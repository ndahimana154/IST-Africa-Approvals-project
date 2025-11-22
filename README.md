## Procure-to-Pay System

Full-stack procurement workflow covering request creation, multi-level approvals, finance validations, and AI-assisted document processing.

### Features

- Django REST API with JWT auth and role-based permissions (staff, approvers, finance)
- Multi-level approval workflow with concurrency-safe transitions and PO auto-generation
- File uploads for proformas, purchase orders, and receipts with AI/OCR metadata extraction
- React dashboard experiences for staff, approvers, and finance teams
- Dockerized deployment with PostgreSQL and production-ready configs (no Redis required)
- Swagger docs (`/swagger/`) plus Postman collection (`docs/postman_collection.json`)

### Tech Stack

- Backend: Django 5 + DRF + drf-yasg + SimpleJWT
- Frontend: React 18 + Vite + Axios + React Router
- Database: PostgreSQL
- AI/OCR: pdfplumber + pytesseract fallbacks
- Containerization: Docker & docker-compose

### Upgrades Made (summary)

- Added PostgreSQL-first configuration and environment-driven DB config (`POSTGRES_*`).
- Integrated Celery for background jobs and task queue (`core.celery`, `procurement.tasks`) using in-memory broker/backend for dev/test.
- Centralized error handling and DRF `EXCEPTION_HANDLER` with structured responses.
- Enhanced logging configuration (console friendly, configurable level).
- Added in-memory caching for dev/test (no Redis required).
- API schema and docs improved with `drf-spectacular` (OpenAPI) while keeping Swagger UI.
- Pagination, filtering (`django-filter`), throttling (rate limiting), and improved DRF defaults.
- File storage readiness (S3 support via `django-storages`) and safer upload permissions.
- Frontend: added `zod` + `@hookform/resolvers` for validation and `vitest` for testing setup; dark mode and accessibility styles.
- CI workflows for backend and frontend in `.github/workflows/`.

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

**Note:** Redis is no longer required. Caching and Celery use in-memory backends for local/dev. For production, configure a persistent cache/broker as needed.

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
