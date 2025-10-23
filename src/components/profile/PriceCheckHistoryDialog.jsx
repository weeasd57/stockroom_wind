'use client';

import React, { useState, useEffect } from 'react';
import { 
  getPriceCheckHistory, 
  deletePriceCheckEntry, 
  clearPriceCheckHistory,
  getPriceCheckStatistics,
  exportPriceCheckHistory 
} from '@/utils/priceCheckHistory';
import dialogStyles from '@/styles/ProfilePostCard.module.css';
import styles from '@/styles/profile.module.css';

export default function PriceCheckHistoryDialog({ isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('all'); // all, week, month

  useEffect(() => {
    if (isOpen) {
      loadHistoryData();
    }
  }, [isOpen]);

  const loadHistoryData = () => {
    setLoading(true);
    try {
      const historyData = getPriceCheckHistory();
      const stats = getPriceCheckStatistics();
      
      setHistory(historyData);
      setStatistics(stats);
      
      console.log(`[PriceCheckHistory] Loaded ${historyData.length} entries`);
    } catch (error) {
      console.error('[PriceCheckHistory] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = (entryId) => {
    if (confirm('Are you sure you want to delete this price check entry?')) {
      if (deletePriceCheckEntry(entryId)) {
        loadHistoryData(); // Refresh data
      }
    }
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all price check history? This action cannot be undone.')) {
      if (clearPriceCheckHistory()) {
        loadHistoryData(); // Refresh data
      }
    }
  };

  const handleExportHistory = () => {
    exportPriceCheckHistory();
  };

  const toggleExpanded = (entryId) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const getFilteredHistory = () => {
    if (filterPeriod === 'all') return history;
    
    const now = new Date();
    const filterDate = filterPeriod === 'week' 
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    return history.filter(entry => new Date(entry.timestamp) > filterDate);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return parseFloat(price).toFixed(2);
  };

  if (!isOpen) return null;

  const filteredHistory = getFilteredHistory();

  return (
    <div className={dialogStyles.dialogOverlay} onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className={dialogStyles.statusDialog} 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '900px', maxHeight: '80vh', overflow: 'hidden' }}
      >
        <div className={dialogStyles.dialogHeader}>
          <h3>📊 Price Check History</h3>
          <button className={dialogStyles.closeButton} onClick={onClose}>Close</button>
        </div>
        
        <div className={dialogStyles.dialogContent} style={{ overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className={styles.modernSpinner}>
                <div className={styles.spinnerRing}></div>
              </div>
              Loading history...
            </div>
          ) : (
            <>
              {/* Statistics Section */}
              {statistics && (
                <div className={styles.historyStats}>
                  <h4>📈 Statistics</h4>
                  <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Total Checks:</span>
                      <span className={styles.statValue}>{statistics.totalChecks}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Posts Checked:</span>
                      <span className={styles.statValue}>{statistics.totalPostsChecked}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Posts Updated:</span>
                      <span className={styles.statValue}>{statistics.totalPostsUpdated}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Avg Updates/Check:</span>
                      <span className={styles.statValue}>{statistics.averageUpdatesPerCheck}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>This Week:</span>
                      <span className={styles.statValue}>{statistics.checksThisWeek}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>This Month:</span>
                      <span className={styles.statValue}>{statistics.checksThisMonth}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className={styles.historyControls}>
                <div className={styles.filterControls}>
                  <label>Filter: </label>
                  <select 
                    value={filterPeriod} 
                    onChange={(e) => setFilterPeriod(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Time</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
                
                <div className={styles.actionControls}>
                  <button 
                    onClick={handleExportHistory}
                    className={styles.exportButton}
                    disabled={history.length === 0}
                  >
                    📤 Export
                  </button>
                  <button 
                    onClick={handleClearHistory}
                    className={styles.clearButton}
                    disabled={history.length === 0}
                  >
                    🗑️ Clear All
                  </button>
                </div>
              </div>

              {/* History Entries */}
              <div className={styles.historyList}>
                {filteredHistory.length === 0 ? (
                  <div className={styles.noHistoryMessage}>
                    {filterPeriod === 'all' 
                      ? 'No price check history found. Start by running a price check!'
                      : `No price checks found for the selected period (${filterPeriod}).`
                    }
                  </div>
                ) : (
                  filteredHistory.map((entry) => (
                    <div key={entry.id} className={styles.historyEntry}>
                      <div className={styles.historyHeader} onClick={() => toggleExpanded(entry.id)}>
                        <div className={styles.historyTitle}>
                          <span className={styles.historyIcon}>📊</span>
                          <span>{entry.title}</span>
                          <span className={styles.historyDate}>{formatDate(entry.timestamp)}</span>
                        </div>
                        
                        <div className={styles.historySummary}>
                          <span className={styles.summaryItem}>
                            ✅ {entry.summary?.checkedPosts || 0} checked
                          </span>
                          <span className={styles.summaryItem}>
                            🔄 {entry.summary?.updatedPosts || 0} updated
                          </span>
                          <span className={styles.summaryItem}>
                            📊 {entry.summary?.remainingChecks || 0} remaining
                          </span>
                        </div>
                        
                        <div className={styles.historyActions}>
                          <button 
                            className={styles.expandButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(entry.id);
                            }}
                          >
                            {expandedEntries.has(entry.id) ? '▼' : '▶'}
                          </button>
                          <button 
                            className={styles.deleteButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEntry(entry.id);
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {expandedEntries.has(entry.id) && (
                        <div className={styles.historyDetails}>
                          {entry.results && entry.results.length > 0 ? (
                            <div className={styles.resultsSection}>
                              <h5>📋 Detailed Results</h5>
                              <div className={styles.resultsList}>
                                {entry.results.map((result, index) => (
                                  <div key={index} className={styles.resultItem}>
                                    <div className={styles.resultSymbol}>
                                      <strong>{result.symbol || 'N/A'}</strong>
                                      {result.companyName && (
                                        <span className={styles.companyName}>{result.companyName}</span>
                                      )}
                                    </div>
                                    
                                    <div className={styles.resultStatus}>
                                      <span className={`${styles.statusBadge} ${
                                        result.targetReached ? styles.successBadge :
                                        result.stopLossTriggered ? styles.errorBadge :
                                        styles.neutralBadge
                                      }`}>
                                        {result.targetReached ? '🎯 Target Reached' :
                                         result.stopLossTriggered ? '🛑 Stop Loss' :
                                         result.message || '📊 Checked'}
                                      </span>
                                    </div>
                                    
                                    <div className={styles.resultPrices}>
                                      <span>Price: ${formatPrice(result.currentPrice)}</span>
                                      <span>Target: ${formatPrice(result.targetPrice)}</span>
                                      <span>SL: ${formatPrice(result.stopLossPrice)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className={styles.noResults}>No detailed results available</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          <div className={styles.statsActions} style={{ marginTop: '20px' }}>
            <button 
              className={styles.closeStatsButton}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
