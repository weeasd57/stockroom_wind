import { Inter, Roboto_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { ThemeProvider } from "@/providers/theme-provider";
import { SupabaseProvider, UserProvider, CreatePostFormProvider } from '@/providers';
import { ProfileProvider } from '@/providers/ProfileProvider';
import { AuthGuard } from '@/providers/AuthGuard';
import { ClientSideLayout } from '@/providers/ClientSideLayout';
import ClientImagePreloader from '@/providers/ClientImagePreloader';
import Script from 'next/script';

const inter = Inter({
  subsets: ['latin'],
  variable: "--font-geist-sans",
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: "--font-geist-mono",
});

export const metadata = {
  title: 'FireStocks - Stock Analysis Platform',
  description: 'Powerful tools for investors to track, analyze, and optimize their portfolios',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable} ${robotoMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preload" as="image" href="/logo.png" />
        <link rel="preload" as="image" href="/profile-bg.jpg" />
        <link rel="preload" as="image" href="/default-avatar.svg" />
      </head>
      <body>
        <Script id="global-abort-init" strategy="beforeInteractive">
          {`
            window.abortPostsFetch = function() {
              console.log('Initial abort function called - no active fetch to cancel');
              return Promise.resolve();
            };
          `}
        </Script>
        
        <Script id="console-suppressor" strategy="beforeInteractive">
          {`
            if (process.env.NODE_ENV === 'production') {
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
        <Script id="image-cache-manager" strategy="beforeInteractive">
          {`
            window.imageCacheManager = {
              cache: {},
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
              }
            };
          `}
        </Script>
        <SupabaseProvider>
          <UserProvider>
            <ProfileProvider>
              <ThemeProvider defaultTheme="dark" attribute="class" enableSystem={true}>
                <CreatePostFormProvider>
                  <ClientSideLayout>
                    <AuthGuard>
                      <ClientImagePreloader />
                        {children}
                    </AuthGuard>
                  </ClientSideLayout>
                </CreatePostFormProvider>
              </ThemeProvider>
            </ProfileProvider>
          </UserProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
