# backend/app/__init__.py
import os
from flask import Flask
from flask_cors import CORS # Import CORS
from .config import Config
from app.database import close_db_connection
# Import necessary functions/objects needing context
from app.stocks.repository import initialize_database
from app.stocks.manager import stock_manager

# Create and configure the app
app = Flask(__name__)
app.config.from_object(Config)
CORS(app) # Initialize CORS for the app - allows all origins by default for now


# Optional: Register database connection closing (still correct)
app.teardown_appcontext(close_db_connection)

# --- Perform Initialization within App Context ---
with app.app_context():
    # Initialize database tables
    try:
        initialize_database() # This call now happens within the context
    except Exception as e:
         print(f"CRITICAL: Database initialization failed: {e}")
         # Decide how to handle this

    # Ensure Default Stock Exists
    try:
        print("Ensuring default stock 'RELIANCE/NSE' metadata exists...")
        # This call also needs the context as it uses the repository/db connection
        stock_manager.ensure_stock_metadata('RELIANCE', 'NSE')
    except Exception as e:
        print(f"WARNING: Could not ensure default stock exists on startup: {e}")
# --- End App Context Block ---


# Import and register blueprints AFTER app is created and context-dependent init is done
from .stocks import routes as stock_routes
app.register_blueprint(stock_routes.stocks_bp, url_prefix='/api/stocks')

@app.route('/hello')
def hello():
    """Simple test route."""
    return "Hello from Flask Backend!"

print("Flask app created and configured. Stocks Blueprint registered.")