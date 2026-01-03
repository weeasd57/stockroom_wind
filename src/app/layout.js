import { Inter, Roboto_Mono } from 'next/font/google';
import '@/styles/globals.css';
import 'flag-icons/css/flag-icons.min.css';
import { ThemeProvider } from "@/providers/theme-provider";
import { SimpleSupabaseProvider } from '@/providers/SimpleSupabaseProvider';
import { DemoModeProvider } from '@/providers/DemoModeProvider';
import { UserProvider } from '@/providers/UserProvider';
import { SubscriptionProvider } from '@/providers/SubscriptionProvider';
import { BrokerSubscriptionProvider } from '@/providers/BrokerSubscriptionProvider';
import { CreatePostFormProvider } from '@/providers/CreatePostFormProvider';
import { ProfileProvider } from '@/providers/ProfileProvider';
import { TradersProvider } from '@/providers/TradersProvider';
import { AuthGuard } from '@/providers/AuthGuard';
import { ClientSideLayout } from '@/providers/ClientSideLayout';
import ClientImagePreloader from '@/providers/ClientImagePreloader';
import Script from 'next/script';
import { headers } from 'next/headers';
import { FollowProvider } from '@/providers/FollowProvider'; // Import FollowProvider
import { PostProvider } from '@/providers/PostProvider';
import { CommentProvider } from '@/providers/CommentProvider';
import { BackgroundPostCreationProvider } from '@/providers/BackgroundPostCreationProvider';
import { BackgroundProfileEditProvider } from '@/providers/BackgroundProfileEditProvider';
import { BackgroundPriceCheckProvider } from '@/providers/BackgroundPriceCheckProvider';
import { PriceCheckResultsProvider } from '@/providers/PriceCheckResultsProvider';
import { StrategiesProvider } from '@/providers/StrategiesProvider';
import { AnalysisStateProvider } from '@/providers/AnalysisStateProvider';
import GlobalPriceCheckHandler from '@/components/internal/GlobalPriceCheckHandler';
import UnifiedBackgroundProcessDrawer from '@/components/background/UnifiedBackgroundProcessDrawer';
import { Toaster } from 'sonner';
import FloatingClock from '@/components/ui/FloatingClock';
import CookieConsent from '@/components/ui/CookieConsent';

const inter = Inter({
  subsets: ['latin'],
  variable: "--font-geist-sans",
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: "--font-geist-mono",
});

