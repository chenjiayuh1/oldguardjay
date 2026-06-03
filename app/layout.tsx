import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '陳家煜的美國時間',
  description: '美國政治、經濟、商業、科技及文化觀察 | Old Guard Capitalist',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: '陳家煜的美國時間',
    description: '美國政治、經濟、商業、科技及文化觀察',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
