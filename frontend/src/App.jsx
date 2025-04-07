// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import ChartComponent from './components/ChartComponent';
import IndicatorSelector from './components/IndicatorSelector';
import IntervalSelector from './components/IntervalSelector';
import StockSelector from './components/StockSelector';

const formatDate = (dt) => {
  const dateObj = new Date(dt);
  if (isNaN(dateObj.getTime())) return null;
  return dateObj.toISOString().split('T')[0];
};

const subtractDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
};

function App() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [exchange, setExchange] = useState('NSE');
  const [interval, setInterval] = useState('1D');
  const [stockData, setStockData] = useState(null);
  const [stockInfo, setStockInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableIndicators, setAvailableIndicators] = useState([]);
  const [selectedIndicators, setSelectedIndicators] = useState({});
  const [error, setError] = useState(null);

  // Fetch indicator metadata
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/stocks/available-indicators')
      .then(res => res.ok ? res.json() : Promise.reject(res.statusText))
      .then(data => {
        setAvailableIndicators(data || []);
        const initial = {};
        data.forEach(ind => (initial[ind.id] = false));
        setSelectedIndicators(initial);
      })
      .catch(err => {
        console.error("Error fetching indicators:", err);
        setError("Failed to fetch indicators");
      });
  }, []);

  // Fetch stock info (metadata, supported intervals, min time)
  useEffect(() => {
    if (!symbol || !exchange) return;
    const url = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/info?interval=${interval}`;
    fetch(url)
      .then(res => res.ok ? res.json() : Promise.reject(res.statusText))
      .then(data => {
        setStockInfo(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching stock info:", err);
        setError("Failed to fetch stock info");
        setLoading(false);
      });
  }, [symbol, exchange]);

  // Fetch OHLCV chart data when symbol, interval, or indicators change
  useEffect(() => {
    if (!stockInfo?.metadata || availableIndicators.length === 0) return;
  
    const endDate = new Date();
    let startDate = subtractDays(endDate, 730);
    const minTime = stockInfo?.[`date_range_${interval}`]?.min_time;
    if (minTime) {
      const minDate = new Date(minTime);
      if (minDate > startDate) startDate = minDate;
    }
  
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
  
    const selectedIndicatorParams = Object.entries(selectedIndicators)
      .filter(([_, val]) => val)
      .map(([id]) => availableIndicators.find(i => i.id === id)?.default_params || id)
      .join(',');
  
    const url = new URL(`http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/data`);
    url.searchParams.set("interval", interval);
    url.searchParams.set("start_date", startStr);
    url.searchParams.set("end_date", endStr);
    if (selectedIndicatorParams) {
      url.searchParams.set("indicators", selectedIndicatorParams);
    }
  
    setLoading(true);
    fetch(url.toString())
      .then(res => res.ok ? res.json() : res.json().then(err => Promise.reject(err.description || res.statusText)))
      .then(data => {
        console.log("Chart Data:", data.data);
        setStockData(data.data || []);
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching chart data:", err);
        setError("Failed to load chart");
        setStockData(null);
        setLoading(false);
      });
  }, [symbol, exchange, interval, selectedIndicators, availableIndicators]);
  

  // Handlers
  const handleStockSelect = (sym, exch) => {
    if (sym !== symbol || exch !== exchange) {
      setSymbol(sym);
      setExchange(exch);
      setStockData(null);
    }
  };

  const handleIntervalChange = useCallback((val) => {
    if (val !== interval) setInterval(val);
  }, [interval]);

  const handleIndicatorChange = useCallback((event) => {
    const { name, checked } = event.target;
    setSelectedIndicators((prev) => ({ ...prev, [name]: checked }));
  }, []);

  const activeIndicatorParams = Object.entries(selectedIndicators)
    .filter(([_, selected]) => selected)
    .map(([id]) => availableIndicators.find(ind => ind.id === id)?.default_params || id);

  // UI
  return (
    <div className="App">
      <div className="selectors-container">
        <IntervalSelector
          supportedIntervals={stockInfo?.supported_intervals || ['1D']}
          selectedInterval={interval}
          onIntervalChange={handleIntervalChange}
        />
        <StockSelector
          currentSymbol={symbol}
          currentExchange={exchange}
          onStockSelect={handleStockSelect}
        />
        <IndicatorSelector
          availableIndicators={availableIndicators}
          selectedIndicators={selectedIndicators}
          onIndicatorChange={handleIndicatorChange}
        />
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && !loading && <div className="error">{error}</div>}

      <div className="chart-container-wrapper">
        {!loading && stockData && (
          <ChartComponent
            key={`${symbol}-${exchange}-${interval}-${activeIndicatorParams.join(',')}`}
            data={stockData}
            interval={interval}
            indicators={activeIndicatorParams}
          />
        )}

        {!loading && !error && (!stockData || stockData.length === 0) && (
          <div className="text-center text-gray-500 p-4">
            No data for {symbol} [{interval}]
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
