"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import styles from '@/styles/PriceHistoryChart.module.css';

export default function PriceHistoryChart({ priceChecks, targetPrice, stopLossPrice, initialPrice }) {
  const chartContainerRef = useRef(null);
  const [chartCreated, setChartCreated] = useState(false);
  
  useEffect(() => {
    if (!chartContainerRef.current || !priceChecks || priceChecks.length < 2) return;
    
    // Clean up previous chart if it exists
    if (chartContainerRef.current.firstChild) {
      chartContainerRef.current.innerHTML = '';
    }
    
    // Determine if we're dealing with the new format (with open, high, low, close) or old format
    const isNewFormat = priceChecks[0] && ('close' in priceChecks[0]);
    
    // Helpers to validate inputs and prevent invalid numbers from reaching the chart
    const toUnixSeconds = (dateStr) => {
      const ts = Date.parse(dateStr);
      return Number.isFinite(ts) ? Math.floor(ts / 1000) : NaN;
    };
    const toFinite = (val) => {
      const n = typeof val === 'number' ? val : parseFloat(val);
      return Number.isFinite(n) ? n : NaN;
    };
    
    // Sort price checks by date
    const sortedChecks = [...priceChecks].sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });
    
    // Prepare and sanitize data for the chart
    const candleData = isNewFormat
      ? sortedChecks
          .map((check) => {
            const time = toUnixSeconds(check.date);
            const open = toFinite(check.open);
            const high = toFinite(check.high);
            const low = toFinite(check.low);
            const close = toFinite(check.close);
            return { time, open, high, low, close };
          })
          .filter((c) =>
            Number.isFinite(c.time) &&
            Number.isFinite(c.open) &&
            Number.isFinite(c.high) &&
            Number.isFinite(c.low) &&
            Number.isFinite(c.close)
          )
      : sortedChecks
          .map((check) => {
            const time = toUnixSeconds(check.date);
            const value = toFinite(check.price);
            return { time, value };
          })
          .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.value));

    // If sanitized dataset is too small, skip chart creation to avoid invalid SVG/path
    if (!candleData || candleData.length < 2) {
      setChartCreated(false);
      return;
    }
    
    // Format dates for x-axis
    const firstDate = new Date(sortedChecks[0].date);
    const lastDate = new Date(sortedChecks[sortedChecks.length - 1].date);
    
    // Get first and last day of month for display format
    const firstDay = firstDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    const lastDay = lastDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    
    // Create chart with improved styling
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#333333',
        fontSize: 12,
        fontFamily: 'Roboto, Arial, sans-serif',
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#EEEEEE',
        textColor: '#666666',
      },
      rightPriceScale: {
        borderColor: '#EEEEEE',
        textColor: '#666666',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      grid: {
        horzLines: {
          color: '#F5F5F5',
          visible: true,
        },
        vertLines: {
          color: '#F5F5F5',
          visible: true,
        },
      },
      crosshair: {
        horzLine: {
          color: 'rgba(0, 0, 0, 0.3)',
          width: 1,
          style: 0,
        },
        vertLine: {
          color: 'rgba(0, 0, 0, 0.3)',
          width: 1,
          style: 0,
        },
        mode: 1,
      },
    });
    
    // Add the main series (candlestick or line)
    const mainSeries = isNewFormat 
      ? chart.addCandlestickSeries({
          upColor: '#4ADE80', // Bright green for up candles
          downColor: '#F87171', // Bright red for down candles
          borderVisible: false,
          wickUpColor: '#4ADE80',
          wickDownColor: '#F87171',
        })
      : chart.addLineSeries({
          color: '#3B82F6', // Blue for line chart
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          lastValueVisible: true,
        });
    
    mainSeries.setData(candleData);
    
    // Add horizontal lines for target, stop loss, and initial price with improved styling
    if (targetPrice) {
      const targetValue = toFinite(targetPrice);
      if (Number.isFinite(targetValue)) {
      const targetLine = chart.addLineSeries({
        color: '#4ADE80', // Bright green for target
        lineWidth: 1,
        lineStyle: 2, // Dashed line
        title: 'Target',
        lastValueVisible: true,
      });
      
      targetLine.setData([
        { time: candleData[0].time, value: targetValue },
        { time: candleData[candleData.length - 1].time, value: targetValue }
      ]);
      
      // Add clear target price label
      const labelSeries = chart.addLineSeries({
        color: 'transparent',
        lastValueVisible: false,
      });
      
      labelSeries.setData([
        { time: candleData[0].time, value: targetValue }
      ]);
      
      labelSeries.setMarkers([
        {
          time: candleData[0].time,
          position: 'inBar',
          color: '#4ADE80',
          shape: 'labelDown',
          text: `Target: ${targetValue.toFixed(2)}`,
          size: 1,
        }
      ]);
      }
    }
    
    if (stopLossPrice) {
      const stopValue = toFinite(stopLossPrice);
      if (Number.isFinite(stopValue)) {
      const stopLine = chart.addLineSeries({
        color: '#F87171', // Bright red for stop loss
        lineWidth: 1,
        lineStyle: 2, // Dashed line
        title: 'Stop',
        lastValueVisible: true,
      });
      
      stopLine.setData([
        { time: candleData[0].time, value: stopValue },
        { time: candleData[candleData.length - 1].time, value: stopValue }
      ]);
      
      // Add clear stop loss label
      const labelSeries = chart.addLineSeries({
        color: 'transparent',
        lastValueVisible: false,
      });
      
      labelSeries.setData([
        { time: candleData[0].time, value: stopValue }
      ]);
      
      labelSeries.setMarkers([
        {
          time: candleData[0].time,
          position: 'inBar',
          color: '#F87171',
          shape: 'labelDown',
          text: `Stop: ${stopValue.toFixed(2)}`,
          size: 1,
        }
      ]);
      }
    }
    
    if (initialPrice) {
      const initialValue = toFinite(initialPrice);
      if (Number.isFinite(initialValue)) {
      const initialLine = chart.addLineSeries({
        color: '#94A3B8', // Gray for initial price
        lineWidth: 1,
        lineStyle: 2, // Dashed line
        title: 'Initial',
        lastValueVisible: true,
      });
      
      initialLine.setData([
        { time: candleData[0].time, value: initialValue },
        { time: candleData[candleData.length - 1].time, value: initialValue }
      ]);
      
      // Add clear initial price label
      const labelSeries = chart.addLineSeries({
        color: 'transparent',
        lastValueVisible: false,
      });
      
      labelSeries.setData([
        { time: candleData[0].time, value: initialValue }
      ]);
      
      labelSeries.setMarkers([
        {
          time: candleData[0].time,
          position: 'inBar',
          color: '#94A3B8',
          shape: 'labelDown',
          text: `Initial: ${initialValue.toFixed(2)}`,
          size: 1,
        }
      ]);
      }
    }
    
    // Format dates for x-axis labels and ensure they're visible
    chart.timeScale().fitContent();
    
    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    setChartCreated(true);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [priceChecks, targetPrice, stopLossPrice, initialPrice]);
  
  // If there are not enough price checks, display a message
  if (!priceChecks || priceChecks.length < 2) {
    return (
      <div className={styles.noDataContainer}>
        <p className={styles.noDataMessage}>
          Not enough price history data to display chart.
        </p>
        <p className={styles.noDataHint}>
          Check prices more frequently to build a history chart.
        </p>
      </div>
    );
  }
  
  // Format dates for display in title
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  };
  
  const startDate = priceChecks.length > 0 ? formatDate(priceChecks[0].date) : '';
  const endDate = priceChecks.length > 0 ? formatDate(priceChecks[priceChecks.length - 1].date) : '';
  
  return (
    <div className={styles.chartContainer}>
      <div ref={chartContainerRef} className={styles.chart} />
    </div>
  );
} 