import './globals.css';
import AppShell from '../components/AppShell';
import { AuthProvider } from '../context/auth-context';
import { AssetClassProvider } from '../context/asset-class-context';

export const metadata = {
  title: 'FinPilot AI — Intelligent Multi-Asset & Portfolio Platform',
  description: 'AI-assisted financial intelligence, equities, cryptocurrency analysis, and real money broker trading.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AssetClassProvider>
            <AppShell>
              {children}
            </AppShell>
          </AssetClassProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
