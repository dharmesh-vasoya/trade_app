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

  const [connecting, setConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Backend check
  useEffect(() => {
    const maxRetries = 5;

    const checkBackendAvailability = async (attempt = 0) => {
      try {
        const res = await fetch('http://127.0.0.1:5000/api/stocks/available-indicators');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setAvailableIndicators(data || []);
        const initial = {};
        data.forEach(ind => {
          initial[ind.id] = {
            enabled: false,
            params: ind.default_params || {}
          };
        });
        setSelectedIndicators(initial);

        setConnecting(false);
        setConnectionError(null);
      } catch (err) {
        console.error(`Connection attempt ${attempt + 1} failed:`, err);
        setConnectionAttempts(attempt + 1);

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 500;
          setTimeout(() => checkBackendAvailability(attempt + 1), delay);
        } else {
          setConnecting(false);
          setConnectionError("Can't connect to backend after several attempts.");
        }
      }
    };

    checkBackendAvailability();
  }, []);

  useEffect(() => {
    if (!symbol || !exchange || connecting || connectionError) return;

    const url = `http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/info?interval=${interval}`;
    fetch(url)
      .then(res => res.ok ? res.json() : Promise.reject(res.statusText))
      .then(data => {
        setStockInfo(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching stock info:", err);
        setLoading(false);
        setError(`Failed to fetch stock info for ${symbol}`);
      });
  }, [symbol, exchange, interval, connecting, connectionError]);

  useEffect(() => {
    if (!stockInfo?.metadata || availableIndicators.length === 0 || connecting || connectionError) return;

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
      .filter(([_, config]) => config.enabled)
      .map(([id, config]) => ({
        id,
        params: config.params
      }));

    const url = new URL(`http://127.0.0.1:5000/api/stocks/${exchange}/${symbol}/data`);
    url.searchParams.set("interval", interval);
    url.searchParams.set("start_date", startStr);
    url.searchParams.set("end_date", endStr);
    if (selectedIndicatorParams.length > 0) {
      url.searchParams.set("indicators", JSON.stringify(selectedIndicatorParams));
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
        setStockData(null);
        setLoading(false);
        setError(`Failed to load chart data for ${symbol}`);
      });
  }, [symbol, exchange, interval, selectedIndicators, availableIndicators, stockInfo, connecting, connectionError]);

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

  const handleIndicatorToggle = useCallback((id, enabled) => {
    setSelectedIndicators(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        enabled
      }
    }));
  }, []);

  const handleIndicatorParamChange = useCallback((indicatorId, paramKey, value) => {
    setSelectedIndicators(prev => ({
      ...prev,
      [indicatorId]: {
        ...prev[indicatorId],
        params: {
          ...prev[indicatorId].params,
          [paramKey]: Number(value)
        }
      }
    }));
  }, []);

  return (
    <div className="App">
      {connecting && (
        <div className="loading">Connecting to backend... (Attempt {connectionAttempts + 1})</div>
      )}

      {!connecting && connectionError && (
        <div className="error">{connectionError}</div>
      )}

      {!connecting && !connectionError && (
        <>
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
              onToggle={handleIndicatorToggle}
              onParamChange={handleIndicatorParamChange}
            />
          </div>

          {loading && <div className="loading">Loading...</div>}
          {error && !loading && <div className="error">{error}</div>}

          <div className="chart-container-wrapper">
            {!loading && stockData && (
              <ChartComponent
                key={`${symbol}-${exchange}-${interval}-${JSON.stringify(selectedIndicators)}`}
                data={stockData}
                interval={interval}
                indicators={selectedIndicators}
              />
            )}

            {!loading && !error && (!stockData || stockData.length === 0) && (
              <div className="text-center text-gray-500 p-4">
                No data for {symbol} [{interval}]
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
