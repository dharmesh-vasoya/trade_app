# backend/app/stocks/routes.py
# Updated to handle interval parameter and report available intervals

from flask import Blueprint, jsonify, request, abort
from datetime import date, timedelta
import pandas as pd

# Import manager and repository functions
from .manager import stock_manager
from .repository import get_ohlcv_date_range # Keep this import for /info route
# Import indicator info getter
from app.indicators import get_available_indicator_info
from .fetcher import get_cached_instrument_list

print("Stock routes module loaded (Interval Support + Final NaN Fix)")

# --- List of currently supported intervals by the backend ---
# This should align with _get_ohlcv_table_name in repository.py and YFINANCE_INTERVAL_MAP in fetcher.py
# We only implemented '1D' and '1W' storage/fetching so far.
SUPPORTED_INTERVALS = ['1D', '1W', '1M'] # <-- Add '1M'
# ---

stocks_bp = Blueprint('stocks', __name__)

# ============================================================
# Route to Ensure Stock Metadata Exists (POST)
# ============================================================
@stocks_bp.route('/<string:exchange>/<string:symbol>', methods=['POST'])
def ensure_stock_exists_route(exchange: str, symbol: str):
    """Ensures stock metadata exists, triggering info fetch and bulk *DAILY* download if new."""
    print(f"API: Received request to ensure stock exists: {symbol} ({exchange})")
    symbol = symbol.upper(); exchange = exchange.upper()
    stock = stock_manager.ensure_stock_metadata(symbol, exchange)
    if stock:
        return jsonify({"message": f"Stock metadata for {symbol} ({exchange}) ensured.", "stock_info": stock.__dict__}), 200
    else:
        abort(500, description=f"Failed to ensure metadata for {symbol} ({exchange}). Check server logs.")

# ============================================================
# Route to Get Data for a Specific Date Range & Interval (GET)
# ============================================================
@stocks_bp.route('/<string:exchange>/<string:symbol>/data', methods=['GET'])
def get_stock_data_route(exchange: str, symbol: str):
    """Gets OHLCV data for a stock for a specific range and interval with optional indicators."""
    symbol = symbol.upper(); exchange = exchange.upper()

    # Get interval (default to '1D')
    interval = request.args.get('interval', '1D').upper()
    if interval not in SUPPORTED_INTERVALS:
         abort(400, description=f"Unsupported interval requested: {interval}. Supported: {SUPPORTED_INTERVALS}")

    # Get date range
    end_date = date.today()
    start_date = end_date - timedelta(days=365) # Default 1 year
    end_date_str = request.args.get('end_date', end_date.strftime('%Y-%m-%d'))
    start_date_str = request.args.get('start_date', start_date.strftime('%Y-%m-%d'))

    # Get indicators
    indicators_str = request.args.get('indicators')
    indicator_list = [ind.strip() for ind in indicators_str.split(',') if ind.strip()] if indicators_str else []

    print(f"API (data): Requesting: {symbol}/{exchange} Interval: {interval} [{start_date_str} to {end_date_str}] Indicators: {indicator_list or 'None'}")

    # Call manager with interval
    ohlcv_data = stock_manager.get_stock_data(
        symbol, exchange, start_date_str, end_date_str, interval=interval, indicators=indicator_list
    )

    # Process response
    if ohlcv_data is None or ohlcv_data.empty:
        error_desc = f"Could not retrieve or fetch {interval} data for {symbol}/{exchange} in range [{start_date_str} - {end_date_str}]."
        abort(404, description=error_desc)

    ohlcv_data_reset = ohlcv_data.reset_index()
    ohlcv_data_processed = ohlcv_data_reset.where(pd.notnull(ohlcv_data_reset), None)
    data_list_of_dicts = ohlcv_data_processed.to_dict(orient='records')

    for record in data_list_of_dicts:
        for key, value in record.items():
            if isinstance(value, float) and pd.isna(value): record[key] = None
        if 'date' in record and record['date'] is not None and hasattr(record['date'], 'strftime'):
             record['date'] = record['date'].strftime('%Y-%m-%d')

    return jsonify({
        "symbol": symbol, "exchange": exchange, "interval": interval, # Include interval in response
        "start_date": start_date_str, "end_date": end_date_str,
        "data": data_list_of_dicts
    }), 200

