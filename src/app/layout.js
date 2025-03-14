import { Geist, Geist_Mono } from "next/font/google";
import { Inter } from 'next/font/google';
import '@/styles/globals.css'
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/useAuth";
import { ProfileProvider } from '@/contexts/ProfileContext';
import { SupabaseProvider } from '@/hooks/useSupabase';
import { ClientSideLayout } from "@/components/ClientSideLayout";
import ClientImagePreloader from '@/components/ClientImagePreloader';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: "StockRoom - Social Trading Platform",
  description: "Connect with traders, share insights, and analyze market opportunities",
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
        className={`${geistSans.variable} ${geistMono.variable} ${inter.className} antialiased notranslate`}
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
