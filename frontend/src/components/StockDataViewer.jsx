// frontend/src/components/StockDataViewer.jsx
// FINAL v6 - REMOVED Timeframe selector, fixed URL bugs, fetches default ~2 year range

import React, { useState, useEffect, useCallback } from 'react';
import ChartComponent from './ChartComponent'; // Assuming ChartComponent v3.1 (Response #86) with dynamic loading
import IndicatorSelector from './IndicatorSelector';
import IntervalSelector from './IntervalSelector';
import StockSelector from './StockSelector';

// Helper function to format date
const formatDate = (dt) => {
    if (!dt) return null;
    if (!(dt instanceof Date)) dt = new Date(dt);
    if (isNaN(dt.getTime())) return null;
    const year = dt.getUTCFullYear();
    const month = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = dt.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
// Helper for date subtraction
const subtractDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
}

function StockDataViewer() {
  // State for data fetching
  const [stockData, setStockData] = useState(null); // Holds full API response { symbol, data: [], ...} for initial load
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingData, setLoadingData] = useState(false); // Use for initial data load triggered after info
  const [error, setError] = useState(null);

  // State for stock identification
  const [symbol, setSymbol] = useState('INFY'); // Default symbol
  const [exchange, setExchange] = useState('NSE'); // Default exchange

  // State for controls / available options
  const [stockInfo, setStockInfo] = useState({ metadata: null, date_range_1D: null, supported_intervals: ['1D'] }); // Default structure
  const [availableIndicators, setAvailableIndicators] = useState([]);
  const [selectedIndicators, setSelectedIndicators] = useState({});
  const [selectedInterval, setSelectedInterval] = useState('1D');


  // --- Effect 1: Fetch available indicators ---
  useEffect(() => {
    const indicatorListUrl = 'http://127.0.0.1:5000/api/stocks/available-indicators';
    console.log("StockDataViewer: Fetching available indicators...");
    fetch(indicatorListUrl)
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then(data => {
        console.log("StockDataViewer: Available indicators received:", data);
        setAvailableIndicators(data);
        const initialSelection = {}; data.forEach(ind => { initialSelection[ind.id] = false; }); setSelectedIndicators(initialSelection);
      })
      .catch(error => { console.error("Error fetching available indicators:", error); setError(prev => `${prev || ''} Failed indicator list: ${error.message}`.trim()); });
  }, []);


  // --- Effect 2: Fetch Stock Info (Metadata, Date Range, Supported Intervals) ---
   useEffect(() => {
        if (!symbol || !exchange) return;
        setStockInfo({ metadata: null, date_range_1D: null, supported_intervals: ['1D'] }); // Reset
        setStockData(null); setError(null); setSelectedInterval('1D'); setLoadingInfo(true); setLoadingData(false); // Don't set data loading true yet

        // *** CORRECTED CLEAN URL CONSTRUCTION ***
        const infoUrl = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/info?interval=1D`;
        // *** END CORRECTION ***

        console.log("StockDataViewer: Fetching stock info from:", infoUrl);

        fetch(infoUrl)
          .then(response => {
             if (!response.ok) { return response.json().then(errData => { throw new Error(errData.description || `HTTP ${response.status}`); }).catch(() => { throw new Error(`HTTP ${response.status}`); }); }
             return response.json();
          })
          .then(data => {
            console.log("StockDataViewer: Stock info received:", data);
            const supported = Array.isArray(data.supported_intervals) && data.supported_intervals.length > 0 ? data.supported_intervals : ['1D'];
            setStockInfo({ metadata: data.metadata, date_range_1D: data.date_range_1D, supported_intervals: supported });
            if (!supported.includes(selectedInterval)) setSelectedInterval('1D');
            setLoadingInfo(false); // Info loading done
            // Data fetch effect will now trigger if needed
          })
          .catch(error => { console.error(`Error fetching info:`, error); setError(`Failed info: ${error.message}`); setLoadingInfo(false); });

    }, [symbol, exchange]);


  // --- Effect 3: Fetch INITIAL OHLCV Data Chunk ---
  useEffect(() => {
    // Wait for info AND indicators to load before first data fetch
    if (loadingInfo || availableIndicators.length === 0 || !stockInfo.metadata) {
        console.log("StockDataViewer: Skipping initial data fetch - waiting.");
        return; // Don't fetch data until info/indicators are ready
    }

    setLoadingData(true);
    // Don't clear info error, clear data error below on success

    // --- Calculate INITIAL Date Range (~ Last 2 Years) ---
    const endDate = new Date(); let startDate = new Date();
    const defaultDaysToFetch = 365 * 2;
    startDate = subtractDays(endDate, defaultDaysToFetch);
    const minDateAvailable = stockInfo.date_range_1D?.min_time ? new Date(stockInfo.date_range_1D.min_time) : null; // Use min_time from info
    if (minDateAvailable && startDate < minDateAvailable) startDate = minDateAvailable;
    const startDateStr = formatDate(startDate); const endDateStr = formatDate(endDate);

    // Build Indicator String
    const requestedIndicators = Object.entries(selectedIndicators).filter(([_,sel]) => sel).map(([id,_])=> availableIndicators.find(ind => ind.id === id)?.default_params || id).join(',');

    // *** CORRECTED CLEAN URL CONSTRUCTION ***
    const params = new URLSearchParams({ start_date: startDateStr, end_date: endDateStr, interval: selectedInterval });
    if (requestedIndicators) { params.append('indicators', requestedIndicators); }
    const apiUrl = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/data?${params.toString()}`;
    // *** END CORRECTION ***

    console.log(`StockDataViewer: Fetching INITIAL data for ${symbol}/${exchange} (Interval: ${selectedInterval}) - Ind: ${requestedIndicators || 'None'}`);
    console.log("StockDataViewer: API URL:", apiUrl);

    fetch(apiUrl)
      .then(response => { if (!response.ok){ return response.json().then(err => {throw new Error(err.description || `HTTP ${response.status}`)})} return response.json(); })
      .then(data => { console.log("StockDataViewer: Initial data received length:", data?.data?.length); setStockData(data); setError(null); setLoadingData(false); }) // Set the full response object
      .catch(error => { console.error("StockDataViewer: Error fetching stock data:", error); setError(error.message); setLoadingData(false); setStockData(null); });

  // Re-run when selections change to fetch NEW initial chunk
  }, [symbol, exchange, selectedInterval, selectedIndicators, availableIndicators, stockInfo, loadingInfo]); // Depend on loadingInfo to trigger after info loads


  // --- Event Handlers ---
  const handleIndicatorChange = useCallback((event) => { const { name, checked } = event.target; setSelectedIndicators(prev => ({ ...prev, [name]: checked })); }, []);
  const handleIntervalChange = useCallback((interval) => { if (interval && interval !== selectedInterval) { setSelectedInterval(interval); } }, [selectedInterval]);
  const handleStockSelect = useCallback((newSymbol, newExchange) => { if (newSymbol !== symbol || newExchange !== exchange) { setSymbol(newSymbol); setExchange(newExchange); } }, [symbol, exchange]);
  // *** REMOVED handleTimeframeChange ***

  // --- Render Component ---
  return (
    <>
      <div className="selectors-container w-full flex flex-row flex-wrap items-center justify-start gap-4 p-2 md:p-3 mb-4 bg-gray-100 border border-gray-200 rounded-md shadow-sm">
         <IntervalSelector supportedIntervals={stockInfo.supported_intervals} selectedInterval={selectedInterval} onIntervalChange={handleIntervalChange} />
         <StockSelector currentSymbol={symbol} currentExchange={exchange} onStockSelect={handleStockSelect}/>
         {/* TimeframeSelector is REMOVED */}
         <div className="ml-auto"> <IndicatorSelector availableIndicators={availableIndicators} selectedIndicators={selectedIndicators} onIndicatorChange={handleIndicatorChange}/> </div>
         <div className="text-sm font-semibold text-gray-800 hidden md:block w-full md:w-auto md:ml-4 text-right pr-2">
           {/* Display current selection */}
           {stockInfo.metadata?.symbol || symbol} ({stockInfo.metadata?.exchange || exchange}) | {selectedInterval}
         </div>
      </div>

      {/* Use combined loading state */}
      {(loadingInfo || loadingData) && <div className="loading">Loading...</div>}
      {/* Display error if not loading */}
      {!loadingInfo && !loadingData && error && <div className="error">Error: {error}</div>}

      <div className="chart-container-wrapper flex-grow">
        {/* Pass initial data chunk and other necessary props to ChartComponent */}
        {/* Render ChartComponent once info has loaded, even if data is still loading/empty */}
        {!loadingInfo && stockInfo.metadata && (
            <ChartComponent
                // Use a key that changes ONLY when symbol/exchange/interval changes, forcing a clean chart slate
                key={`${symbol}-${exchange}-${selectedInterval}`}
                // Pass the data array from the stockData state object
                initialData={stockData?.data ?? []}
                symbol={symbol}
                exchange={exchange}
                interval={selectedInterval}
                // Pass selected indicators definitions (key and options)
                indicators={Object.entries(selectedIndicators)
                                .filter(([_,sel]) => sel)
                                .map(([id,_]) => availableIndicators.find(ind => ind.id === id)?.default_params || id)}
            />
        )}
        {/* Show no data message only if loading finished without error and no data arrived */}
        {!loadingInfo && !loadingData && !error && (!stockData || !stockData.data || !stockData.data.length === 0) && (
            <div className="flex items-center justify-center h-full text-gray-500">
                {loadingInfo ? 'Loading info...' : `No chart data available for ${symbol}/${selectedInterval}.`}
            </div>
        )}
      </div>
    </>
  );
}

export default StockDataViewer;