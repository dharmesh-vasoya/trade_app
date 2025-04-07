import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { debounce } from 'lodash-es';

function ChartComponent({ data, interval, indicators = [] }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef({});

  // Effect 1: Chart initialization and resize
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333333',
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#eee' },
      },
    });

    chartRef.current = chart;

    const handleResize = debounce(() => {
      if (chart && chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 500,
        });
      }
    }, 150);

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Effect 2: Data update
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !Array.isArray(data) || data.length === 0) return;

    // Cleanup previous series
    Object.values(seriesRefs.current).forEach(s => chart.removeSeries(s));
    seriesRefs.current = {};

    const candleSeries = chart.addCandlestickSeries();
    const volumeSeries = chart.addHistogramSeries({ priceScaleId: '' });

    const candleData = [];
    const volumeData = [];
    const indicatorSeriesMap = {};

    data.forEach(item => {
      if (!item.time) return;
      const time = Number(item.time);
      if (isNaN(time)) return;

      if (
        item.open != null &&
        item.high != null &&
        item.low != null &&
        item.close != null
      ) {
        candleData.push({
          time,
          open: +item.open,
          high: +item.high,
          low: +item.low,
          close: +item.close,
        });
      }

      if (item.volume != null) {
        volumeData.push({ time, value: +item.volume, color: '#8884d8' });
      }

      // Handle indicators
      indicators.forEach(ind => {
        if (!(ind in item)) return;
        if (!indicatorSeriesMap[ind]) {
          indicatorSeriesMap[ind] = chart.addLineSeries({ title: ind });
        }
        indicatorSeriesMap[ind].update({ time, value: +item[ind] });
      });
    });

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    Object.entries(indicatorSeriesMap).forEach(([id, series]) => {
      seriesRefs.current[id] = series;
    });

    seriesRefs.current.candles = candleSeries;
    seriesRefs.current.volume = volumeSeries;

  }, [data, interval, indicators]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />;
}

export default ChartComponent;
