import type { CompanyInfo } from '@/lib/company-context';

/** Default research message pre-filled for a company (same text shown on first visit with no sessions). */
export function buildResearchAutofillPrompt(company: CompanyInfo): string {
  const lines: string[] = [
    `Run competitive intelligence for **${company.name}**.`,
    '',
    '### Context from my workspace (use with the full pipeline)',
  ];
  if (company.industry?.trim()) lines.push(`- Industry: ${company.industry.trim()}`);
  if (company.size?.trim()) lines.push(`- Size: ${company.size.trim()}`);
  if (company.description?.trim()) {
    lines.push('- Description:');
    lines.push(company.description.trim());
  }
  if (company.linkedinUrl?.trim()) lines.push(`- LinkedIn: ${company.linkedinUrl.trim()}`);
  if (company.instagramUrl?.trim()) lines.push(`- Instagram: ${company.instagramUrl.trim()}`);
  if (company.websiteUrl?.trim()) lines.push(`- Website: ${company.websiteUrl.trim()}`);
  lines.push(
    '',
    'Find direct and indirect competitors, key people posting on LinkedIn/Instagram, and summarize content strategies with concrete post examples. Call out gaps and opportunities for us.'
  );
  return lines.join('\n');
}