# ============================================================
# Route to Get Recent Data (Last 6 Months) for Interval (GET)
# ============================================================
@stocks_bp.route('/<string:exchange>/<string:symbol>/recent', methods=['GET'])
def get_stock_data_recent(exchange: str, symbol: str):
    """Gets last 6 months OHLCV data for a stock for a specific interval with optional indicators."""
    symbol = symbol.upper(); exchange = exchange.upper()

    # Get interval (default to '1D')
    interval = request.args.get('interval', '1D').upper()
    if interval not in SUPPORTED_INTERVALS:
         abort(400, description=f"Unsupported interval requested: {interval}. Supported: {SUPPORTED_INTERVALS}")

    # Calculate date range
    end_date = date.today()
    start_date = end_date - timedelta(days=180) # Approx 6 months
    end_date_str = end_date.strftime('%Y-%m-%d')
    start_date_str = start_date.strftime('%Y-%m-%d')

    # Get indicators
    indicators_str = request.args.get('indicators')
    indicator_list = [ind.strip() for ind in indicators_str.split(',') if ind.strip()] if indicators_str else []

    print(f"API (recent): Requesting: {symbol}/{exchange} Interval: {interval} [{start_date_str} to {end_date_str}] Indicators: {indicator_list or 'None'}")

    # Call manager with interval
    ohlcv_data = stock_manager.get_stock_data(
        symbol, exchange, start_date_str, end_date_str, interval=interval, indicators=indicator_list
    )

    # Process response
    if ohlcv_data is None or ohlcv_data.empty:
        error_desc = f"Could not retrieve or fetch recent (6m) {interval} data for {symbol} ({exchange})."
        abort(404, description=error_desc)

    ohlcv_data_reset = ohlcv_data.reset_index()
    ohlcv_data_processed = ohlcv_data_reset.where(pd.notnull(ohlcv_data_reset), None)
    data_list_of_dicts = ohlcv_data_processed.to_dict(orient='records')

    for record in data_list_of_dicts:
        for key, value in record.items():
            if isinstance(value, float) and pd.isna(value): record[key] = None
        if 'date' in record and record['date'] is not None and hasattr(record['date'], 'strftime'):
             record['date'] = record['date'].strftime('%Y-%m-%d')

    return jsonify({
        "symbol": symbol, "exchange": exchange, "interval": interval, # Include interval in response
        "start_date": start_date_str, "end_date": end_date_str,
        "data": data_list_of_dicts
    }), 200

# ============================================================
# Route to Get Stock Info (Metadata, Date Range per Interval)
# ============================================================
@stocks_bp.route('/<string:exchange>/<string:symbol>/info', methods=['GET'])
def get_stock_info_route(exchange: str, symbol: str):
    """
    Returns basic stock metadata, available intervals, and the
    available date range for a requested interval (default '1D').
    """
    symbol = symbol.upper(); exchange = exchange.upper()
    # Get interval for which to report date range (default '1D')
    interval_for_range = request.args.get('interval', '1D').upper()
    print(f"API: Requesting info for {symbol} ({exchange}), date range for interval {interval_for_range}")

    stock_meta = stock_manager.ensure_stock_metadata(symbol, exchange)
    # Note: ensure_stock_metadata might trigger bulk fetch if stock is new,
    # so date range might change right after. Fetch range *after* ensuring metadata.

    if not stock_meta:
         abort(404, description=f"Could not find or create metadata for {symbol} ({exchange}).")

    # Get date range for the requested interval
    date_range = None
    if interval_for_range in SUPPORTED_INTERVALS:
         date_range = get_ohlcv_date_range(symbol, exchange, interval=interval_for_range)
    else:
         print(f"Warning: Date range requested for unsupported interval: {interval_for_range}")


    # Convert date objects to strings for JSON
    date_range_str = None
    if date_range:
        date_range_str = {
            "min_date": date_range["min_date"].strftime('%Y-%m-%d'),
            "max_date": date_range["max_date"].strftime('%Y-%m-%d')
        }

    return jsonify({
        "metadata": stock_meta.__dict__,
        "supported_intervals": SUPPORTED_INTERVALS, # List intervals backend can handle
        f"date_range_{interval_for_range}": date_range_str # Date range for the specific interval requested
    }), 200


# ============================================================
# Route to Get Available Indicator Info
# ============================================================
@stocks_bp.route('/available-indicators', methods=['GET'])
def get_available_indicators():
    """Returns a list of available indicators registered in the backend."""
    available = get_available_indicator_info() # Get list dynamically
    print("API: Returning available indicators list (Dynamically generated).")
    return jsonify(available), 200

# Make sure this route exists
@stocks_bp.route('/list', methods=['GET'])
def get_stock_list():
    """Returns list of equity instruments for a given exchange from cache/download."""
    exchange = request.args.get('exchange', 'NSE').upper()
    print(f"API: Request received for stock list for exchange: {exchange}")
    stock_list = get_cached_instrument_list(exchange)
    if not stock_list: print(f"API: No stocks found or error loading list for {exchange}."); return jsonify([])
    return jsonify(stock_list)