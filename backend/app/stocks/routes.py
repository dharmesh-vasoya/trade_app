# --- Helper Function to convert data for JSON ---
# backend/app/stocks/routes.py
# FINAL Version v5 - Convert Time to Epoch Sec, Supports D/W/M, Dynamic Indicators List

from flask import Blueprint, jsonify, request, abort
from datetime import date, datetime, timezone ,timedelta# Import datetime & timezone
import pandas as pd
from typing import Dict, List, Any

# Import manager and repository functions needed
from .manager import stock_manager
from .repository import get_ohlcv_date_range
from app.indicators import get_available_indicator_info # Use dynamic list getter
from .fetcher import get_cached_instrument_list

print("Stock routes module loaded (Final v5 - Epoch Time Output)")

SUPPORTED_INTERVALS = ['1D', '1W', '1M'] # Removed '1H'

stocks_bp = Blueprint('stocks', __name__)

# --- Helper Function to convert data for JSON ---
def prepare_data_for_json(data_list_of_dicts: List[Dict], interval: str) -> List[Dict]:
    """Converts NaN to None and date/timestamp to epoch seconds for JSON safety."""
    processed_list = []
    # get_ohlcv_data now returns DF with index 'time' (datetime objects)
    # reset_index makes 'time' a column containing datetime objects
    time_key_in_dict = 'time'

    if not data_list_of_dicts: return []
    if data_list_of_dicts and time_key_in_dict not in data_list_of_dicts[0]:
         print(f"Error: Cannot find expected time key ('{time_key_in_dict}') in data for JSON prep: {data_list_of_dicts[0].keys()}")
         return []

    for record in data_list_of_dicts:
        processed_record = {}; processed_time_val = None
        original_time_val = record.get(time_key_in_dict)
        # Convert pandas Timestamp, datetime, or date object to epoch seconds
        if original_time_val is not None:
            try:
                dt = pd.to_datetime(original_time_val) # Convert input to datetime
                if not pd.isna(dt):
                     # Make timezone-aware (assume UTC if naive), then get epoch seconds
                     processed_time_val = int(dt.tz_localize('UTC').timestamp() if dt.tzinfo is None else dt.timestamp())
            except Exception as e: print(f"Warning: Could not convert time field '{time_key_in_dict}' ({original_time_val}) to timestamp: {e}")

        # Process other fields
        for key, value in record.items():
            if key == time_key_in_dict: processed_record['time'] = processed_time_val # Use standard 'time' key
            elif isinstance(value, float) and pd.isna(value): processed_record[key] = None
            else: processed_record[key] = value
        if processed_record.get('time') is not None: processed_list.append(processed_record)
        else: print(f"Warning: Skipping record due to invalid time field: {record}")
    return processed_list

# --- End Helper ---


# ============================================================
# Route to Ensure Stock Metadata Exists (POST)
# ============================================================
@stocks_bp.route('/<string:exchange>/<string:symbol>', methods=['POST'])
def ensure_stock_exists_route(exchange: str, symbol: str):
    """Ensures stock metadata exists, triggering info fetch and bulk download if new."""
    print(f"API: Received request to ensure stock exists: {symbol} ({exchange})")
    symbol = symbol.upper(); exchange = exchange.upper()
    stock = stock_manager.ensure_stock_metadata(symbol, exchange)
    if stock: return jsonify({"message": f"Stock metadata for {symbol} ({exchange}) ensured.", "stock_info": stock.__dict__}), 200
    else: abort(500, description=f"Failed to ensure metadata for {symbol} ({exchange}). Check server logs.")

