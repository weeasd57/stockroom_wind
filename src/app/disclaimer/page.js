import Link from 'next/link';
import styles from './disclaimer.module.css';

export const metadata = {
  title: 'Financial Disclaimer - SharksZone',
  description: 'Important financial disclaimer for SharksZone social trading platform',
};

export default function DisclaimerPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1>⚠️ Important Financial Disclaimer</h1>
          <p className={styles.lastUpdated}>Last Updated: November 8, 2025</p>
        </header>

        <div className={styles.warningBox}>
          <div className={styles.warningIcon}>🚨</div>
          <div className={styles.warningContent}>
            <h3>Warning: This is NOT Financial Advice</h3>
            <p>Please read this disclaimer carefully before using SharksZone</p>
          </div>
        </div>

        <section className={styles.section}>
          <h2>1. Nature of Content</h2>
          <p>
            SharksZone is a social trading platform that allows users to share their ideas about stocks
            and investing. All content posted on the platform represents users' personal opinions only.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. No Financial Advice</h2>
          <ul>
            <li><strong>No Investment Advice:</strong> We do not provide any financial or investment advice</li>
            <li><strong>No Trading Recommendations:</strong> We do not recommend buying or selling any stocks or financial instruments</li>
            <li><strong>No Guarantees:</strong> We do not guarantee the accuracy or validity of information posted by users</li>
            <li><strong>No Predictions:</strong> We do not predict stock prices or market trends</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>3. Investment Risks</h2>
          <div className={styles.riskBox}>
            <h3>⚠️ Investing Involves High Risk</h3>
            <ul>
              <li>You can lose all of your invested money</li>
              <li>Prices can be volatile and unpredictable</li>
              <li>Past performance does not guarantee future results</li>
              <li>Prices may be affected by unexpected external factors</li>
              <li>There may be hidden fees or additional costs</li>
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <h2>4. Your Responsibility</h2>
          <p>
            You are responsible for your own investment decisions. You must:
          </p>
          <ul>
            <li>Conduct your own research before making any investment decision</li>
            <li>Consult a licensed financial advisor before investing</li>
            <li>Understand the risks associated with the financial instruments you're interested in</li>
            <li>Not rely on information from unreliable sources</li>
            <li>Start with small amounts if you're a beginner</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>5. Website Disclaimer</h2>
          <p>
            SharksZone is not responsible for:
          </p>
          <ul>
            <li>Financial losses resulting from following user opinions</li>
            <li>Accuracy of information posted on the platform</li>
            <li>Availability or accuracy of displayed market data</li>
            <li>Any direct or indirect damages from using the platform</li>
            <li>Technical issues or service interruptions</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>6. Your Obligations as a User</h2>
          <p>When using SharksZone, you agree to:</p>
          <ul>
            <li>Not post misleading or false information</li>
            <li>Not attempt to manipulate prices or the market</li>
            <li>Not violate intellectual property rights</li>
            <li>Respect other users and posted content</li>
            <li>Comply with all applicable laws and regulations</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>7. Financial Education</h2>
          <p>
            We strongly recommend financial education before starting to invest:
          </p>
          <ul>
            <li>Read reliable books about investing</li>
            <li>Follow accredited educational courses</li>
            <li>Start with small amounts for learning</li>
            <li>Consult licensed financial professionals</li>
            <li>Learn about risk management and diversification</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>8. Disclaimer Updates</h2>
          <p>
            We may update this financial disclaimer from time to time. We will notify you of any material changes by
            posting the updated version on this page and updating the "Last Updated" date.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Contact Us</h2>
          <p>
            If you have any questions about this financial disclaimer or using the platform, please contact us:
          </p>
          <ul>
            <li>Through our <Link href="/contact">contact page</Link></li>
            <li>By email: support@sharkszone.com</li>
          </ul>
        </section>

        <div className={styles.actions}>
          <Link href="/" className={styles.backButton}>
            Back to Home
          </Link>
          <Link href="/terms" className={styles.termsButton}>
            Read Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
