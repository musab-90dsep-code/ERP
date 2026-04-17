import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider } from '@/components/AuthProvider';
import { InstallPrompt } from '@/components/InstallPrompt';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ERP Business Manager',
  description: 'Comprehensive business management — Invoices, Inventory, Employees, Payments & more.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ERP Manager',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'ERP Business Manager',
    description: 'Comprehensive ERP for managing your business.',
  },
};

export const viewport: Viewport = {
  themeColor: '#c9a84c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* PWA / Mobile web meta */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ERP Manager" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#c9a84c" />
        <meta name="msapplication-TileImage" content="/icon-192.png" />


      </head>
      <body
        className="flex h-screen overflow-hidden"
        style={{ background: '#0b0f1a' }}
        suppressHydrationWarning
      >
        <AuthProvider>
          <InstallPrompt />

          <Suspense fallback={<div className="hidden lg:block w-[250px] bg-[#0d1220]" />}>
            <Sidebar />
          </Suspense>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto w-full min-w-0" style={{ background: '#0b0f1a' }}>
            {/* Spacer for mobile hamburger button */}
            <div className="lg:hidden h-16" />
            <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
