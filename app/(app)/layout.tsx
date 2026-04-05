import { NavTabs } from '@/components/nav-tabs';
import { AppProviders } from './providers';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <NavTabs />
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">{children}</main>
    </AppProviders>
  );
}
