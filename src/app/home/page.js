'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import styles from '@/styles/home.module.css';

// Mock data for the dashboard
const mockStocks = [
  { id: 1, symbol: 'AAPL', name: 'Apple Inc.', price: 182.63, change: 1.25, changePercent: 0.69, volume: '52.3M', targetPrice: 195.00, stopLoss: 175.00, successRate: '68%' },
  { id: 2, symbol: 'MSFT', name: 'Microsoft Corp.', price: 418.42, change: -2.35, changePercent: -0.56, volume: '18.7M', targetPrice: 440.00, stopLoss: 400.00, successRate: '72%' },
  { id: 3, symbol: 'GOOGL', name: 'Alphabet Inc.', price: 172.91, change: 3.42, changePercent: 2.02, volume: '24.1M', targetPrice: 185.00, stopLoss: 165.00, successRate: '63%' },
  { id: 4, symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.12, change: 0.87, changePercent: 0.49, volume: '31.8M', targetPrice: 190.00, stopLoss: 170.00, successRate: '58%' },
  { id: 5, symbol: 'TSLA', name: 'Tesla Inc.', price: 173.80, change: -5.63, changePercent: -3.14, volume: '95.2M', targetPrice: 200.00, stopLoss: 160.00, successRate: '54%' },
];

const mockNews = [
  { 
    id: 1, 
    title: 'Target prices analysis shows 65% success rate across community',
    summary: 'FireStocks community traders have shown a 65% success rate in hitting target prices over the last quarter, outperforming market averages.',
    source: 'FireStocks Analytics',
    time: '2 hours ago'
  },
  { 
    id: 2, 
    title: 'Tech stocks continue to dominate community recommendations',
    summary: 'Tech sector recommendations account for over 40% of all posts with the highest success rates for target price predictions.',
    source: 'Community Insights',
    time: '5 hours ago'
  },
  { 
    id: 3, 
    title: 'New feature: Trader performance ranking system launched',
    summary: 'FireStocks has released a new ranking system that automatically tracks and scores traders based on their prediction accuracy.',
    source: 'Platform Updates',
    time: '8 hours ago'
  },
];

