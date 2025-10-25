"use client";

import { useTheme } from '@/providers/theme-provider';
import styles from '@/styles/footer.module.css';

export default function Footer() {
  const { theme } = useTheme();
  
  return (
    <footer className={`${styles.footer} ${theme === 'dark' ? styles.darkFooter : ''}`}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.title}>SharksZone</h3>
            <p className={styles.description}>
              Your social platform for stock market enthusiasts
            </p>
          </div>
        </div>
        
        <div className={styles.bottom}>
          <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} <span className={styles.appNameInCopyright}>SharksZone</span>. All rights reserved.
          </p>
        </div>
        <div className={styles.appname}>SharksZone</div>
      </div>
    </footer>
  );
}