# ============================================================
# Route to Get Data for a Specific Date Range & Interval (GET)
# ============================================================
@stocks_bp.route('/<string:exchange>/<string:symbol>/data', methods=['GET'])
def get_stock_data_route(exchange: str, symbol: str):
    symbol = symbol.upper(); exchange = exchange.upper()
    interval = request.args.get('interval', '1D').upper()
    if interval not in SUPPORTED_INTERVALS: abort(400, description=f"Unsupported interval: {interval}")
    end_date = date.today(); start_date = end_date - timedelta(days=365*2)
    end_date_str = request.args.get('end_date', end_date.strftime('%Y-%m-%d'))
    start_date_str = request.args.get('start_date', start_date.strftime('%Y-%m-%d'))
    indicators_str = request.args.get('indicators')
    indicator_list = [ind.strip() for ind in indicators_str.split(',') if ind.strip()] if indicators_str else []
    print(f"API (data): Req: {symbol}/{exchange} Int:{interval} [{start_date_str}-{end_date_str}] Ind:{indicator_list or 'None'}")
    ohlcv_data = stock_manager.get_stock_data(symbol, exchange, start_date_str, end_date_str, interval=interval, indicators=indicator_list)
    if ohlcv_data is None or ohlcv_data.empty: abort(404, description=f"No {interval} data for {symbol}/{exchange} in range [{start_date_str} - {end_date_str}].")

    ohlcv_data_reset = ohlcv_data.reset_index() # Index ('time') becomes column
    data_list_of_dicts = ohlcv_data_reset.to_dict(orient='records')
    # REMOVED line: ohlcv_data_processed = ohlcv_data_reset.where(pd.notnull(ohlcv_data_reset), None)
    prepared_data = prepare_data_for_json(data_list_of_dicts, interval) # Use helper directly

    return jsonify({"symbol": symbol, "exchange": exchange, "interval": interval, "start_date": start_date_str, "end_date": end_date_str, "data": prepared_data}), 200

# ============================================================
# Route to Get Recent Data (REMOVED - covered by /data with default range)
# ============================================================
# @stocks_bp.route('/<string:exchange>/<string:symbol>/recent', methods=['GET'])
# def get_stock_data_recent(exchange: str, symbol: str):
#     # This route is now redundant as /data fetches a default range
#     # Keeping it might cause confusion, better to remove or redirect
#     abort(410, description="Use /data endpoint instead of /recent")

# ============================================================
# Route to Get Stock Info (Metadata, Date Range per Interval)
# ============================================================
@stocks_bp.route('/<string:exchange>/<string:symbol>/info', methods=['GET'])
def get_stock_info_route(exchange: str, symbol: str):
    """Returns stock metadata, supported intervals, and date range for requested interval."""
    symbol = symbol.upper(); exchange = exchange.upper()
    interval_for_range = request.args.get('interval', '1D').upper()
    print(f"API: Requesting info for {symbol}/{exchange}, date range for interval {interval_for_range}")
    stock_meta = stock_manager.ensure_stock_metadata(symbol, exchange)
    if not stock_meta: abort(404, description=f"Could not find/create metadata for {symbol}/{exchange}.")
    date_range = None; date_range_key = f"date_range_{interval_for_range}"
    if interval_for_range in SUPPORTED_INTERVALS: date_range = get_ohlcv_date_range(symbol, exchange, interval=interval_for_range)
    else: print(f"Warning: Date range requested for unsupported interval: {interval_for_range}")
    date_range_serializable = None
    if date_range and date_range.get("min_time") and date_range.get("max_time"):
        try: date_range_serializable = {"min_time": date_range["min_time"].isoformat(), "max_time": date_range["max_time"].isoformat()}
        except Exception as e: print(f"Warning: Could not format date range for JSON: {e}")
    return jsonify({"metadata": stock_meta.__dict__, "supported_intervals": SUPPORTED_INTERVALS, date_range_key: date_range_serializable }), 200

# ============================================================
# Route to Get Available Indicator Info (Dynamic)
# ============================================================
@stocks_bp.route('/available-indicators', methods=['GET'])
def get_available_indicators():
    """Returns available indicators list dynamically."""
    print("API: Returning available indicators list (Dynamically generated)...")
    try:
        available = get_available_indicator_info() # Call dynamic getter
        if not isinstance(available, list): raise TypeError("Indicator info not a list")
    except Exception as e:
        print(f"ERROR getting dynamic indicator list: {e}. Returning empty list.")
        available = [] # Fallback to empty list on error
    return jsonify(available), 200

# ============================================================
# Route to Get Stock List for Search/Combobox
# ============================================================
@stocks_bp.route('/list', methods=['GET'])
def get_stock_list():
    """Returns list of equity instruments from cache/download."""
    exchange = request.args.get('exchange', 'NSE').upper()
    print(f"API: Request received for stock list for exchange: {exchange}")
    stock_list = get_cached_instrument_list(exchange) # Function from fetcher.py
    if not stock_list: print(f"API: No stocks found for {exchange}."); return jsonify([])
    return jsonify(stock_list)