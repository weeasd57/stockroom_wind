"use client";

import Link from 'next/link';
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

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Legal</h4>
            <ul className={styles.linkList}>
              <li>
                <Link href="/privacy" className={styles.link}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className={styles.link}>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className={styles.link}>
                  Financial Disclaimer
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Support</h4>
            <ul className={styles.linkList}>
              <li>
                <Link href="/contact" className={styles.link}>
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className={styles.link}>
                  How It Works
                </Link>
              </li>
            </ul>
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
