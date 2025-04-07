# backend/app/stocks/manager.py
# Reverted to simple fetcher import - assumes fetcher.py imports cleanly

import pandas as pd
from typing import Optional, List
from datetime import date, timedelta

# Import necessary components
from . import repository
from . import fetcher # Simple import now
from .models import Stock
from app.indicators import get_indicator

print("Stock manager module loaded (Upstox Primary, yfinance Fallback - Simplified Import)")

class StockManager:
    """
    Coordinates access to stock data, handling fetching (Upstox first),
    caching, intervals, and indicators.
    """

    def __init__(self):
        pass

    # --- ensure_stock_metadata ---
    # Tries Upstox first for bulk download if stock is new
    def ensure_stock_metadata(self, symbol: str, exchange: str) -> Optional[Stock]:
        symbol = symbol.upper(); exchange = exchange.upper()
        stock = repository.get_stock(symbol, exchange)
        stock_was_added_now = False

        if stock: return stock

        print(f"Manager EnsureMeta: Metadata for {symbol}/{exchange} not found. Fetching info (yfinance)...")
        stock_info = fetcher.fetch_stock_info_yf(symbol, exchange)
        if not stock_info: print(f"Manager EnsureMeta: Failed fetch metadata for {symbol}/{exchange}."); return None

        stock = Stock(
            symbol=symbol, exchange=exchange, name=stock_info.get('name'),
            isin=stock_info.get('isin'), instrument_key=stock_info.get('instrument_key')
        )
        add_result = repository.add_stock(stock)

        if add_result == 1: print(f"Manager EnsureMeta: Successfully added NEW metadata for {symbol}/{exchange}."); stock_was_added_now = True
        elif add_result == 2: print(f"Manager EnsureMeta: Successfully UPDATED metadata for {symbol}/{exchange}.")
        else: print(f"Manager EnsureMeta: Failed save metadata for {symbol}/{exchange}."); return None

        # Trigger Bulk Historical Fetch ONLY FOR DAILY DATA if Stock was NEWLY Added
        if stock_was_added_now:
            print(f"Manager EnsureMeta: Triggering BULK *DAILY* fetch for new stock {symbol}/{exchange}...")
            hist_end_date = date.today(); hist_start_date = hist_end_date - timedelta(days=365 * 10)
            hist_start_date_str = hist_start_date.strftime('%Y-%m-%d'); hist_end_date_str = hist_end_date.strftime('%Y-%m-%d')
            interval_to_fetch = '1D'
            historical_data = None

            print(f"Manager Bulk: Attempting fetch from Upstox ({interval_to_fetch})...")
            historical_data = fetcher.fetch_stock_data_upstox(
                symbol, exchange, interval_to_fetch, hist_start_date_str, hist_end_date_str
            )

            if historical_data is None or historical_data.empty:
                print(f"Manager Bulk: Upstox fetch failed/empty. Falling back to yfinance ({interval_to_fetch})...")
                historical_data = fetcher.fetch_stock_data_yf(
                     symbol, hist_start_date_str, hist_end_date_str, exchange, interval=interval_to_fetch
                )

            if historical_data is not None and not historical_data.empty:
                print(f"Manager Bulk: Fetch successful ({len(historical_data)} rows). Storing {interval_to_fetch} data...")
                repository.add_ohlcv_data(symbol, exchange, historical_data, interval=interval_to_fetch)
            else:
                print(f"WARNING: Bulk {interval_to_fetch} fetch failed from all sources for {symbol}/{exchange}.")
        return stock
    # --- END ensure_stock_metadata ---


    # --- get_stock_data ---
    # Tries Upstox first for on-demand fetch
    def get_stock_data(self,
                       symbol: str, exchange: str, start_date_str: str, end_date_str: str,
                       interval: str = '1D', indicators: Optional[List[str]] = None
                       ) -> Optional[pd.DataFrame]:
        symbol = symbol.upper(); exchange = exchange.upper(); interval = interval.upper()
        print(f"Manager GetData: Requesting {symbol}/{exchange} Interval:{interval} [{start_date_str} to {end_date_str}] Ind:{indicators or 'None'}")

        stock_meta = self.ensure_stock_metadata(symbol, exchange)
        if not stock_meta: print(f"Manager GetData: Cannot proceed without metadata for {symbol}/{exchange}."); return None

        stored_data = repository.get_ohlcv_data(symbol, exchange, start_date_str, end_date_str, interval=interval)
        needs_fetch = False; data_to_process = None

        if stored_data is None or stored_data.empty:
             print(f"Manager GetData: No/incomplete {interval} data in DB for {symbol}/{exchange} range. Fetch needed."); needs_fetch = True
        else:
             try:
                 min_date_db = stored_data.index.min().date(); max_date_db = stored_data.index.max().date()
                 req_start_date = pd.to_datetime(start_date_str).date(); req_end_date = pd.to_datetime(end_date_str).date()
                 if min_date_db > req_start_date or max_date_db < (req_end_date - timedelta(days=1)):
                      print(f"Manager GetData: DB {interval} data [{min_date_db} - {max_date_db}] doesn't cover request [{req_start_date} - {req_end_date}]. Fetch needed.")
                      needs_fetch = True
                 else:
                      print(f"Manager GetData: {interval} Data found in DB for {symbol}/{exchange}, covers range."); data_to_process = stored_data
             except Exception as e:
                 print(f"Manager GetData: Error checking {interval} date range coverage: {e}. Fetch needed."); needs_fetch = True

        if needs_fetch:
            fetched_data = None
            print(f"Manager GetData: Attempting fetch from Upstox ({interval})...")
            fetched_data = fetcher.fetch_stock_data_upstox( symbol, exchange, interval, start_date_str, end_date_str)

            if fetched_data is None or fetched_data.empty:
                print(f"Manager GetData: Upstox fetch failed/empty for {interval}. Falling back to yfinance...")
                fetched_data = fetcher.fetch_stock_data_yf( symbol, start_date_str, end_date_str, exchange, interval=interval)

            if fetched_data is not None and not fetched_data.empty:
                print(f"Manager GetData: Fetch successful ({len(fetched_data)} rows). Storing {interval} data...")
                repository.add_ohlcv_data(symbol, exchange, fetched_data, interval=interval)
                data_to_process = repository.get_ohlcv_data(symbol, exchange, start_date_str, end_date_str, interval=interval)
            elif data_to_process is None:
                 print(f"Manager GetData: Fetch failed from all sources and no {interval} data in DB for {symbol}/{exchange}."); return None
            else:
                 print(f"Manager GetData: Fetch failed, using previously stored partial {interval} data for {symbol}/{exchange}.")

        # Calculate Indicators
        if indicators and data_to_process is not None and not data_to_process.empty:
            print(f"Manager GetData: Calculating indicators on {interval} data for {symbol}/{exchange}...")
            for indicator_request in indicators:
                # ... (indicator calculation loop - keep as is) ...
                indicator_instance = get_indicator(indicator_request);
                if indicator_instance:
                    indicator_series = indicator_instance.calculate(data_to_process);
                    if indicator_series is not None:
                        if isinstance(indicator_series, pd.DataFrame):
                            for col in indicator_series.columns:
                                data_to_process[col] = indicator_series[col]
                                print(f"Manager GetData: Added '{col}' (multi-column)")
                        else:
                            data_to_process[indicator_instance.get_column_name()] = indicator_series
                            print(f"Manager GetData: Added '{indicator_instance.get_column_name()}' (single-column)")

                else: print(f"Manager GetData: Could not create indicator for '{indicator_request}'")


        if data_to_process is None: print(f"Manager GetData: Returning None for {symbol}/{exchange}/{interval}.")
        else: print(f"Manager GetData: Returning {len(data_to_process)} records for {symbol}/{exchange}/{interval}.")
        return data_to_process
    # --- END get_stock_data ---

# --- Instantiate the manager ---
print("DEBUG MANAGER: --- About to instantiate StockManager ---")
stock_manager = StockManager()
print("DEBUG MANAGER: --- StockManager instance CREATED ---")