import { Inter } from 'next/font/google';
import '@/styles/globals.css'
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/useAuth";
import { ProfileProvider } from '@/contexts/ProfileContext';
import { SupabaseProvider } from '@/hooks/useSupabase';
import { ClientSideLayout } from "@/components/ClientSideLayout";
import ClientImagePreloader from '@/components/ClientImagePreloader';
import { Roboto_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { PostFormProvider } from '@/contexts/PostFormContext';

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
    <html lang="en" className={`scroll-smooth dark ${inter.variable} ${robotoMono.variable}`}>
      <head>
        {/* Add metadata if needed */}
      </head>
      <body>
        {/* Add console suppression script */}
        <Script id="console-suppressor" strategy="beforeInteractive">
          {`
            if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
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
        <PostFormProvider>
          <SupabaseProvider>
            <AuthProvider>
              <ProfileProvider>
                <ThemeProvider defaultTheme="dark" attribute="class">
                  <ClientSideLayout>
                    <ClientImagePreloader />
                    {children}
                  </ClientSideLayout>
                </ThemeProvider>
              </ProfileProvider>
            </AuthProvider>
          </SupabaseProvider>
        </PostFormProvider>
      </body>
    </html>
  );
}
