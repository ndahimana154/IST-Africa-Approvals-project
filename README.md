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
   cp .env.example .env            # copy the example env and edit values
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   # set up the database and run migrations
   python manage.py migrate
   # optional: create a superuser or use the seed command to create demo roles
   python manage.py createsuperuser
   # OR use provided seed command which creates groups and an admin user:
   # python manage.py seed_data
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

### Important notes about accounts & roles

- New user sign-ups through the public `auth/register/` endpoint are created with the `staff` role by default. If you want to create users with `approver` or `finance` roles, you must assign those roles via the Django admin interface (`/admin/`) or create them programmatically.
- The repository includes a management command `python manage.py seed_data` which will create the basic groups (`staff`, `approver`, `finance`, `admin`) and a demo superuser `admin` with password `adminpass` if that username does not already exist. Change that password immediately after first login.

### Cloudinary (optional client-side uploads)

- The frontend supports direct uploads to Cloudinary using an unsigned upload preset. To enable, create a `.env` file in `frontend/` with these values:

```
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_CLOUDINARY_NAME=
VITE_API_BASE_URL=
```

- When configured, the client will upload attachments and receipts directly to Cloudinary, then the backend stores the returned `external_url` and uses it for previews and downloads. If you do not set these values, the frontend falls back to multipart uploads to the backend.

### File previews and downloads

- The frontend includes an in-app `DocumentViewer` (PDF/image preview) that opens receipts, POs and attachments. Previewing depends on the remote host's CORS settings. For reliable downloads the backend proxies external attachments and streams them with `Content-Disposition` headers.

### Production recommendations

- Use a persistent message broker (Redis/RabbitMQ) and result backend for Celery in production.
- Use S3 (or other cloud object storage) for media with proper CORS and signed URLs.
- Secure Cloudinary upload presets or use a signed upload flow if you handle sensitive documents.
