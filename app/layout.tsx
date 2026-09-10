import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ActivityTracker } from '@/components/activity-tracker';
import './globals.css';
import './designs.css';
import './biographies.css';
import './logs.css';
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
      <body>
        {children}
        <Suspense fallback={null}>
          <ActivityTracker />
        </Suspense>
      </body>
    </html>
  );
}
