import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
export const metadata: Metadata = {
  title: '合成清华 · 徽章竞速挑战',
  description:
    '手机横屏操控院徽，合成清华完成毕业答辩，或参加期末周争取更高总分。',
  icons: { icon: '/badges/shuxue.png' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
