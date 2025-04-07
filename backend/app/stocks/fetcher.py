# backend/app/stocks/fetcher.py
# FINAL v7 - Fixed basedir error, added cache refresh, fixed yf tickers

import yfinance as yf
import pandas as pd
from typing import Optional, Dict, List, Any
from datetime import date, timedelta, datetime
import time # Import time for cache age check
import os
import requests
import json
import gzip

# --- Upstox SDK Imports ---
try:
    import upstox_client
    from upstox_client.configuration import Configuration
    from upstox_client.api_client import ApiClient
    from upstox_client.rest import ApiException
    from upstox_client.api.history_api import HistoryApi
    print("Upstox SDK base and HistoryApi imported successfully.")
    UPSTOX_SDK_AVAILABLE = True
except ImportError as e:
    print(f"WARNING: Failed to import Upstox SDK components ({e}). Upstox fetching will fail.")
    upstox_client = None; Configuration = None; ApiClient = None; ApiException = Exception; HistoryApi = None
    UPSTOX_SDK_AVAILABLE = False

# --- App Config ---
# Config import needed ONLY for access token, not basedir anymore
from app.config import Config

print("Stock fetcher module loaded (File Key Lookup v7)")

# --- Interval Mapping ---
# --- Interval Mapping ---
YFINANCE_INTERVAL_MAP = {
    "1D": "1d", "1W": "1wk", "1WK": "1wk", "1M": "1mo", "1MO": "1mo",
    "1H": "1h", # Added Hourly for yfinance
    "60M": "60m", # Alternate yfinance hourly
    "60MIN": "60m",
    # Add 5m, 15m etc later: "5M": "5m", "15M": "15m"
}
UPSTOX_INTERVAL_MAP = {
    "1D": "day", "1W": "week", "1WK": "week", "1M": "month", "1MO": "month",
    "1H": "60minute", # Added Hourly for Upstox (check exact string needed!)
    "60MIN": "60minute",
    # Add "5MIN": "5minute" etc. later
}
# --- Instrument Data Storage ---
_instrument_list_cache: Dict[str, List[Dict[str, Any]]] = {} # {'NSE': [...], 'BSE': [...]}
_instrument_key_cache: Dict[str, Optional[str]] = {} # {'TCS_NSE': 'NSE_EQ|...'}

# --- URLs for Upstox Instrument Files (Verify These!) ---
UPSTOX_INSTRUMENT_URLS = {
    "NSE": "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz",
    "BSE": "https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz",
}
# Correct path calculation for backend/data/ directory
INSTRUMENT_CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data'))


