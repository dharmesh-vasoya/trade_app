// frontend/src/components/StockDataViewer.jsx
// FINAL Version v10 - CLEANED URL construction for /data endpoint

import React, { useState, useEffect, useCallback } from 'react';
import ChartComponent from './ChartComponent'; // Assumes Simplified Stable Chart Component
import IndicatorSelector from './IndicatorSelector';
import IntervalSelector from './IntervalSelector';
import StockSelector from './StockSelector';

// Helper function to format date to YYYY-MM-DD
const formatDate = (dt) => {
  if (!dt) return null;
  let dateObj = dt;
  if (!(dt instanceof Date)) {
      dateObj = new Date(dt); // Try parsing if not already Date object
  }
  if (isNaN(dateObj.getTime())) {
      console.error("Invalid date object in formatDate:", dt);
      return null;
  }
  // Use UTC methods to get YYYY-MM-DD consistently
  const year = dateObj.getUTCFullYear();
  const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;  // ✅ FIXED LINE
};


// Helper for date subtraction
const subtractDays = (date, days) => {
    const result = new Date(date); // Creates date in local timezone from input
    // Use UTC setDate to avoid DST issues during calculation
    result.setUTCDate(result.getUTCDate() - days);
    return result;
}

function StockDataViewer() {
  const [stockData, setStockData] = useState(null); // Holds full API response { symbol, data: [], ...}
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [symbol, setSymbol] = useState('INFY');
  const [exchange, setExchange] = useState('NSE');
  const [stockInfo, setStockInfo] = useState({ metadata: null, date_range_1D: null, supported_intervals: ['1D'] });
  const [availableIndicators, setAvailableIndicators] = useState([]);
  const [selectedIndicators, setSelectedIndicators] = useState({});
  const [selectedInterval, setSelectedInterval] = useState('1D');
  // No timeframe range selector state needed

  // Effect 1: Fetch available indicators
  useEffect(() => {
    const indicatorListUrl = 'http://127.0.0.1:5000/api/stocks/available-indicators';
    fetch(indicatorListUrl)
      .then(response => response.ok ? response.json() : Promise.reject(`HTTP ${response.status}`))
      .then(data => { setAvailableIndicators(data || []); const initSel = {}; (data||[]).forEach(ind => { initSel[ind.id] = false; }); setSelectedIndicators(initSel); })
      .catch(error => { console.error("Error fetching indicators:", error); setError(prev => `${prev || ''} Failed indicators list: ${error.message}`.trim()); });
  }, []);

  // Effect 2: Fetch Stock Info
   useEffect(() => {
        if (!symbol || !exchange) return;
        setStockInfo({ metadata: null, date_range_1D: null, supported_intervals: ['1D'] });
        setStockData(null); setError(null); setSelectedInterval('1D'); setLoadingInfo(true); setLoadingData(false);

        // --- CLEAN INFO URL ---
        const infoUrl = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/info?interval=1D`;
        console.log("StockDataViewer: Fetching stock info from:", infoUrl);

        fetch(infoUrl)
          .then(response => { if (!response.ok){ throw new Error(`HTTP ${response.status}`)} return response.json(); })
          .then(data => {
            console.log("StockDataViewer: Stock info received:", data);
            const supported = Array.isArray(data.supported_intervals) && data.supported_intervals.length > 0 ? data.supported_intervals : ['1D', '1W', '1M']; // Fallback if backend missing it
            setStockInfo({ metadata: data.metadata, date_range_1D: data.date_range_1D, supported_intervals: supported });
            if (!supported.includes(selectedInterval)) setSelectedInterval('1D');
            setLoadingInfo(false);
          })
          .catch(error => { console.error(`Error fetching info:`, error); setError(`Failed info: ${error.message}`); setLoadingInfo(false); });
    }, [symbol, exchange]);

  // Effect 3: Fetch INITIAL OHLCV Data Chunk
  useEffect(() => {
    if (loadingInfo || availableIndicators.length === 0 || !stockInfo.metadata) { return; }
    setLoadingData(true);

    // Calculate Date Range (~ Last 2 Years)
    const endDate = new Date(); let startDate = new Date();
    const defaultDaysToFetch = 365 * 2;
    startDate = subtractDays(endDate, defaultDaysToFetch);
    // Use date range info from the /info endpoint (use min_time)
    const minDateAvailable = stockInfo.date_range_1D?.min_time ? new Date(stockInfo.date_range_1D.min_time) : null;
    if (minDateAvailable && startDate < minDateAvailable) startDate = minDateAvailable;

    // --- CLEAN DATE FORMATTING ---
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    if (!startDateStr || !endDateStr) { console.error("Failed to format dates"); setLoadingData(false); return; }
    // ---

    // Build Indicator String
    const requestedIndicators = Object.entries(selectedIndicators).filter(([_,sel]) => sel).map(([id,_])=> availableIndicators.find(ind => ind.id === id)?.default_params || id).join(',');

    // --- CLEAN API URL CONSTRUCTION ---
    const params = new URLSearchParams({ start_date: startDateStr, end_date: endDateStr, interval: selectedInterval });
    if (requestedIndicators) { params.append('indicators', requestedIndicators); }
    const apiUrl = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/data?${params.toString()}`;
    // --- END CLEAN URL ---

    console.log(`StockDataViewer: Fetching data for <span class="math-inline">\{symbol\}/</span>{exchange} (Interval: ${selectedInterval}) - Ind: ${requestedIndicators || 'None'}`);
    console.log("StockDataViewer: API URL:", apiUrl);

    fetch(apiUrl)
      .then(response => { if (!response.ok){ return response.json().then(err => {throw new Error(err.description || `HTTP ${response.status}`)})} return response.json(); })
      .then(data => { console.log("StockDataViewer: Data received length:", data?.data?.length); setStockData(data); setError(null); setLoadingData(false); })
      .catch(error => { console.error("StockDataViewer: Error fetching stock data:", error); setError(error.message); setLoadingData(false); setStockData(null); });

  }, [symbol, exchange, selectedInterval, selectedIndicators, availableIndicators, stockInfo, loadingInfo]);

  // Event Handlers
  const handleIndicatorChange = useCallback((event) => { const { name, checked } = event.target; setSelectedIndicators(prev => ({ ...prev, [name]: checked })); }, []);
  const handleIntervalChange = useCallback((interval) => { if (interval && interval !== selectedInterval) { setSelectedInterval(interval); } }, [selectedInterval]);
  const handleStockSelect = useCallback((newSymbol, newExchange) => { if (newSymbol !== symbol || newExchange !== exchange) { setSymbol(newSymbol); setExchange(newExchange); } }, [symbol, exchange]);

  const activeIndicatorParams = Object.entries(selectedIndicators).filter(([_, isSelected]) => isSelected).map(([id, _]) => availableIndicators.find(ind => ind.id === id)?.default_params || id);

  // Render Component
  return (
    <>
      <div className="selectors-container w-full flex flex-row flex-wrap items-center justify-start gap-4 p-2 md:p-3 mb-4 bg-gray-100 border border-gray-200 rounded-md shadow-sm">
         <IntervalSelector supportedIntervals={stockInfo.supported_intervals} selectedInterval={selectedInterval} onIntervalChange={handleIntervalChange} />
         <StockSelector currentSymbol={symbol} currentExchange={exchange} onStockSelect={handleStockSelect}/>
         <div className="ml-auto"> <IndicatorSelector availableIndicators={availableIndicators} selectedIndicators={selectedIndicators} onIndicatorChange={handleIndicatorChange}/> </div>
         <div className="text-sm font-semibold text-gray-800 hidden md:block w-full md:w-auto md:ml-4 text-right pr-2">
           {stockInfo.metadata?.symbol || symbol} ({stockInfo.metadata?.exchange || exchange}) | {selectedInterval}
         </div>
      </div>

      {(loadingInfo || loadingData) && <div className="loading">Loading...</div>}
      {!loadingInfo && !loadingData && error && <div className="error">Error: {error}</div>}

      <div className="chart-container-wrapper flex-grow">
        {!loadingInfo && stockInfo.metadata && (
            <ChartComponent
                key={`<span class="math-inline">\{symbol\}\-</span>{exchange}-${selectedInterval}`}
                data={stockData?.data ?? []} // Pass the data array
                interval={selectedInterval}
                indicators={activeIndicatorParams}
            />
        )}
        {!loadingInfo && !loadingData && !error && (!stockData || !stockData.data || !stockData.data.length === 0) && (
             <div className="flex items-center justify-center h-full text-gray-500">
                {loadingInfo ? 'Loading info...' : `No chart data available for <span class="math-inline">\{symbol\}/</span>{selectedInterval}.`}
             </div>
        )}
      </div>
    </>
  );
}
export default StockDataViewer;