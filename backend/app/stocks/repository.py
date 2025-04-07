# backend/app/stocks/repository.py
# --- CORRECTED VERSION: No unnecessary semicolons ---
# --- Supports '1D', '1W', '1M' intervals ---

import duckdb
import pandas as pd
from typing import Optional, List, Dict, Any
from datetime import date

from app.database import get_db_connection
from .models import Stock

print("Stock repository module loaded (1D, 1W, 1M Support)")

# --- Database Schema Definition & Initialization ---

STOCKS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS stocks (
    symbol VARCHAR NOT NULL, exchange VARCHAR NOT NULL, name VARCHAR,
    isin VARCHAR, instrument_key VARCHAR, added_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP, PRIMARY KEY (symbol, exchange)
)
"""

OHLCV_DAILY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ohlcv_daily (
    symbol VARCHAR NOT NULL, exchange VARCHAR NOT NULL, date DATE NOT NULL,
    open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT,
    PRIMARY KEY (symbol, exchange, date),
    FOREIGN KEY (symbol, exchange) REFERENCES stocks(symbol, exchange)
)
"""

OHLCV_WEEKLY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ohlcv_weekly (
    symbol VARCHAR NOT NULL, exchange VARCHAR NOT NULL, date DATE NOT NULL,
    open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT,
    PRIMARY KEY (symbol, exchange, date),
    FOREIGN KEY (symbol, exchange) REFERENCES stocks(symbol, exchange)
)
"""

OHLCV_MONTHLY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ohlcv_monthly (
    symbol VARCHAR NOT NULL, exchange VARCHAR NOT NULL, date DATE NOT NULL,
    open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT,
    PRIMARY KEY (symbol, exchange, date),
    FOREIGN KEY (symbol, exchange) REFERENCES stocks(symbol, exchange)
)
"""

_db_initialized = False

def _get_ohlcv_table_name(interval: str) -> str:
    interval_map = {
        '1D': 'ohlcv_daily',
        '1W': 'ohlcv_weekly', '1WK': 'ohlcv_weekly',
        '1M': 'ohlcv_monthly', '1MO': 'ohlcv_monthly',
    }
    normalized_interval = interval.upper().replace(' ', '')
    if normalized_interval in interval_map:
        return interval_map[normalized_interval]
    else:
        raise ValueError(f"Unsupported interval for table mapping: {interval}")

def initialize_database():
    global _db_initialized
    if _db_initialized: return
    print("Initializing/Checking database tables (Stocks, Daily, Weekly, Monthly)...")
    try:
        con = get_db_connection()
        con.execute(STOCKS_TABLE_SQL)
        con.execute(OHLCV_DAILY_TABLE_SQL)
        con.execute(OHLCV_WEEKLY_TABLE_SQL)
        con.execute(OHLCV_MONTHLY_TABLE_SQL) # Add Monthly table creation
        print("Database tables checked/created successfully.")
        _db_initialized = True
    except Exception as e:
        print(f"Error initializing database tables: {e}")
        _db_initialized = False
        raise

# --- Repository Functions ---

