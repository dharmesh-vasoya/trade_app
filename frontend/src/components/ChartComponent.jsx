// frontend/src/components/ChartComponent.jsx
// FINAL v7 - Adds volume series with tooltip on hover

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { debounce } from 'lodash-es';

function ChartComponent({ data, interval, indicators = [] }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef({});
  const volumeTooltipRef = useRef(null);
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333333',
      },
      width: chartContainerRef.current.clientWidth || 600,
      height: chartContainerRef.current.clientHeight || 400,
      timeScale: { timeVisible: true },
      crosshair: { mode: 1 },
      grid: { vertLines: { visible: false }, horzLines: { color: '#E6E6E6' } },
    });
    chartRef.current = chart;

    const handleResize = debounce(() => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
    }, 100);

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !Array.isArray(data)) return;
    if (data.length === 0) return;

    const formattedData = data
      .map((item) => {
        const time = Number(item.time);
        if (!time || isNaN(time)) return null;
        return {
          time,
          open: +item.open,
          high: +item.high,
          low: +item.low,
          close: +item.close,
          volume: +item.volume,
          ...indicators.reduce((acc, key) => {
            if (item.hasOwnProperty(key)) acc[key] = +item[key];
            return acc;
          }, {}),
        };
      })
      .filter((item) => item && !isNaN(item.time))
      .sort((a, b) => a.time - b.time);

    // --- Candlestick ---
    const candleData = formattedData.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
    if (!seriesRefs.current.candlestick) {
      seriesRefs.current.candlestick = chart.addCandlestickSeries({ title: 'Price' });
    }
    seriesRefs.current.candlestick.setData(candleData);

    // --- Volume (Histogram) ---
    const volumeData = formattedData.map(({ time, close, open, volume }) => ({
      time,
      value: volume,
      color: close >= open ? '#26a69a' : '#ef5350', // green/red
    }));

    if (!seriesRefs.current.volume) {
      seriesRefs.current.volume = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        scaleMargins: { top: 0.8, bottom: 0 },
        title: 'Volume',
      });
    }
    seriesRefs.current.volume.setData(volumeData);

    // --- Fit content on first load ---
    if (!dataLoadedRef.current && candleData.length > 0) {
      chart.timeScale().fitContent();
      dataLoadedRef.current = true;
    }

    // --- Volume Hover Tooltip ---
    if (!volumeTooltipRef.current) {
      volumeTooltipRef.current = document.createElement('div');
      volumeTooltipRef.current.style = `
        position: absolute;
        z-index: 20;
        background: white;
        border: 1px solid #ccc;
        padding: 4px 8px;
        font-size: 12px;
        pointer-events: none;
        border-radius: 4px;
        display: none;
      `;
      chartContainerRef.current.appendChild(volumeTooltipRef.current);
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        volumeTooltipRef.current.style.display = 'none';
        return;
      }

      const volumeVal = param.seriesData.get(seriesRefs.current.volume)?.value;
      if (volumeVal != null) {
        volumeTooltipRef.current.textContent = `Volume: ${volumeVal.toLocaleString()}`;
        volumeTooltipRef.current.style.left = `${param.point.x + 10}px`;
        volumeTooltipRef.current.style.top = `${param.point.y}px`;
        volumeTooltipRef.current.style.display = 'block';
      } else {
        volumeTooltipRef.current.style.display = 'none';
      }
    });

  }, [data, interval, indicators]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '100%', minHeight: '400px', position: 'relative' }} />;
}

export default ChartComponent;
