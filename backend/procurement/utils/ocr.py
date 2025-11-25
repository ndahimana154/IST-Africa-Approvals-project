"""
OCR and text extraction utilities for proforma processing.
Supports PDF and image extraction with structured data parsing.
"""
import io
import json
import re
from decimal import Decimal

import pdfplumber
import pytesseract
from django.core.files.uploadedfile import UploadedFile
from PIL import Image


def extract_text_from_image(file: UploadedFile) -> str:
    """
    Extract text from image file using Tesseract OCR.
    
    Args:
        file: Uploaded image file (JPG, PNG, etc.)
    
    Returns:
        Extracted text string
    """
    try:
        # Read image from uploaded file
        image = Image.open(file)
        # Use pytesseract to extract text
        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception as e:
        print(f"Error extracting text from image: {e}")
        return ""


def extract_text_from_pdf(file: UploadedFile) -> str:
    """
    Extract text from PDF file using pdfplumber.
    
    Args:
        file: Uploaded PDF file
    
    Returns:
        Extracted text string
    """
    try:
        # Read PDF from uploaded file
        pdf_bytes = file.read()
        file.seek(0)  # Reset file pointer
        
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
        
        return text.strip()
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return ""


def parse_proforma_text(text: str) -> dict:
    """
    Parse extracted text from proforma into structured data.
    
    Attempts to identify:
    - Vendor/supplier name
    - Line items (name, qty, unit price, total)
    - Payment terms
    - Grand total
    
    Args:
        text: Extracted text from OCR/PDF
    
    Returns:
        Dictionary with keys: vendor, items, payment_terms, grand_total
    """
    parsed = {
        "vendor": "",
        "items": [],
        "payment_terms": "",
        "grand_total": ""
    }
    
    if not text:
        return parsed
    
    lines = text.split('\n')
    cleaned_lines = [line.strip() for line in lines if line.strip()]
    
    # ===== VENDOR EXTRACTION =====
    # Look for "Vendor:" prefix or similar
    vendor_keywords = ['vendor:', 'from:', 'supplier:', 'company:', 'bill from:']
    for i, line in enumerate(cleaned_lines[:20]):
        lower_line = line.lower()
        for kw in vendor_keywords:
            if kw in lower_line:
                # Extract everything after the keyword
                parsed['vendor'] = line.split(kw, 1)[-1].strip()
                break
        if parsed['vendor']:
            break
    
    # Fallback: if not found, check for "Vendor: <name>" pattern anywhere
    if not parsed['vendor']:
        for line in cleaned_lines:
            if line.lower().startswith('vendor'):
                parsed['vendor'] = line.split(':', 1)[-1].strip() if ':' in line else line[6:].strip()
                break
    
    # ===== ITEMS EXTRACTION =====
    # Look for numbered items (1. Item Name – Qty: X – Unit Price: $Y pattern)
    # or lines with format: "Item Description – Qty: # – Unit Price: $price"
    item_pattern = re.compile(
        r'^\d+\.\s*(.+?)\s*[–-]\s*Qty:\s*(\d+)\s*[–-]\s*Unit Price:\s*\$?([\d.]+)',
        re.IGNORECASE
    )
    
    for line in cleaned_lines:
        match = item_pattern.match(line)
        if match:
            name, qty, unit_price = match.groups()
            parsed['items'].append({
                "name": name.strip(),
                "qty": qty,
                "unit_price": unit_price,
                "total_price": str(float(qty) * float(unit_price))  # Calculate total
            })
    
    # Fallback: if no structured items found, try simpler pattern
    if not parsed['items']:
        for line in cleaned_lines:
            # Look for lines with "–" or "-" separators and numbers
            if ('–' in line or '- Qty:' in line) and re.search(r'\$?\d+', line):
                # Try to extract: name, qty, price
                parts = re.split(r'[–-]', line)
                if len(parts) >= 2:
                    name = parts[0].strip()
                    # Remove leading numbers (1., 2., etc.)
                    name = re.sub(r'^\d+\.\s*', '', name)
                    
                    # Extract qty and price from remaining parts
                    remaining = ' '.join(parts[1:])
                    qty_match = re.search(r'Qty:\s*(\d+)', remaining)
                    price_match = re.search(r'Unit Price:\s*\$?([\d.]+)', remaining)
                    
                    if qty_match and price_match:
                        qty = qty_match.group(1)
                        unit_price = price_match.group(1)
                        parsed['items'].append({
                            "name": name,
                            "qty": qty,
                            "unit_price": unit_price,
                            "total_price": str(float(qty) * float(unit_price))
                        })
    
    # ===== PAYMENT TERMS EXTRACTION =====
    # Look for lines containing "Payment Terms:" or similar
    for line in cleaned_lines:
        lower_line = line.lower()
        if 'payment' in lower_line and ('term' in lower_line or 'due' in lower_line or 'day' in lower_line):
            parsed['payment_terms'] = line.strip()
            break
    
    # ===== GRAND TOTAL EXTRACTION =====
    # Look for "Grand Total:" or "Total:" with a currency amount
    for line in cleaned_lines:
        lower_line = line.lower()
        if 'grand total' in lower_line:
            # Extract the number (currency-prefixed or not)
            amount_match = re.search(r'\$?([\d,]+\.?\d*)', line)
            if amount_match:
                parsed['grand_total'] = amount_match.group(1).replace(',', '')
            break
    
    # Fallback: look for "Total:" if "Grand Total" not found
    if not parsed['grand_total']:
        for line in reversed(cleaned_lines):
            if line.lower().strip().startswith('total:'):
                amount_match = re.search(r'\$?([\d,]+\.?\d*)', line)
                if amount_match:
                    parsed['grand_total'] = amount_match.group(1).replace(',', '')
                break
    
    # Last resort: find the largest currency amount in the document
    if not parsed['grand_total']:
        all_amounts = re.findall(r'\$?([\d,]+\.\d{2})', text)  # Amounts like 1,234.56
        if all_amounts:
            # Convert to float, find max
            amounts = [float(a.replace(',', '')) for a in all_amounts]
            parsed['grand_total'] = str(max(amounts))
    
    return parsed


