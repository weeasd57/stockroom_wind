import { Inter, Roboto_Mono } from 'next/font/google';
import '@/styles/globals.css';
import 'flag-icons/css/flag-icons.min.css';
import { ThemeProvider } from "@/providers/theme-provider";
import { SupabaseProvider, UserProvider, CreatePostFormProvider } from '@/providers';
import { ProfileProvider } from '@/providers/ProfileProvider';
import { TradersProvider } from '@/providers/TradersProvider';
import { AuthGuard } from '@/providers/AuthGuard';
import { ClientSideLayout } from '@/providers/ClientSideLayout';
import ClientImagePreloader from '@/providers/ClientImagePreloader';
import Script from 'next/script';
import { headers } from 'next/headers';
import { FollowProvider } from '@/providers/FollowProvider'; // Import FollowProvider
import { PostProvider } from '@/providers';
import { BackgroundPostCreationProvider } from '@/providers';
import BackgroundPostCreationFloatingIndicator from '@/components/background/BackgroundPostCreationFloatingIndicator';
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: "--font-geist-sans",
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: "--font-geist-mono",
});

export const metadata = {
  title: 'SharksZone - Stock Analysis Platform',
  description: 'SharksZone helps you analyze stocks, track performance, and act with confidence using real-time insights.',
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
      </head>
      <body
        translate="no"
        className="pt-[var(--navbar-height)] pb-[env(safe-area-inset-bottom)]"
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
        <Script id="image-cache-manager" strategy="beforeInteractive" nonce={cspNonce || undefined}>
          {`
            window.imageCacheManager = {
              cache: {},
              listeners: [],
              
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
              
              preload: function(urls) {
                if (!Array.isArray(urls)) urls = [urls];
                urls.forEach(url => {
                  if (!url || this.cache[url]) return;
                  
                  const img = new Image();
                  img.onload = () => {
                    this.cache[url] = true;
                    console.log('Image preloaded:', url);
                  };
                  img.src = url;
                });
              },
              
              getAvatarUrl: function(userId) {
                const key = 'avatar_' + userId;
                return localStorage.getItem(key);
              },
              
              setAvatarUrl: function(userId, url) {
                if (!userId || !url) return;
                const key = 'avatar_' + userId;
                localStorage.setItem(key, url);
                this.preload(url);
                
                // Notify all subscribers about the avatar change
                this.notifyChange(userId, 'avatar', url);
              },
              
              // Add method for background images
              getBackgroundUrl: function(userId) {
                const key = 'background_' + userId;
                return localStorage.getItem(key);
              },
              
              setBackgroundUrl: function(userId, url) {
                if (!userId || !url) return;
                const key = 'background_' + userId;
                localStorage.setItem(key, url);
                this.preload(url);
                
                // Notify all subscribers about the background change
                this.notifyChange(userId, 'background', url);
              }
            };
          `}
        </Script>
        <SupabaseProvider>
          <UserProvider>
            <ProfileProvider>
              <TradersProvider>
                <ThemeProvider defaultTheme="dark" attribute="class" enableSystem={true}>
                  <CreatePostFormProvider>
                    <ClientSideLayout>
                      <AuthGuard>
                        <ClientImagePreloader />
                        <PostProvider>
                          <BackgroundPostCreationProvider>
                            <FollowProvider> {/* Wrap children with FollowProvider */}
                              {children}
                              <BackgroundPostCreationFloatingIndicator />
                              <Toaster richColors position="top-right" />
                            </FollowProvider>
                          </BackgroundPostCreationProvider>
                        </PostProvider>
                      </AuthGuard>
                    </ClientSideLayout>
                  </CreatePostFormProvider>
                </ThemeProvider>
              </TradersProvider>
            </ProfileProvider>
          </UserProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
