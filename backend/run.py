# This file is the main entry point to run the Flask application.
import sys
print("--- run.py ---")
print("SYS.PATH:", sys.path) # See where Python is looking for modules
try:
    import upstox_client
    print("SDK IMPORT OK in run.py")
except Exception as e:
    print(f"SDK IMPORT FAIL in run.py: {e}")
print("--------------")

from app import app # Import the app instance from our app package

if __name__ == '__main__':
    # Runs the Flask development server
    # Debug=True enables auto-reloading and provides detailed error pages
    # Use host='0.0.0.0' to make the server accessible on your network
    print("Starting Flask development server...")
    app.run(debug=True, host='127.0.0.1', port=5000) # Port 5000 is common for Flask backends