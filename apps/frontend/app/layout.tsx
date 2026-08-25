import './globals.css';
import Navbar from '../components/Navbar';
import { AuthProvider } from '../context/auth-context';

export const metadata = {
  title: 'FinPilot AI — Intelligent Stock Market & Portfolio Platform',
  description: 'AI-assisted financial intelligence, stock analysis, portfolio tracking, and structured reasoning.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
