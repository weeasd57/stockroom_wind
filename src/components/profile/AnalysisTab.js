'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useAnalysisState } from '@/providers/AnalysisStateProvider';
import styles from '@/styles/analysisTab.module.css';
import AdvancedChartBuilder from './AdvancedChartBuilder';

export default function AnalysisTab({ userId, posts }) {
  const { supabase } = useSupabase();
  
  // Get persisted state from provider
  const {
    viewMode,
    setViewMode,
    dateRange,
    setDateRange,
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    showCharts,
    setShowCharts,
    visibleCharts,
    toggleChart,
    customCharts,
    customChartsVisibility,
    toggleCustomChart,
    addCustomChart: addCustomChartToProvider,
    deleteCustomChart: deleteCustomChartFromProvider,
  } = useAnalysisState();
  
  // Local temporary state (not persisted)
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterText, setFilterText] = useState('');
  const [collapsedWeeks, setCollapsedWeeks] = useState(new Set());
  const [showChartBuilder, setShowChartBuilder] = useState(false);
  const [newChartConfig, setNewChartConfig] = useState({
    name: '',
    chartType: 'bar',
    dataSource: 'status',
  });

  // Custom Chart Functions (using provider)
  const addCustomChart = () => {
    if (!newChartConfig.name.trim()) {
      alert('Please enter a chart name');
      return;
    }
    addCustomChartToProvider(newChartConfig);
    setNewChartConfig({ name: '', chartType: 'bar', dataSource: 'status' });
    setShowChartBuilder(false);
  };

  // Filter posts by date
  const filteredPosts = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    
    let filtered = [...posts];
    
    // Apply date filtering
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (dateRange === 'today') {
      filtered = filtered.filter(post => {
        const postDate = new Date(post.created_at);
        return postDate >= today;
      });
    } else if (dateRange === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(post => {
        const postDate = new Date(post.created_at);
        return postDate >= weekAgo;
      });
    } else if (dateRange === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(post => {
        const postDate = new Date(post.created_at);
        return postDate >= monthAgo;
      });
    } else if (dateRange === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(post => {
        const postDate = new Date(post.created_at);
        return postDate >= start && postDate <= end;
      });
    }
    
    // Apply text filter
    if (filterText) {
      const searchLower = filterText.toLowerCase();
      filtered = filtered.filter(post => 
        post.symbol?.toLowerCase().includes(searchLower) ||
        post.company_name?.toLowerCase().includes(searchLower) ||
        post.strategy?.toLowerCase().includes(searchLower) ||
        post.country?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      // Handle numeric values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle string values
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
    
    return filtered;
  }, [posts, dateRange, startDate, endDate, filterText, sortColumn, sortDirection]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredPosts.length;
    const successCount = filteredPosts.filter(p => p.status === 'success' || p.target_reached).length;
    const lossCount = filteredPosts.filter(p => p.status === 'loss' || p.stop_loss_triggered).length;
    const openCount = filteredPosts.filter(p => !p.status || p.status === 'open').length;
    
    // Calculate Success Rate same as Dashboard:
    // (Successful Posts / (Successful Posts + Loss Posts)) * 100
    const closedPosts = successCount + lossCount;
    const successRate = closedPosts > 0 
      ? ((successCount / closedPosts) * 100).toFixed(1) 
      : 0;
    
    const totalBuyVotes = filteredPosts.reduce((sum, p) => sum + (p.buy_count || 0), 0);
    const totalSellVotes = filteredPosts.reduce((sum, p) => sum + (p.sell_count || 0), 0);
    const totalComments = filteredPosts.reduce((sum, p) => sum + (p.comment_count || 0), 0);
    
    const avgCurrentPrice = filteredPosts.reduce((sum, p) => sum + (p.current_price || 0), 0) / (total || 1);
    const avgTargetPrice = filteredPosts.reduce((sum, p) => sum + (p.target_price || 0), 0) / (total || 1);
    const avgStopLoss = filteredPosts.reduce((sum, p) => sum + (p.stop_loss || 0), 0) / (total || 1);
    
    // Calculate price change percentages
    const priceChanges = filteredPosts
      .filter(p => p.current_price && p.target_price)
      .map(p => ((p.current_price - p.target_price) / p.target_price) * 100);
    
    const avgPriceChange = priceChanges.length > 0 
      ? priceChanges.reduce((sum, val) => sum + val, 0) / priceChanges.length 
      : 0;
    
    return {
      total,
      successCount,
      lossCount,
      openCount,
      closedPosts,
      successRate,
      totalBuyVotes,
      totalSellVotes,
      totalComments,
      avgCurrentPrice: avgCurrentPrice.toFixed(2),
      avgTargetPrice: avgTargetPrice.toFixed(2),
      avgStopLoss: avgStopLoss.toFixed(2),
      avgPriceChange: avgPriceChange.toFixed(2),
    };
  }, [filteredPosts]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num) => {
    if (num == null) return '-';
    return Number(num).toFixed(2);
  };

  const getStatusBadge = (post) => {
    if (post.status === 'success' || post.target_reached) {
      return <span className={`${styles.badge} ${styles.badgeSuccess}`}>Success</span>;
    }
    if (post.status === 'loss' || post.stop_loss_triggered) {
      return <span className={`${styles.badge} ${styles.badgeLoss}`}>Loss</span>;
    }
    return <span className={`${styles.badge} ${styles.badgeOpen}`}>Open</span>;
  };

  // Calendar view helper functions
  const getWeekNumber = (date) => {
    const d = new Date(date);
    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const getWeekLabel = (date) => {
    const d = new Date(date);
    return `Week ${getWeekNumber(d)}, ${d.getFullYear()}`;
  };

  const toggleWeek = (weekLabel) => {
    setCollapsedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekLabel)) {
        newSet.delete(weekLabel);
      } else {
        newSet.add(weekLabel);
      }
      return newSet;
    });
  };

  // Group posts by week for calendar view
  const calendarData = useMemo(() => {
    const grouped = {};
    filteredPosts.forEach(post => {
      const date = new Date(post.created_at);
      const weekLabel = getWeekLabel(date);
      const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!grouped[weekLabel]) {
        grouped[weekLabel] = {};
      }
      if (!grouped[weekLabel][dayKey]) {
        grouped[weekLabel][dayKey] = [];
      }
      grouped[weekLabel][dayKey].push(post);
    });
    return grouped;
  }, [filteredPosts]);

  // Chart data preparation
  const chartData = useMemo(() => {
    // 1. Posts per month
    const monthlyData = {};
    filteredPosts.forEach(post => {
      const date = new Date(post.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, success: 0, loss: 0, open: 0 };
      }
      monthlyData[monthKey].total++;
      if (post.status === 'success' || post.target_reached) monthlyData[monthKey].success++;
      else if (post.status === 'loss' || post.stop_loss_triggered) monthlyData[monthKey].loss++;
      else monthlyData[monthKey].open++;
    });

    // 2. Success rate over time
    const sortedMonths = Object.keys(monthlyData).sort();
    const successRateData = sortedMonths.map(month => ({
      month,
      rate: monthlyData[month].success + monthlyData[month].loss > 0 
        ? ((monthlyData[month].success / (monthlyData[month].success + monthlyData[month].loss)) * 100).toFixed(1)
        : 0
    }));

    // 3. Posts by Strategy
    const strategyData = {};
    filteredPosts.forEach(post => {
      const strategy = post.strategy || 'No Strategy';
      if (!strategyData[strategy]) {
        strategyData[strategy] = { total: 0, success: 0, loss: 0 };
      }
      strategyData[strategy].total++;
      if (post.status === 'success' || post.target_reached) strategyData[strategy].success++;
      if (post.status === 'loss' || post.stop_loss_triggered) strategyData[strategy].loss++;
    });

    // 4. Posts by Country
    const countryData = {};
    filteredPosts.forEach(post => {
      const country = post.country || 'Unknown';
      if (!countryData[country]) {
        countryData[country] = { total: 0, success: 0, loss: 0 };
      }
      countryData[country].total++;
      if (post.status === 'success' || post.target_reached) countryData[country].success++;
      if (post.status === 'loss' || post.stop_loss_triggered) countryData[country].loss++;
    });

    // 5. Posts by Sentiment
    const sentimentData = {
      bullish: { total: 0, success: 0, loss: 0 },
      bearish: { total: 0, success: 0, loss: 0 },
      neutral: { total: 0, success: 0, loss: 0 }
    };
    filteredPosts.forEach(post => {
      const sentiment = post.sentiment?.toLowerCase() || 'neutral';
      if (sentimentData[sentiment]) {
        sentimentData[sentiment].total++;
        if (post.status === 'success' || post.target_reached) sentimentData[sentiment].success++;
        if (post.status === 'loss' || post.stop_loss_triggered) sentimentData[sentiment].loss++;
      }
    });

    // 6. Engagement over time
    const engagementData = sortedMonths.map(month => {
      const postsInMonth = filteredPosts.filter(post => {
        const date = new Date(post.created_at);
        const postMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return postMonth === month;
      });
      
      return {
        month,
        buyVotes: postsInMonth.reduce((sum, p) => sum + (p.buy_count || 0), 0),
        sellVotes: postsInMonth.reduce((sum, p) => sum + (p.sell_count || 0), 0),
        comments: postsInMonth.reduce((sum, p) => sum + (p.comment_count || 0), 0)
      };
    });

    return { 
      monthlyData, 
      successRateData, 
      sortedMonths,
      strategyData,
      countryData,
      sentimentData,
      engagementData
    };
  }, [filteredPosts]);

  return (
    <div className={styles.analysisContainer}>
      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Posts</div>
          <div className={styles.statValue}>{stats.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Success Rate</div>
          <div className={styles.statValue}>{stats.successRate}%</div>
          <div className={styles.statSubtext}>{stats.successCount} / {stats.closedPosts} closed</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Open Positions</div>
          <div className={styles.statValue}>{stats.openCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg Price Change</div>
          <div className={`${styles.statValue} ${parseFloat(stats.avgPriceChange) >= 0 ? styles.positive : styles.negative}`}>
            {stats.avgPriceChange}%
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Engagement</div>
          <div className={styles.statValue}>{stats.totalBuyVotes + stats.totalSellVotes + stats.totalComments}</div>
          <div className={styles.statSubtext}>
            👍 {stats.totalBuyVotes} | 👎 {stats.totalSellVotes} | 💬 {stats.totalComments}
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <select 
              className={styles.filterSelect}
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <>
              <div className={styles.filterGroup}>
                <input
                  type="date"
                  className={styles.filterInput}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Start Date"
                />
              </div>
              <div className={styles.filterGroup}>
                <input
                  type="date"
                  className={styles.filterInput}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="End Date"
                />
              </div>
            </>
          )}

          <div className={styles.filterGroup}>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="Search by symbol, company, strategy..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        </div>

        <button
          className={styles.chartBuilderBtn}
          onClick={() => setShowChartBuilder(true)}
          title="Create Custom Chart"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Chart Builder
        </button>

        <button
          className={`${styles.chartsToggleBtn} ${showCharts ? styles.active : ''}`}
          onClick={() => setShowCharts(!showCharts)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          {showCharts ? 'Hide Charts' : 'Show Charts'}
        </button>
      </div>

      {/* Charts Section */}
      {showCharts && (
        <div className={styles.chartsSection}>
          <h3 className={styles.chartsSectionTitle}>Performance Charts</h3>
          
          <div className={styles.chartsGrid}>
            {/* 1. Posts Per Month Chart */}
            {visibleCharts.postsPerMonth && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>Posts Per Month</h4>
                  <button 
                    className={styles.chartToggle}
                    onClick={() => toggleChart('postsPerMonth')}
                    title="Hide chart"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.chart2DLegend}>
                  <div className={styles.legendItem}>
                    <div className={styles.legendColor} style={{ background: 'linear-gradient(180deg, hsl(142, 71%, 55%) 0%, hsl(142, 71%, 45%) 100%)' }}></div>
                    <span>Success</span>
                  </div>
                  <div className={styles.legendItem}>
                    <div className={styles.legendColor} style={{ background: 'linear-gradient(180deg, hsl(0, 84%, 70%) 0%, hsl(0, 84%, 60%) 100%)' }}></div>
                    <span>Loss</span>
                  </div>
                  <div className={styles.legendItem}>
                    <div className={styles.legendColor} style={{ background: 'linear-gradient(180deg, hsl(217, 91%, 70%) 0%, hsl(217, 91%, 60%) 100%)' }}></div>
                    <span>Open</span>
                  </div>
                </div>
                <div className={styles.barChart2D}>
                  {chartData.sortedMonths.length > 0 ? chartData.sortedMonths.map(month => {
                    const data = chartData.monthlyData[month];
                    const maxValue = Math.max(
                      ...chartData.sortedMonths.flatMap(m => [
                        chartData.monthlyData[m].success,
                        chartData.monthlyData[m].loss,
                        chartData.monthlyData[m].open
                      ])
                    );
                    
                    const successHeight = Math.max(10, (data.success / maxValue) * 100);
                    const lossHeight = Math.max(10, (data.loss / maxValue) * 100);
                    const openHeight = Math.max(10, (data.open / maxValue) * 100);
                    
                    return (
                      <div key={month} className={styles.barGroup2D}>
                        <div className={styles.barCluster}>
                          <div 
                            className={styles.bar2DSuccess} 
                            style={{ height: `${successHeight}%` }}
                            title={`Success: ${data.success}`}
                          >
                            <span className={styles.barValue2D}>{data.success}</span>
                          </div>
                          <div 
                            className={styles.bar2DLoss} 
                            style={{ height: `${lossHeight}%` }}
                            title={`Loss: ${data.loss}`}
                          >
                            <span className={styles.barValue2D}>{data.loss}</span>
                          </div>
                          <div 
                            className={styles.bar2DOpen} 
                            style={{ height: `${openHeight}%` }}
                            title={`Open: ${data.open}`}
                          >
                            <span className={styles.barValue2D}>{data.open}</span>
                          </div>
                        </div>
                        <div className={styles.barLabel}>{month}</div>
                      </div>
                    );
                  }) : <div className={styles.noData}>No data available</div>}
                </div>
              </div>
            )}

            {/* 2. Success Rate Over Time Chart */}
            {visibleCharts.successRate && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>Success Rate Over Time</h4>
                  <button 
                    className={styles.chartToggle}
                    onClick={() => toggleChart('successRate')}
                    title="Hide chart"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.lineChart}>
                  {chartData.successRateData.length > 0 ? (
                    <>
                      <svg className={styles.lineChartSvg} viewBox="0 0 400 200">
                        <polyline
                          fill="none"
                          stroke="hsl(142, 71%, 45%)"
                          strokeWidth="2"
                          points={chartData.successRateData.map((d, i) => {
                            const x = (i / (chartData.successRateData.length - 1 || 1)) * 380 + 10;
                            const y = 190 - (d.rate / 100) * 160;
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                        {chartData.successRateData.map((d, i) => {
                          const x = (i / (chartData.successRateData.length - 1 || 1)) * 380 + 10;
                          const y = 190 - (d.rate / 100) * 160;
                          return (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r="4"
                              fill="hsl(142, 71%, 45%)"
                            />
                          );
                        })}
                      </svg>
                      <div className={styles.chartLabels}>
                        {chartData.successRateData.map((d, i) => (
                          <div key={i} className={styles.chartLabel}>
                            <span>{d.month}</span>
                            <span>{d.rate}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <div className={styles.noData}>No data available</div>}
                </div>
              </div>
            )}

            {/* 3. Posts by Strategy Chart */}
            {visibleCharts.postsByStrategy && Object.keys(chartData.strategyData).length > 0 && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>Posts by Strategy</h4>
                  <button 
                    className={styles.chartToggle}
                    onClick={() => toggleChart('postsByStrategy')}
                    title="Hide chart"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.pieChartContainer}>
                  {(() => {
                    // Get top 5 strategies
                    const topStrategies = Object.entries(chartData.strategyData)
                      .sort((a, b) => b[1].total - a[1].total)
                      .slice(0, 5);
                    
                    // Calculate total from ONLY the displayed strategies
                    const displayedTotal = topStrategies.reduce((sum, [_, data]) => sum + data.total, 0);
                    
                    return topStrategies.map(([strategy, data], index) => {
                      const percentage = ((data.total / displayedTotal) * 100).toFixed(1);
                      
                      return (
                        <div key={strategy} className={styles.pieItem}>
                          <div className={styles.pieBar}>
                            <div 
                              className={styles.pieBarFill}
                              style={{ 
                                width: `${percentage}%`,
                                background: `hsl(${index * 72}, 70%, 60%)`
                              }}
                            ></div>
                          </div>
                          <div className={styles.pieLabel}>
                            <span className={styles.pieName}>{strategy}</span>
                            <span className={styles.pieValue}>{data.total} ({percentage}%)</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* 4. Posts by Country Chart */}
            {visibleCharts.postsByCountry && Object.keys(chartData.countryData).length > 0 && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>Posts by Country</h4>
                  <button 
                    className={styles.chartToggle}
                    onClick={() => toggleChart('postsByCountry')}
                    title="Hide chart"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.horizontalBarChart}>
                  {(() => {
                    // Get top 6 countries
                    const topCountries = Object.entries(chartData.countryData)
                      .sort((a, b) => b[1].total - a[1].total)
                      .slice(0, 6);
                    
                    // Calculate max from ONLY the displayed countries
                    const maxPosts = Math.max(...topCountries.map(([_, data]) => data.total));
                    
                    return topCountries.map(([country, data]) => {
                      const width = (data.total / maxPosts) * 100;
                      const successWidth = (data.success / data.total) * 100;
                      const lossWidth = (data.loss / data.total) * 100;
                      
                      return (
                        <div key={country} className={styles.hBarItem}>
                          <div className={styles.hBarLabel}>{country}</div>
                          <div className={styles.hBarContainer}>
                            <div className={styles.hBar} style={{ width: `${width}%` }}>
                              <div className={styles.hBarSuccess} style={{ width: `${successWidth}%` }}></div>
                              <div className={styles.hBarLoss} style={{ width: `${lossWidth}%` }}></div>
                            </div>
                            <span className={styles.hBarValue}>{data.total}</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* 5. Posts by Sentiment Chart */}
            {visibleCharts.postsBySentiment && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>Posts by Sentiment</h4>
                  <button 
                    className={styles.chartToggle}
                    onClick={() => toggleChart('postsBySentiment')}
                    title="Hide chart"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.donutChart}>
                  {Object.entries(chartData.sentimentData).map(([sentiment, data]) => {
                    const total = Object.values(chartData.sentimentData).reduce((sum, d) => sum + d.total, 0);
                    const percentage = total > 0 ? ((data.total / total) * 100).toFixed(1) : 0;
                    const color = sentiment === 'bullish' ? 'hsl(142, 71%, 45%)' : 
                                 sentiment === 'bearish' ? 'hsl(0, 84%, 60%)' : 
                                 'hsl(var(--muted-foreground))';
                    
                    return (
                      <div key={sentiment} className={styles.donutItem}>
                        <div className={styles.donutIndicator} style={{ background: color }}></div>
                        <div className={styles.donutLabel}>
                          <span className={styles.donutName}>{sentiment}</span>
                          <span className={styles.donutValue}>{data.total} ({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Engagement Over Time Chart */}
            {visibleCharts.engagement && chartData.engagementData.length > 0 && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>Engagement Over Time</h4>
                  <button 
                    className={styles.chartToggle}
                    onClick={() => toggleChart('engagement')}
                    title="Hide chart"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.multiLineChart}>
                  <svg className={styles.lineChartSvg} viewBox="0 0 400 200">
                    {/* Buy Votes Line */}
                    <polyline
                      fill="none"
                      stroke="hsl(142, 71%, 45%)"
                      strokeWidth="3"
                      points={chartData.engagementData.map((d, i) => {
                        const maxEngagement = Math.max(...chartData.engagementData.flatMap(e => [e.buyVotes, e.sellVotes, e.comments])) || 1;
                        const x = (i / (chartData.engagementData.length - 1 || 1)) * 380 + 10;
                        const y = 190 - (d.buyVotes / maxEngagement) * 160;
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    {/* Buy Votes Points */}
                    {chartData.engagementData.map((d, i) => {
                      const maxEngagement = Math.max(...chartData.engagementData.flatMap(e => [e.buyVotes, e.sellVotes, e.comments])) || 1;
                      const x = (i / (chartData.engagementData.length - 1 || 1)) * 380 + 10;
                      const y = 190 - (d.buyVotes / maxEngagement) * 160;
                      return (
                        <circle
                          key={`buy-${i}`}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="hsl(142, 71%, 45%)"
                        />
                      );
                    })}
                    
                    {/* Sell Votes Line */}
                    <polyline
                      fill="none"
                      stroke="hsl(0, 84%, 60%)"
                      strokeWidth="3"
                      points={chartData.engagementData.map((d, i) => {
                        const maxEngagement = Math.max(...chartData.engagementData.flatMap(e => [e.buyVotes, e.sellVotes, e.comments])) || 1;
                        const x = (i / (chartData.engagementData.length - 1 || 1)) * 380 + 10;
                        const y = 190 - (d.sellVotes / maxEngagement) * 160;
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    {/* Sell Votes Points */}
                    {chartData.engagementData.map((d, i) => {
                      const maxEngagement = Math.max(...chartData.engagementData.flatMap(e => [e.buyVotes, e.sellVotes, e.comments])) || 1;
                      const x = (i / (chartData.engagementData.length - 1 || 1)) * 380 + 10;
                      const y = 190 - (d.sellVotes / maxEngagement) * 160;
                      return (
                        <circle
                          key={`sell-${i}`}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="hsl(0, 84%, 60%)"
                        />
                      );
                    })}
                    
                    {/* Comments Line */}
                    <polyline
                      fill="none"
                      stroke="hsl(217, 91%, 60%)"
                      strokeWidth="3"
                      points={chartData.engagementData.map((d, i) => {
                        const maxEngagement = Math.max(...chartData.engagementData.flatMap(e => [e.buyVotes, e.sellVotes, e.comments])) || 1;
                        const x = (i / (chartData.engagementData.length - 1 || 1)) * 380 + 10;
                        const y = 190 - (d.comments / maxEngagement) * 160;
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    {/* Comments Points */}
                    {chartData.engagementData.map((d, i) => {
                      const maxEngagement = Math.max(...chartData.engagementData.flatMap(e => [e.buyVotes, e.sellVotes, e.comments])) || 1;
                      const x = (i / (chartData.engagementData.length - 1 || 1)) * 380 + 10;
                      const y = 190 - (d.comments / maxEngagement) * 160;
                      return (
                        <circle
                          key={`comment-${i}`}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="hsl(217, 91%, 60%)"
                        />
                      );
                    })}
                  </svg>
                  <div className={styles.engagementLegend}>
                    <div className={styles.legendItem}>
                      <div className={styles.legendColor} style={{ background: 'hsl(142, 71%, 45%)' }}></div>
                      <span>Buy Votes</span>
                    </div>
                    <div className={styles.legendItem}>
                      <div className={styles.legendColor} style={{ background: 'hsl(0, 84%, 60%)' }}></div>
                      <span>Sell Votes</span>
                    </div>
                    <div className={styles.legendItem}>
                      <div className={styles.legendColor} style={{ background: 'hsl(217, 91%, 60%)' }}></div>
                      <span>Comments</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. Pie Chart - Status Distribution */}
            {visibleCharts.pieChart && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>Status Distribution (Pie)</h4>
                  <button 
                    className={styles.chartToggle}
                    onClick={() => toggleChart('pieChart')}
                    title="Hide chart"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.pieChartSvg}>
                  <svg viewBox="0 0 200 200" className={styles.svgPie}>
                    {(() => {
                      const total = stats.total;
                      if (total === 0) return <text x="100" y="100" textAnchor="middle" fill="hsl(var(--muted-foreground))">No data</text>;
                      
                      const data = [
                        { label: 'Success', value: stats.successCount, color: 'hsl(142, 71%, 45%)' },
                        { label: 'Loss', value: stats.lossCount, color: 'hsl(0, 84%, 60%)' },
                        { label: 'Open', value: stats.openCount, color: 'hsl(217, 91%, 60%)' },
                      ];
                      
                      let currentAngle = -90;
                      const radius = 70;
                      const cx = 100;
                      const cy = 100;
                      
                      return data.map((item, i) => {
                        if (item.value === 0) return null;
                        const percentage = (item.value / total) * 100;
                        const angle = (percentage / 100) * 360;
                        const startAngle = currentAngle;
                        const endAngle = currentAngle + angle;
                        
                        const x1 = cx + radius * Math.cos((startAngle * Math.PI) / 180);
                        const y1 = cy + radius * Math.sin((startAngle * Math.PI) / 180);
                        const x2 = cx + radius * Math.cos((endAngle * Math.PI) / 180);
                        const y2 = cy + radius * Math.sin((endAngle * Math.PI) / 180);
                        
                        const largeArc = angle > 180 ? 1 : 0;
                        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                        
                        currentAngle = endAngle;
                        
                        return (
                          <g key={i}>
                            <path d={path} fill={item.color} stroke="hsl(var(--background))" strokeWidth="2" />
                            <text
                              x={cx + (radius * 0.6) * Math.cos(((startAngle + endAngle) / 2 * Math.PI) / 180)}
                              y={cy + (radius * 0.6) * Math.sin(((startAngle + endAngle) / 2 * Math.PI) / 180)}
                              textAnchor="middle"
                              fill="white"
                              fontSize="12"
                              fontWeight="600"
                            >
                              {percentage.toFixed(0)}%
                            </text>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                  <div className={styles.pieChartLegend}>
                    <div className={styles.legendItem}>
                      <div className={styles.legendColor} style={{ background: 'hsl(142, 71%, 45%)' }}></div>
                      <span>Success ({stats.successCount})</span>
                    </div>
                    <div className={styles.legendItem}>
                      <div className={styles.legendColor} style={{ background: 'hsl(0, 84%, 60%)' }}></div>
                      <span>Loss ({stats.lossCount})</span>
                    </div>
                    <div className={styles.legendItem}>
                      <div className={styles.legendColor} style={{ background: 'hsl(217, 91%, 60%)' }}></div>
                      <span>Open ({stats.openCount})</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 8. Treemap - Top Strategies */}
            {visibleCharts.treemap && Object.keys(chartData.strategyData).length > 0 && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>Strategy Treemap</h4>
                  <button 
                    className={styles.chartToggle}
                    onClick={() => toggleChart('treemap')}
                    title="Hide chart"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.treemapContainer}>
                  {(() => {
                    // Get top 6 strategies
                    const topStrategies = Object.entries(chartData.strategyData)
                      .sort((a, b) => b[1].total - a[1].total)
                      .slice(0, 6);
                    
                    // Calculate total from ONLY the displayed strategies
                    const displayedTotal = topStrategies.reduce((sum, [_, data]) => sum + data.total, 0);
                    
                    return topStrategies.map(([strategy, data], index) => {
                      const percentage = ((data.total / displayedTotal) * 100).toFixed(1);
                      const size = Math.sqrt(data.total);
                      
                      return (
                        <div 
                          key={strategy} 
                          className={styles.treemapBox}
                          style={{ 
                            flex: data.total,
                            background: `hsl(${index * 60}, 70%, 60%)`,
                            minHeight: `${Math.max(60, size * 10)}px`
                          }}
                        >
                          <div className={styles.treemapLabel}>
                            <div className={styles.treemapStrategy}>{strategy}</div>
                            <div className={styles.treemapValue}>{data.total}</div>
                            <div className={styles.treemapPercent}>{percentage}%</div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* 9. Sunburst - Hierarchical Data */}
            {visibleCharts.sunburst && (
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>Sunburst Chart</h4>
                  <button 
                    className={styles.chartToggle}
                    onClick={() => toggleChart('sunburst')}
                    title="Hide chart"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.sunburstContainer}>
                  <svg viewBox="0 0 300 300" className={styles.svgSunburst}>
                    {(() => {
                      const cx = 150;
                      const cy = 150;
                      const innerRadius = 40;
                      const middleRadius = 80;
                      const outerRadius = 120;
                      
                      // Center: Total
                      const centerText = (
                        <g>
                          <circle cx={cx} cy={cy} r={innerRadius} fill="hsl(var(--primary))" />
                          <text x={cx} y={cy - 5} textAnchor="middle" fill="white" fontSize="20" fontWeight="700">
                            {stats.total}
                          </text>
                          <text x={cx} y={cy + 10} textAnchor="middle" fill="white" fontSize="10">
                            Total
                          </text>
                        </g>
                      );
                      
                      // Middle ring: Status
                      const statusData = [
                        { label: 'Success', value: stats.successCount, color: 'hsl(142, 71%, 45%)' },
                        { label: 'Loss', value: stats.lossCount, color: 'hsl(0, 84%, 60%)' },
                        { label: 'Open', value: stats.openCount, color: 'hsl(217, 91%, 60%)' },
                      ];
                      
                      let currentAngle = 0;
                      const middleRing = statusData.map((item, i) => {
                        if (item.value === 0) return null;
                        const percentage = (item.value / stats.total) * 100;
                        const angle = (percentage / 100) * 360;
                        const startAngle = currentAngle;
                        const endAngle = currentAngle + angle;
                        
                        const x1Inner = cx + innerRadius * Math.cos((startAngle * Math.PI) / 180);
                        const y1Inner = cy + innerRadius * Math.sin((startAngle * Math.PI) / 180);
                        const x2Inner = cx + innerRadius * Math.cos((endAngle * Math.PI) / 180);
                        const y2Inner = cy + innerRadius * Math.sin((endAngle * Math.PI) / 180);
                        
                        const x1Outer = cx + middleRadius * Math.cos((startAngle * Math.PI) / 180);
                        const y1Outer = cy + middleRadius * Math.sin((startAngle * Math.PI) / 180);
                        const x2Outer = cx + middleRadius * Math.cos((endAngle * Math.PI) / 180);
                        const y2Outer = cy + middleRadius * Math.sin((endAngle * Math.PI) / 180);
                        
                        const largeArc = angle > 180 ? 1 : 0;
                        const path = `M ${x1Inner} ${y1Inner} L ${x1Outer} ${y1Outer} A ${middleRadius} ${middleRadius} 0 ${largeArc} 1 ${x2Outer} ${y2Outer} L ${x2Inner} ${y2Inner} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1Inner} ${y1Inner} Z`;
                        
                        currentAngle = endAngle;
                        
                        return (
                          <path key={i} d={path} fill={item.color} stroke="hsl(var(--background))" strokeWidth="2" opacity="0.9" />
                        );
                      });
                      
                      // Outer ring: Sentiment
                      const sentimentData = [
                        { label: 'Bullish', value: chartData.sentimentData.bullish.total, color: 'hsl(142, 71%, 55%)' },
                        { label: 'Bearish', value: chartData.sentimentData.bearish.total, color: 'hsl(0, 84%, 70%)' },
                        { label: 'Neutral', value: chartData.sentimentData.neutral.total, color: 'hsl(var(--muted-foreground))' },
                      ];
                      
                      currentAngle = 0;
                      const outerRing = sentimentData.map((item, i) => {
                        if (item.value === 0) return null;
                        const percentage = (item.value / stats.total) * 100;
                        const angle = (percentage / 100) * 360;
                        const startAngle = currentAngle;
                        const endAngle = currentAngle + angle;
                        
                        const x1Inner = cx + middleRadius * Math.cos((startAngle * Math.PI) / 180);
                        const y1Inner = cy + middleRadius * Math.sin((startAngle * Math.PI) / 180);
                        const x2Inner = cx + middleRadius * Math.cos((endAngle * Math.PI) / 180);
                        const y2Inner = cy + middleRadius * Math.sin((endAngle * Math.PI) / 180);
                        
                        const x1Outer = cx + outerRadius * Math.cos((startAngle * Math.PI) / 180);
                        const y1Outer = cy + outerRadius * Math.sin((startAngle * Math.PI) / 180);
                        const x2Outer = cx + outerRadius * Math.cos((endAngle * Math.PI) / 180);
                        const y2Outer = cy + outerRadius * Math.sin((endAngle * Math.PI) / 180);
                        
                        const largeArc = angle > 180 ? 1 : 0;
                        const path = `M ${x1Inner} ${y1Inner} L ${x1Outer} ${y1Outer} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2Outer} ${y2Outer} L ${x2Inner} ${y2Inner} A ${middleRadius} ${middleRadius} 0 ${largeArc} 0 ${x1Inner} ${y1Inner} Z`;
                        
                        currentAngle = endAngle;
                        
                        return (
                          <path key={i} d={path} fill={item.color} stroke="hsl(var(--background))" strokeWidth="2" opacity="0.8" />
                        );
                      });
                      
                      return (
                        <>
                          {middleRing}
                          {outerRing}
                          {centerText}
                        </>
                      );
                    })()}
                  </svg>
                  <div className={styles.sunburstLegend}>
                    <div className={styles.sunburstLegendSection}>
                      <strong>Inner: Status</strong>
                      <div className={styles.legendItem}>
                        <div className={styles.legendColor} style={{ background: 'hsl(142, 71%, 45%)' }}></div>
                        <span>Success</span>
                      </div>
                      <div className={styles.legendItem}>
                        <div className={styles.legendColor} style={{ background: 'hsl(0, 84%, 60%)' }}></div>
                        <span>Loss</span>
                      </div>
                      <div className={styles.legendItem}>
                        <div className={styles.legendColor} style={{ background: 'hsl(217, 91%, 60%)' }}></div>
                        <span>Open</span>
                      </div>
                    </div>
                    <div className={styles.sunburstLegendSection}>
                      <strong>Outer: Sentiment</strong>
                      <div className={styles.legendItem}>
                        <div className={styles.legendColor} style={{ background: 'hsl(142, 71%, 55%)' }}></div>
                        <span>Bullish</span>
                      </div>
                      <div className={styles.legendItem}>
                        <div className={styles.legendColor} style={{ background: 'hsl(0, 84%, 70%)' }}></div>
                        <span>Bearish</span>
                      </div>
                      <div className={styles.legendItem}>
                        <div className={styles.legendColor} style={{ background: 'hsl(var(--muted-foreground))' }}></div>
                        <span>Neutral</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Charts - Dynamically rendered from localStorage */}
            {customCharts.filter(chart => customChartsVisibility[chart.id] !== false).map((chart) => (
              <div key={chart.id} className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h4 className={styles.chartTitle}>📊 {chart.name}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className={styles.chartToggle}
                      onClick={() => toggleCustomChart(chart.id)}
                      title="Hide chart"
                    >
                      👁️
                    </button>
                    <button 
                      className={styles.chartToggle}
                      onClick={() => deleteCustomChartFromProvider(chart.id)}
                      title="Delete chart"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <AdvancedChartBuilder 
                  stats={stats} 
                  chartData={chartData} 
                  config={chart}
                  readOnly={true}
                />
              </div>
            ))}
          </div>

          {/* Hidden Charts - Show buttons */}
          {(() => {
            const hasHiddenBuiltinCharts = !visibleCharts.postsPerMonth || !visibleCharts.successRate || 
              !visibleCharts.postsByStrategy || !visibleCharts.postsByCountry || !visibleCharts.postsBySentiment || 
              !visibleCharts.engagement || !visibleCharts.pieChart || !visibleCharts.treemap || !visibleCharts.sunburst;
            const hiddenCustomCharts = customCharts.filter(chart => customChartsVisibility[chart.id] === false);
            const hasHiddenCustomCharts = hiddenCustomCharts.length > 0;
            
            return (hasHiddenBuiltinCharts || hasHiddenCustomCharts) ? (
              <div className={styles.hiddenCharts}>
                <h4 className={styles.hiddenChartsTitle}>Hidden Charts (Click to show)</h4>
                <div className={styles.hiddenChartsButtons}>
                  {!visibleCharts.postsPerMonth && (
                    <button className={styles.showChartBtn} onClick={() => toggleChart('postsPerMonth')}>
                      + Posts Per Month
                    </button>
                  )}
                  {!visibleCharts.successRate && (
                    <button className={styles.showChartBtn} onClick={() => toggleChart('successRate')}>
                      + Success Rate
                    </button>
                  )}
                  {!visibleCharts.postsByStrategy && (
                    <button className={styles.showChartBtn} onClick={() => toggleChart('postsByStrategy')}>
                      + Posts by Strategy
                    </button>
                  )}
                  {!visibleCharts.postsByCountry && (
                    <button className={styles.showChartBtn} onClick={() => toggleChart('postsByCountry')}>
                      + Posts by Country
                    </button>
                  )}
                  {!visibleCharts.postsBySentiment && (
                    <button className={styles.showChartBtn} onClick={() => toggleChart('postsBySentiment')}>
                      + Posts by Sentiment
                    </button>
                  )}
                  {!visibleCharts.engagement && (
                    <button className={styles.showChartBtn} onClick={() => toggleChart('engagement')}>
                      + Engagement Over Time
                    </button>
                  )}
                  {!visibleCharts.pieChart && (
                    <button className={styles.showChartBtn} onClick={() => toggleChart('pieChart')}>
                      + Pie Chart
                    </button>
                  )}
                  {!visibleCharts.treemap && (
                    <button className={styles.showChartBtn} onClick={() => toggleChart('treemap')}>
                      + Treemap
                    </button>
                  )}
                  {!visibleCharts.sunburst && (
                    <button className={styles.showChartBtn} onClick={() => toggleChart('sunburst')}>
                      + Sunburst Chart
                    </button>
                  )}
                  
                  {/* Custom Charts - Hidden ones */}
                  {hiddenCustomCharts.map(chart => (
                    <button 
                      key={chart.id}
                      className={styles.showChartBtn} 
                      onClick={() => toggleCustomChart(chart.id)}
                    >
                      + 📊 {chart.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Chart Builder Modal */}
      {showChartBuilder && (
        <div className={styles.modalOverlay} onClick={() => setShowChartBuilder(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>📊 Create Custom Chart</h3>
              <button 
                className={styles.modalClose} 
                onClick={() => setShowChartBuilder(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Left Side - Form Controls */}
              <div className={styles.formSide}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Chart Name</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g., My Custom Chart"
                    value={newChartConfig.name}
                    onChange={(e) => setNewChartConfig({...newChartConfig, name: e.target.value})}
                    autoFocus
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Chart Type</label>
                  <select 
                    className={styles.formSelect}
                    value={newChartConfig.chartType}
                    onChange={(e) => setNewChartConfig({...newChartConfig, chartType: e.target.value})}
                  >
                    <option value="bar">📊 Bar Chart</option>
                    <option value="horizontalBar">📊 Horizontal Bar</option>
                    <option value="line">📈 Line Chart</option>
                    <option value="area">📈 Area Chart</option>
                    <option value="pie">🥧 Pie Chart</option>
                    <option value="donut">🍩 Donut Chart</option>
                    <option value="radar">🕸️ Radar Chart</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Data Source</label>
                  <select 
                    className={styles.formSelect}
                    value={newChartConfig.dataSource}
                    onChange={(e) => setNewChartConfig({...newChartConfig, dataSource: e.target.value})}
                  >
                    <option value="status">📊 Post Status</option>
                    <option value="sentiment">💭 Sentiment</option>
                    <option value="strategy">🎯 Strategy (Top 5)</option>
                    <option value="country">🌍 Country (Top 5)</option>
                  </select>
                </div>
              </div>

              {/* Right Side - Preview */}
              <div className={styles.previewSide}>
                <label className={styles.formLabel}>Preview</label>
                <div className={styles.previewContainer}>
                  <AdvancedChartBuilder 
                    stats={stats} 
                    chartData={chartData} 
                    config={newChartConfig}
                    readOnly={true}
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn}
                onClick={() => setShowChartBuilder(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.createBtn}
                onClick={addCustomChart}
              >
                Create Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Toggle Section */}
      <div className={styles.viewToggleSection}>
        <div className={styles.viewToggleGroup}>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
            onClick={() => setViewMode('table')}
            title="Table View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
            </svg>
            Table
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
            </svg>
            Grid
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'timeline' ? styles.active : ''}`}
            onClick={() => setViewMode('timeline')}
            title="Timeline View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="3"></circle>
              <path d="M12 11v10"></path>
              <circle cx="12" cy="21" r="2"></circle>
            </svg>
            Timeline
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'kanban' ? styles.active : ''}`}
            onClick={() => setViewMode('kanban')}
            title="Kanban View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="5" height="18" rx="1"></rect>
              <rect x="10" y="3" width="5" height="12" rx="1"></rect>
              <rect x="17" y="3" width="5" height="15" rx="1"></rect>
            </svg>
            Kanban
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'calendar' ? styles.active : ''}`}
            onClick={() => setViewMode('calendar')}
            title="Calendar View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Calendar
          </button>
        </div>
      </div>

      {/* Data View - Multiple Views */}
      {viewMode === 'table' ? (
        <div className={styles.tableContainer}>
        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th onClick={() => handleSort('created_at')}>
                  Date {getSortIcon('created_at')}
                </th>
                <th onClick={() => handleSort('symbol')}>
                  Symbol {getSortIcon('symbol')}
                </th>
                <th onClick={() => handleSort('company_name')}>
                  Company {getSortIcon('company_name')}
                </th>
                <th onClick={() => handleSort('strategy')}>
                  Strategy {getSortIcon('strategy')}
                </th>
                <th onClick={() => handleSort('country')}>
                  Country {getSortIcon('country')}
                </th>
                <th onClick={() => handleSort('sentiment')}>
                  Sentiment {getSortIcon('sentiment')}
                </th>
                <th onClick={() => handleSort('current_price')}>
                  Current Price {getSortIcon('current_price')}
                </th>
                <th onClick={() => handleSort('target_price')}>
                  Target Price {getSortIcon('target_price')}
                </th>
                <th onClick={() => handleSort('stop_loss')}>
                  Stop Loss {getSortIcon('stop_loss')}
                </th>
                <th onClick={() => handleSort('buy_count')}>
                  Buy Votes {getSortIcon('buy_count')}
                </th>
                <th onClick={() => handleSort('sell_count')}>
                  Sell Votes {getSortIcon('sell_count')}
                </th>
                <th onClick={() => handleSort('comment_count')}>
                  Comments {getSortIcon('comment_count')}
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan="13" className={styles.emptyRow}>
                    No posts found for the selected filters
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <tr key={post.id}>
                    <td className={styles.dateCell}>{formatDate(post.created_at)}</td>
                    <td className={styles.symbolCell}>{post.symbol || '-'}</td>
                    <td className={styles.companyCell}>{post.company_name || '-'}</td>
                    <td className={styles.strategyCell}>{post.strategy || '-'}</td>
                    <td className={styles.countryCell}>{post.country || '-'}</td>
                    <td className={styles.sentimentCell}>
                      <span className={`${styles.sentiment} ${styles[post.sentiment]}`}>
                        {post.sentiment || '-'}
                      </span>
                    </td>
                    <td className={styles.numberCell}>{formatNumber(post.current_price)}</td>
                    <td className={styles.numberCell}>{formatNumber(post.target_price)}</td>
                    <td className={styles.numberCell}>{formatNumber(post.stop_loss)}</td>
                    <td className={styles.voteCell}>{post.buy_count || 0}</td>
                    <td className={styles.voteCell}>{post.sell_count || 0}</td>
                    <td className={styles.commentCell}>{post.comment_count || 0}</td>
                    <td className={styles.statusCell}>{getStatusBadge(post)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className={styles.gridContainer}>
          {filteredPosts.map(post => (
            <div key={post.id} className={styles.gridCard}>
              <div className={styles.gridCardHeader}>
                <span className={styles.gridSymbol}>{post.symbol}</span>
                {getStatusBadge(post)}
              </div>
              <div className={styles.gridCardBody}>
                <div className={styles.gridCompany}>{post.company_name}</div>
                <div className={styles.gridPrice}>${formatNumber(post.current_price)}</div>
                <div className={styles.gridMeta}>
                  <span>{post.strategy || 'No Strategy'}</span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredPosts.length === 0 && (
            <div className={styles.emptyState}>No posts found for the selected filters</div>
          )}
        </div>

      ) : viewMode === 'timeline' ? (
        /* Timeline View */
        <div className={styles.timelineContainer}>
          {filteredPosts.map((post, index) => (
            <div key={post.id} className={styles.timelineItem}>
              <div className={styles.timelineDate}>
                {new Date(post.created_at).toLocaleDateString()}
              </div>
              <div className={styles.timelineDot}></div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineCard}>
                  <div className={styles.timelineHeader}>
                    <span className={styles.timelineSymbol}>{post.symbol}</span>
                    {getStatusBadge(post)}
                  </div>
                  <div className={styles.timelineBody}>
                    <div className={styles.timelineCompany}>{post.company_name}</div>
                    <div className={styles.timelineDetails}>
                      <span className={styles.timelinePrice}>${formatNumber(post.current_price)}</span>
                      <span className={styles.timelineStrategy}>{post.strategy || 'No Strategy'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredPosts.length === 0 && (
            <div className={styles.emptyState}>No posts found for the selected filters</div>
          )}
        </div>

      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className={styles.kanbanContainer}>
          <div className={styles.kanbanColumn}>
            <div className={styles.kanbanHeader}>
              <span className={styles.kanbanTitle}>Open</span>
              <span className={styles.kanbanCount}>{filteredPosts.filter(p => p.status === 'open' || (!p.target_reached && !p.stop_loss_triggered)).length}</span>
            </div>
            <div className={styles.kanbanCards}>
              {filteredPosts.filter(p => p.status === 'open' || (!p.target_reached && !p.stop_loss_triggered)).map(post => (
                <div key={post.id} className={styles.kanbanCard}>
                  <div className={styles.kanbanSymbol}>{post.symbol}</div>
                  <div className={styles.kanbanCompany}>{post.company_name}</div>
                  <div className={styles.kanbanPrice}>${formatNumber(post.current_price)}</div>
                  <div className={styles.kanbanStrategy}>{post.strategy || 'No Strategy'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.kanbanColumn}>
            <div className={styles.kanbanHeader}>
              <span className={styles.kanbanTitle}>Success</span>
              <span className={styles.kanbanCount}>{filteredPosts.filter(p => p.status === 'success' || p.target_reached).length}</span>
            </div>
            <div className={styles.kanbanCards}>
              {filteredPosts.filter(p => p.status === 'success' || p.target_reached).map(post => (
                <div key={post.id} className={styles.kanbanCard}>
                  <div className={styles.kanbanSymbol}>{post.symbol}</div>
                  <div className={styles.kanbanCompany}>{post.company_name}</div>
                  <div className={styles.kanbanPrice}>${formatNumber(post.current_price)}</div>
                  <div className={styles.kanbanStrategy}>{post.strategy || 'No Strategy'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.kanbanColumn}>
            <div className={styles.kanbanHeader}>
              <span className={styles.kanbanTitle}>Loss</span>
              <span className={styles.kanbanCount}>{filteredPosts.filter(p => p.status === 'loss' || p.stop_loss_triggered).length}</span>
            </div>
            <div className={styles.kanbanCards}>
              {filteredPosts.filter(p => p.status === 'loss' || p.stop_loss_triggered).map(post => (
                <div key={post.id} className={styles.kanbanCard}>
                  <div className={styles.kanbanSymbol}>{post.symbol}</div>
                  <div className={styles.kanbanCompany}>{post.company_name}</div>
                  <div className={styles.kanbanPrice}>${formatNumber(post.current_price)}</div>
                  <div className={styles.kanbanStrategy}>{post.strategy || 'No Strategy'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : (
        /* Calendar View */
        <div className={styles.calendarContainer}>
          {Object.keys(calendarData).sort().reverse().map(weekLabel => {
            const isCollapsed = collapsedWeeks.has(weekLabel);
            const weekData = calendarData[weekLabel];
            const days = Object.keys(weekData).sort();
            
            return (
              <div key={weekLabel} className={styles.weekRow}>
                <div className={styles.weekHeader} onClick={() => toggleWeek(weekLabel)}>
                  <button className={styles.collapseBtn}>
                    {isCollapsed ? '▶' : '▼'}
                  </button>
                  <span className={styles.weekLabel}>{weekLabel}</span>
                  <span className={styles.weekSummary}>
                    {days.reduce((sum, day) => sum + weekData[day].length, 0)} posts
                  </span>
                </div>
                
                {!isCollapsed && (
                  <div className={styles.daysGrid}>
                    {days.map(dayKey => {
                      const date = new Date(dayKey);
                      const dayPosts = weekData[dayKey];
                      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                      const dayNum = date.getDate();
                      
                      return (
                        <div key={dayKey} className={styles.dayColumn}>
                          <div className={styles.dayHeader}>
                            <div className={styles.dayName}>{dayName}</div>
                            <div className={styles.dayDate}>{dayNum}</div>
                            <div className={styles.dayCount}>{dayPosts.length}</div>
                          </div>
                          <div className={styles.dayPosts}>
                            {dayPosts.map(post => (
                              <div key={post.id} className={styles.calendarPost}>
                                <div className={styles.postSymbol}>{post.symbol}</div>
                                <div className={styles.postPrice}>
                                  ${formatNumber(post.current_price)}
                                </div>
                                <div className={styles.postStatus}>
                                  {getStatusBadge(post)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(calendarData).length === 0 && (
            <div className={styles.emptyCalendar}>
              No posts found for the selected filters
            </div>
          )}
        </div>
      )}

      {/* Export Button */}
      <div className={styles.exportSection}>
        <button 
          className={styles.exportButton}
          onClick={() => {
            // Simple CSV export
            const headers = ['Date', 'Symbol', 'Company', 'Strategy', 'Country', 'Sentiment', 'Current Price', 'Target Price', 'Stop Loss', 'Buy Votes', 'Sell Votes', 'Comments', 'Status'];
            const rows = filteredPosts.map(post => [
              formatDate(post.created_at),
              post.symbol || '',
              post.company_name || '',
              post.strategy || '',
              post.country || '',
              post.sentiment || '',
              post.current_price || '',
              post.target_price || '',
              post.stop_loss || '',
              post.buy_count || 0,
              post.sell_count || 0,
              post.comment_count || 0,
              post.status || 'open'
            ]);
            
            const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `posts-analysis-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export to CSV
        </button>
      </div>
    </div>
  );
}
