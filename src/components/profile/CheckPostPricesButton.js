'use client';

import { useState } from 'react';
import styles from '@/styles/profile.module.css';
import { useProfile } from '@/providers/ProfileProvider';
import dialogStyles from '@/styles/ProfilePostCard.module.css';

export default function CheckPostPricesButton({ userId }) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkStats, setCheckStats] = useState(null);
  const [error, setError] = useState(null);
  const { refreshData } = useProfile();
  const [abortController, setAbortController] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [detailedResults, setDetailedResults] = useState([]);
  const [apiResponses, setApiResponses] = useState([]);
  
  const cancelCheck = () => {
    if (abortController) {
      // Mark as cancelled before aborting to prevent processing response
      setIsCancelled(true);
      abortController.abort();
      setIsChecking(false);
      setError('Price check cancelled');
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };
  
  // Format price with 2 decimal places or display N/A if null
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return parseFloat(price).toFixed(2);
  };
  
  // Format date to locale string or display N/A if null
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const checkPostPrices = async () => {
    setIsChecking(true);
    setCheckStats(null);
    setError(null);
    setIsCancelled(false);
    setDetailedResults([]);
    setApiResponses([]);
    
    // Create a new AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);
    
    console.log('Checking post prices for user:', userId);
    console.log('Including API details in request:', true);
    
    try {
      console.log('Making API request to: /api/posts/check-prices');
      const response = await fetch('/api/posts/check-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, includeApiDetails: true }), 
        credentials: 'include',
        signal: controller.signal // Add the abort signal to the fetch request
      });
      
      // Check if cancelled before processing response
      if (isCancelled) {
        console.log('Request was cancelled, ignoring response');
        return;
      }
      
      const data = await response.json();
      
      // Check again if cancelled after parsing JSON
      if (isCancelled) {
        console.log('Request was cancelled while parsing response, ignoring data');
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.message || 'An error occurred while checking prices');
      }
      
      console.log('Received API response:', data);
      console.log('API details:', data.apiDetails || 'No API details available');
      
      setCheckStats({
        usageCount: data.usageCount,
        remainingChecks: data.remainingChecks,
        checkedPosts: data.checkedPosts,
        updatedPosts: data.updatedPosts,
        closedPostsSkipped: data.closedPostsSkipped
      });
      
      // Store detailed results for display in the dialog
      if (data.results && Array.isArray(data.results)) {
        setDetailedResults(data.results);
        
        // Extract API response details if available
        if (data.apiDetails && Array.isArray(data.apiDetails)) {
          console.log(`Processing ${data.apiDetails.length} API response details`);
          setApiResponses(data.apiDetails);
          
          // Log each URL for debugging
          data.apiDetails.forEach((detail, index) => {
            console.log(`API URL ${index + 1} (${detail.symbol}): ${detail.requestUrl || 'No URL available'}`);
          });
        } else {
          // Create mock API response details if none provided by the server
          console.log('No API details provided by server, creating mock data');
          const mockApiData = data.results.map(post => {
            // Determine the type of response based on available data
            let responseType = 'No price data';
            
            if (post.last_price) {
              if (post.last_price_check) {
                // Check if price is up or down compared to initial
                const initial = parseFloat(post.current_price || 0);
                const current = parseFloat(post.last_price || 0);
                const priceDiff = initial !== 0 ? ((current - initial) / initial * 100).toFixed(1) : 0;
                
                if (current > initial) {
                  responseType = `Historical prices (↑${priceDiff}%)`;
                } else if (current < initial) {
                  responseType = `Historical prices (↓${Math.abs(priceDiff)}%)`;
                } else {
                  responseType = 'Historical prices (0%)';
                }
              } else {
                responseType = 'Last price only';
              }
            }
            
            // Construct a mock API URL for display purposes
            const mockRequestUrl = post.symbol ? 
              `https://eodhd.com/api/eod/${post.symbol}${post.exchange ? `.${post.exchange}` : ''}?from=YYYY-MM-DD&to=YYYY-MM-DD&period=d&api_token=***&fmt=json` : 
              'N/A';
            
            console.log(`Creating mock URL for ${post.symbol}: ${mockRequestUrl}`);
            
            return {
              symbol: post.symbol,
              exchange: post.exchange || 'N/A',
              requestType: 'Price data request',
              responseType: responseType,
              timestamp: post.last_price_check || new Date().toISOString(),
              requestUrl: mockRequestUrl // Add mock URL for display
            };
          });
          setApiResponses(mockApiData);
        }
      }
      
      if (userId && !isCancelled) {
        refreshData(userId);
      }
      
      // Show the stats dialog
      if (!isCancelled) {
        setShowStatsDialog(true);
      } 
      
    } catch (err) {
      if (err.name === 'AbortError') {
        // This is expected when the request is aborted
        console.log('Request aborted');
        // Error is already set in cancelCheck
      } else if (!isCancelled) {
        // Only set error if not cancelled
        setError(err.message || 'An error occurred while checking prices');
      }
    } finally {
      setIsChecking(false);
      setAbortController(null);
      // Reset cancelled state if it was an error other than abort
      if (!isCancelled) {
        setIsCancelled(false);
      }
    }
  };
  
  // Calculate price change percentage and direction between initial and last price
  const getPriceChangeStatus = (post) => {
    if (!post.current_price || !post.last_price) return null;
    
    const initial = parseFloat(post.current_price);
    const last = parseFloat(post.last_price);
    
    if (last < initial) {
      return { change: 'decrease', percent: (((initial - last) / initial) * 100).toFixed(2) };
    } else if (last > initial) {
      return { change: 'increase', percent: (((last - initial) / initial) * 100).toFixed(2) };
    }
    return { change: 'none', percent: 0 };
  };
  
  return (
    <div className={styles.priceCheckContainer}>
      <div className={styles.priceCheckButtonGroup}>
        <button 
          onClick={checkPostPrices}
          disabled={isChecking}
          className={styles.checkPricesButton}
          aria-label="Check post prices"
        >
          {isChecking ? 'Checking...' : '📈 Check Post Prices'}
        </button>
        
        {isChecking && (
          <button 
            onClick={cancelCheck}
            className={styles.cancelCheckButton}
            aria-label="Cancel price check"
          >
            Cancel
          </button>
        )}
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      {/* Enhanced API Response Dialog */}
      {showStatsDialog && checkStats && (
        <div className={dialogStyles.dialogOverlay} onClick={() => setShowStatsDialog(false)} style={{ zIndex: 9999 }}>
          <div className={dialogStyles.statusDialog} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className={dialogStyles.dialogHeader}>
              <h3>API Response Details</h3>
              <button className={dialogStyles.closeButton} onClick={() => setShowStatsDialog(false)}>Cancel</button>
            </div>
            <div className={dialogStyles.dialogContent}>
              {/* Summary Section */}
              <div className={styles.resultsSummary}>
                <div className={dialogStyles.dialogItem}>
                  <span className={dialogStyles.dialogLabel}>Checks Today:</span>
                  <span className={dialogStyles.dialogValue}>{checkStats.usageCount} of 100</span>
                </div>
                
                <div className={dialogStyles.dialogItem}>
                  <span className={dialogStyles.dialogLabel}>Checked Posts:</span>
                  <span className={dialogStyles.dialogValue}>{checkStats.checkedPosts}</span>
                </div>
                
                <div className={dialogStyles.dialogItem}>
                  <span className={dialogStyles.dialogLabel}>Updated Posts:</span>
                  <span className={dialogStyles.dialogValue}>{checkStats.updatedPosts}</span>
                </div>
              </div>
              
              {/* API Response Details - Always visible */}
              <div className={styles.resultsList}>                  
                {/* API Response rows */}
                {apiResponses && apiResponses.length > 0 ? (
                  apiResponses.map((response, index) => (
                    <div key={index} className={styles.simpleResultRow}>
                      <div className={styles.symbolWithTag}>
                        <span className={styles.symbolText}>{response.symbol || 'N/A'}</span>
                        {response.exchange && <span className={styles.exchangeTag}>{response.exchange}</span>}
                      </div>
                      
                      <span className={`${styles.responseTypeTag} 
                        ${response.responseType?.includes('↑') ? styles.priceUpTag : 
                          response.responseType?.includes('↓') ? styles.priceDownTag :
                          response.responseType?.includes('Historical') ? styles.historyTag : 
                          response.responseType?.includes('No price') ? styles.errorTag :
                          styles.lastPriceTag}`}
                      >
                        {response.responseType || 'N/A'}
                      </span>

                      {/* Display API URL if available */}
                      {response.requestUrl && (
                        <div className={styles.apiUrlContainer}>
                          <input 
                            type="text" 
                            readOnly
                            value={response.requestUrl} 
                            className={styles.apiUrlInput}
                            onClick={(e) => e.target.select()}
                          />
                          <button 
                            className={styles.copyUrlButton}
                            onClick={() => {
                              console.log(`Copying URL to clipboard: ${response.requestUrl}`);
                              navigator.clipboard.writeText(response.requestUrl)
                                .then(() => {
                                  console.log('URL successfully copied to clipboard');
                                  // Show copied notification
                                  const button = document.getElementById(`copy-btn-${index}`);
                                  if (button) {
                                    const originalText = button.innerText;
                                    button.innerText = 'Copied!';
                                    setTimeout(() => {
                                      button.innerText = originalText;
                                      console.log('Reset button text after copy');
                                    }, 2000);
                                  } else {
                                    console.warn(`Copy button element not found: copy-btn-${index}`);
                                  }
                                })
                                .catch(err => {
                                  console.error('Error copying URL to clipboard:', err);
                                });
                            }}
                            id={`copy-btn-${index}`}
                          >
                            Copy URL
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className={styles.noDataMessage}>No API response details available</div>
                )}
              </div>

              <div className={styles.statsActions}>
                <button 
                  className={styles.cancelCheckButton}
                  onClick={() => setShowStatsDialog(false)}
                >
                  Cancel
                </button>
                <button 
                  className={styles.closeStatsButton}
                  onClick={() => setShowStatsDialog(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show the error message as a dialog for better visibility */}
      {error && (
        <div className={dialogStyles.dialogOverlay} onClick={() => setError(null)} style={{ zIndex: 9999 }}>
          <div className={dialogStyles.statusDialog} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={dialogStyles.dialogHeader}>
              <h3>Price Check Status</h3>
              <button className={dialogStyles.closeButton} onClick={() => setError(null)}>Cancel</button>
            </div>
            <div className={dialogStyles.dialogContent}>
              <div className={styles.errorMessageContainer}>
                <div className={styles.errorIcon}>⚠️</div>
                <div className={styles.errorText}>{error}</div>
              </div>
              <div className={styles.statsActions}>
                <button 
                  className={styles.cancelCheckButton}
                  onClick={() => setError(null)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
