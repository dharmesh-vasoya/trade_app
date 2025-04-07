// frontend/src/components/ChartComponent.jsx
// REFACTORED version - should be the same as the last one provided

import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

function ChartComponent({ data }) {
    console.log('ChartComponent: Render function called.');
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRefs = useRef({}); // Use an object to store multiple series refs keyed by type/name

    // --- Effect 1: Create and Cleanup Chart Instance & Resize Listener ---
    useEffect(() => {
        if (!chartContainerRef.current) {
            console.log("Chart Create/Cleanup Effect: No container ref.");
            return;
        }
        console.log("Chart Create/Cleanup Effect: Initializing chart instance...");

        const chartOptions = { /* ... Omitted for brevity ... */ }; // Use options from previous step
        const chart = createChart(chartContainerRef.current, chartOptions);
        chartRef.current = chart;
        console.log("Chart Create/Cleanup Effect: Chart instance CREATED.");

        // Resize listener setup
        const handleResize = () => { /* ... */ }; // Keep implementation
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial size apply

        // Cleanup function: Only runs when component UNMOUNTS
        return () => {
             console.log("Chart Cleanup Effect: Cleanup running...");
             window.removeEventListener('resize', handleResize);
             if (chartRef.current) {
                console.log("Chart Cleanup Effect: Removing chart instance.");
                chartRef.current.remove();
                chartRef.current = null;
             } else {
                 console.log("Chart Cleanup Effect: Chart already removed or never created.");
             }
             seriesRefs.current = {};
        };
    }, []); // Empty dependency array: Runs only ONCE on mount, cleans up on unmount

    // --- Effect 2: Update Series Data When 'data' Prop Changes ---
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || !data || data.length === 0) {
            console.log("Chart Update Effect: Exit (no chart or no data)");
            Object.entries(seriesRefs.current).forEach(([key, series]) => { // Clear existing series if data becomes empty
                 if (series) chart.removeSeries(series);
            });
            seriesRefs.current = {};
            return;
        }
        console.log("Chart Update Effect: Received new data length:", data.length);

        // --- Candlestick Data ---
        const candleData = data
            .map(item => ({ time: item.date, open: item.open, high: item.high, low: item.low, close: item.close }))
            .sort((a, b) => new Date(a.time) - new Date(b.time));

        if (!seriesRefs.current.candlestick) {
            console.log("Chart Update Effect: Creating Candlestick series...");
            seriesRefs.current.candlestick = chart.addCandlestickSeries({ /* ... options ... */ });
        }
        console.log("Chart Update Effect: Updating Candlestick data...");
        seriesRefs.current.candlestick.setData(candleData);


        // --- Indicator Data (Dynamic Handling) ---
        const indicatorConfigs = [
             { key: 'SMA_20', options: { color: 'blue', lineWidth: 2, title: 'SMA 20' } },
             { key: 'SMA_50', options: { color: 'orange', lineWidth: 2, title: 'SMA 50' } },
             // Add other indicators here
        ];

        indicatorConfigs.forEach(config => {
            const { key, options } = config;
            const series = seriesRefs.current[key]; // Get current ref for this indicator

            const hasIndicatorData = data[0]?.hasOwnProperty(key);

            if (hasIndicatorData) {
                const indicatorData = data
                    .filter(item => item[key] !== null && item[key] !== undefined)
                    .map(item => ({ time: item.date, value: item[key] }));

                if (indicatorData.length > 0) {
                    if (!series) { // Series doesn't exist, create it
                         console.log(`Chart Update Effect: Creating ${key} series...`);
                         seriesRefs.current[key] = chart.addLineSeries(options);
                    } else {
                         // Ensure options are up-to-date (optional)
                         // series.applyOptions(options);
                    }
                    console.log(`Chart Update Effect: Updating ${key} data...`);
                    seriesRefs.current[key].setData(indicatorData); // Update data
                } else if (series) { // Data column exists but is empty/all nulls, clear series
                    console.log(`Chart Update Effect: Setting empty data for ${key}.`);
                     seriesRefs.current[key].setData([]);
                }
            } else { // Indicator column NOT present in input data
                if (series) { // If the series exists on chart, remove it
                    console.log(`Chart Update Effect: Removing ${key} series (data not present).`);
                    chart.removeSeries(series);
                    seriesRefs.current[key] = null; // Clear the ref
                }
            }
        });

        console.log("Chart Update Effect: Finished processing data update.");

    }, [data]); // Re-run ONLY when data prop changes


    console.log('ChartComponent: Rendering div container.');
    return <div ref={chartContainerRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />;
}

export default ChartComponent;