# --- Load/Download Instrument List Function ---
def _load_or_download_instruments(exchange: str) -> Optional[List[Dict[str, Any]]]:
    """Loads instrument list from local cache or downloads if missing/older than a day."""
    global _instrument_list_cache
    exchange_upper = exchange.upper()
    if exchange_upper not in UPSTOX_INSTRUMENT_URLS:
        print(f"Error: No download URL for exchange: {exchange_upper}"); return None

    # Check memory cache
    if exchange_upper in _instrument_list_cache:
        print(f"Using in-memory instrument list cache for {exchange_upper}."); return _instrument_list_cache[exchange_upper]

    # Check file cache
    cache_file_name = f"upstox_{exchange_upper}_instruments.json"
    cache_file_path = os.path.join(INSTRUMENT_CACHE_DIR, cache_file_name)
    needs_download = True # Assume download needed unless valid cache found

    if os.path.exists(cache_file_path):
        try:
            file_mod_time = os.path.getmtime(cache_file_path)
            age_seconds = time.time() - file_mod_time
            # Re-download if older than ~23 hours
            if age_seconds < (23 * 60 * 60):
                print(f"Loading instruments for {exchange_upper} from file cache (age: {age_seconds/3600:.1f} hours)...")
                with open(cache_file_path, 'r', encoding='utf-8') as f:
                    instrument_list = json.load(f)
                print(f"Loaded {len(instrument_list)} instruments from file.")
                _instrument_list_cache[exchange_upper] = instrument_list # Store in memory
                return instrument_list # Return cached data
            else:
                 print(f"Cache file for {exchange_upper} is older than 1 day. Re-downloading...")
                 needs_download = True # Explicitly set
        except Exception as e:
            print(f"Error reading/checking cache file {cache_file_path}: {e}. Will attempt download.")
            needs_download = True

    # Download if needed
    if needs_download:
        url = UPSTOX_INSTRUMENT_URLS[exchange_upper]
        print(f"Downloading instrument list for {exchange_upper} from {url}...")
        try:
            headers = {'Accept-Encoding': 'gzip, deflate'}
            response = requests.get(url, headers=headers, timeout=60)
            response.raise_for_status()
            # Use response.content for manual gzip handling
            try:
                 decompressed_bytes = gzip.decompress(response.content)
                 json_data = json.loads(decompressed_bytes.decode('utf-8'))
                 print("Manual gzip decompression successful.")
            except Exception as gz_err:
                 print(f"Manual gzip decompression failed: {gz_err}, trying response.text...")
                 # Fallback to requests' automatic decoding (might fail if headers wrong)
                 json_data = response.json()
                 print("Used response.text fallback.")


            if not isinstance(json_data, list):
                 print(f"Error: Downloaded data for {exchange_upper} is not a JSON list."); return None

            _instrument_list_cache[exchange_upper] = json_data # Store in memory
            print(f"Successfully downloaded/parsed {len(json_data)} instruments for {exchange_upper}.")

            # Save to file cache
            try:
                 os.makedirs(INSTRUMENT_CACHE_DIR, exist_ok=True)
                 with open(cache_file_path, 'w', encoding='utf-8') as f: json.dump(json_data, f)
                 print(f"Saved instrument list to cache file: {cache_file_path}")
            except Exception as e: print(f"Warning: Could not save cache file {cache_file_path}: {e}")

            return json_data
        except requests.exceptions.RequestException as e: print(f"Error downloading instrument list for {exchange_upper}: {e}"); return None
        except Exception as e: print(f"Error processing downloaded instrument list for {exchange_upper}: {e}"); return None
    # This part should not be reached if needs_download was false and file load succeeded
    return None # Should not happen in normal flow

# --- Instrument Key Lookup (Uses File/Cache) ---
def get_instrument_key(symbol: str, exchange: str) -> Optional[str]:
    """Gets Upstox instrument key by searching downloaded/cached list."""
    exchange = exchange.upper(); symbol = symbol.upper()
    # Use consistent cache key format, mapping NS to NSE
    upstox_exchange = "NSE" if exchange in ["NSE", "NS"] else ("BSE" if exchange == "BSE" else None)
    if not upstox_exchange: print(f"Warning: Exchange '{exchange}' not supported."); return None

    cache_key = f"{symbol}_{upstox_exchange}" # Use mapped exchange in key
    if cache_key in _instrument_key_cache: return _instrument_key_cache[cache_key]

    instruments = _load_or_download_instruments(upstox_exchange)
    if not instruments: print(f"Error: Could not load instrument list for {upstox_exchange}."); _instrument_key_cache[cache_key] = None; return None

    print(f"DEBUG Upstox Key: Searching list ({len(instruments)}) for {symbol}/{upstox_exchange} (EQ)...")
    found_key = None
    segment_prefix = f"{upstox_exchange}_EQ" # e.g., NSE_EQ
    for instrument in instruments:
        inst_exch = instrument.get('exchange', '').upper()
        inst_symbol = instrument.get('trading_symbol', '').upper()
        inst_type = instrument.get('instrument_type', '').upper()
        inst_segment = instrument.get('segment', '').upper()
        # Match criteria
        if (inst_exch == upstox_exchange and inst_symbol == symbol and inst_type == 'EQ' and inst_segment == segment_prefix):
             found_key = instrument.get('instrument_key'); print(f"DEBUG Upstox Key: Found match! Key={found_key}..."); break

    print(f"DEBUG Upstox Key: Search finished. Found key: {found_key}")
    _instrument_key_cache[cache_key] = found_key; return found_key


