import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'GO FOR GOLD | Competitive Programming Platform',
    description: 'Practice coding daily, track streaks, compete on leaderboards, and get AI-powered help.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="/logo.png" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body className="antialiased min-h-screen">{children}</body>
        </html>
    );
}
