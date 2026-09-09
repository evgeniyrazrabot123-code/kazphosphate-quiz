from pathlib import Path
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "app.db"
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

# Read database URL from environment, fallback to local sqlite
# SQLite is convenient for local development, but Render's service filesystem is
# ephemeral. Require an external database there instead of silently losing data.
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
# Render values are sometimes pasted with surrounding quotes. Remove only a
# matching pair so the URL parser receives the actual connection string.
if len(DATABASE_URL) >= 2 and DATABASE_URL[0] == DATABASE_URL[-1] and DATABASE_URL[0] in {"'", '"'}:
    DATABASE_URL = DATABASE_URL[1:-1].strip()
IS_RENDER = bool(os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID"))
if IS_RENDER and not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is required on Render. Create a Render PostgreSQL database "
        "and add its Internal Database URL to the web service environment."
    )

SQLALCHEMY_DATABASE_URL = DATABASE_URL or f"sqlite:///{DATABASE_PATH}"

# Some providers use the old postgres:// scheme which SQLAlchemy may warn about
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Create engine differently for sqlite vs other DBs
if SQLALCHEMY_DATABASE_URL.startswith("sqlite:"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )

    # Improve SQLite durability and behavior on connect
    @event.listens_for(engine, "connect")
    def _sqlite_configure(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.close()
        except Exception:
            pass
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()