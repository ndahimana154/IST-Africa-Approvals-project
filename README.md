## Procure-to-Pay System

Full-stack procurement workflow covering request creation, multi-level approvals, finance validations, and AI-assisted document processing.

### Features
- Django REST API with JWT auth and role-based permissions (staff, approvers, finance)
- Multi-level approval workflow with concurrency-safe transitions and PO auto-generation
- File uploads for proformas, purchase orders, and receipts with AI/OCR metadata extraction
- React dashboard experiences for staff, approvers, and finance teams
- Dockerized deployment with PostgreSQL, optional Redis cache, and production-ready configs
- Swagger docs (`/swagger/`) plus Postman collection (`docs/postman_collection.json`)

### Tech Stack
- Backend: Django 5 + DRF + drf-yasg + SimpleJWT
- Frontend: React 18 + Vite + Axios + React Router
- Database: PostgreSQL
- AI/OCR: pdfplumber + pytesseract fallbacks
- Containerization: Docker & docker-compose

### Getting Started (Local)
1. **Backend**
   ```bash
   cd backend
   cp env.example .env
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver 0.0.0.0:8000
   ```
2. **Frontend**
   ```bash
   cd frontend
   cp env.example .env
   npm install
   npm run dev -- --host
   ```

### Docker Workflow
```bash
docker-compose up --build
```
The stack exposes:
- API: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- Postgres: `localhost:5432`

### Deployment Notes
- Configure `DJANGO_ALLOWED_HOSTS`, `CSRF` origins, and `VITE_API_BASE_URL`
- Collect static files (`python manage.py collectstatic`)
- For Render/Railway/Fly/AWS: use provided Dockerfiles or run `gunicorn core.wsgi`
- Ensure Tesseract and Poppler binaries are present (Docker image already installs them)

### Testing
```bash
cd backend
pytest
```
(Use Django's test runner or Pytest; add fixtures as needed.)

### Limitations
- Package installation and migrations were not executed in this environment due to sandbox restrictions; run the commands above locally before first launch.

