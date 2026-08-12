"""
Helper to run Alembic commands programmatically from the project.
Usage examples:
  python backend/manage_migrations.py revision --autogenerate -m "initial"
  python backend/manage_migrations.py upgrade head
This requires `alembic` installed (pip install alembic).
"""
import sys
from alembic.config import CommandLine

if __name__ == '__main__':
    # forward args to alembic CLI using alembic.ini in backend/
    argv = ['-c', 'backend/alembic.ini'] + sys.argv[1:]
    sys.exit(CommandLine().main(argv))
