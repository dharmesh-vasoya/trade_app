// frontend/src/components/ChartComponent.jsx
// FINAL v6 - Added more detailed logs inside data processing effect

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { debounce } from 'lodash-es'; // Ensure installed

// Helper functions
const formatDate = (dt) => { /* ... */ };
const subtractDays = (date, days) => { /* ... */ };

function ChartComponent({ initialData, symbol, exchange, interval, indicators = [] }) { // Default indicators to []
    console.log(`ChartComponent: Render. Symbol:<span class="math-inline">\{symbol\} Interval\:</span>{interval} InitialData:${initialData?.length}`);
    // Add log for indicators prop
    console.log('DEBUG ChartComponent: Received indicators prop:', indicators, 'Is Array:', Array.isArray(indicators));

    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRefs = useRef({});
    const dataRangeLoaded = useRef({ oldest: null, newest: null });
    const isLoadingMore = useRef(false);
    const hasMoreHistory = useRef(true);

    const [chartData, setChartData] = useState([]);

    // --- Helper to Fetch Older Data ---
    const fetchAndPrependData = useCallback(async () => { /* ... keep implementation ... */ }, [symbol, exchange, interval, indicators, chartData]);

    // --- Effect 1: Create/Destroy Chart Instance & Listeners ---
    useEffect(() => { /* ... keep implementation ... */ }, []);

     // --- Effect 2: Process Initial Data Prop ---
     useEffect(() => {
         console.log("Chart InitialData Effect: Processing prop length:", initialData?.length);
         if (initialData && initialData.length > 0) {
             // Backend sends 'time' key with epoch seconds
             const timeKey = initialData[0]?.timestamp ? 'timestamp' : (initialData[0]?.date ? 'date' : 'time'); // Find actual time key
             console.log(`Chart InitialData Effect: Detected timeKey in prop: ${timeKey}`);

             const sortedData = [...initialData].map(item => ({ // Map to internal format { time: seconds, ... }
                  time: item[timeKey], // Use detected key
                  open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume,
                  // Copy only requested indicators if present
                  ...indicators.reduce((acc, indKey) => { if (item.hasOwnProperty(indKey)) acc[indKey] = item[indKey]; return acc; }, {})
              })).filter(item => item.time != null && !isNaN(item.time)) // Filter invalid time
              .sort((a, b) => a.time - b.time);

             setChartData(sortedData); // Set internal state
             const oldestTs = sortedData[0]?.time || null; // Use 'time' key from internal format
             const newestTs = sortedData[sortedData.length-1]?.time || null; // Use 'time' key
             dataRangeLoaded.current = { oldest: oldestTs, newest: newestTs }; // Store numeric timestamp
             hasMoreHistory.current = true;
             console.log(`Chart InitialData Effect: Set chartData. Time Range (Epoch Sec): ${oldestTs} to ${newestTs}`);
         } else {
              setChartData([]); dataRangeLoaded.current = { oldest: null, newest: null }; hasMoreHistory.current = true;
              console.log("Chart InitialData Effect: Initial data prop empty/null.");
         }
     }, [initialData, indicators]); // Add indicators dependency here too


    // --- Effect 3: Update Chart Series When Internal `chartData` State Changes ---
    useEffect(() => {
        const chart = chartRef.current;
        console.log("DEBUG UpdateEffect: Running Effect. Chart Ref:", chart ? 'Exists' : 'null'); // Log ref status
        console.log('DEBUG UpdateEffect: chartData type:', typeof chartData, 'Is Array:', Array.isArray(chartData), 'Length:', chartData?.length);
        console.log('DEBUG UpdateEffect: indicators prop:', indicators, 'Is Array:', Array.isArray(indicators)); // Log indicators prop

        if (!chart || !Array.isArray(chartData)) { /* ... exit logic ... */ return; }
        if (chartData.length === 0) { /* ... clear series logic ... */ return; }
        console.log("Chart Update Series: Processing chartData length:", chartData.length);

        // --- Data Formatting & Detailed Log ---
        const allFormattedData = [];
        let mapError = false; // Flag for errors inside map
        chartData.forEach((item, index) => { // Use forEach for better logging
            if (mapError) return; // Stop processing if error found
            try {
                // Ensure time is a number
                if (item == null || item.time == null || typeof item.time !== 'number') {
                    console.warn(`Invalid time in chartData at index ${index}:`, item);
                    return; // Skip this item
                }
                const point = { time: item.time }; // Time is already epoch seconds

                // Add required OHLCV, ensure they are numbers
                if (item.open == null || item.high == null || item.low == null || item.close == null) {
                     console.warn(`Invalid OHLC found at index ${index}:`, item);
                     return; // Skip candle if OHLC missing
                }
                point.open = +item.open; point.high = +item.high; point.low = +item.low; point.close = +item.close;
                if (item.volume != null) point.volume = +item.volume;

                // Check indicators prop BEFORE iterating
                if (!Array.isArray(indicators)) {
                     console.error("Indicators prop is not an array!", indicators);
                     mapError = true; return; // Stop processing
                }
                // Add indicator values if present in data and requested in prop
                indicators.forEach(indKey => {
                     if(item.hasOwnProperty(indKey) && item[indKey] !== null) {
                          const indValue = +item[indKey]; // Ensure number
                          if (!isNaN(indValue)) { // Check if conversion worked
                              point[indKey] = indValue;
                          }
                     }
                });
                allFormattedData.push(point); // Add valid point to array

            } catch (err) {
                console.error(`Error processing item at index ${index}:`, item, err);
                mapError = true; // Stop processing on error
            }
        }); // End chartData.forEach

        if (mapError) { console.error("Stopped processing due to error within loop."); return; }
        console.log("DEBUG ChartComponent: Count AFTER formatting & loop:", allFormattedData.length);
        if (allFormattedData.length === 0) { /* ... clear series logic ... */ return; }
        // --- End Data Formatting ---


        // --- Candlestick Update ---
        const candleData = allFormattedData.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
        console.log("DEBUG ChartComponent: Candle data count before setData:", candleData.length);
        if (candleData.length > 0) {
            if (!seriesRefs.current.candlestick) { /* ... create ... */ }
            try { seriesRefs.current.candlestick.setData(candleData); console.log("Candlestick data updated."); }
            catch(e) { console.error("Error during candlestick setData:", e); }
        } else if (seriesRefs.current.candlestick) { /* ... clear series ... */ }

        // --- Indicator Update ---
        const indicatorConfigs = indicators.map(indKey => { /* ... map key to options ... */ });
        const activeIndicatorKeys = new Set(indicators);
        indicatorConfigs.forEach(config => { /* ... update/add/remove logic ... */ });
        Object.keys(seriesRefs.current).forEach(key => { /* ... remove stale series ... */ });

        console.log("Chart Update Series: Finished.");

    }, [chartData, interval, indicators]); // Depend on internal chartData


    console.log('ChartComponent: Rendering div container.');
    return <div ref={chartContainerRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />;
}

export default ChartComponent;