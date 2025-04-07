# backend/app/stocks/repository.py
# FINAL VERSION v3.1 - Cleaned Syntax

import duckdb
import pandas as pd
from typing import Optional, List, Dict, Any
from datetime import date, datetime # Import datetime

from app.database import get_db_connection
from .models import Stock

print("Stock repository module loaded (1D, 1W, 1M Support - Final v3.1)")

# --- Database Schema Definitions ---
STOCKS_TABLE_SQL = """CREATE TABLE IF NOT EXISTS stocks ( symbol VARCHAR NOT NULL, exchange VARCHAR NOT NULL, name VARCHAR, isin VARCHAR, instrument_key VARCHAR, added_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_updated TIMESTAMP, PRIMARY KEY (symbol, exchange));"""
OHLCV_DAILY_TABLE_SQL = """CREATE TABLE IF NOT EXISTS ohlcv_daily ( symbol VARCHAR NOT NULL, exchange VARCHAR NOT NULL, date DATE NOT NULL, open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT, PRIMARY KEY (symbol, exchange, date), FOREIGN KEY (symbol, exchange) REFERENCES stocks(symbol, exchange));"""
OHLCV_WEEKLY_TABLE_SQL = """CREATE TABLE IF NOT EXISTS ohlcv_weekly ( symbol VARCHAR NOT NULL, exchange VARCHAR NOT NULL, date DATE NOT NULL, open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT, PRIMARY KEY (symbol, exchange, date), FOREIGN KEY (symbol, exchange) REFERENCES stocks(symbol, exchange));"""
OHLCV_MONTHLY_TABLE_SQL = """CREATE TABLE IF NOT EXISTS ohlcv_monthly ( symbol VARCHAR NOT NULL, exchange VARCHAR NOT NULL, date DATE NOT NULL, open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT, PRIMARY KEY (symbol, exchange, date), FOREIGN KEY (symbol, exchange) REFERENCES stocks(symbol, exchange));"""
OHLCV_1HOUR_TABLE_SQL = """CREATE TABLE IF NOT EXISTS ohlcv_1hour ( symbol VARCHAR NOT NULL, exchange VARCHAR NOT NULL, timestamp TIMESTAMP NOT NULL, open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT, PRIMARY KEY (symbol, exchange, timestamp), FOREIGN KEY (symbol, exchange) REFERENCES stocks(symbol, exchange));"""


_db_initialized = False

# Helper to map interval to table info
def _get_ohlcv_table_name(interval: str) -> Dict[str, str]:
    interval_map = {
        '1D': {'table': 'ohlcv_daily', 'time_col': 'date'},
        '1W': {'table': 'ohlcv_weekly', 'time_col': 'date'},
        '1WK': {'table': 'ohlcv_weekly', 'time_col': 'date'},
        '1M': {'table': 'ohlcv_monthly', 'time_col': 'date'},
        '1MO': {'table': 'ohlcv_monthly', 'time_col': 'date'},
        '1H': {'table': 'ohlcv_1hour', 'time_col': 'timestamp'},
        '60MIN': {'table': 'ohlcv_1hour', 'time_col': 'timestamp'},
    }
    normalized_interval = interval.upper().replace(' ', '').replace('MINUTE','')
    if normalized_interval in interval_map:
        return interval_map[normalized_interval]
    else:
        raise ValueError(f"Unsupported interval for table mapping: {interval}")

# Initialize DB
def initialize_database():
    global _db_initialized
    if _db_initialized: return
    print("Initializing/Checking DB tables (Stocks, Daily, Weekly, Monthly, 1Hour)...")
    try:
        con = get_db_connection()
        con.execute(STOCKS_TABLE_SQL)
        con.execute(OHLCV_DAILY_TABLE_SQL)
        con.execute(OHLCV_WEEKLY_TABLE_SQL)
        con.execute(OHLCV_MONTHLY_TABLE_SQL)
        con.execute(OHLCV_1HOUR_TABLE_SQL) # Create Hourly table
        print("Database tables checked/created successfully.")
        _db_initialized = True
    except Exception as e: print(f"Error initializing database tables: {e}"); _db_initialized = False; raise

# --- Repository Functions ---

