# backend/app/stocks/fetcher.py
# Updated to handle interval parameter

import yfinance as yf
import pandas as pd
from typing import Optional, Dict
from datetime import date, timedelta

print("Stock fetcher module loaded (Corrected + Interval Support)")

# --- Interval Mapping for yfinance ---
YFINANCE_INTERVAL_MAP = {
    "1D": "1d",
    "1W": "1wk",
    "1WK": "1wk", # Allow alternate notation
    "1M": "1mo",
    # Add more later: "1H": "1h", "15M": "15m", etc.
}

# --- CORRECTED fetch_stock_data_yf ---
def fetch_stock_data_yf(symbol: str, start_date: str, end_date: str, exchange: str = "NSE", interval: str = '1D') -> Optional[pd.DataFrame]:
    """
    Fetches historical OHLCV data using yf.download() for a specific interval.
    """
    # Construct ticker
    ticker_symbol = f"{symbol.upper()}.{exchange.upper()}" if exchange.upper() in ["NSE", "BSE", "NS"] else symbol.upper()

    # Map interval to yfinance format
    yf_interval = YFINANCE_INTERVAL_MAP.get(interval.upper())
    if not yf_interval:
        print(f"Error: Unsupported interval requested for yfinance fetch: {interval}")
        return None

    print(f"DEBUG Fetcher: Using ticker_symbol: '{ticker_symbol}' and interval: '{yf_interval}'")
    print(f"Attempting to download data for {ticker_symbol} ({interval}) from yfinance [{start_date} to {end_date}]...")

    try:
        # Adjust end_date by one day for yf.download daily/weekly/monthly convention
        # For intraday, end date might not need adjustment or might have other constraints.
        end_date_adjusted = end_date # Default
        if yf_interval in ['1d', '1wk', '1mo']:
             end_date_adjusted = (pd.to_datetime(end_date) + timedelta(days=1)).strftime('%Y-%m-%d')

        history = yf.download(
            tickers=ticker_symbol,
            start=start_date,
            end=end_date_adjusted,
            interval=yf_interval, # Pass the mapped interval
            progress=False,
            auto_adjust=False
        )

        if history.empty:
            print(f"No data returned by yf.download for {ticker_symbol} ({interval}) in the specified period.")
            return None

        print(f"DEBUG Fetcher: Initial history.columns: {history.columns}")

        # Handle potential MultiIndex columns
        if isinstance(history.columns, pd.MultiIndex):
            print(f"DEBUG Fetcher: MultiIndex detected. Attempting to select ticker data.")
            try:
                ticker_in_multindex = history.columns.get_level_values(1)[0]
                print(f"DEBUG Fetcher: Selecting columns for ticker '{ticker_in_multindex}' from MultiIndex.")
                history = history.xs(ticker_in_multindex, level=1, axis=1)
                print(f"DEBUG Fetcher: Columns after xs/droplevel(1): {history.columns}")
            except Exception as e:
                print(f"Error processing MultiIndex columns for {ticker_symbol}: {e}")
                return None
        else:
             print(f"DEBUG Fetcher: Single level columns detected: {history.columns}")


        # Rename columns to lowercase
        try:
            history.columns = history.columns.str.lower()
            print(f"DEBUG Fetcher: history.columns after lower(): {history.columns}")
        except AttributeError as e:
             print(f"Error converting columns to lower case for {ticker_symbol} (cols: {history.columns}): {e}")
             return None

        # Ensure standard columns exist and select them
        required_cols_lower = ['open', 'high', 'low', 'close', 'volume']
        available_cols = [col for col in required_cols_lower if col in history.columns]
        if not available_cols:
            print(f"DEBUG Fetcher: Columns when 'No standard OHLCV' error occurred: {history.columns}")
            print(f"Error: No standard OHLCV columns found after processing for {ticker_symbol}")
            return None
        if len(available_cols) < 5:
             print(f"Warning: Missing standard OHLCV columns for {ticker_symbol}. Found: {available_cols}")

        history = history[available_cols]

        print(f"Successfully downloaded and processed {len(history)} rows for {ticker_symbol} ({interval})")
        return history

    except Exception as e:
        # Catch other potential errors
        # Check for specific yfinance errors if needed
        print(f"Error downloading/processing {interval} data for {ticker_symbol} from yfinance: {e}")
        return None
# --- END fetch_stock_data_yf ---


# --- fetch_stock_info_yf (No changes needed for interval) ---
def fetch_stock_info_yf(symbol: str, exchange: str = "NSE") -> Optional[Dict]:
    ticker_symbol = f"{symbol.upper()}.{exchange.upper()}" if exchange.upper() in ["NSE", "BSE", "NS"] else symbol.upper()
    print(f"DEBUG Fetcher: Using ticker_symbol for info: '{ticker_symbol}'")
    print(f"Fetching info for {ticker_symbol} using yfinance fast_info...")
    # ... (rest of function is the same using fast_info) ...
    stock_info = None
    try:
        stock = yf.Ticker(ticker_symbol)
        f_info = stock.fast_info
        if not f_info or not hasattr(f_info, 'currency'):
             print(f"Warning: Limited or no info found via yf.fast_info for {ticker_symbol}.")
             stock_info = { "symbol": symbol, "exchange": exchange, "name": symbol, "currency": "INR"}
        else:
            stock_info = {
                "symbol": symbol, "exchange": exchange,
                "name": getattr(f_info, 'longName', symbol),
                "currency": getattr(f_info, 'currency', 'INR'),
                "lastPrice": getattr(f_info, 'lastPrice', None),
                "marketCap": getattr(f_info, 'marketCap', None),
                "quoteType": getattr(f_info, 'quoteType', None),
            }
        print(f"Successfully fetched basic info for {ticker_symbol} via fast_info.")
        return stock_info
    except Exception as e:
        print(f"Error fetching info for {ticker_symbol} from yfinance (fast_info attempt): {e}")
        print(f"Providing minimal fallback metadata for {symbol} ({exchange}) due to fetch error.")
        return { "symbol": symbol, "exchange": exchange, "name": symbol, "currency": "INR"}

# --- fetch_stock_data_upstox (Placeholder - Would also need interval param) ---
def fetch_stock_data_upstox(instrument_key: str, interval: str, start_date: str, end_date: str):
    """Placeholder for fetching data using Upstox API."""
    print(f"Placeholder: Would fetch {interval} data for {instrument_key} from Upstox ({start_date} to {end_date})")
    return None