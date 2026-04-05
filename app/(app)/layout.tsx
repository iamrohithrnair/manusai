import { NavTabs } from '@/components/nav-tabs';
import { CompanyProvider } from '@/lib/company-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyProvider>
      <NavTabs />
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">{children}</main>
    </CompanyProvider>
  );
}
