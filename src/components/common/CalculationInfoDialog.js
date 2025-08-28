import React from 'react';
import styles from '@/styles/ProfilePostCard.module.css'; // Using existing dialog styles

export default function CalculationInfoDialog({ isOpen, onClose, title, content }) {
  if (!isOpen) return null;

  return (
    <div className={styles.dialogOverlay} onClick={onClose} style={{ zIndex: 10000 }}>
      <div className={styles.statusDialog} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className={styles.dialogHeader}>
          <h3>{title}</h3>
          <button className={styles.closeButton} onClick={onClose}>Close</button>
        </div>
        <div className={styles.dialogContent}>
          <div className={styles.infoContent} dangerouslySetInnerHTML={{ __html: content }} />
          <div className={styles.statsActions}>
            <button 
              className={styles.closeStatsButton}
              onClick={onClose}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
