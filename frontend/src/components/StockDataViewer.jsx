// frontend/src/components/StockDataViewer.jsx
// Updated to add Interval Selector and use interval state

import React, { useState, useEffect, useCallback } from 'react';
import ChartComponent from './ChartComponent';
import IndicatorSelector from './IndicatorSelector';
import IntervalSelector from './IntervalSelector'; // Import the new component
// Removed TimeframeSelector import

// Helper function to format date
const formatDate = (dt) => {
    if (!(dt instanceof Date)) dt = new Date(dt);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().split('T')[0];
};
// Helper function for date subtraction (basic)
const subtractDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
}


function StockDataViewer() {
  // State for data fetching
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true); // Start true on initial load
  const [error, setError] = useState(null);

  // State for stock identification
  const [symbol, setSymbol] = useState('INFY');
  const [exchange, setExchange] = useState('NS');

  // State for controls / available options
  const [stockInfo, setStockInfo] = useState({ metadata: null, date_range_1D: null, supported_intervals: ['1D'] }); // Default structure
  const [availableIndicators, setAvailableIndicators] = useState([]);
  const [selectedIndicators, setSelectedIndicators] = useState({});
  const [selectedInterval, setSelectedInterval] = useState('1D'); // Default interval '1D'

  // --- Effect 1: Fetch available indicators (no change) ---
  useEffect(() => {
    const indicatorListUrl = 'http://127.0.0.1:5000/api/stocks/available-indicators';
    console.log("StockDataViewer: Fetching available indicators...");
    fetch(indicatorListUrl)
      .then(response => response.ok ? response.json() : Promise.reject(`HTTP ${response.status}`))
      .then(data => {
        console.log("StockDataViewer: Available indicators received:", data);
        setAvailableIndicators(data);
        const initialSelection = {};
        data.forEach(ind => { initialSelection[ind.id] = false; });
        setSelectedIndicators(initialSelection);
      })
      .catch(error => {
        console.error("StockDataViewer: Error fetching available indicators:", error);
        setError(prev => prev ? `${prev}; Failed to load indicator list: ${error.message}` : `Failed to load indicator list: ${error.message}`);
      });
  }, []);


  // --- Effect 2: Fetch Stock Info (Metadata, Date Range, *Supported Intervals*) ---
   useEffect(() => {
        if (!symbol || !exchange) return;
        // Reset states when symbol changes
        setStockInfo({ metadata: null, date_range_1D: null, supported_intervals: ['1D'] }); // Reset with default interval
        setStockData(null);
        setError(null);
        setSelectedInterval('1D'); // Reset interval to default on symbol change
        setLoading(true);

        // Fetch for default interval '1D' initially
        // Replace the incorrect line with this correct version:
        const infoUrl = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/info?interval=1D`;
        console.log("StockDataViewer: Fetching stock info from:", infoUrl);

        fetch(infoUrl)
          .then(response => {
             if (!response.ok) { throw new Error(`HTTP ${response.status} fetching info`); }
             return response.json();
          })
          .then(data => {
            console.log("StockDataViewer: Stock info received:", data);
            // Ensure supported_intervals is an array, default to ['1D'] if missing
            const supported = Array.isArray(data.supported_intervals) && data.supported_intervals.length > 0
                               ? data.supported_intervals
                               : ['1D'];
            setStockInfo({
                metadata: data.metadata,
                date_range_1D: data.date_range_1D, // Store the daily range
                supported_intervals: supported
            });
            // Don't setLoading(false) yet, let data fetch effect handle it
          })
          .catch(error => {
            console.error(`StockDataViewer: Error fetching info for <span class="math-inline">\{symbol\}/</span>{exchange}:`, error);
            setError(`Failed to load info for ${symbol}: ${error.message}`);
            setLoading(false); // Stop loading on info error
          });

    }, [symbol, exchange]); // Fetch info when symbol/exchange changes


  // --- Effect 3: Fetch OHLCV Data when symbol, interval, indicators, or info change ---
  useEffect(() => {
    // Don't fetch if info hasn't loaded or if available indicators haven't loaded
    if (!stockInfo.metadata || availableIndicators.length === 0) {
        console.log("StockDataViewer: Skipping data fetch - waiting for stock info and available indicators.");
        // If loading wasn't stopped by an error, stop it now
        if (!error) setLoading(false);
        return;
    }

    setLoading(true);
    // Don't clear general errors here, clear specific data error below on success

    // --- Calculate Date Range (Using a fixed window for simplicity for now) ---
    // We are removing the TimeframeSelector (1M, 6M etc.) for now
    // Let's fetch a fixed period like 2 years of the SELECTED INTERVAL data
    const endDate = new Date();
    let startDate = new Date();
    const daysToFetch = 365 * 2; // Fetch 2 years
    startDate = subtractDays(endDate, daysToFetch);

    // Adjust start date based on available data for the *default* '1D' interval if known
    // Note: This doesn't account for different start dates of weekly/monthly data yet
    if (stockInfo.date_range_1D?.min_date) {
         const availableMinDate = new Date(stockInfo.date_range_1D.min_date + 'T00:00:00');
         if (startDate < availableMinDate) {
             startDate = availableMinDate;
         }
    }
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    // --- End Date Range Calculation ---


    // --- Build Indicator Query String ---
    const requestedIndicators = Object.entries(selectedIndicators)
      .filter(([id, isSelected]) => isSelected)
      .map(([id, _]) => {
          const indicatorInfo = availableIndicators.find(ind => ind.id === id);
          return indicatorInfo ? indicatorInfo.default_params : id;
      })
      .join(',');

    // --- Construct API URL (Add interval) ---
    const params = new URLSearchParams({
        start_date: startDateStr,
        end_date: endDateStr,
        interval: selectedInterval // Pass the selected interval
    });
    if (requestedIndicators) { params.append('indicators', requestedIndicators); }
    // Replace the old console.log line with this one:
    console.log(`StockDataViewer: Fetching data for ${symbol}/${exchange} (Interval: ${selectedInterval}) - Indicators: ${requestedIndicators || 'None'}`);
    const apiUrl = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/data?${params.toString()}`;

    console.log(`StockDataViewer: Fetching data for <span class="math-inline">\{symbol\}/</span>{exchange} (Interval: ${selectedInterval}) - Indicators: ${requestedIndicators || 'None'}`);
    console.log("StockDataViewer: API URL:", apiUrl);

    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          return response.json().then(errData => { throw new Error(errData.description || `HTTP error! status: ${response.status}`); })
                           .catch(() => { throw new Error(`HTTP error! status: ${response.status}`); });
        }
        return response.json();
      })
      .then(data => {
        console.log("StockDataViewer: Data received length:", data?.data?.length);
        setStockData(data);
        setError(null); // Clear previous data fetch errors on success
        setLoading(false);
      })
      .catch(error => {
        console.error("StockDataViewer: Error fetching stock data:", error);
        setError(error.message);
        setLoading(false);
        setStockData(null); // Clear data on error
      });

  // Re-run when these change
  }, [symbol, exchange, selectedInterval, selectedIndicators, availableIndicators, stockInfo]);


  // --- Event Handlers ---
  const handleIndicatorChange = useCallback((event) => {
    const { name, checked } = event.target;
    setSelectedIndicators(prev => ({ ...prev, [name]: checked }));
  }, []);

  // New handler for interval changes
  const handleIntervalChange = useCallback((interval) => {
      if (interval && interval !== selectedInterval) { // Ensure value is valid and changed
        console.log("StockDataViewer: Setting selected interval to:", interval);
        setSelectedInterval(interval);
        // Data fetch useEffect will trigger automatically due to state change
      }
  }, [selectedInterval]); // Dependency needed if used inside


  // --- Render Component ---
  return (
    <>
      {/* Container for selectors */}
      <div className="selectors-container w-full flex flex-row flex-wrap items-center justify-start gap-4 p-2 md:p-3 mb-4 bg-gray-100 border border-gray-200 rounded-md shadow-sm">
          {/* Order: Interval -> Stock Name -> Indicator */}

          <IntervalSelector
              supportedIntervals={stockInfo.supported_intervals}
              selectedInterval={selectedInterval}
              onIntervalChange={handleIntervalChange}
          />

          {/* Display Symbol in the middle */}
          <div className="text-sm font-semibold text-gray-800 sm:ml-auto"> {/* Added font-semibold, ensured ml-auto for right alignment on sm+ screens */}
            {stockInfo.metadata ? `${stockInfo.metadata.symbol} (${stockInfo.metadata.exchange})` : `${symbol} (${exchange})`}
          </div>

          {/* Indicator selector - push it towards the right if desired using ml-auto on a wrapper OR rely on justify-start placing it after the others */}
          <div className="ml-auto"> {/* Use ml-auto on a wrapper to push indicator button right */}
              <IndicatorSelector
                  availableIndicators={availableIndicators}
                  selectedIndicators={selectedIndicators}
                  onIndicatorChange={handleIndicatorChange}
              />
          </div>

      </div>

      {/* Display Loading / Error / Chart */}
      {loading && <div className="loading">Loading data...</div>}
      {!loading && error && <div className="error">Error: {error}</div>}

      {/* Chart container */}
      <div className="chart-container-wrapper flex-grow">
        {!loading && !error && stockData?.data && stockData.data.length > 0 && (
            <ChartComponent data={stockData.data} />
        )}
        {!loading && !error && (!stockData || !stockData.data || !stockData.data.length === 0) && (
            <div className="flex items-center justify-center h-full text-gray-500">
                No chart data available for {symbol} / {selectedInterval}. (May be loading or failed fetch).
            </div>
        )}
      </div>
    </>
  );
}

export default StockDataViewer;