const topTraders = [
  { id: 1, name: 'TradeMaster92', successRate: '78%', totalPosts: 124, targetHits: 97 },
  { id: 2, name: 'StockGuru', successRate: '75%', totalPosts: 86, targetHits: 65 },
  { id: 3, name: 'ValueInvestor', successRate: '72%', totalPosts: 152, targetHits: 109 },
];

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
  const [marketTrend, setMarketTrend] = useState('up'); // 'up' or 'down'
  const [activeTab, setActiveTab] = useState('overview');
  const [isVisible, setIsVisible] = useState(false);
  const [showFeatureGuide, setShowFeatureGuide] = useState(true);

  useEffect(() => {
    // Redirect to landing page if not authenticated
    if (!loading && !isAuthenticated) {
      router.push('/landing');
    }
    
    // Calculate overall market trend from mock data
    const totalChange = mockStocks.reduce((sum, stock) => sum + stock.changePercent, 0);
    setMarketTrend(totalChange >= 0 ? 'up' : 'down');
    
    // Animation effect
    setIsVisible(true);
  }, [isAuthenticated, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }

  // If not authenticated, don't render anything (we're redirecting)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`${styles.homePage} ${isVisible ? styles.visible : ''}`}>
      {/* Dashboard Header */}
      <header className={styles.dashboardHeader}>
        <div className={styles.container}>
          <div className={styles.welcomeSection}>
            <h1 className={styles.welcomeTitle}>
              Welcome back, {user?.displayName || 'User'}
            </h1>
            <p className={styles.welcomeSubtitle}>
              Market is {marketTrend === 'up' ? 'up' : 'down'} today. 
              <span className={marketTrend === 'up' ? styles.trendUp : styles.trendDown}>
                {marketTrend === 'up' ? '↑' : '↓'} 
                {marketTrend === 'up' ? '+0.85%' : '-0.62%'}
              </span>
            </p>
          </div>
          <div className={styles.dashboardActions}>
            <button className={styles.actionButton}>
              Dashboard
            </button>
            <button className={`${styles.actionButton} ${styles.primaryAction}`}>
              New Post
            </button>
          </div>
        </div>
      </header>

      {/* Feature Guide */}
      {showFeatureGuide && (
        <div className={styles.featureGuide}>
          <div className={styles.container}>
            <div className={styles.guideHeader}>
              <h2 className={styles.guideTitle}>FireStocks Community Trading Platform</h2>
              <button 
                className={styles.closeGuide}
                onClick={() => setShowFeatureGuide(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.guideContent}>
              <p className={styles.guideDescription}>
                FireStocks is a community-driven platform for traders to share stock analysis with target prices and stop loss levels. 
                Our platform automatically tracks the performance of each post to see if stocks hit their target or stop loss price.
              </p>
              <div className={styles.guideFeatures}>
                <div className={styles.featureItem}>
                  <h3 className={styles.featureTitle}>Post Analysis</h3>
                  <p className={styles.featureDesc}>Share stock picks with target price and stop loss levels. Our system tracks if stocks hit targets or stop losses.</p>
                </div>
                <div className={styles.featureItem}>
                  <h3 className={styles.featureTitle}>Performance Tracking</h3>
                  <p className={styles.featureDesc}>Every post is automatically analyzed to calculate success rates and performance metrics.</p>
                </div>
                <div className={styles.featureItem}>
                  <h3 className={styles.featureTitle}>Trader Rankings</h3>
                  <p className={styles.featureDesc}>Traders are ranked based on the accuracy of their predictions, helping you find the most reliable analysts.</p>
                </div>
              </div>
              <div className={styles.guideCta}>
                <Link href="/create-post" className={styles.guideButton}>
                  Create Your First Analysis
                </Link>
                <Link href="/learn-more" className={styles.guideLink}>
                  Learn more about how it works
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Tabs */}
      <div className={styles.dashboardTabs}>
        <div className={styles.container}>
          <ul className={styles.tabsList}>
            <li 
              className={`${styles.tabItem} ${activeTab === 'overview' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </li>
            <li 
              className={`${styles.tabItem} ${activeTab === 'portfolio' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('portfolio')}
            >
              Portfolio
            </li>
            <li 
              className={`${styles.tabItem} ${activeTab === 'watchlist' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('watchlist')}
            >
              Watchlist
            </li>
            <li 
              className={`${styles.tabItem} ${activeTab === 'insights' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('insights')}
            >
              Insights
            </li>
          </ul>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <main className={styles.dashboardContent}>
        <div className={styles.container}>
          <div className={styles.dashboardGrid}>
            {/* Market Overview Card */}
            <section className={`${styles.dashboardCard} ${styles.marketOverview}`}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Stock Analysis Overview</h2>
                <div className={styles.cardActions}>
                  <button className={styles.cardAction}>
                  </button>
                </div>
              </div>
              <div className={styles.stocksTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCol}>Symbol</div>
                  <div className={styles.tableCol}>Price</div>
                  <div className={styles.tableCol}>Change</div>
                  <div className={styles.tableCol}>Target</div>
                  <div className={styles.tableCol}>Stop Loss</div>
                  <div className={styles.tableCol}>Success Rate</div>
                </div>
                {mockStocks.map(stock => (
                  <div key={stock.id} className={styles.tableRow}>
                    <div className={styles.tableCol}>
                      <div className={styles.stockInfo}>
                        <span className={styles.stockSymbol}>{stock.symbol}</span>
                        <span className={styles.stockName}>{stock.name}</span>
                      </div>
                    </div>
                    <div className={styles.tableCol}>
                      <span className={styles.stockPrice}>${stock.price.toFixed(2)}</span>
                    </div>
                    <div className={styles.tableCol}>
                      <span className={stock.change >= 0 ? styles.priceUp : styles.priceDown}>
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                    <div className={styles.tableCol}>
                      <span className={styles.targetPrice}>${stock.targetPrice.toFixed(2)}</span>
                    </div>
                    <div className={styles.tableCol}>
                      <span className={styles.stopLoss}>${stock.stopLoss.toFixed(2)}</span>
                    </div>
                    <div className={styles.tableCol}>
                      <span className={styles.successRate}>{stock.successRate}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.cardFooter}>
                <Link href="/markets" className={styles.cardLink}>
                  View All Stocks
                </Link>
              </div>
            </section>

            {/* Top Traders Card */}
            <section className={`${styles.dashboardCard} ${styles.topTraders}`}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Top Performing Traders</h2>
                <div className={styles.cardActions}>
                  <button className={styles.cardAction}>
                  </button>
                </div>
              </div>
              <div className={styles.tradersList}>
                {topTraders.map(trader => (
                  <div key={trader.id} className={styles.traderItem}>
                    <div className={styles.traderInfo}>
                      <h3 className={styles.traderName}>{trader.name}</h3>
                      <div className={styles.traderStats}>
                        <span className={styles.successBadge}>{trader.successRate} Success</span>
                        <span className={styles.postCount}>{trader.totalPosts} posts</span>
                      </div>
                    </div>
                    <div className={styles.traderPerformance}>
                      <div className={styles.performanceBar}>
                        <div 
                          className={styles.performanceFill} 
                          style={{width: trader.successRate}}
                        ></div>
                      </div>
                      <span className={styles.performanceText}>{trader.targetHits} target hits</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.cardFooter}>
                <Link href="/traders" className={styles.cardLink}>
                  View All Traders
                </Link>
              </div>
            </section>

            {/* Market News Card */}
            <section className={`${styles.dashboardCard} ${styles.marketNews}`}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Community Insights</h2>
                <div className={styles.cardActions}>
                  <button className={styles.cardAction}>
                  </button>
                </div>
              </div>
              <div className={styles.newsList}>
                {mockNews.map(news => (
                  <div key={news.id} className={styles.newsItem}>
                    <div className={styles.newsContent}>
                      <h3 className={styles.newsTitle}>{news.title}</h3>
                      <p className={styles.newsSummary}>{news.summary}</p>
                      <div className={styles.newsFooter}>
                        <span className={styles.newsSource}>{news.source}</span>
                        <span className={styles.newsTime}>{news.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.cardFooter}>
                <Link href="/news" className={styles.cardLink}>
                  View All Insights
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
} 