def add_stock(stock: Stock) -> int: # Returns 1 insert, 2 update, 0 error
    initialize_database()
    print(f"Adding/updating stock (using try/except): {stock.symbol} ({stock.exchange})")
    insert_sql = "INSERT INTO stocks (symbol, exchange, name, isin, instrument_key) VALUES (?, ?, ?, ?, ?)"
    update_sql = "UPDATE stocks SET name = ?, isin = ?, instrument_key = ?, last_updated = CURRENT_TIMESTAMP WHERE symbol = ? AND exchange = ?"
    con = None
    try:
        con = get_db_connection()
        print(f"DEBUG REPO AddStock: Attempting INSERT for {stock.symbol}")
        con.execute(insert_sql, [stock.symbol, stock.exchange, stock.name, stock.isin, stock.instrument_key])
        con.commit()
        print(f"Stock {stock.symbol} INSERTED successfully.")
        return 1
    except duckdb.ConstraintException as e:
        print(f"DEBUG REPO AddStock: INSERT failed (likely duplicate), attempting UPDATE for {stock.symbol}. Error: {e}")
        try:
            if con is None: con = get_db_connection()
            print(f"DEBUG REPO AddStock: Attempting UPDATE for {stock.symbol}")
            con.execute(update_sql, [stock.name, stock.isin, stock.instrument_key, stock.symbol, stock.exchange])
            con.commit()
            print(f"Stock {stock.symbol} UPDATED successfully.")
            return 2
        except Exception as update_e: print(f"Error UPDATING stock {stock.symbol} after INSERT failed: {update_e}"); return 0
    except Exception as e: print(f"Error during initial INSERT attempt for stock {stock.symbol}: {e}"); return 0

def get_stock(symbol: str, exchange: str) -> Optional[Stock]:
    initialize_database()
    print(f"Querying stock: {symbol} ({exchange})")
    sql = "SELECT symbol, exchange, name, isin, instrument_key FROM stocks WHERE symbol = ? AND exchange = ?"
    try:
        con = get_db_connection()
        result = con.execute(sql, [symbol.upper(), exchange.upper()]).fetchone()
        if result: return Stock(symbol=result[0], exchange=result[1], name=result[2], isin=result[3], instrument_key=result[4])
        else: return None
    except Exception as e: print(f"Error getting stock {symbol} ({exchange}): {e}"); return None


def add_ohlcv_data(symbol: str, exchange: str, ohlcv_df: pd.DataFrame, interval: str = '1D') -> bool:
    """Adds historical OHLCV data to the appropriate interval table with robust date/timestamp handling."""
    initialize_database()
    if ohlcv_df is None or ohlcv_df.empty: print(f"No OHLCV data for {symbol}/{exchange}/{interval}. Skip."); return True

    try: table_info = _get_ohlcv_table_name(interval); table_name = table_info['table']; time_col = table_info['time_col']
    except ValueError as e: print(f"Error adding OHLCV: {e}"); return False

    print(f"Adding {len(ohlcv_df)} {interval} records for {symbol} ({exchange}) to {table_name}...")
    df = ohlcv_df.copy()

    # Ensure primary time column exists ('date' or 'timestamp') and has correct type
    time_col_in_df = None
    if df.index.name is not None and df.index.name.lower() == time_col:
        print(f"DEBUG REPO Add ({interval}): Index named '{df.index.name}' found. Resetting.")
        df.reset_index(inplace=True)
        time_col_in_df = time_col # Now it's a column
    else:
        for col in df.columns: # Check columns case-insensitively
            if col.lower() == time_col: time_col_in_df = col; break

    if not time_col_in_df: print(f"Error: DataFrame lacks primary time column '{time_col}'. Cols: {df.columns}, Index: {df.index}"); return False
    print(f"DEBUG REPO Add ({interval}): Found time column: '{time_col_in_df}'")

    # Convert to datetime objects first, handle errors
    try:
        df[time_col] = pd.to_datetime(df[time_col_in_df])
    except Exception as date_err: print(f"Error converting time column '{time_col_in_df}' to datetime: {date_err}"); return False

    # If target DB column is DATE, keep only date part
    if time_col == 'date':
        df[time_col] = df[time_col].dt.date
        print(f"DEBUG REPO Add ({interval}): Converted time column to date objects.")
    else: # Target is TIMESTAMP
         print(f"DEBUG REPO Add ({interval}): Kept time column as datetime objects.")


    # Rename column to match DB schema if it was different (e.g., 'Date' -> 'date')
    if time_col_in_df.lower() == time_col and time_col_in_df != time_col:
        df.rename(columns={time_col_in_df: time_col}, inplace=True)
        print(f"DEBUG REPO Add ({interval}): Renamed column '{time_col_in_df}' to '{time_col}'.")


    df['symbol'] = symbol.upper(); df['exchange'] = exchange.upper()
    required_value_cols = ['open', 'high', 'low', 'close', 'volume']
    if not all(col in df.columns for col in required_value_cols): print(f"Error: DataFrame missing OHLCV columns. Need:{required_value_cols}, Got:{df.columns}"); return False

    cols_for_db = ['symbol', 'exchange', time_col] + required_value_cols
    df_to_insert = df[cols_for_db]
    print(f"DEBUG REPO Add ({interval}): Final columns being inserted: {df_to_insert.columns}")

    # Insert data
    try:
        con = get_db_connection(); con.register('ohlcv_temp_view', df_to_insert)
        insert_sql = f""" INSERT OR IGNORE INTO {table_name} (symbol, exchange, {time_col}, open, high, low, close, volume) SELECT symbol, exchange, {time_col}, open, high, low, close, volume FROM ohlcv_temp_view """
        result = con.execute(insert_sql); inserted_count = result.fetchone(); inserted_count = inserted_count[0] if inserted_count else 0; con.commit(); con.unregister('ohlcv_temp_view')
        print(f"Processed {len(df_to_insert)} records for {symbol}/{exchange}/{interval}. New rows: {inserted_count}"); return True
    except Exception as e: print(f"Error adding {interval} OHLCV data via SQL: {e}"); return False


