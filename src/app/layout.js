import { Inter, Roboto_Mono } from 'next/font/google';
import '@/styles/globals.css';
import 'flag-icons/css/flag-icons.min.css';
import { ThemeProvider } from "@/providers/theme-provider";
import { SupabaseProvider } from '@/providers/SupabaseProvider';
import { UserProvider } from '@/providers/UserProvider';
import { ProfileProvider } from '@/providers/ProfileProvider';
import { TradersProvider } from '@/providers/TradersProvider';
import { AuthGuard } from '@/providers/AuthGuard';
import { ClientSideLayout } from '@/providers/ClientSideLayout';
import ClientImagePreloader from '@/providers/ClientImagePreloader';
import { CreatePostFormProvider } from '@/providers/CreatePostFormProvider';
import { headers } from 'next/headers';
import GlobalInit from '@/providers/GlobalInit';
import { FollowProvider } from '@/providers/FollowProvider'; // Import FollowProvider
import { PostProvider } from '@/providers/PostProvider';
import { BackgroundPostCreationProvider } from '@/providers/BackgroundPostCreationProvider';
import { BackgroundProfileUpdateProvider } from '@/providers/BackgroundProfileUpdateProvider';
import { SubscriptionProvider } from '@/providers/SubscriptionProvider';
import BackgroundPostCreationFloatingIndicator from '@/components/background/BackgroundPostCreationFloatingIndicator';
import BackgroundProfileUpdateIndicator from '@/components/background/BackgroundProfileUpdateIndicator';
import { Toaster } from 'sonner';
import FloatingClock from '@/components/ui/FloatingClock';
import { setupGlobalErrorHandler } from '@/utils/errorHandler';

const inter = Inter({
  subsets: ['latin'],
  variable: "--font-geist-sans",
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: "--font-geist-mono",
});

export const metadata = {
  title: 'SharksZone — Social Trading Platform',
  description: 'Share stock ideas, connect with traders, and build a community around trading insights. Discuss market opportunities and follow successful traders.',
};

export default async function RootLayout({ children }) {
  const isProd = process.env.NODE_ENV === 'production';
  const reqHeaders = await headers();
  let cspNonce = '';
  if (!isProd) {
    try {
      const headerEntries = Array.from(reqHeaders.entries());
    } catch (error) {
      console.warn('[RootLayout] failed to inspect headers', error);
    }
  }
  if (!cspNonce) {
    cspNonce =
      reqHeaders.get('x-nextjs-nonce') ||
      reqHeaders.get('x-nonce') ||
      reqHeaders.get('next-app-nonce') ||
      '';
  }
  if (!cspNonce) {
    const cspHeader = reqHeaders.get('content-security-policy') || '';
    const match = cspHeader.match(/'nonce-([^']+)'/);
    if (match && match[1]) {
      cspNonce = match[1];
    }
  }
  // In development, Next may inject a client nonce even without CSP.
  // Provide a stable fallback to avoid hydration attribute mismatch.
  if (!cspNonce && !isProd) {
    cspNonce = 'dev-nonce';
  }
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable} ${robotoMono.variable}`} suppressHydrationWarning translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <meta name="translate" content="no" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/favicon_io/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon_io/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon_io/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon_io/favicon-16x16.png" />
        <link rel="manifest" href="/favicon_io/site.webmanifest" />
      </head>
      <body
        translate="no"
        className="pb-[env(safe-area-inset-bottom)]"
        suppressHydrationWarning
        data-csp-nonce={cspNonce || undefined}
      >
        {/* Client-side init to avoid inline script hydration differences */}
        { /* eslint-disable-next-line @next/next/no-head-element */ }
        <GlobalInit />
        <SupabaseProvider>
          <UserProvider>
            <ProfileProvider>
              <SubscriptionProvider>
                <TradersProvider>
                  <ThemeProvider defaultTheme="dark" attribute="class" enableSystem={true}>
                    <CreatePostFormProvider>
                      <ClientSideLayout>
                        <AuthGuard>
                          <ClientImagePreloader />
                          <PostProvider>
                            <BackgroundPostCreationProvider>
                              <BackgroundProfileUpdateProvider>
                                <FollowProvider> {/* Wrap children with FollowProvider */}
                                  {children}
                                  <BackgroundPostCreationFloatingIndicator />
                                  <BackgroundProfileUpdateIndicator />
                                  <FloatingClock />
                                  <Toaster richColors position="top-right" />
                                </FollowProvider>
                              </BackgroundProfileUpdateProvider>
                            </BackgroundPostCreationProvider>
                          </PostProvider>
                        </AuthGuard>
                      </ClientSideLayout>
                    </CreatePostFormProvider>
                  </ThemeProvider>
                </TradersProvider>
              </SubscriptionProvider>
            </ProfileProvider>
          </UserProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