# --- fetch_stock_data_upstox (No changes needed inside) ---
def fetch_stock_data_upstox(symbol: str, exchange: str, interval: str, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
    # ... (Keep implementation from previous step, it calls the updated get_instrument_key) ...
    if not UPSTOX_SDK_AVAILABLE: print("Error: Cannot fetch Upstox data, SDK not available."); return None
    if not HistoryApi: print("Error: Cannot fetch Upstox data, SDK HistoryApi not available."); return None
    print(f"Attempting fetch from Upstox for {symbol}/{exchange} ({interval}) [{start_date} to {end_date}]")
    instrument_key = get_instrument_key(symbol, exchange) # Uses file based lookup now
    if not instrument_key: print(f"Error: Could not find/lookup Upstox instrument key for {symbol}/{exchange}."); return None
    upstox_interval = UPSTOX_INTERVAL_MAP.get(interval.upper())
    if not upstox_interval: print(f"Error: Unsupported interval for Upstox fetch: {interval}"); return None
    access_token = Config.UPSTOX_ACCESS_TOKEN
    if not access_token: print("Error: Upstox Access Token not configured."); return None
    try:
        configuration = Configuration(); configuration.access_token = access_token
        configuration.api_key['api-version'] = '2.0'; api_client = ApiClient(configuration)
        history_instance = HistoryApi(api_client)
        api_version = "2.0"
        print(f"DEBUG Upstox: Calling history_instance.get_historical_candle_data1(...) key={instrument_key}, interval={upstox_interval}")
        api_response = history_instance.get_historical_candle_data1(
            instrument_key=instrument_key, interval=upstox_interval, to_date=end_date, from_date=start_date, api_version=api_version
        )
        if (not api_response or getattr(api_response, 'status', 'error') != 'success' or not getattr(api_response, 'data', None) or not getattr(api_response.data, 'candles', None)): print(f"Error/empty data from Upstox API for {symbol}/{exchange}/{interval}. Status: {getattr(api_response, 'status', 'N/A')}"); return None
        candles = api_response.data.candles;
        if not candles: print(f"No candles data in Upstox response for {symbol}/{exchange}/{interval}"); return None
        print(f"DEBUG Upstox: Parsing {len(candles)} candles...")
        columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'oi']; df = pd.DataFrame(candles, columns=columns)
        try: df['date'] = pd.to_datetime(df['timestamp']); df['date'] = df['date'].dt.date
        except Exception as ts_e: print(f"Error converting Upstox timestamp: {ts_e}. Timestamp: {df['timestamp'].iloc[0]}"); return None
        df.set_index('date', inplace=True); df.drop(columns=['timestamp', 'oi'], inplace=True, errors='ignore')
        cols_to_convert = ['open', 'high', 'low', 'close', 'volume']
        for col in cols_to_convert:
            if col in df.columns: df[col] = pd.to_numeric(df[col], errors='coerce')
        df.dropna(subset=['open', 'high', 'low', 'close'], inplace=True);
        if df.empty: print("DataFrame empty after NaN drop"); return None
        df.columns = [c.lower() for c in df.columns]
        required_cols_lower = ['open', 'high', 'low', 'close', 'volume']
        available_cols = [col for col in required_cols_lower if col in df.columns]
        if not all(col in required_cols_lower for col in available_cols): print(f"Error: Post-processing missing required columns in Upstox data. Need: {required_cols_lower}, Got: {df.columns}"); return None
        df = df[available_cols]; df.sort_index(inplace=True)
        print(f"Successfully fetched and processed {len(df)} {interval} rows for {symbol}/{exchange} from Upstox."); return df
    except ApiException as e: print(f"Upstox API Exception fetching {interval} data for {symbol}/{exchange}: Status={e.status}, Reason={e.reason}, Body={e.body}"); return None
    except AttributeError as e: print(f"AttributeError during Upstox fetch (likely missing SDK method '{e.name}')"); return None
    except Exception as e: print(f"General Error processing {interval} data for {symbol}/{exchange} from Upstox: {e}"); return None

