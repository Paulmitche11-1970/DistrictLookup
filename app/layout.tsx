import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Martinez | Find your councilmember',
  description:
    'Find your Martinez council district and connect with your elected representative.',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
