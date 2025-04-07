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
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333333',
      },
      width: container.clientWidth || window.innerWidth,
      height: container.clientHeight || window.innerHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: interval.includes('min') || interval.includes('s'),
      },
      
      crosshair: { mode: 1 },
      grid: { vertLines: { visible: false }, horzLines: { color: '#E6E6E6' } },
    });

    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => {
      if (chart && container) {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const container = chartContainerRef.current;
    if (!chart || !container || !Array.isArray(data)) return;

    if (data.length === 0) return;

    const formattedData = data
      .map((item) => {
        const time = Math.floor(Number(item.time) / 1000);
        if (!time || isNaN(time)) return null;

        const base = {
          time,
          open: +item.open,
          high: +item.high,
          low: +item.low,
          close: +item.close,
          volume: +item.volume,
        };

        indicators.forEach((key) => {
          if (item[key] != null && !isNaN(item[key])) {
            base[key] = +item[key];
          }
        });

        return base;
      })
      .filter((item) => item && !isNaN(item.time))
      .sort((a, b) => a.time - b.time);

    if (formattedData.length === 0) return;

    // --- Candlestick Series ---
    const candleData = formattedData.map(({ time, open, high, low, close }) => ({
      time,
      open,
      high,
      low,
      close,
    }));

    if (!seriesRefs.current.candlestick) {
      seriesRefs.current.candlestick = chart.addCandlestickSeries({ title: 'Price' });
    }
    seriesRefs.current.candlestick.setData(candleData);

    // --- Volume Histogram (smaller pane height) ---
    const volumeData = formattedData.map(({ time, close, open, volume }) => ({
      time,
      value: volume,
      color: close >= open ? '#26a69a' : '#ef5350',
    }));

    if (!seriesRefs.current.volume) {
      seriesRefs.current.volume = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        scaleMargins: { top: 0.97, bottom: 0 }, // smaller volume height
        title: 'Volume',
      });
    }
    seriesRefs.current.volume.setData(volumeData);

    // --- Indicators ---
    indicators.forEach((indicatorKey) => {
      const indicatorData = formattedData
        .map((row) => {
          const value = row[indicatorKey];
          return value != null && !isNaN(value) ? { time: row.time, value } : null;
        })
        .filter(Boolean);

      if (!seriesRefs.current[indicatorKey]) {
        seriesRefs.current[indicatorKey] = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 1,
          title: indicatorKey,
        });
      }

      seriesRefs.current[indicatorKey].setData(indicatorData);
    });

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
      container.appendChild(volumeTooltipRef.current);
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData || !volumeTooltipRef.current) {
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

  return (
    <div
      ref={chartContainerRef}
      className="chart-container"
    />
  );
  
}

export default ChartComponent;