# --- fetch_stock_data_yf (Corrected Ticker Suffix) ---
def fetch_stock_data_yf(symbol: str, start_date: str, end_date: str, exchange: str = "NSE", interval: str = '1D') -> Optional[pd.DataFrame]:
     """Fetches historical OHLCV data from yfinance"""
     yf_interval = YFINANCE_INTERVAL_MAP.get(interval.upper())
     # --- Corrected yfinance Ticker Suffix ---
     suffix = ""
     if exchange.upper() in ["NSE", "NS"]: suffix = ".NS"
     elif exchange.upper() == "BSE": suffix = ".BO"
     ticker_symbol = f"{symbol.upper()}{suffix}"
     # --------------------------------------
     if not yf_interval: print(f"Error: Unsupported yf interval: {interval}"); return None
     is_intraday = yf_interval not in ['1d', '1wk', '1mo', '3mo'] # Rough check
     fetch_start_date = start_date
     if is_intraday:
          max_hist_days = 59 # Allow slightly less than 60 for safety
          required_start_dt = pd.to_datetime(start_date)
          limit_start_dt = pd.to_datetime(end_date) - pd.Timedelta(days=max_hist_days)
          if required_start_dt < limit_start_dt:
               print(f"Warning: yfinance intraday interval '{yf_interval}' requested beyond typical limit ({max_hist_days} days). Adjusting start date from {start_date} to {limit_start_dt.strftime('%Y-%m-%d')}.")
               fetch_start_date = limit_start_dt.strftime('%Y-%m-%d')

     print(f"DEBUG yfinance: Using ticker: '{ticker_symbol}', interval: '{yf_interval}'"); print(f"Attempting yf download for {ticker_symbol} ({interval}) [{fetch_start_date} to {end_date}]...")
     print(f"DEBUG yfinance: Using ticker: '{ticker_symbol}', interval: '{yf_interval}'"); print(f"Attempting yf download for {ticker_symbol} ({interval}) [{start_date} to {end_date}]...")
     # ... (Rest of yfinance fetch logic remains the same) ...
     try:
         end_date_adjusted = end_date;
         if yf_interval in ['1d', '1wk', '1mo']: end_date_adjusted = (pd.to_datetime(end_date) + timedelta(days=1)).strftime('%Y-%m-%d')
         history = yf.download(tickers=ticker_symbol, start=start_date, end=end_date_adjusted, interval=yf_interval, progress=False, auto_adjust=False)
         if history.empty: print(f"No data yf.download {ticker_symbol} ({interval})."); return None
         if isinstance(history.columns, pd.MultiIndex):
             try: ticker_in_multindex = history.columns.get_level_values(1)[0]; history = history.xs(ticker_in_multindex, level=1, axis=1);
             except Exception as e: print(f"Error processing MultiIndex columns for {ticker_symbol}: {e}"); return None
         try: history.columns = history.columns.str.lower();
         except AttributeError as e: print(f"Error converting cols lower {ticker_symbol} ({history.columns}): {e}"); return None
         required_cols_lower = ['open', 'high', 'low', 'close', 'volume']; available_cols = [col for col in required_cols_lower if col in history.columns]
         if not available_cols or len(available_cols) < 5: print(f"Error/Warning: Missing standard OHLCV cols after processing {ticker_symbol}. Found: {available_cols}"); return None
         history = history[available_cols]; print(f"Successfully yf downloaded/processed {len(history)} rows for {ticker_symbol} ({interval})"); return history
     except Exception as e: print(f"Error downloading/processing {interval} data for {ticker_symbol} from yfinance: {e}"); return None


