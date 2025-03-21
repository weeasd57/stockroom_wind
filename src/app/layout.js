import { Inter } from 'next/font/google';
import '@/styles/globals.css'
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/useAuth";
import { ProfileProvider } from '@/contexts/ProfileContext';
import { SupabaseProvider } from '@/hooks/useSupabase';
import { ClientSideLayout } from "@/components/ClientSideLayout";
import ClientImagePreloader from '@/components/ClientImagePreloader';
import { Roboto_Mono } from 'next/font/google';

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
  title: "FireStocks - Trading Community & Stock Analysis Platform",
  description: "Join our trading community to share stock insights with target prices and stop loss levels. Track performance metrics, analyze success rates, and discover top-performing traders ranked by their analysis accuracy.",
  keywords: "stock analysis, trading community, target price, stop loss, trader rankings, stock performance, investment insights, social trading, market analysis",
  openGraph: {
    title: "FireStocks - Trading Community & Stock Analysis Platform",
    description: "Join our trading community to share stock insights with target prices and stop loss levels. Track performance metrics and discover top-performing traders.",
    type: "website",
    locale: "en_US",
    url: "https://firestocks.com/",
    siteName: "FireStocks",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "FireStocks Trading Platform"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "FireStocks - Trading Community & Stock Analysis Platform",
    description: "Join our trading community to share stock insights with target prices and stop loss levels. Track performance metrics and discover top-performing traders.",
    images: ["/twitter-image.jpg"]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <meta name="translator" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
      </head>
      <body
        className={`${inter.variable} ${robotoMono.variable} ${inter.className} antialiased notranslate`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SupabaseProvider>
              <ProfileProvider>
                <ClientSideLayout>
                  <ClientImagePreloader />
                  {children}
                </ClientSideLayout>
              </ProfileProvider>
            </SupabaseProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
