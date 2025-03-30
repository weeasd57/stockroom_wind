import { Inter } from 'next/font/google';
import '@/styles/globals.css'
import Script from 'next/script';
import { Roboto_Mono } from 'next/font/google';
import './globals.css';
import { 
  DynamicThemeProvider, 
  DynamicAuthProvider, 
  DynamicProfileProvider, 
  DynamicSupabaseProvider, 
  DynamicPostFormProvider,
  DynamicClientSideLayout,
  DynamicClientImagePreloader
} from './dynamic-imports';

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
        <DynamicPostFormProvider>
          <DynamicSupabaseProvider>
            <DynamicAuthProvider>
              <DynamicProfileProvider>
                <DynamicThemeProvider defaultTheme="dark" attribute="class">
                  <DynamicClientSideLayout>
                    <DynamicClientImagePreloader />
                    {children}
                  </DynamicClientSideLayout>
                </DynamicThemeProvider>
              </DynamicProfileProvider>
            </DynamicAuthProvider>
          </DynamicSupabaseProvider>
        </DynamicPostFormProvider>
      </body>
    </html>
  );
}
