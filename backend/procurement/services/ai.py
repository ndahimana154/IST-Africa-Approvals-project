import io
import json
import re
from decimal import Decimal
from typing import Dict, List
from django.conf import settings

try:
    import requests
except Exception:  # pragma: no cover
    requests = None

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    pdfplumber = None

try:
    import pytesseract
    from PIL import Image
except ImportError:  # pragma: no cover
    pytesseract = None
    Image = None


def _read_file_bytes(django_file) -> bytes:
    django_file.seek(0)
    data = django_file.read()
    django_file.seek(0)
    return data


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    if not pdfplumber:
        return ""
    text = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text.append(page.extract_text() or "")
    return "\n".join(text)


def _extract_text_with_ocr(file_bytes: bytes) -> str:
    if not (pytesseract and Image):
        return ""
    image = Image.open(io.BytesIO(file_bytes))
    return pytesseract.image_to_string(image)


def extract_text(file_obj) -> str:
    file_bytes = _read_file_bytes(file_obj)
    if file_obj.name.lower().endswith(".pdf"):
        return _extract_text_from_pdf(file_bytes)
    return _extract_text_with_ocr(file_bytes)


def _parse_currency_candidates(text: str) -> List[Decimal]:
    amounts = []
    for match in re.findall(r"(?:USD|R|KES|UGX|ZAR|GBP|EUR)?\\s?([0-9]+(?:\\.[0-9]{2})?)", text):
        try:
            amounts.append(Decimal(match))
        except Exception:  # pragma: no cover
            continue
    return amounts


def extract_proforma_data(file_obj) -> Dict:
    """
    Extract rudimentary metadata from a proforma document.
    Falls back to heuristic parsing when AI services are unavailable.
    """
    text = extract_text(file_obj)
    vendor = re.search(r"Vendor[:\\s]+(.+)", text)
    items = re.findall(r"(?:Item|Product)[:\\s]+(.+)", text)
    totals = _parse_currency_candidates(text)

    result = {
        "vendor": vendor.group(1).strip() if vendor else "Unknown Vendor",
        "items": [item.strip() for item in items][:10],
        "total_estimate": str(totals[-1]) if totals else "0.00",
        "raw_text": text[:5000],
    }

    # Optionally refine using LLM extraction
    try:
        refined = llm_refine_extraction(text)
        if refined.get('vendor'):
            result['vendor'] = refined['vendor']
        if refined.get('items'):
            result['items'] = refined['items']
        if refined.get('total_estimate'):
            result['total_estimate'] = refined['total_estimate']
    except Exception:
        pass

    return result


def llm_refine_extraction(raw_text: str) -> Dict:
    """
    Optionally call an LLM (OpenAI-compatible) to refine extracted fields.
    Controlled via settings: set `USE_LLM_EXTRACT = True` and `OPENAI_API_KEY`.
    Returns a dict with possible keys: vendor, items, total_estimate
    """
    if not getattr(settings, 'USE_LLM_EXTRACT', False):
        return {}
    api_key = getattr(settings, 'OPENAI_API_KEY', None)
    if not api_key or requests is None:
        return {}

    prompt = (
        "Extract vendor name, list of items (as short descriptions), and total amount "
        "from the following document text. Return a JSON object with keys: vendor, items, total_estimate.\n\n" + raw_text
    )

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
                "max_tokens": 500,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data['choices'][0]['message']['content']
        # try to parse JSON from the assistant
        j = re.search(r"\{[\s\S]*\}", text)
        if j:
            parsed = json.loads(j.group(0))
            return {
                'vendor': parsed.get('vendor'),
                'items': parsed.get('items'),
                'total_estimate': parsed.get('total_estimate'),
            }
    except Exception:
        return {}
    return {}


def generate_purchase_order_metadata(purchase_request, vendor_data=None) -> Dict:
    vendor_data = vendor_data or {}
    return {
        "purchase_request_id": purchase_request.id,
        "title": purchase_request.title,
        "amount": str(purchase_request.amount),
        "vendor": vendor_data.get("vendor", "Unknown Vendor"),
        "items": vendor_data.get("items", []),
        "total_estimate": vendor_data.get("total_estimate", str(purchase_request.amount)),
    }


def compare_receipt_to_po(purchase_request, receipt_data: Dict) -> Dict:
    po_total = Decimal(purchase_request.purchase_order_metadata.get("total_estimate", "0"))
    receipt_total = Decimal(receipt_data.get("total", "0"))
    difference = receipt_total - po_total
    return {
        "po_total": str(po_total),
        "receipt_total": str(receipt_total),
        "difference": str(difference),
        "matches": abs(difference) <= Decimal("1.00"),
    }


def extract_receipt_data(file_obj) -> Dict:
    text = extract_text(file_obj)
    totals = _parse_currency_candidates(text)
    return {
        "total": str(totals[-1]) if totals else "0.00",
        "raw_text": text[:5000],
    }


def serialize_metadata(metadata: Dict) -> bytes:
    return json.dumps(metadata, indent=2).encode("utf-8")

