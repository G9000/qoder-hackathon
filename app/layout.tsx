import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bengkel Baik — compare workshop quotes properly',
  description:
    'Photo of visible car damage in, normalised and comparable workshop quotes out. Prices are seeded estimates and always labelled.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
