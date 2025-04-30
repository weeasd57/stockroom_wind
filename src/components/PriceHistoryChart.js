"use client";

import React, { useEffect, useRef } from 'react';
import styles from '@/styles/PriceHistoryChart.module.css';

export default function PriceHistoryChart({ priceChecks, targetPrice, stopLossPrice, initialPrice }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current || !priceChecks || priceChecks.length < 2) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Determine if we're dealing with the new format (with open, high, low, close) or old format
    const isNewFormat = priceChecks[0] && ('close' in priceChecks[0]);
    
    // Sort price checks by date
    const sortedChecks = [...priceChecks].sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });
    
    // Get price values for min/max calculations
    const prices = isNewFormat 
      ? sortedChecks.flatMap(check => [
          parseFloat(check.open), 
          parseFloat(check.high), 
          parseFloat(check.low), 
          parseFloat(check.close)
        ])
      : sortedChecks.map(check => parseFloat(check.price));
    
    // Add initial price, target price, and stop loss to the price range
    const allPrices = [
      ...prices,
      initialPrice ? parseFloat(initialPrice) : null,
      targetPrice ? parseFloat(targetPrice) : null,
      stopLossPrice ? parseFloat(stopLossPrice) : null
    ].filter(price => price !== null && !isNaN(price));
    
    // Calculate min and max with some padding
    const minPrice = Math.min(...allPrices) * 0.95;
    const maxPrice = Math.max(...allPrices) * 1.05;
    
    // Dates for x-axis
    const dates = sortedChecks.map(check => new Date(check.date));
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    
    // Set dimensions
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    
    // Function to map a price to y coordinate
    const getPriceY = (price) => {
      return height - padding - ((price - minPrice) / (maxPrice - minPrice)) * (height - 2 * padding);
    };
    
    // Function to map a date to x coordinate
    const getDateX = (date) => {
      return padding + ((date - minDate) / (maxDate - minDate)) * (width - 2 * padding);
    };
    
    // Draw the axes
    ctx.beginPath();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw the price line
    ctx.beginPath();
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < sortedChecks.length; i++) {
      // For new format, use close price; for old format, use price
      const price = isNewFormat 
        ? parseFloat(sortedChecks[i].close)
        : parseFloat(sortedChecks[i].price);
      
      const date = new Date(sortedChecks[i].date);
      const x = getDateX(date);
      const y = getPriceY(price);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Draw OHLC candles if we have that data
    if (isNewFormat) {
      const candleWidth = Math.min(8, (width - 2 * padding) / sortedChecks.length * 0.8);
      
      for (let i = 0; i < sortedChecks.length; i++) {
        const candle = sortedChecks[i];
        const open = parseFloat(candle.open);
        const high = parseFloat(candle.high);
        const low = parseFloat(candle.low);
        const close = parseFloat(candle.close);
        const date = new Date(candle.date);
        
        const x = getDateX(date);
        const yOpen = getPriceY(open);
        const yHigh = getPriceY(high);
        const yLow = getPriceY(low);
        const yClose = getPriceY(close);
        
        // Draw the high-low line
        ctx.beginPath();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();
        
        // Determine if it's an up or down day
        const isUp = close >= open;
        ctx.fillStyle = isUp ? '#2ecc71' : '#e74c3c';
        ctx.strokeStyle = isUp ? '#2ecc71' : '#e74c3c';
        
        // Draw the candle body
        const candleHeight = Math.abs(yOpen - yClose);
        const yTop = isUp ? yClose : yOpen;
        ctx.fillRect(x - candleWidth / 2, yTop, candleWidth, Math.max(1, candleHeight));
      }
    } else {
      // Draw dots for each data point (old format)
      for (let i = 0; i < sortedChecks.length; i++) {
        const price = parseFloat(sortedChecks[i].price);
        const date = new Date(sortedChecks[i].date);
        const x = getDateX(date);
        const y = getPriceY(price);
        
        ctx.beginPath();
        ctx.fillStyle = '#4a90e2';
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Label the price
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(price.toFixed(2), x, y - 10);
      }
    }
    
    // Draw initial price line if available
    if (initialPrice) {
      const initialY = getPriceY(parseFloat(initialPrice));
      
      ctx.beginPath();
      ctx.strokeStyle = '#95a5a6';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.moveTo(padding, initialY);
      ctx.lineTo(width - padding, initialY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Label
      ctx.fillStyle = '#95a5a6';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Initial: ${parseFloat(initialPrice).toFixed(2)}`, padding + 5, initialY - 5);
    }
    
    // Draw target price line if available
    if (targetPrice) {
      const targetY = getPriceY(parseFloat(targetPrice));
      
      ctx.beginPath();
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.moveTo(padding, targetY);
      ctx.lineTo(width - padding, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Label
      ctx.fillStyle = '#2ecc71';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Target: ${parseFloat(targetPrice).toFixed(2)}`, padding + 5, targetY - 5);
    }
    
    // Draw stop loss line if available
    if (stopLossPrice) {
      const stopLossY = getPriceY(parseFloat(stopLossPrice));
      
      ctx.beginPath();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.moveTo(padding, stopLossY);
      ctx.lineTo(width - padding, stopLossY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Label
      ctx.fillStyle = '#e74c3c';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Stop: ${parseFloat(stopLossPrice).toFixed(2)}`, padding + 5, stopLossY - 5);
    }
    
    // Draw x-axis labels (dates)
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    // Draw first and last date
    if (dates.length >= 2) {
      const firstDate = dates[0].toLocaleDateString();
      const lastDate = dates[dates.length - 1].toLocaleDateString();
      
      ctx.fillText(firstDate, padding, height - padding + 15);
      ctx.fillText(lastDate, width - padding, height - padding + 15);
    }
    
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
  
  return (
    <div className={styles.chartContainer}>
      <h4 className={styles.chartTitle}>Price History Chart</h4>
      <canvas 
        ref={canvasRef}
        className={styles.chart}
        width="500"
        height="300"
      />
    </div>
  );
} 