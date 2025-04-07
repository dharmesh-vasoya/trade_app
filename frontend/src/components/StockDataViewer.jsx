// frontend/src/components/StockDataViewer.jsx
// FINAL Version v11 - REFRESHES chart on indicator change, data fetch cleaned

import React, { useState, useEffect, useCallback } from 'react';
import ChartComponent from './ChartComponent';
import IndicatorSelector from './IndicatorSelector';
import IntervalSelector from './IntervalSelector';
import StockSelector from './StockSelector';

const formatDate = (dt) => {
  if (!dt) return null;
  let dateObj = dt instanceof Date ? dt : new Date(dt);
  if (isNaN(dateObj.getTime())) return null;
  const year = dateObj.getUTCFullYear();
  const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const subtractDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
};

function StockDataViewer() {
  const [stockData, setStockData] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [symbol, setSymbol] = useState('INFY');
  const [exchange, setExchange] = useState('NSE');
  const [stockInfo, setStockInfo] = useState({ metadata: null, date_range_1D: null, supported_intervals: ['1D'] });
  const [availableIndicators, setAvailableIndicators] = useState([]);
  const [selectedIndicators, setSelectedIndicators] = useState({});
  const [selectedInterval, setSelectedInterval] = useState('1D');

  // 1. Fetch available indicators
  useEffect(() => {
    const indicatorListUrl = 'http://127.0.0.1:5000/api/stocks/available-indicators';
    fetch(indicatorListUrl)
      .then(res => res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`))
      .then(data => {
        setAvailableIndicators(data || []);
        const initialSelection = {};
        (data || []).forEach(ind => { initialSelection[ind.id] = false; });
        setSelectedIndicators(initialSelection);
      })
      .catch(err => setError(`Failed indicators list: ${err.message}`));
  }, []);

  // 2. Fetch stock info on symbol/exchange change
  useEffect(() => {
    if (!symbol || !exchange) return;
    setStockInfo({ metadata: null, date_range_1D: null, supported_intervals: ['1D'] });
    setStockData(null); setError(null); setSelectedInterval('1D'); setLoadingInfo(true);

    const infoUrl = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/info?interval=1D`;
    fetch(infoUrl)
      .then(res => res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`))
      .then(data => {
        const supported = Array.isArray(data.supported_intervals) && data.supported_intervals.length > 0
          ? data.supported_intervals : ['1D', '1W', '1M'];
        setStockInfo({ metadata: data.metadata, date_range_1D: data.date_range_1D, supported_intervals: supported });
        if (!supported.includes(selectedInterval)) setSelectedInterval('1D');
        setLoadingInfo(false);
      })
      .catch(err => {
        setError(`Failed info: ${err.message}`);
        setLoadingInfo(false);
      });
  }, [symbol, exchange]);

  // 3. Fetch OHLCV data on relevant changes
  useEffect(() => {
    if (loadingInfo || availableIndicators.length === 0 || !stockInfo.metadata) return;
    setLoadingData(true);

    const endDate = new Date();
    let startDate = subtractDays(endDate, 730); // 2 years
    const minDate = stockInfo.date_range_1D?.min_time ? new Date(stockInfo.date_range_1D.min_time) : null;
    if (minDate && startDate < minDate) startDate = minDate;

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    if (!startDateStr || !endDateStr) {
      setError("Date formatting failed.");
      setLoadingData(false);
      return;
    }

    const indicatorString = Object.entries(selectedIndicators)
      .filter(([_, val]) => val)
      .map(([id]) => availableIndicators.find(ind => ind.id === id)?.default_params || id)
      .join(',');

    const params = new URLSearchParams({ start_date: startDateStr, end_date: endDateStr, interval: selectedInterval });
    if (indicatorString) params.append('indicators', indicatorString);

    const apiUrl = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/data?${params.toString()}`;

    fetch(apiUrl)
      .then(res => res.ok ? res.json() : res.json().then(err => { throw new Error(err.description || `HTTP ${res.status}`); }))
      .then(data => {
        setStockData(data);
        setError(null);
        setLoadingData(false);
      })
      .catch(err => {
        setError(err.message);
        setStockData(null);
        setLoadingData(false);
      });

  }, [symbol, exchange, selectedInterval, selectedIndicators, availableIndicators, stockInfo, loadingInfo]);

  // Event Handlers
  const handleIndicatorChange = useCallback((event) => {
    const { name, checked } = event.target;
    setSelectedIndicators(prev => ({ ...prev, [name]: checked }));
  }, []);

  const handleIntervalChange = useCallback((interval) => {
    if (interval !== selectedInterval) setSelectedInterval(interval);
  }, [selectedInterval]);

  const handleStockSelect = useCallback((newSymbol, newExchange) => {
    if (newSymbol !== symbol || newExchange !== exchange) {
      setSymbol(newSymbol); setExchange(newExchange);
    }
  }, [symbol, exchange]);

  const activeIndicatorParams = Object.entries(selectedIndicators)
    .filter(([_, selected]) => selected)
    .map(([id]) => availableIndicators.find(ind => ind.id === id)?.default_params || id);

  // Render
  return (
    <>
      <div className="selectors-container w-full flex flex-row flex-wrap items-center justify-start gap-4 p-2 md:p-3 mb-4 bg-gray-100 border border-gray-200 rounded-md shadow-sm">
        <IntervalSelector supportedIntervals={stockInfo.supported_intervals} selectedInterval={selectedInterval} onIntervalChange={handleIntervalChange} />
        <StockSelector currentSymbol={symbol} currentExchange={exchange} onStockSelect={handleStockSelect} />
        <div className="ml-auto">
          <IndicatorSelector availableIndicators={availableIndicators} selectedIndicators={selectedIndicators} onIndicatorChange={handleIndicatorChange} />
        </div>
        <div className="text-sm font-semibold text-gray-800 hidden md:block w-full md:w-auto md:ml-4 text-right pr-2">
          {stockInfo.metadata?.symbol || symbol} ({stockInfo.metadata?.exchange || exchange}) | {selectedInterval}
        </div>
      </div>

      {(loadingInfo || loadingData) && <div className="loading">Loading...</div>}
      {!loadingInfo && !loadingData && error && <div className="error">Error: {error}</div>}

      <div className="chart-container-wrapper flex-grow">
        {!loadingInfo && stockInfo.metadata && (
          <ChartComponent
            key={`${symbol}-${exchange}-${selectedInterval}-${activeIndicatorParams.join(',')}`}
            data={(stockData?.data ?? []).map(d => ({
              ...d,
              time: d.time * 1000 // Convert seconds → milliseconds
            }))}
            
            interval={selectedInterval}
            indicators={activeIndicatorParams}
          />
        )}
        {!loadingInfo && !loadingData && !error && (!stockData?.data?.length) && (
          <div className="flex items-center justify-center h-full text-gray-500">
            No chart data available for {symbol}/{selectedInterval}.
          </div>
        )}
      </div>
    </>
  );
}

export default StockDataViewer;