def extract_proforma_data(file: UploadedFile) -> dict:
    """
    Main function: detect file type, extract text, and parse into structured data.
    
    Args:
        file: Uploaded proforma file (PDF or image)
    
    Returns:
        Dictionary with extracted_data and status
    """
    try:
        # Detect file type
        filename = file.name.lower()
        is_pdf = filename.endswith('.pdf')
        is_image = any(filename.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'])
        
        print(f"[OCR DEBUG] Processing file: {filename}, is_pdf={is_pdf}, is_image={is_image}")
        
        # Extract text based on file type
        extracted_text = ""
        if is_pdf:
            extracted_text = extract_text_from_pdf(file)
            print(f"[OCR DEBUG] PDF extraction completed, extracted {len(extracted_text)} characters")
        elif is_image:
            extracted_text = extract_text_from_image(file)
            print(f"[OCR DEBUG] Image extraction completed, extracted {len(extracted_text)} characters")
        else:
            error_msg = "Unsupported file type. Please upload a PDF or image."
            print(f"[OCR DEBUG] {error_msg}")
            return {
                "status": "error",
                "message": error_msg,
                "extracted_data": {}
            }
        
        # Parse structured data
        parsed_data = parse_proforma_text(extracted_text)
        
        return {
            "status": "success",
            "message": "Proforma processed successfully",
            "extracted_data": parsed_data,
            "raw_text": extracted_text[:500]  # Store first 500 chars for debugging
        }
    except Exception as e:
        error_msg = f"Extraction error: {str(e)}"
        print(f"[OCR ERROR] {error_msg}")
        return {
            "status": "error",
            "message": error_msg,
            "extracted_data": {}
        }
