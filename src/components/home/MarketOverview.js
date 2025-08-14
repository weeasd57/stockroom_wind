'use client';

import { useState, useEffect } from 'react';
import styles from './MarketOverview.module.css';

export function MarketOverview() {
  const [marketData, setMarketData] = useState({
    trending: [],
    gainers: [],
    losers: [],
    indices: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMarketData() {
      const apiKey = process.env.NEXT_PUBLIC_EOD_API_KEY;
      
      if (!apiKey) {
        setError('API key not configured');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Popular stocks to track
        const popularSymbols = ['AAPL.US', 'GOOGL.US', 'MSFT.US', 'TSLA.US', 'AMZN.US', 'NVDA.US'];
        const indicesSymbols = ['SPY.US', 'QQQ.US', 'DIA.US'];

        // Fetch popular stocks data
        const stockPromises = popularSymbols.map(async (symbol) => {
          try {
            const response = await fetch(
              `https://eodhistoricaldata.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`
            );
            const data = await response.json();
            
            return {
              symbol: symbol.replace('.US', ''),
              name: getCompanyName(symbol),
              price: data.close || data.price || 0,
              change: data.change || 0,
              changePercent: data.change_p || 0,
              volume: data.volume || 0
            };
          } catch (error) {
            console.error(`Error fetching ${symbol}:`, error);
            return null;
          }
        });

        // Fetch indices data
        const indicesPromises = indicesSymbols.map(async (symbol) => {
          try {
            const response = await fetch(
              `https://eodhistoricaldata.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`
            );
            const data = await response.json();
            
            return {
              symbol: symbol.replace('.US', ''),
              name: getIndexName(symbol),
              price: data.close || data.price || 0,
              change: data.change || 0,
              changePercent: data.change_p || 0
            };
          } catch (error) {
            console.error(`Error fetching ${symbol}:`, error);
            return null;
          }
        });

        const [stocksData, indicesData] = await Promise.all([
          Promise.all(stockPromises),
          Promise.all(indicesPromises)
        ]);

        // Filter out failed requests
        const validStocks = stocksData.filter(stock => stock !== null);
        const validIndices = indicesData.filter(index => index !== null);

        // Sort stocks by performance
        const sortedStocks = [...validStocks].sort((a, b) => b.changePercent - a.changePercent);
        
        setMarketData({
          trending: validStocks.slice(0, 3),
          gainers: sortedStocks.slice(0, 3),
          losers: sortedStocks.slice(-3).reverse(),
          indices: validIndices
        });

      } catch (error) {
        console.error('Error fetching market data:', error);
        setError('Failed to load market data');
      } finally {
        setLoading(false);
      }
    }

    fetchMarketData();
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function getCompanyName(symbol) {
    const names = {
      'AAPL.US': 'Apple Inc.',
      'GOOGL.US': 'Alphabet Inc.',
      'MSFT.US': 'Microsoft Corp.',
      'TSLA.US': 'Tesla Inc.',
      'AMZN.US': 'Amazon.com Inc.',
      'NVDA.US': 'NVIDIA Corp.'
    };
    return names[symbol] || symbol;
  }

  function getIndexName(symbol) {
    const names = {
      'SPY.US': 'S&P 500',
      'QQQ.US': 'NASDAQ 100',
      'DIA.US': 'Dow Jones'
    };
    return names[symbol] || symbol;
  }

  function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  }

  function formatChange(change, changePercent) {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
  }

  if (loading) {
    return (
      <div className={styles.marketOverview}>
        <h2 className={styles.title}>📈 Market Overview</h2>
        <div className={styles.loadingGrid}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className={styles.skeleton}></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.marketOverview}>
        <h2 className={styles.title}>📈 Market Overview</h2>
        <div className={styles.errorMessage}>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.marketOverview}>
      <h2 className={styles.title}>📈 Market Overview</h2>
      
      {/* Market Indices */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>📊 Market Indices</h3>
        <div className={styles.indicesGrid}>
          {marketData.indices.map((index) => (
            <div key={index.symbol} className={styles.indexCard}>
              <div className={styles.indexInfo}>
                <h4 className={styles.indexSymbol}>{index.symbol}</h4>
                <p className={styles.indexName}>{index.name}</p>
              </div>
              <div className={styles.indexPrice}>
                <span className={styles.price}>{formatPrice(index.price)}</span>
                <span className={`${styles.change} ${index.change >= 0 ? styles.positive : styles.negative}`}>
                  {formatChange(index.change, index.changePercent)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Stocks */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>🔥 Trending Stocks</h3>
        <div className={styles.stocksGrid}>
          {marketData.trending.map((stock) => (
            <div key={stock.symbol} className={styles.stockCard}>
              <div className={styles.stockInfo}>
                <h4 className={styles.stockSymbol}>{stock.symbol}</h4>
                <p className={styles.stockName}>{stock.name}</p>
              </div>
              <div className={styles.stockPrice}>
                <span className={styles.price}>{formatPrice(stock.price)}</span>
                <span className={`${styles.change} ${stock.change >= 0 ? styles.positive : styles.negative}`}>
                  {formatChange(stock.change, stock.changePercent)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gainers and Losers */}
      <div className={styles.gainersLosers}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>🚀 Top Gainers</h3>
          <div className={styles.miniStocksList}>
            {marketData.gainers.slice(0, 3).map((stock) => (
              <div key={stock.symbol} className={styles.miniStock}>
                <span className={styles.miniSymbol}>{stock.symbol}</span>
                <span className={`${styles.miniChange} ${styles.positive}`}>
                  +{stock.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>📉 Top Losers</h3>
          <div className={styles.miniStocksList}>
            {marketData.losers.slice(0, 3).map((stock) => (
              <div key={stock.symbol} className={styles.miniStock}>
                <span className={styles.miniSymbol}>{stock.symbol}</span>
                <span className={`${styles.miniChange} ${styles.negative}`}>
                  {stock.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}