# --- fetch_stock_info_yf (Corrected Ticker Suffix) ---
def fetch_stock_info_yf(symbol: str, exchange: str = "NSE") -> Optional[Dict]:
    """Fetches basic stock info using yfinance (fast_info)"""
    # --- Corrected yfinance Ticker Suffix ---
    suffix = ""
    if exchange.upper() in ["NSE", "NS"]: suffix = ".NS"
    elif exchange.upper() == "BSE": suffix = ".BO"
    ticker_symbol = f"{symbol.upper()}{suffix}"
    # --------------------------------------
    print(f"DEBUG yfinance Info: Using ticker: '{ticker_symbol}'"); print(f"Fetching info for {ticker_symbol} using yfinance fast_info...")
    # ... (Rest of info fetch logic remains the same) ...
    stock_info = None
    try:
        stock = yf.Ticker(ticker_symbol); f_info = stock.fast_info
        if not f_info or not hasattr(f_info, 'currency') or f_info.currency is None: print(f"Warning: Limited info via fast_info for {ticker_symbol}."); stock_info = { "symbol": symbol, "exchange": exchange, "name": symbol, "currency": "INR"}
        else: stock_info = { "symbol": symbol, "exchange": exchange, "name": getattr(f_info, 'longName', symbol), "currency": getattr(f_info, 'currency', 'INR'), "lastPrice": getattr(f_info, 'lastPrice', None), "marketCap": getattr(f_info, 'marketCap', None), "quoteType": getattr(f_info, 'quoteType', None)}
        print(f"Successfully fetched basic info for {ticker_symbol} via fast_info."); return stock_info
    except Exception as e: print(f"Error fetching info {ticker_symbol} (fast_info): {e}"); print(f"Providing minimal fallback metadata for {symbol}/{exchange}."); return { "symbol": symbol, "exchange": exchange, "name": symbol, "currency": "INR"}

    # Add this function in backend/app/stocks/fetcher.py

def get_cached_instrument_list(exchange: str) -> List[Dict[str, str]]:
    """
    Loads the instrument list for an exchange and returns a simplified list
    containing equity symbols and names.
    """
    exchange_upper = None
    segment_prefix = None
    if exchange.upper() in ["NSE", "NS"]: exchange_upper = "NSE"; segment_prefix = "NSE_EQ"
    elif exchange.upper() == "BSE": exchange_upper = "BSE"; segment_prefix = "BSE_EQ"
    else: return [] # Return empty list for unsupported exchanges

    instruments = _load_or_download_instruments(exchange_upper) # Use existing load/download function
    if not instruments: return []

    # Filter for EQ segment and extract relevant fields
    equity_list = []
    for instrument in instruments:
        # Use .get() for safety
        inst_exch = instrument.get('exchange', '').upper()
        inst_symbol = instrument.get('trading_symbol') # Keep original case? Or upper? Let's use upper.
        inst_name = instrument.get('name')
        inst_type = instrument.get('instrument_type', '').upper()
        inst_segment = instrument.get('segment', '').upper()

        # Check if it's an equity on the correct exchange/segment
        if (inst_exch == exchange_upper and
            inst_type == 'EQ' and
            inst_segment == segment_prefix and
            inst_symbol and inst_name): # Ensure symbol and name exist
             equity_list.append({
                 "symbol": inst_symbol.upper(),
                 "name": inst_name,
                 "exchange": exchange_upper # <-- CORRECTED LINE: Use exchange_upper
             })

    print(f"Returning simplified list of {len(equity_list)} equities for {exchange_upper}.")
    # Sort alphabetically by symbol
    return sorted(equity_list, key=lambda x: x['symbol'])