def add_stock(stock: Stock) -> int: # Returns 1 for insert, 2 for update, 0 for error
    initialize_database()
    print(f"Adding/updating stock (using try/except): {stock.symbol} ({stock.exchange})")
    insert_sql = "INSERT INTO stocks (symbol, exchange, name, isin, instrument_key) VALUES (?, ?, ?, ?, ?)"
    update_sql = "UPDATE stocks SET name = ?, isin = ?, instrument_key = ?, last_updated = CURRENT_TIMESTAMP WHERE symbol = ? AND exchange = ?"
    con = None
    try:
        con = get_db_connection()
        print(f"DEBUG: Attempting INSERT for {stock.symbol}")
        con.execute(insert_sql, [stock.symbol, stock.exchange, stock.name, stock.isin, stock.instrument_key])
        con.commit()
        print(f"Stock {stock.symbol} INSERTED successfully.")
        return 1
    except duckdb.ConstraintException as e:
        print(f"DEBUG: INSERT failed (likely duplicate), attempting UPDATE for {stock.symbol}. Error: {e}")
        try:
            if con is None: con = get_db_connection()
            print(f"DEBUG: Attempting UPDATE for {stock.symbol}")
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
    initialize_database()
    if ohlcv_df is None or ohlcv_df.empty: print(f"No OHLCV data for {symbol}/{exchange}/{interval}. Skip insert."); return True
    try: table_name = _get_ohlcv_table_name(interval)
    except ValueError as e: print(f"Error adding OHLCV: {e}"); return False
    print(f"Adding {len(ohlcv_df)} {interval} records for {symbol} ({exchange}) to {table_name}...")
    df = ohlcv_df.copy(); df['symbol'] = symbol.upper(); df['exchange'] = exchange.upper()
    if isinstance(df.index, pd.DatetimeIndex): df['date'] = df.index.date
    elif 'date' in df.columns: df['date'] = pd.to_datetime(df['date']).dt.date
    else: print(f"Error: DataFrame for {symbol}/{exchange}/{interval} needs 'date' column or DatetimeIndex."); return False
    required_cols = ['open', 'high', 'low', 'close', 'volume']
    if not all(col in df.columns for col in required_cols): print(f"Error: DataFrame for {symbol}/{exchange}/{interval} missing required columns: {required_cols}"); return False
    if 'date' not in df.columns: df['date'] = df.index.date
    df = df[['symbol', 'exchange', 'date', 'open', 'high', 'low', 'close', 'volume']]
    try:
        con = get_db_connection(); con.register('ohlcv_temp_view', df)
        insert_sql = f"INSERT OR IGNORE INTO {table_name} (symbol, exchange, date, open, high, low, close, volume) SELECT symbol, exchange, date, open, high, low, close, volume FROM ohlcv_temp_view"
        result = con.execute(insert_sql); inserted_count = result.fetchone(); inserted_count = inserted_count[0] if inserted_count else 0; con.commit(); con.unregister('ohlcv_temp_view')
        print(f"Processed {len(df)} records for {symbol}/{exchange}/{interval}. New rows: {inserted_count}"); return True
    except Exception as e: print(f"Error adding {interval} OHLCV data for {symbol}/{exchange} via SQL: {e}"); return False

def get_ohlcv_data(symbol: str, exchange: str, start_date: str, end_date: str, interval: str = '1D') -> Optional[pd.DataFrame]:
    initialize_database()
    try: table_name = _get_ohlcv_table_name(interval)
    except ValueError as e: print(f"Error getting OHLCV: {e}"); return None
    print(f"Querying {interval} OHLCV from {table_name} for {symbol} ({exchange}) [{start_date} to {end_date}]")
    sql = f"SELECT date, open, high, low, close, volume FROM {table_name} WHERE symbol = ? AND exchange = ? AND date BETWEEN ? AND ? ORDER BY date ASC"
    try:
        con = get_db_connection(); df = con.execute(sql, [symbol.upper(), exchange.upper(), start_date, end_date]).fetchdf()
        if df.empty: print(f"No {interval} OHLCV data found for {symbol}/{exchange} in range."); return None
        df['date'] = pd.to_datetime(df['date']); df.set_index('date', inplace=True); print(f"Retrieved {len(df)} {interval} OHLCV records for {symbol} ({exchange})."); return df
    except Exception as e: print(f"Error getting {interval} OHLCV data for {symbol}/{exchange} via SQL: {e}"); return None

def get_ohlcv_date_range(symbol: str, exchange: str, interval: str = '1D') -> Optional[Dict[str, date]]:
    initialize_database()
    try: table_name = _get_ohlcv_table_name(interval)
    except ValueError as e: print(f"Error getting OHLCV range: {e}"); return None
    print(f"Querying {interval} OHLCV date range from {table_name} for: {symbol} ({exchange})")
    sql = f"SELECT MIN(date) AS min_date, MAX(date) AS max_date FROM {table_name} WHERE symbol = ? AND exchange = ?"
    try:
        con = get_db_connection(); result = con.execute(sql, [symbol.upper(), exchange.upper()]).fetchone()
        if result and result[0] is not None and result[1] is not None:
             min_d = result[0] if isinstance(result[0], date) else pd.to_datetime(result[0]).date(); max_d = result[1] if isinstance(result[1], date) else pd.to_datetime(result[1]).date()
             print(f"Found {interval} date range: {min_d} to {max_d}"); return {"min_date": min_d, "max_date": max_d}
        else: print(f"No {interval} OHLCV data found for {symbol}/{exchange}."); return None
    except Exception as e: print(f"Error getting {interval} OHLCV date range for {symbol}/{exchange}: {e}"); return None