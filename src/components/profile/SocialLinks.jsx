'use client';

import React, { useEffect, useState } from 'react';
import styles from '@/styles/socialLinks.module.css';

export default function SocialLinks({ profile, size = 'normal', className = '' }) {
  const [socialData, setSocialData] = useState({
    facebook_url: '',
    telegram_url: '',
    youtube_url: ''
  });

  // Update social data when profile changes
  useEffect(() => {
    if (profile) {
      const rawFacebook = profile.facebook_url;
      const rawTelegram = profile.telegram_url;
      const rawYoutube = profile.youtube_url;
      
      console.log('[SocialLinks] 🔄 Profile updated:', {
        facebook_url: rawFacebook,
        facebook_type: typeof rawFacebook,
        telegram_url: rawTelegram,
        telegram_type: typeof rawTelegram,
        youtube_url: rawYoutube,
        youtube_type: typeof rawYoutube
      });
      
      setSocialData({
        facebook_url: rawFacebook || '',
        telegram_url: rawTelegram || '',
        youtube_url: rawYoutube || ''
      });
    }
  }, [profile]);

  // Listen for profile update events
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      console.log('[SocialLinks] 📡 Received profile update event:', event.detail);
      
      // Update social data if profile data is included in the event
      if (event.detail?.profileData) {
        const profileData = event.detail.profileData;
        setSocialData({
          facebook_url: profileData.facebook_url || '',
          telegram_url: profileData.telegram_url || '',
          youtube_url: profileData.youtube_url || ''
        });
        console.log('[SocialLinks] 🔄 Updated social data from event:', {
          facebook_url: profileData.facebook_url || '',
          telegram_url: profileData.telegram_url || '',
          youtube_url: profileData.youtube_url || ''
        });
      }
    };

    const handleSocialLinksUpdate = (event) => {
      console.log('[SocialLinks] 🔗 Received social links update event:', {
        facebook_url: event.detail.facebook_url || '',
        telegram_url: event.detail.telegram_url || '',
        youtube_url: event.detail.youtube_url || ''
      });
      setSocialData({
        facebook_url: event.detail.facebook_url || '',
        telegram_url: event.detail.telegram_url || '',
        youtube_url: event.detail.youtube_url || ''
      });
    };

    const handleProfileSocialLinksUpdate = (event) => {
      console.log('[SocialLinks] 👤 Received profile social links update event:', {
        facebook_url: event.detail.facebook_url || '',
        telegram_url: event.detail.telegram_url || '',
        youtube_url: event.detail.youtube_url || ''
      });
      setSocialData({
        facebook_url: event.detail.facebook_url || '',
        telegram_url: event.detail.telegram_url || '',
        youtube_url: event.detail.youtube_url || ''
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('avatarUpdated', handleProfileUpdate);
      window.addEventListener('socialLinksUpdated', handleSocialLinksUpdate);
      window.addEventListener('profileSocialLinksUpdated', handleProfileSocialLinksUpdate);
      
      return () => {
        window.removeEventListener('avatarUpdated', handleProfileUpdate);
        window.removeEventListener('socialLinksUpdated', handleSocialLinksUpdate);
        window.removeEventListener('profileSocialLinksUpdated', handleProfileSocialLinksUpdate);
      };
    }
  }, []);

  if (!profile) {
    console.log('[SocialLinks] ❌ No profile data available');
    return null;
  }

  const socialPlatforms = [
    {
      name: 'Facebook',
      url: socialData.facebook_url,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      color: '#1877f2',
      hoverColor: '#166fe5'
    },
    {
      name: 'Telegram',
      url: socialData.telegram_url,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
      color: '#0088cc',
      hoverColor: '#006ba6'
    },
    {
      name: 'YouTube',
      url: socialData.youtube_url,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      color: '#ff0000',
      hoverColor: '#cc0000'
    }
  ];

  const availablePlatforms = socialPlatforms.filter(platform => {
    const hasUrl = platform.url && platform.url.trim();
    if (hasUrl) {
      console.log(`[SocialLinks] ✅ ${platform.name} URL available:`, platform.url);
    }
    return hasUrl;
  });

  if (availablePlatforms.length === 0) {
    console.log('[SocialLinks] 📝 No social media URLs available');
    return null;
  }

  console.log(`[SocialLinks] 🎯 Rendering ${availablePlatforms.length} social platform(s):`, 
    availablePlatforms.map(p => `${p.name}: ${p.url}`));

  return (
    <div className={`${styles.socialLinks} ${styles[size]} ${className}`}>
      {availablePlatforms.map(platform => (
        <a
          key={platform.name}
          href={platform.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.socialLink}
          title={`Follow on ${platform.name}`}
          style={{
            '--social-color': platform.color,
            '--social-hover-color': platform.hoverColor
          }}
        >
          <div className={styles.socialIcon}>
            {platform.icon}
          </div>
          <span className={styles.socialName}>{platform.name}</span>
        </a>
      ))}
    </div>
  );
}