export const metadata = {
  metadataBase: new URL('https://sharkszone.com'),
  // Basic Metadata
  title: {
    default: 'SharksZone — Social Trading Platform',
    template: '%s | SharksZone',
  },
  description: 'Share stock ideas, connect with traders, and build a community around trading insights. Discuss market opportunities and follow successful traders.',
  applicationName: 'SharksZone',
  authors: [{ name: 'SharksZone Team' }],
  generator: 'Next.js',
  keywords: ['trading', 'stocks', 'social trading', 'market analysis', 'trading community', 'stock ideas', 'traders', 'investment', 'finance'],
  referrer: 'origin-when-cross-origin',
  creator: 'SharksZone Team',
  publisher: 'SharksZone',
  
  // Robots & Indexing
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // Icons
  icons: {
    icon: [
      { url: '/favicon_io/favicon.ico' },
      { url: '/favicon_io/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon_io/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/favicon_io/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/favicon_io/safari-pinned-tab.svg',
      },
    ],
  },
  
  // Manifest
  manifest: '/favicon_io/site.webmanifest',
  
  // Theme Color
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  
  // Viewport (redundant with meta tag in head but good practice)
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  
  // OpenGraph
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://sharkszone.com',
    siteName: 'SharksZone',
    title: 'SharksZone — Social Trading Platform',
    description: 'Share stock ideas, connect with traders, and build a community around trading insights. Discuss market opportunities and follow successful traders.',
    images: [
      {
        url: '/favicon_io/android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'SharksZone Social Trading Platform',
      },
    ],
  },
  
  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'SharksZone — Social Trading Platform',
    description: 'Share stock ideas, connect with traders, and build a community around trading insights. Discuss market opportunities and follow successful traders.',
    creator: '@sharkszone',
    site: '@sharkszone',
    images: ['/favicon_io/android-chrome-512x512.png'],
  },
  
  // Verification (Google, Bing, etc.)
  verification: {
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
  
  // App Links (for mobile deep linking)
  appLinks: {
    web: {
      url: 'https://sharkszone.com',
      should_fallback: true,
    },
  },
  
  // Alternates (for multi-language support and canonical URLs)
  alternates: {
    canonical: 'https://sharkszone.com',
    languages: {
      'en-US': 'https://sharkszone.com',
      // Add more languages as needed
    },
  },
  
  // Category
  category: 'finance',
  
  // Classification
  classification: 'Business',
  
  // Format Detection
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  
  // Other
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function RootLayout({ children }) {
  const isProd = process.env.NODE_ENV === 'production';
  // Try to read a nonce forwarded via request headers by middleware/CDN if available
  const reqHeaders = headers();
  const cspHeader = reqHeaders.get('content-security-policy') || '';
  const extractNonce = (headerVal) => {
    if (!headerVal) return '';
    // Prefer style-src nonce, fallback to script-src nonce
    const styleMatch = headerVal.match(/style-src[^;]*'nonce-([^']+)'/i);
    if (styleMatch && styleMatch[1]) return styleMatch[1];
    const scriptMatch = headerVal.match(/script-src[^;]*'nonce-([^']+)'/i);
    if (scriptMatch && scriptMatch[1]) return scriptMatch[1];
    return '';
  };
  const cspNonce = extractNonce(cspHeader) || reqHeaders.get('x-nonce') || '';
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable} ${robotoMono.variable}`} suppressHydrationWarning translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/favicon_io/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon_io/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon_io/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon_io/favicon-16x16.png" />
        <link rel="manifest" href="/favicon_io/site.webmanifest" />
        {/* Google AdSense */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6192742001147947"
          crossOrigin="anonymous"
        />
      </head>
      <body
        translate="no"
        className="pb-[env(safe-area-inset-bottom)]"
      >
        {/* Expose CSP nonce to client scripts (e.g., PayPal SDK expects data-csp-nonce for injected styles) */}
        <Script id="csp-nonce-init" strategy="beforeInteractive" nonce={cspNonce || undefined}>
          {`window.__CSP_NONCE__ = ${JSON.stringify(cspNonce || '')};`}
        </Script>
        <Script id="global-abort-init" strategy="beforeInteractive" nonce={cspNonce || undefined}>
          {`
            window.abortPostsFetch = function() {
              console.log('Initial abort function called - no active fetch to cancel');
              return Promise.resolve();
            };
          `}
        </Script>

        {/* Google Analytics Consent Management */}
        <Script id="gtag-consent-init" strategy="beforeInteractive" nonce={cspNonce || undefined}>
          {`
            try {
              // Check if we can access cookies (will throw SecurityError in sandbox)
              var cookieEnabled = navigator.cookieEnabled;
              // Try accessing document.cookie to be sure
              var testCookie = document.cookie;
              
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              
              // Set default consent state (denied until user accepts)
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
              });
            } catch (e) {
              console.warn('Cookie access denied (sandbox mode). Analytics disabled.');
              window.gtag = function() {}; // No-op function to prevent errors
            }
          `}
        </Script>

        <Script id="console-suppressor" strategy="beforeInteractive" nonce={cspNonce || undefined}>
          {`
            if (${isProd}) {
              const originalLog = console.log;
              const originalInfo = console.info;
              const originalDebug = console.debug;
              
              console.log = function() {};
              console.info = function() {};
              console.debug = function() {};
              
              window._restoreConsole = function() {
                console.log = originalLog;
                console.info = originalInfo;
                console.debug = originalDebug;
              };
            }
          `}
        </Script>
        <Script id="iframe-detector" strategy="beforeInteractive" nonce={cspNonce || undefined}>
          {`
            try {
              var inIframe = window.self !== window.top;
              if (inIframe) {
                document.documentElement.classList.add('in-iframe');
                window.__IN_IFRAME__ = true;
              }
            } catch (e) {
              document.documentElement.classList.add('in-iframe');
              window.__IN_IFRAME__ = true;
            }
          `}
        </Script>
        <Script id="image-cache-manager" strategy="beforeInteractive" nonce={cspNonce || undefined}>
          {`
            window.imageCacheManager = {
              cache: {},
              listeners: [],
              failedUrls: new Set(),
              requestQueue: [],
              isProcessing: false,
              rateLimitDelay: 1000, // 1 second between requests
              maxRetries: 2,
              
              // Register a component to be notified of image changes
              subscribe: function(callback) {
                if (typeof callback === 'function') {
                  this.listeners.push(callback);
                  return () => {
                    this.listeners = this.listeners.filter(cb => cb !== callback);
                  };
                }
              },
              
              // Notify all components about an image change
              notifyChange: function(userId, imageType, url) {
                this.listeners.forEach(callback => {
                  try {
                    callback(userId, imageType, url);
                  } catch (e) {
                    console.error('Error in imageCacheManager listener:', e);
                  }
                });
              },
              
              // Check if URL is a Google profile image
              isGoogleProfileImage: function(url) {
                return url && (url.includes('googleusercontent.com') || url.includes('google.com/'));
              },
              
              // Get fallback image for failed URLs
              getFallbackImage: function(imageType) {
                if (imageType === 'avatar') {
                  return '/default-avatar.svg';
                }
                return null;
              },
              
              // Process request queue with rate limiting
              processQueue: async function() {
                if (this.isProcessing || this.requestQueue.length === 0) return;
                
                this.isProcessing = true;
                
                while (this.requestQueue.length > 0) {
                  const request = this.requestQueue.shift();
                  
                  try {
                    await this.loadImageWithRetry(request.url, request.retries || 0);
                  } catch (error) {
                    console.warn('Failed to load image after retries:', request.url, error);
                    this.failedUrls.add(request.url);
                  }
                  
                  // Rate limiting delay
                  if (this.requestQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
                  }
                }
                
                this.isProcessing = false;
              },
              
              // Load image with retry logic
              loadImageWithRetry: function(url, retryCount = 0) {
                return new Promise((resolve, reject) => {
                  if (this.cache[url] || this.failedUrls.has(url)) {
                    resolve();
                    return;
                  }
                  
                  const img = new Image();
                  
                  img.onload = () => {
                    this.cache[url] = true;
                    console.log('Image loaded successfully:', url);
                    resolve();
                  };
                  
                  img.onerror = () => {
                    if (retryCount < this.maxRetries && this.isGoogleProfileImage(url)) {
                      console.warn(\`Image load failed, retrying (\${retryCount + 1}/\${this.maxRetries}):\`, url);
                      setTimeout(() => {
                        this.loadImageWithRetry(url, retryCount + 1).then(resolve).catch(reject);
                      }, Math.pow(2, retryCount) * 1000); // Exponential backoff
                    } else {
                      console.error('Image load failed permanently:', url);
                      this.failedUrls.add(url);
                      reject(new Error('Image load failed'));
                    }
                  };
                  
                  img.src = url;
                });
              },
              
              // Enhanced preload with rate limiting
              preload: function(urls) {
                if (!Array.isArray(urls)) urls = [urls];
                
                urls.forEach(url => {
                  if (!url || this.cache[url] || this.failedUrls.has(url)) return;
                  
                  // Add to queue instead of immediate loading
                  this.requestQueue.push({ url, retries: 0 });
                });
                
                // Process queue
                this.processQueue();
              },
              
              getAvatarUrl: function(userId) {
                const key = 'avatar_' + userId;
                const url = localStorage.getItem(key);
                
                // If the stored URL has failed before, return fallback
                if (url && this.failedUrls.has(url)) {
                  return this.getFallbackImage('avatar');
                }
                
                return url;
              },
              
              setAvatarUrl: function(userId, url) {
                if (!userId) return;
                
                // If no URL provided or URL has failed, use fallback
                if (!url || this.failedUrls.has(url)) {
                  url = this.getFallbackImage('avatar');
                }
                
                const key = 'avatar_' + userId;
                localStorage.setItem(key, url);
                
                // Only preload if not a fallback image
                if (url !== this.getFallbackImage('avatar')) {
                  this.preload(url);
                }
                
                // Notify all subscribers about the avatar change
                this.notifyChange(userId, 'avatar', url);
              },
              
              getBackgroundUrl: function(userId) {
                const key = 'background_' + userId;
                const url = localStorage.getItem(key);
                
                // If the stored URL has failed before, return null
                if (url && this.failedUrls.has(url)) {
                  return null;
                }
                
                return url;
              },
              
              setBackgroundUrl: function(userId, url) {
                if (!userId || !url || this.failedUrls.has(url)) return;
                
                const key = 'background_' + userId;
                localStorage.setItem(key, url);
                this.preload(url);
                
                // Notify all subscribers about the background change
                this.notifyChange(userId, 'background', url);
              },
              
              // Clear failed URLs cache (for retry scenarios)
              clearFailedUrls: function() {
                this.failedUrls.clear();
              },
              
              // Check if URL has failed
              hasUrlFailed: function(url) {
                return this.failedUrls.has(url);
              }
            };
          `}
        </Script>
        <SimpleSupabaseProvider>
          <DemoModeProvider>
            <UserProvider>
              <SubscriptionProvider>
                <BrokerSubscriptionProvider>
                  <ProfileProvider>
                    <StrategiesProvider>
                      <AnalysisStateProvider>
                        <TradersProvider>
                          <ThemeProvider defaultTheme="dark" attribute="class" enableSystem={false}>
                            <CreatePostFormProvider>
                              <ClientSideLayout>
                                <AuthGuard>
                                  <ClientImagePreloader />
                                  <PostProvider>
                                    <CommentProvider>
                                      <BackgroundPostCreationProvider>
                                        <BackgroundProfileEditProvider>
                                          <BackgroundPriceCheckProvider>
                                            <PriceCheckResultsProvider>
                                              <GlobalPriceCheckHandler />
                                              <FollowProvider> {/* Wrap children with FollowProvider */}
                                                {children}
                                                <UnifiedBackgroundProcessDrawer />
                                                <FloatingClock />
                                                <Toaster richColors position="top-right" />
                                                <CookieConsent />
                                              </FollowProvider>
                                            </PriceCheckResultsProvider>
                                          </BackgroundPriceCheckProvider>
                                        </BackgroundProfileEditProvider>
                                      </BackgroundPostCreationProvider>
                                    </CommentProvider>
                                  </PostProvider>
                                </AuthGuard>
                              </ClientSideLayout>
                            </CreatePostFormProvider>
                          </ThemeProvider>
                        </TradersProvider>
                      </AnalysisStateProvider>
                    </StrategiesProvider>
                  </ProfileProvider>
                </BrokerSubscriptionProvider>
              </SubscriptionProvider>
            </UserProvider>
          </DemoModeProvider>
        </SimpleSupabaseProvider>
      </body>
    </html>
  );
}
