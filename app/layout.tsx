import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider } from '@/components/AuthProvider';
import { InstallPrompt } from '@/components/InstallPrompt';

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
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* PWA / Mobile web meta */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ERP Manager" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#4f46e5" />
        <meta name="msapplication-TileImage" content="/icon-192.png" />

        {/* Register Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('SW registered:', reg.scope); })
                    .catch(function(err) { console.log('SW registration failed:', err); });
                });
              }
            `,
          }}
        />
      </head>
      <body className="flex h-screen overflow-hidden" suppressHydrationWarning>
        <AuthProvider>
          <InstallPrompt />
          
          {/* Sidebar: desktop=static, mobile=overlay drawer */}
          <Sidebar />

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto w-full min-w-0">
            {/* Spacer for mobile hamburger button */}
            <div className="lg:hidden h-16" />
            <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10">
              {children}
            </div>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
