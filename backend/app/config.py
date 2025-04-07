import os
from dotenv import load_dotenv

# Load environment variables from .env file
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')) # Points to backend/
load_dotenv(os.path.join(basedir, '.env'))

class Config:
    """Set Flask configuration variables from .env file."""

    # General Config
    SECRET_KEY = os.environ.get('SECRET_KEY', 'a-default-secret-key-for-dev')
    FLASK_APP = os.environ.get('FLASK_APP', 'run.py')
    FLASK_ENV = os.environ.get('FLASK_ENV', 'development') # development or production

    # Database - We'll refine this later for SQLite/DuckDB
    # SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
    #     'sqlite:///' + os.path.join(basedir, 'app.db')
    # SQLALCHEMY_TRACK_MODIFICATIONS = False
    DB_PATH = os.path.join(basedir, 'data', 'stocks.db') # Example path if using SQLite/DuckDB directly

    # API Keys
    UPSTOX_API_KEY = os.environ.get('UPSTOX_API_KEY')
    UPSTOX_API_SECRET = os.environ.get('UPSTOX_API_SECRET')
    UPSTOX_REDIRECT_URI = os.environ.get('UPSTOX_REDIRECT_URI')
    UPSTOX_ACCESS_TOKEN = os.environ.get('UPSTOX_ACCESS_TOKEN')
    # Add other API keys as needed (e.g., for yFinance if needed, or other brokers)

    # Create data directory if it doesn't exist
    data_dir = os.path.join(basedir, 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)

    print("Config loaded") # Temporary check