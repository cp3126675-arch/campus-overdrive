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
    '手机横屏操控院徽，按合成进度挑战 Boss，合出清华并击败最终 Boss。',
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
