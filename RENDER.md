# Render deployment

The web service must use a persistent Render PostgreSQL database. The local SQLite fallback is only for development.

## Setup

1. In Render, create a PostgreSQL database in the same region as the web service.
2. Open the PostgreSQL database and copy its **Internal Database URL**.
3. Open the web service settings and add an environment variable:

   `DATABASE_URL=<Internal Database URL>`

4. Deploy the service again. On startup, the application creates missing tables and seeds initial questions/specialties when their tables are empty.

5. Admin login credentials and the API token are defined in `backend/main.py`. Change them there if needed, then deploy the updated source.

The service must install the root `requirements.txt` (or `backend/requirements.txt`) and start with a command equivalent to:

```text
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

If `DATABASE_URL` is missing on Render, the application now fails with an explicit error instead of writing data to temporary SQLite storage.
For security, keep the GitHub repository private when credentials are stored in source code. Anyone who can read the source can see them.

## Important

Do not use `sqlite:///backend/app.db` as the production database on a Render Web Service. Its filesystem is not persistent across service replacement or redeploy. Keep SQLite for local development only.
