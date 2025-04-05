# backend/app/database.py
import duckdb
import os
from flask import g # Import Flask's context global 'g'
from .config import Config

# Ensure the data directory exists
data_dir = os.path.dirname(Config.DB_PATH)
if not os.path.exists(data_dir):
    os.makedirs(data_dir)

def get_db_connection():
    """
    Connects to the DuckDB database for the current application context.
    If a connection doesn't exist for this context, it creates one.
    """
    # Check if a connection exists in the current context (g)
    if '_database' not in g:
        try:
            print(f"CONTEXT: Attempting to connect to DuckDB at: {Config.DB_PATH}")
            # Store the connection in the current context (g)
            g._database = duckdb.connect(database=Config.DB_PATH, read_only=False)
            print("CONTEXT: DuckDB connection successful.")
        except Exception as e:
            print(f"CONTEXT: Error connecting to DuckDB: {e}")
            g._database = None # Ensure it's None on failure
            raise # Reraise the exception

    if g._database is None:
         raise ConnectionError("CONTEXT: Failed to establish database connection.")

    return g._database

def close_db_connection(exception=None):
    """Closes the database connection stored in the current application context (g)."""
    db = g.pop('_database', None) # Get connection from g, removing it

    if db is not None:
        print("CONTEXT: Closing DuckDB connection.")
        db.close()

# We still need init_app or similar registration if we want to ensure
# close_db_connection is called automatically.
# The registration in app/__init__.py using app.teardown_appcontext(close_db_connection)
# handles this - ensure that line is still present in app/__init__.py

print("DuckDB database module loaded (Using Flask g context)")