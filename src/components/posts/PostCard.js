'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CommentProvider } from '@/providers/CommentProvider';
import PostActions from '@/components/posts/PostActions';
import PostSentiment from '@/components/posts/PostSentiment';
import Comments from '@/components/posts/Comments';
import PriceUpdateIndicator from '@/components/PriceUpdateIndicator';
import Link from 'next/link';
import styles from '@/styles/home/PostsFeed.module.css';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';

// Reusable PostCard component used across Home feed and Traders page
export default function PostCard({ post, showFlagBackground = false, hideUserInfo = false }) {
  if (!post) return null;

  const formatPrice = (price) => {
    if (price == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  const calculatePotentialReturn = (currentPrice, targetPrice) => {
    if (!currentPrice || !targetPrice) return 0;
    return (((targetPrice - currentPrice) / currentPrice) * 100).toFixed(2);
  };

  const getStatusColor = (p) => {
    if (p?.target_reached) return styles.success;
    if (p?.stop_loss_triggered) return styles.loss;
    return styles.active;
  };

  const getStatusText = (p) => {
    if (p?.target_reached) return '🎯 Target Reached';
    if (p?.stop_loss_triggered) return '🛑 Stop Loss Hit';
    return '📊 Active';
  };

  const username = post?.profile?.username || 'Unknown';
  const avatarUrl = post?.profile?.avatar_url;
  const profileId = post?.profile?.id;

  // Debug: log post data to check last_price_check field
  if (post?.id && post.id === 'f2e20d85-c0b6-4e54-b723-4407bea26163') {
    console.log(`[PostCard] Post ${post.id} data:`, {
      id: post.id,
      symbol: post.symbol,
      last_price_check: post.last_price_check,
      created_at: post.created_at,
      current_price: post.current_price,
      hasLastPriceCheck: !!post.last_price_check,
      lastPriceCheckFormatted: post.last_price_check ? new Date(post.last_price_check).toISOString() : 'N/A'
    });
  }

  // Derive 2-letter ISO country code (lowercase) from country name/code or from symbol suffix
  const getCountryCode = (post) => {
    // Try explicit country
    if (post?.country) {
      const v = String(post.country).trim();
      if (v.length === 2) return v.toLowerCase();
      const match = Object.entries(COUNTRY_CODE_TO_NAME).find(([, name]) => String(name).toLowerCase() === v.toLowerCase());
      if (match) return match[0];
    }
    // Try from symbol like AAPL.US -> us
    if (post?.symbol && String(post.symbol).includes('.')) {
      try {
        const parts = String(post.symbol).split('.');
        if (parts.length > 1 && parts[1].length === 2) {
          return parts[1].toLowerCase();
        }
      } catch (_) {}
    }
    return null;
  };
  const countryCode = getCountryCode(post);

  return (
    <CommentProvider>
      <div className={styles.postCard}>
        {showFlagBackground && countryCode && (
          <div className={styles.flagBackground} aria-hidden="true">
            <span className={`fi fi-${countryCode}`}></span>
          </div>
        )}
        {/* Post Header */}
        <div className={styles.postHeader}>
          {!hideUserInfo && (
            profileId ? (
              <Link href={`/view-profile/${profileId}`} className={styles.userInfo} prefetch>
                <div className={styles.avatar}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={username} className={styles.avatarImage} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className={styles.userDetails}>
                  <h4 className={styles.username}>{username}</h4>
                  {post?.created_at && (
                    <p className={styles.timestamp}>
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  )}
                  {post?.last_price_check && (
                    <p className={styles.lastUpdate}>
                      Last updated: {formatDistanceToNow(new Date(post.last_price_check), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </Link>
            ) : (
              <div className={styles.userInfo}>
                <div className={styles.avatar}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={username} className={styles.avatarImage} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className={styles.userDetails}>
                  <h4 className={styles.username}>{username}</h4>
                  {post?.created_at && (
                    <p className={styles.timestamp}>
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  )}
                  {post?.last_price_check && (
                    <p className={styles.lastUpdate}>
                      Last updated: {formatDistanceToNow(new Date(post.last_price_check), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            )
          )}
          <div className={`${styles.status} ${getStatusColor(post)}`}>
            {getStatusText(post)}
          </div>
        </div>

        {/* Stock Info */}
        <div className={styles.stockInfo}>
          <div className={styles.stockHeader}>
            <h3 className={styles.stockSymbol}>{post?.symbol || '-'}</h3>
            {post?.exchange && <span className={styles.exchange}>{post.exchange}</span>}
          </div>
          {post?.company_name && (
            <p className={styles.companyName}>{post.company_name}</p>
          )}
          {(post?.country || countryCode) && (
            <p className={styles.country}>
              {countryCode && (
                <span className={`fi fi-${countryCode} country-flag`} style={{ marginRight: 6 }} />
              )}
              {post.country || countryCode}
            </p>
          )}
        </div>

        {/* Price Analysis */}
        <div className={styles.priceAnalysis}>
          <div className={styles.priceGrid}>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Current</span>
              <span className={styles.priceValue}>
                {formatPrice(post?.current_price)}
                {post?.last_price_check && (
                  <PriceUpdateIndicator
                    isUpdating={false}
                    lastUpdate={post.last_price_check}
                    currentPrice={post.current_price}
                    previousPrice={post.initial_price}
                  />
                )}
              </span>
            </div>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Target</span>
              <span className={styles.priceValue}>{formatPrice(post?.target_price)}</span>
            </div>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Stop Loss</span>
              <span className={styles.priceValue}>{formatPrice(post?.stop_loss_price)}</span>
            </div>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Potential</span>
              <span className={`${styles.priceValue} ${styles.potential}`}>
                +{calculatePotentialReturn(post?.current_price, post?.target_price)}%
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        {post?.description && (
          <div className={styles.postContent}>
            <p>{post.description}</p>
          </div>
        )}

        {/* Strategy Tag */}
        {post?.strategy && (
          <div className={styles.strategy}>
            <span className={styles.strategyTag}>📈 {post.strategy}</span>
          </div>
        )}

        {/* Buy/Sell Actions */}
        <PostActions 
          postId={post.id}
          initialBuyCount={post.buy_count || 0}
          initialSellCount={post.sell_count || 0}
        />

        {/* Market Sentiment */}
        <PostSentiment 
          postId={post.id}
          buyCount={post.buy_count || 0}
          sellCount={post.sell_count || 0}
        />

        {/* Comments Section */}
        <Comments 
          postId={post.id}
          initialCommentCount={post.comment_count || 0}
        />

        {/* Footer Actions */}
        <div className={styles.postFooter}>
          <Link className={styles.actionButton} href={`/posts/${post.id}`}>
            View Details
          </Link>
        </div>
      </div>
    </CommentProvider>
  );
}
