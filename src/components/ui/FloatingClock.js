'use client';

import { useState, useEffect } from 'react';
import { Clock, Settings, Eye, EyeOff, Move } from 'lucide-react';
import styles from '@/styles/floating-clock.module.css';

export default function FloatingClock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isVisible, setIsVisible] = useState(true);
  const [position, setPosition] = useState('bottom-right');
  const [format24Hour, setFormat24Hour] = useState(false);
  const [showDate, setShowDate] = useState(true);
  const [showSeconds, setShowSeconds] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('floating-clock-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setIsVisible(settings.isVisible ?? true);
        setPosition(settings.position ?? 'bottom-right');
        setFormat24Hour(settings.format24Hour ?? false);
        setShowDate(settings.showDate ?? true);
        setShowSeconds(settings.showSeconds ?? true);
      }
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const settings = {
        isVisible,
        position,
        format24Hour,
        showDate,
        showSeconds
      };
      localStorage.setItem('floating-clock-settings', JSON.stringify(settings));
    }
  }, [isVisible, position, format24Hour, showDate, showSeconds]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time based on settings
  const formatTime = (date) => {
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !format24Hour,
      timeZone: 'UTC'
    };

    if (showSeconds) {
      options.second = '2-digit';
    }

    return date.toLocaleTimeString('en-US', options);
  };

  // Format date
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  // Get timezone
  const getTimezone = () => {
    return 'UTC';
  };

  // Position classes
  const getPositionClass = () => {
    switch (position) {
      case 'top-left':
        return styles.topLeft;
      case 'top-right':
        return styles.topRight;
      case 'bottom-left':
        return styles.bottomLeft;
      case 'bottom-right':
      default:
        return styles.bottomRight;
    }
  };

  // Handle drag start
  const handleMouseDown = (e) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  // Handle drag
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const clockElement = document.querySelector(`.${styles.floatingClock}`);
      if (!clockElement) return;

      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;

      clockElement.style.left = `${x}px`;
      clockElement.style.top = `${y}px`;
      clockElement.style.right = 'auto';
      clockElement.style.bottom = 'auto';
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className={styles.showButton}
        title="Show Clock"
        aria-label="Show Clock"
      >
        <Clock size={20} />
      </button>
    );
  }

  return (
    <>
      <div 
        className={`${styles.floatingClock} ${getPositionClass()} ${isDragging ? styles.dragging : ''}`}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className={styles.clockHeader}>
          <div className={styles.clockIcon}>
            <Clock size={16} />
          </div>
          <div className={styles.clockControls}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={styles.controlButton}
              title="Clock Settings"
              aria-label="Clock Settings"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className={styles.controlButton}
              title="Hide Clock"
              aria-label="Hide Clock"
            >
              <EyeOff size={14} />
            </button>
          </div>
        </div>

        <div className={styles.timeDisplay}>
          <div className={styles.time}>
            {formatTime(currentTime)}
          </div>
          {showDate && (
            <div className={styles.date}>
              {formatDate(currentTime)}
            </div>
          )}
          <div className={styles.timezone}>
            {getTimezone()}
          </div>
        </div>

        {showSettings && (
          <div className={styles.settings}>
            <div className={styles.settingsHeader}>
              <h4>Clock Settings</h4>
            </div>
            
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>
                <input
                  type="checkbox"
                  checked={format24Hour}
                  onChange={(e) => setFormat24Hour(e.target.checked)}
                />
                <span>24 Hour Format</span>
              </label>
            </div>

            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>
                <input
                  type="checkbox"
                  checked={showDate}
                  onChange={(e) => setShowDate(e.target.checked)}
                />
                <span>Show Date</span>
              </label>
            </div>

            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>
                <input
                  type="checkbox"
                  checked={showSeconds}
                  onChange={(e) => setShowSeconds(e.target.checked)}
                />
                <span>Show Seconds</span>
              </label>
            </div>

            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>
                <span>Position:</span>
                <select 
                  value={position} 
                  onChange={(e) => setPosition(e.target.value)}
                  className={styles.positionSelect}
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
