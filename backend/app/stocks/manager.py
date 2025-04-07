# backend/app/stocks/manager.py
# Updated to handle interval parameter

import pandas as pd
from typing import Optional, List
from datetime import date, timedelta

# Import necessary components from the same module
from . import repository
from . import fetcher
from .models import Stock
# Import the factory function from the indicators package
from app.indicators import get_indicator

print("Stock manager module loaded (Interval Support)")

class StockManager:
    """
    Coordinates access to stock data, handling fetching, caching, and intervals.
    """

    def __init__(self):
        pass

    # --- MODIFIED ensure_stock_metadata ---
    def ensure_stock_metadata(self, symbol: str, exchange: str) -> Optional[Stock]:
        """
        Checks if stock metadata exists, fetches/adds it if not.
        If metadata is newly added, triggers a bulk fetch of *DAILY* historical data.
        """
        symbol = symbol.upper()
        exchange = exchange.upper()
        stock = repository.get_stock(symbol, exchange)
        stock_was_added_now = False

        if stock:
            return stock

        print(f"Metadata for {symbol} ({exchange}) not found. Fetching...")
        stock_info = fetcher.fetch_stock_info_yf(symbol, exchange)
        if not stock_info:
            print(f"Failed to fetch metadata for {symbol} ({exchange}).")
            return None

        stock = Stock(
            symbol=symbol, exchange=exchange,
            name=stock_info.get('name'), isin=stock_info.get('isin'),
            instrument_key=stock_info.get('instrument_key')
        )

        add_result = repository.add_stock(stock) # Returns 1 if inserted, 2 if updated

        if add_result == 1:
            print(f"Successfully added NEW metadata for {symbol} ({exchange}).")
            stock_was_added_now = True
        elif add_result == 2:
             print(f"Successfully UPDATED metadata for {symbol} ({exchange}).")
        else:
            print(f"Failed to save fetched metadata for {symbol} ({exchange}).")
            return None

        # Trigger Bulk Historical Fetch ONLY FOR DAILY DATA if Stock was NEWLY Added
        if stock_was_added_now:
            print(f"Triggering BULK *DAILY* historical data fetch for new stock {symbol} ({exchange})...")
            hist_end_date = date.today()
            hist_start_date = hist_end_date - timedelta(days=365 * 10) # Approx 10 years
            hist_start_date_str = hist_start_date.strftime('%Y-%m-%d')
            hist_end_date_str = hist_end_date.strftime('%Y-%m-%d')

            # Fetch specifically '1D' data
            historical_data = fetcher.fetch_stock_data_yf(
                symbol, hist_start_date_str, hist_end_date_str, exchange, interval='1D' # Specify interval
            )

            if historical_data is not None and not historical_data.empty:
                print(f"Bulk DAILY fetch successful ({len(historical_data)} rows). Storing...")
                # Store specifically as '1D' data
                repository.add_ohlcv_data(symbol, exchange, historical_data, interval='1D') # Specify interval
            else:
                print(f"WARNING: Bulk DAILY historical data fetch failed for {symbol} ({exchange}).")
        # --- End Bulk Fetch ---

        return stock
    # --- END MODIFIED ensure_stock_metadata ---


    # --- MODIFIED get_stock_data ---
    def get_stock_data(self,
                       symbol: str,
                       exchange: str,
                       start_date_str: str,
                       end_date_str: str,
                       interval: str = '1D', # Add interval parameter
                       indicators: Optional[List[str]] = None) -> Optional[pd.DataFrame]:
        """
        Gets stock OHLCV data for a given range and interval. Checks repository,
        fetches missing data, and optionally calculates indicators.
        """
        symbol = symbol.upper()
        exchange = exchange.upper()
        interval = interval.upper() # Normalize interval internally
        print(f"Manager: Requesting data for {symbol}/{exchange} Interval: {interval} Range: [{start_date_str} to {end_date_str}]")
        if indicators: print(f"Manager: Requested indicators: {indicators}")

        # 1. Ensure metadata exists
        stock_meta = self.ensure_stock_metadata(symbol, exchange)
        if not stock_meta:
             print(f"Manager: Cannot proceed without metadata for {symbol}/{exchange}.")
             return None

        # 2. Try fetching data from the repository for the specified interval
        # TODO: Implement more granular check for missing date ranges later
        stored_data = repository.get_ohlcv_data(symbol, exchange, start_date_str, end_date_str, interval=interval)

        needs_fetch = False
        data_to_process = None

        if stored_data is None or stored_data.empty:
             print(f"Manager: No {interval} data found in DB for {symbol}/{exchange} range. Triggering fetch.")
             needs_fetch = True
        else:
             # Check if data fully covers the range (or up to yesterday)
             try:
                 min_date_db = stored_data.index.min().date()
                 max_date_db = stored_data.index.max().date()
                 req_start_date = pd.to_datetime(start_date_str).date()
                 req_end_date = pd.to_datetime(end_date_str).date()
                 # Check if data covers up to the day *before* requested end date
                 if min_date_db > req_start_date or max_date_db < (req_end_date - timedelta(days=1)):
                      print(f"Manager: DB {interval} data range [{min_date_db} - {max_date_db}] doesn't cover requested [{req_start_date} - {req_end_date}]. Triggering fetch.")
                      needs_fetch = True
                 else:
                      print(f"Manager: {interval} Data found in DB for {symbol}/{exchange} and covers range.")
                      data_to_process = stored_data
             except Exception as e:
                 print(f"Manager: Error checking {interval} date range coverage: {e}. Triggering fetch.")
                 needs_fetch = True

        if needs_fetch:
            print(f"Manager: Fetching {interval} from source for {symbol}/{exchange}...")
            # Fetch data for the SPECIFIC interval needed
            fetched_data = fetcher.fetch_stock_data_yf(symbol, start_date_str, end_date_str, exchange, interval=interval)

            if fetched_data is not None and not fetched_data.empty:
                print(f"Manager: Storing fetched {interval} data for {symbol}/{exchange}...")
                # Add fetched data for the SPECIFIC interval
                repository.add_ohlcv_data(symbol, exchange, fetched_data, interval=interval)
                # Retrieve again to ensure consistency
                data_to_process = repository.get_ohlcv_data(symbol, exchange, start_date_str, end_date_str, interval=interval)
            elif data_to_process is None: # Fetch failed AND nothing was stored before
                 print(f"Manager: Fetch failed and no {interval} data in DB for {symbol}/{exchange}.")
                 return None
            else: # Fetch failed, but we might have some older partial data
                 print(f"Manager: Fetch failed, using previously stored partial {interval} data for {symbol}/{exchange}.")
                 # data_to_process remains as the potentially partial stored_data

        # 3. Calculate Indicators (if requested and data exists)
        if indicators and data_to_process is not None and not data_to_process.empty:
            print(f"Manager: Calculating indicators on {interval} data for {symbol}/{exchange}...")
            for indicator_request in indicators:
                indicator_instance = get_indicator(indicator_request) # Factory gets indicator based on name_params
                if indicator_instance:
                    indicator_series = indicator_instance.calculate(data_to_process) # Calculation uses the interval data passed
                    if indicator_series is not None:
                        col_name = indicator_instance.get_column_name()
                        data_to_process[col_name] = indicator_series
                        print(f"Manager: Added column '{col_name}'")
                    else: print(f"Manager: Calculation failed for indicator '{indicator_request}'")
                else: print(f"Manager: Could not create indicator for request '{indicator_request}'")

        # Return final DataFrame
        if data_to_process is None:
             print(f"Manager: Returning None for {symbol}/{exchange}/{interval}.")
        else:
             print(f"Manager: Returning {len(data_to_process)} records for {symbol}/{exchange}/{interval}.")

        return data_to_process
    # --- END MODIFIED get_stock_data ---

# Instantiate the manager
stock_manager = StockManager()