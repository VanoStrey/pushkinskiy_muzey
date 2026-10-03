"""CLI script to import official Pushkin Museum routes into the database."""

import sys
from pathlib import Path

# Add backend directory to sys.path so app imports work
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.db import create_driver
import ydb
from app.services.official_routes_importer import import_official_routes


def main():
    print("=== Pushkin Museum Official Routes Importer ===")
    print(f"YDB Endpoint: {settings.ydb_endpoint or 'Not configured (using memory fallback)'}")
    print(f"YDB Database: {settings.ydb_database or 'Not configured'}")

    driver = create_driver(settings)
    pool = ydb.QuerySessionPool(driver) if driver else None

    try:
        routes = import_official_routes(pool)
        print(f"Successfully imported {len(routes)} official museum routes:")
        for r in routes:
            print(f" - [{r.id}] {r.title} ({len(r.stops)} остановок, {len(r.exhibit_ids)} привязано, статус: {r.verification_status}, полнота: {int(r.completeness_score*100)}%)")
            print(f"   URL: {r.source_url}")
            print(f"   Seq Hash: {r.sequence_hash[:16]}... | Set Hash: {r.set_hash[:16]}...")
    finally:
        if pool:
            pool.stop()
        if driver:
            driver.stop(timeout=1)

    print("Import finished successfully.")


if __name__ == "__main__":
    main()
