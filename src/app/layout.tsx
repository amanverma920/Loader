import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { PanelNameProvider } from '@/contexts/PanelNameContext'
import { LogoProvider } from '@/contexts/LogoContext'

const inter = Inter({ subsets: ['latin'] })
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins'
})

export const metadata: Metadata = {
  title: 'Advanced Owner Dashboard',
  description: 'Professional admin panel for managing users, keys, and analytics. Monitor traffic, generate keys, and track device usage with ease.',
  keywords: 'admin panel, key management, analytics, dashboard, user management',
  authors: [{ name: 'NexPanel Team' }],
  openGraph: {
    title: 'Advanced Owner Dashboard',
    description: 'Professional admin panel for managing users, keys, and analytics',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/images/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Vip PanelDashboard Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Advanced Owner Dashboard',
    description: 'Professional admin panel for managing users, keys, and analytics',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} ${poppins.variable}`}>
        <ThemeProvider>
          <PanelNameProvider>
            <LogoProvider>
              {children}
            </LogoProvider>
          </PanelNameProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
