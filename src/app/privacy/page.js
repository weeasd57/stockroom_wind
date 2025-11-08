import Link from 'next/link';
import styles from './privacy.module.css';

export const metadata = {
  title: 'Privacy Policy - SharksZone',
  description: 'Privacy Policy for SharksZone social trading platform',
};

export default function PrivacyPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1>Privacy Policy</h1>
          <p className={styles.lastUpdated}>Last Updated: November 5, 2025</p>
        </header>

        <section className={styles.section}>
          <h2>1. Introduction</h2>
          <p>
            Welcome to SharksZone. We respect your privacy and are committed to protecting your personal data.
            This privacy policy will inform you about how we look after your personal data when you visit our
            platform and tell you about your privacy rights and how the law protects you.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Information We Collect</h2>
          <p>We may collect, use, store and transfer different kinds of personal data about you:</p>
          <ul>
            <li><strong>Identity Data:</strong> Username, profile information, avatar</li>
            <li><strong>Contact Data:</strong> Email address</li>
            <li><strong>Transaction Data:</strong> Details about payments and subscriptions</li>
            <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
            <li><strong>Profile Data:</strong> Trading preferences, posts, comments, and interactions</li>
            <li><strong>Usage Data:</strong> Information about how you use our platform</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>3. How We Use Your Information</h2>
          <p>We use your personal data for the following purposes:</p>
          <ul>
            <li>To provide and maintain our service</li>
            <li>To manage your account and subscription</li>
            <li>To process your transactions</li>
            <li>To communicate with you about your account or our services</li>
            <li>To improve our platform and user experience</li>
            <li>To comply with legal obligations</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>4. Data Sharing and Disclosure</h2>
          <p>We may share your personal data with:</p>
          <ul>
            <li><strong>Service Providers:</strong> Third-party companies that help us operate our platform (payment processors, hosting services)</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
          </ul>
          <p>We do not sell your personal data to third parties.</p>
        </section>

        <section className={styles.section}>
          <h2>5. Data Security</h2>
          <p>
            We have implemented appropriate security measures to prevent your personal data from being
            accidentally lost, used, or accessed in an unauthorized way. We limit access to your personal
            data to those employees, agents, contractors, and other third parties who have a business need
            to know.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Data Retention</h2>
          <p>
            We will only retain your personal data for as long as necessary to fulfill the purposes we
            collected it for, including for the purposes of satisfying any legal, accounting, or reporting
            requirements.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Your Legal Rights</h2>
          <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data:</p>
          <ul>
            <li>Request access to your personal data</li>
            <li>Request correction of your personal data</li>
            <li>Request erasure of your personal data</li>
            <li>Object to processing of your personal data</li>
            <li>Request restriction of processing your personal data</li>
            <li>Request transfer of your personal data</li>
            <li>Right to withdraw consent</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>8. Third-Party Links</h2>
          <p>
            Our platform may include links to third-party websites, plug-ins, and applications. Clicking on
            those links or enabling those connections may allow third parties to collect or share data about
            you. We do not control these third-party websites and are not responsible for their privacy statements.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Cookies</h2>
          <p>
            We use cookies and similar tracking technologies to track activity on our platform and store certain
            information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being
            sent. However, if you do not accept cookies, you may not be able to use some portions of our service.
          </p>
        </section>

        <section className={styles.section}>
          <h2>10. Children's Privacy</h2>
          <p>
            Our service is not intended for use by children under the age of 18. We do not knowingly collect
            personal data from children under 18. If you are a parent or guardian and you are aware that your
            child has provided us with personal data, please contact us.
          </p>
        </section>

        <section className={styles.section}>
          <h2>11. Changes to This Privacy Policy</h2>
          <p>
            We may update our privacy policy from time to time. We will notify you of any changes by posting
            the new privacy policy on this page and updating the "Last Updated" date at the top of this policy.
          </p>
        </section>

        <section className={styles.section}>
          <h2>12. Contact Us</h2>
          <p>If you have any questions about this privacy policy, please contact us:</p>
          <ul>
            <li>Through our <Link href="/contact">contact page</Link></li>
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
