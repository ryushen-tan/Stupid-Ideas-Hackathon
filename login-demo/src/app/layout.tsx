import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'entré. — Your world, a little more secure.',
  description: 'A real two-factor sign-in experience. Your password opens the door. Your authenticator lets you in.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