def get_ohlcv_data(symbol: str, exchange: str, start_date: str, end_date: str, interval: str = '1D') -> Optional[pd.DataFrame]:
    initialize_database();
    try: table_info = _get_ohlcv_table_name(interval); table_name = table_info['table']; time_col = table_info['time_col']
    except ValueError as e: print(f"Error getting OHLCV: {e}"); return None
    print(f"Querying {interval} OHLCV from {table_name} for {symbol} ({exchange}) [{start_date} to {end_date}]")
    # Use appropriate time column name in query
    sql = f""" SELECT {time_col}, open, high, low, close, volume FROM {table_name} WHERE symbol = ? AND exchange = ? AND {time_col} BETWEEN ? AND ? ORDER BY {time_col} ASC """
    try:
        con = get_db_connection()
        # DuckDB handles date/timestamp comparison usually, pass dates as strings
        df = con.execute(sql, [symbol.upper(), exchange.upper(), start_date, end_date]).fetchdf()
        if df.empty: print(f"No {interval} OHLCV data found."); return None

        # Convert time column to datetime and set as index
        df[time_col] = pd.to_datetime(df[time_col])
        df.set_index(time_col, inplace=True)
        df.index.name = 'time' # Use consistent index name 'time' for DatetimeIndex

        print(f"Retrieved {len(df)} {interval} OHLCV records for {symbol}/{exchange}. Index type: {type(df.index)}")
        return df
    except Exception as e: print(f"Error getting {interval} OHLCV data via SQL: {e}"); return None


def get_ohlcv_date_range(symbol: str, exchange: str, interval: str = '1D') -> Optional[Dict[str, Any]]: # Return datetime/date
    initialize_database();
    try: table_info = _get_ohlcv_table_name(interval); table_name = table_info['table']; time_col = table_info['time_col']
    except ValueError as e: print(f"Error getting OHLCV range: {e}"); return None
    print(f"Querying {interval} time range from {table_name} for: {symbol} ({exchange})")
    sql = f"SELECT MIN({time_col}) AS min_time, MAX({time_col}) AS max_time FROM {table_name} WHERE symbol = ? AND exchange = ?"
    try:
        con = get_db_connection(); result = con.execute(sql, [symbol.upper(), exchange.upper()]).fetchone()
        if result and result[0] is not None and result[1] is not None:
             min_t = result[0]; max_t = result[1] # Keep original type (date or timestamp)
             print(f"Found {interval} time range: {min_t} to {max_t}"); return {"min_time": min_t, "max_time": max_t}
        else: print(f"No {interval} OHLCV data found for range."); return None
    except Exception as e: print(f"Error getting {interval} OHLCV range: {e}"); return None