# Project Setup Guide: Modular Web-Based Indian Stock Market Analysis

This guide provides step-by-step instructions to set up the development environment for the Stock Market Analysis application on a new machine.

**Current Date:** Saturday, April 5, 2025

## 1. Prerequisites

Before you begin, ensure you have the following installed on your system:

* **Python:** Version 3.10+ recommended ([Download](https://www.python.org/downloads/)). Ensure Python and `pip` are in PATH.
* **Node.js & npm:** LTS version recommended ([Download](https://nodejs.org/)). Ensure Node.js and `npm` are in PATH.
* **Yarn (Recommended for Frontend):** Install globally via `npm install -g yarn`. Yarn was needed to work around some npm installation issues during development.
* **Git:** ([Download](https://git-scm.com/downloads/)).
* **Code Editor:** e.g., VS Code ([Download](https://code.visualstudio.com/)).

## 2. Getting Started

1.  **Clone Repository:**
    ```bash
    git clone <repository-url>
    cd <project-directory-name> # e.g., cd trade_app
    ```
2.  **Navigate to Project Root:** All subsequent commands assume your terminal is in the project root (e.g., `E:\trade_app`) unless specified otherwise.

## 3. Backend Setup (Python / Flask)

1.  **Create Virtual Environment:**
    ```bash
    python -m venv venv
    ```
2.  **Activate Environment:**
    * Windows PowerShell: `.\venv\Scripts\Activate.ps1` (May require `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force` first)
    * Windows CMD: `.\venv\Scripts\activate.bat`
    * macOS/Linux: `source venv/bin/activate`
    *(Look for `(venv)` prefix)*
3.  **Install Dependencies:**
    ```bash
    # Make sure (venv) is active
    pip install -r backend\requirements.txt
    ```
    *Key dependencies:* `Flask`, `Flask-CORS`, `python-dotenv`, `duckdb`, `pandas`, `numpy~=1.23` (pinned), `yfinance`, `pandas-ta==0.3.14b0` (pinned).
4.  **Create `.env` File:**
    * Create `backend\.env`.
    * Add necessary variables (replace placeholders):
        ```text
        # backend/.env
        SECRET_KEY='generate_a_strong_random_secret_key'
        FLASK_APP='run.py'
        FLASK_ENV='development'
        UPSTOX_API_KEY=''
        UPSTOX_API_SECRET=''
        UPSTOX_REDIRECT_URI=''
        ```

## 4. Frontend Setup (React / Vite / Tailwind)

1.  **Navigate to Frontend Directory:**
    ```bash
    cd frontend
    ```
2.  **Install Node.js Dependencies (Using Yarn Recommended):**
    * Clean up first (optional but recommended):
        ```bash
        # Inside frontend directory
        Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
        Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
        Remove-Item -Force yarn.lock -ErrorAction SilentlyContinue
        ```
    * Install using Yarn:
        ```bash
        yarn install
        ```
    * *(Alternative) Install using npm:*
        ```bash
        # npm install
        ```
    *Key dependencies:* `react`, `react-dom`, `vite`, `lightweight-charts@^4.1.0` (pinned), `tailwindcss`, `postcss`, `autoprefixer`, `@tailwindcss/postcss`.

3.  **Configure Tailwind CSS (Manual Setup Required):**
    * **Background:** During development, the standard `npx tailwindcss init -p` or `yarn tailwindcss init -p` commands failed to run because the executable was not correctly linked in `node_modules/.bin` after installation (tested with both npm and Yarn on Windows).
    * **Workaround:** Manually create the configuration files:
        * **Create `frontend/postcss.config.js`** with this content:
            ```javascript
            // frontend/postcss.config.js
            export default {
              plugins: {
                '@tailwindcss/postcss': {}, // Use the required package for v4
                autoprefixer: {},
              },
            }
            ```
        * **Create `frontend/tailwind.config.js`** with this content:
            ```javascript
            // frontend/tailwind.config.js
            /** @type {import('tailwindcss').Config} */
            export default {
              content: [
                "./index.html",
                "./src/**/*.{js,ts,jsx,tsx}", // Scan src files
              ],
              theme: {
                extend: {},
              },
              plugins: [],
            }
            ```
    * **Configure `frontend/src/index.css`:** Ensure this file **only** contains the following:
        ```css
        /* frontend/src/index.css */
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
        ```

## 5. Database Setup

* The DuckDB database file (`backend/data/stocks.db`) and required tables are created automatically by the backend on first run. No manual setup needed.

## 6. Running the Application

Run the backend and frontend simultaneously in **two separate terminals**.

1.  **Terminal 1 (Backend):**
    ```bash
    # In project root (e.g., E:\trade_app)
    .\venv\Scripts\Activate.ps1  # Activate Python venv
    python backend/run.py        # Run Flask server
    ```
    * _Server runs at `http://127.0.0.1:5000`_

2.  **Terminal 2 (Frontend):**
    ```bash
    # In project root (e.g., E:\trade_app)
    cd frontend
    yarn dev # Or npm run dev if you used npm
    ```
    * _Server runs at `http://localhost:5173` (or similar - check output)_

3.  **Access App:** Open your browser to the frontend URL (e.g., `http://localhost:5173`).

## 7. Troubleshooting

* **PowerShell Execution Policy:** Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force` if activating venv fails.
* **Command Not Found (node, npm, yarn, python, pip):** Ensure prerequisites are installed and added to your system's PATH. Restart terminals after installation.
* **Frontend Errors/Blank Screen:** Check the Browser Developer Console (F12) for JavaScript errors.
* **CORS Errors:** Ensure `Flask-CORS` is installed in backend venv and `CORS(app)` is initialized in `backend/app/__init__.py`.
* **`yfinance` Failures:** Data fetching might fail for specific tickers (like `RELIANCE.NSE`) due to issues with unofficial Yahoo Finance APIs. Test with other tickers (`INFY.NS`, `AAPL`) or implement alternative data sources (Upstox, nsepy).
* **Tailwind `init` Command Fails:** Use the manual configuration file creation method described in the Frontend Setup section. If styling doesn't work after manual setup, ensure config files are correct, `index.css` has directives, and restart the frontend dev server.