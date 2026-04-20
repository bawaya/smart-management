import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Arabic, Noto_Sans_Hebrew } from 'next/font/google';
import './globals.css';

const notoHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew'],
  variable: '--font-noto-hebrew',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-arabic',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'ניהול חכם',
  description: 'הניהול החכם לעסק שלך',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ניהול חכם',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#f59e0b',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body
        className={`${notoHebrew.variable} ${notoArabic.variable} antialiased bg-[#f3f4f6] text-gray-900`}
      >
        {children}
      </body>
    </html>
  );
}
