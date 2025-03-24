import { Inter } from 'next/font/google';
import '@/styles/globals.css'
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/useAuth";
import { ProfileProvider } from '@/contexts/ProfileContext';
import { SupabaseProvider } from '@/hooks/useSupabase';
import { ClientSideLayout } from "@/components/ClientSideLayout";
import ClientImagePreloader from '@/components/ClientImagePreloader';
import { Roboto_Mono } from 'next/font/google';
import './globals.css';

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
      <body>
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
      </body>
    </html>
  );
}
