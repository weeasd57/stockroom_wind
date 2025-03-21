"use client";

import Link from 'next/link';
import { useTheme } from '@/components/theme-provider';
import styles from '@/styles/footer.module.css';

export default function Footer() {
  const { theme } = useTheme();
  
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.title}>FireStocks</h3>
            <p className={styles.description}>
              Your social platform for stock market enthusiasts
            </p>
          </div>
          
          <div className={styles.section}>
            <h3 className={styles.title}>Links</h3>
            <ul className={styles.links}>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/explore">Explore</Link></li>
              <li><Link href="/stocks">Stocks</Link></li>
              <li><Link href="/news">News</Link></li>
            </ul>
          </div>
          
          <div className={styles.section}>
            <h3 className={styles.title}>Legal</h3>
            <ul className={styles.links}>
              <li><Link href="/terms">Terms</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
            </ul>
          </div>
        </div>
        
        <div className={styles.bottom}>
          <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} FireStocks. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
