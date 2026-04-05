'use client';

import { CompanyProvider } from '@/lib/company-context';
import { ManusApiKeyProvider } from '@/components/manus-api-key-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ManusApiKeyProvider>
      <CompanyProvider>{children}</CompanyProvider>
    </ManusApiKeyProvider>
  );
}
