'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

export interface CompanyInfo {
  _id: string;
  name: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  industry?: string;
  size?: string;
  description?: string;
}

interface CompanyContextType {
  companies: CompanyInfo[];
  activeCompany: CompanyInfo | null;
  setActiveCompany: (company: CompanyInfo | null) => void;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  activeCompany: null,
  setActiveCompany: () => {},
  refreshCompanies: async () => {},
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyInfo | null>(null);

  const refreshCompanies = useCallback(async () => {
    const res = await fetch('/api/companies');
    const data = await res.json();
    const list = (data.companies || []) as CompanyInfo[];
    setCompanies(list);
    setActiveCompany((prev) => {
      if (!prev) return list[0] ?? null;
      const match = list.find((c) => c._id === prev._id);
      return match ?? list[0] ?? null;
    });
  }, []);

  useEffect(() => {
    refreshCompanies();
  }, [refreshCompanies]);

  return (
    <CompanyContext.Provider
      value={{ companies, activeCompany, setActiveCompany, refreshCompanies }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
