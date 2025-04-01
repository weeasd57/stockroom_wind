import { Inter, Roboto_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/useAuth";
import { ProfileProvider } from '@/contexts/ProfileContext';
import { SupabaseProvider } from '@/hooks/useSupabase';
import { ClientSideLayout } from "@/components/ClientSideLayout";
import ClientImagePreloader from '@/components/ClientImagePreloader';
import { CreatePostFormProvider } from '@/contexts/CreatePostFormContext';
import PostsStoreUpdater from '@/components/PostsStoreUpdater';
import Script from 'next/script';
import { Suspense } from 'react';

// Replace Geist with Inter as the primary font
const inter = Inter({
  subsets: ['latin'],
  variable: "--font-geist-sans",
});

// Use Roboto Mono as a replacement for Geist Mono
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
    <html lang="en" className={`scroll-smooth dark ${inter.variable} ${robotoMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Add metadata if needed */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body>
        {/* Initialize the global abort function */}
        <Script id="global-abort-init" strategy="beforeInteractive">
          {`
            // Initialize the global abort function to ensure it's always available
            window.abortPostsFetch = function() {
              console.log('Initial abort function called - no active fetch to cancel');
              return Promise.resolve();
            };
          `}
        </Script>
        
        {/* Add console suppression script */}
        <Script id="console-suppressor" strategy="beforeInteractive">
          {`
            if (process.env.NODE_ENV === 'production') {
              // Keep error and warn for debugging
              const originalLog = console.log;
              const originalInfo = console.info;
              const originalDebug = console.debug;
              
              // Replace with empty functions
              console.log = function() {};
              console.info = function() {};
              console.debug = function() {};
              
              // Add a way to restore if needed
              window._restoreConsole = function() {
                console.log = originalLog;
                console.info = originalInfo;
                console.debug = originalDebug;
              };
            }
          `}
        </Script>
        <SupabaseProvider>
          <AuthProvider>
            <ProfileProvider>
              <ThemeProvider defaultTheme="dark" attribute="class">
                <CreatePostFormProvider>
                  <ClientSideLayout>
                    <ClientImagePreloader />
                    <div className="app-wrapper">
                      {children}
                    </div>
                  </ClientSideLayout>
                  <PostsStoreUpdater />
                </CreatePostFormProvider>
              </ThemeProvider>
            </ProfileProvider>
          </AuthProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
