# Render deployment

The web service must use a persistent Render PostgreSQL database. The local SQLite fallback is only for development.

## Setup

1. In Render, create a PostgreSQL database in the same region as the web service.
2. Open the PostgreSQL database and copy its **Internal Database URL**.
3. Open the web service settings and add an environment variable:

   `DATABASE_URL=<Internal Database URL>`

4. Deploy the service again. On startup, the application creates missing tables and seeds initial questions/specialties when their tables are empty.

5. In the web service's **Environment** settings, configure admin credentials:

   - `ADMIN_USERNAME` — administrator login.
   - `ADMIN_PASSWORD` — a strong, unique administrator password.
   - `ADMIN_TOKEN` — a separate, long random secret used to authorize admin API requests.

   These values are intentionally not stored in the source code. If any are missing, the admin login endpoint returns a configuration error. Save the environment changes and redeploy the service.

The service must install the root `requirements.txt` (or `backend/requirements.txt`) and start with a command equivalent to:

```text
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

If `DATABASE_URL` is missing on Render, the application now fails with an explicit error instead of writing data to temporary SQLite storage.
Admin access is disabled until all three admin environment variables above are configured.

## Important

Do not use `sqlite:///backend/app.db` as the production database on a Render Web Service. Its filesystem is not persistent across service replacement or redeploy. Keep SQLite for local development only.
