import Link from 'next/link';
import styles from './terms.module.css';

export const metadata = {
  title: 'Terms of Service - SharksZone',
  description: 'Terms of Service for SharksZone social trading platform',
};

export default function TermsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1>Terms of Service</h1>
          <p className={styles.lastUpdated}>Last Updated: November 5, 2025</p>
        </header>

        <section className={styles.section}>
          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing or using SharksZone ("the Service"), you agree to be bound by these Terms of Service
            ("Terms"). If you disagree with any part of the terms, you may not access the Service.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Description of Service</h2>
          <p>
            SharksZone is a social trading platform that allows users to share trading ideas, connect with other
            traders, and access stock market information. The Service includes features such as:
          </p>
          <ul>
            <li>Creating and sharing trading posts</li>
            <li>Following other traders and their activities</li>
            <li>Commenting and interacting with trading ideas</li>
            <li>Accessing stock market data and analysis</li>
            <li>Premium subscription features</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>3. User Accounts</h2>
          <p>When you create an account with us, you must provide accurate, complete, and current information at all times.</p>
          <ul>
            <li>You are responsible for safeguarding your account credentials</li>
            <li>You must be at least 18 years old to use this Service</li>
            <li>You agree to notify us immediately of any unauthorized use of your account</li>
            <li>We reserve the right to refuse service or terminate accounts at our sole discretion</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>4. Investment Disclaimer</h2>
          <div className={styles.warning}>
            <p><strong>IMPORTANT:</strong> SharksZone is an informational and social platform only.</p>
          </div>
          <ul>
            <li>We do not provide financial, investment, or trading advice</li>
            <li>All content shared by users represents their personal opinions only</li>
            <li>Trading and investing involve substantial risk of loss</li>
            <li>Past performance is not indicative of future results</li>
            <li>You should consult with a licensed financial advisor before making investment decisions</li>
            <li>We are not responsible for any financial losses resulting from information shared on the platform</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>5. User Content</h2>
          <p>By posting content on SharksZone, you grant us certain rights:</p>
          <ul>
            <li>You retain ownership of your content</li>
            <li>You grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content</li>
            <li>You are responsible for the content you post</li>
            <li>You agree not to post prohibited content (see Section 6)</li>
            <li>We reserve the right to remove any content that violates these Terms</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>6. Prohibited Activities</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Post false, misleading, or fraudulent information</li>
            <li>Manipulate or attempt to manipulate stock prices</li>
            <li>Engage in pump-and-dump schemes or market manipulation</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Post spam, advertisements, or promotional content without permission</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Attempt to gain unauthorized access to the platform</li>
            <li>Use automated systems (bots) without permission</li>
            <li>Impersonate others or misrepresent your identity</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>7. Subscriptions and Payments</h2>
          <ul>
            <li>Premium subscriptions are billed on a recurring basis</li>
            <li>You can cancel your subscription at any time</li>
            <li>Refunds are provided in accordance with our refund policy</li>
            <li>We reserve the right to change subscription prices with notice</li>
            <li>Failed payments may result in suspension of premium features</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>8. Intellectual Property</h2>
          <p>
            The Service and its original content (excluding user content), features, and functionality are owned
            by SharksZone and are protected by international copyright, trademark, patent, trade secret, and other
            intellectual property laws.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, SharksZone shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages, including without limitation:
          </p>
          <ul>
            <li>Loss of profits, revenue, or business</li>
            <li>Loss of data or trading losses</li>
            <li>Loss resulting from user content or third-party actions</li>
            <li>Any damages arising from your use or inability to use the Service</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>10. Data and Privacy</h2>
          <p>
            Your use of the Service is also governed by our Privacy Policy. Please review our
            <Link href="/privacy"> Privacy Policy</Link> to understand our practices.
          </p>
        </section>

        <section className={styles.section}>
          <h2>11. Third-Party Services</h2>
          <p>
            The Service may contain links to third-party websites or services that are not owned or controlled
            by SharksZone. We have no control over and assume no responsibility for the content, privacy policies,
            or practices of any third-party websites or services.
          </p>
        </section>

        <section className={styles.section}>
          <h2>12. Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason,
            including if you breach these Terms. Upon termination:
          </p>
          <ul>
            <li>Your right to use the Service will immediately cease</li>
            <li>Your account data may be deleted in accordance with our data retention policy</li>
            <li>You remain liable for any outstanding payments</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>13. Changes to Terms</h2>
          <p>
            We reserve the right to modify or replace these Terms at any time. If a revision is material, we will
            provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material
            change will be determined at our sole discretion.
          </p>
        </section>

        <section className={styles.section}>
          <h2>14. Governing Law</h2>
          <p>
            These Terms shall be governed and construed in accordance with applicable laws, without regard to
            its conflict of law provisions.
          </p>
        </section>

        <section className={styles.section}>
          <h2>15. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us:</p>
          <ul>
            <li>Through our <Link href="/contact">contact page</Link></li>
            <li>By email: support@sharkszone.com</li>
          </ul>
        </section>

        <div className={styles.actions}>
          <Link href="/" className={styles.backButton}>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
