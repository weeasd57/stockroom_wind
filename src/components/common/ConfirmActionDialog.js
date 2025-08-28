 'use client';
import React, { useEffect, useRef, useId } from 'react';
import styles from '@/styles/ProfilePostCard.module.css'; // Using existing dialog styles
import profileStyles from '@/styles/profile.module.css'; // Reuse profile button styles for consistency

export default function ConfirmActionDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', showCancelButton = true }) {
  if (!isOpen) return null;

  const dialogRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  // Focus the dialog on open and close on Escape for accessibility
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div className={styles.dialogOverlay} onClick={onClose} style={{ zIndex: 10001 }}>
      <div
        className={styles.statusDialog}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className={styles.dialogHeader}>
          <h3 id={titleId}>{title}</h3>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close dialog">Close</button>
        </div>
        <div className={styles.dialogContent}>
          <p id={descId} className={styles.dialogMessage}>{message}</p>
          <div className={profileStyles.statsActions}>
            {showCancelButton && (
              <button 
                className={profileStyles.cancelCheckButton}
                onClick={onClose}
              >
                {cancelText}
              </button>
            )}
            <button 
              className={profileStyles.checkPricesButton} // Reusing the checkPricesButton style
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
