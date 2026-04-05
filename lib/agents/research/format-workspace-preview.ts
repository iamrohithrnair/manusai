import type { companies } from '@/lib/db/schema';

type CompanyRow = typeof companies.$inferSelect;

/**
 * Human-readable block shown in the research chat so users can verify
 * what workspace data (including every URL) is included in the Manus prompt.
 */
export function formatResearchWorkspacePreview(
  company: CompanyRow,
  userInstructions: string,
  options?: { maxUserInstructionChars?: number }
): string {
  const maxU = options?.maxUserInstructionChars ?? 6000;
  const lines: string[] = [
    '#### Sent to Manus — workspace context',
    '',
    '**Company:** ' + company.name,
  ];

  if (company.industry?.trim()) lines.push('**Industry:** ' + company.industry.trim());
  if (company.size?.trim()) lines.push('**Size:** ' + company.size.trim());
  if (company.followerCount != null && company.followerCount > 0) {
    lines.push('**Follower count (hint):** ' + String(company.followerCount));
  }
  if (company.description?.trim()) {
    lines.push('');
    lines.push('**Description:**');
    lines.push(company.description.trim());
  }

  lines.push('');
  lines.push('**URLs (each line is included in the research prompt):**');
  lines.push(
    '- **LinkedIn:** ' + (company.linkedinUrl?.trim() || '_(not set)_')
  );
  lines.push(
    '- **Instagram:** ' + (company.instagramUrl?.trim() || '_(not set)_')
  );
  lines.push(
    '- **Website:** ' + (company.websiteUrl?.trim() || '_(not set)_')
  );

  let extra: { platform: string; url: string }[] = [];
  try {
    extra = JSON.parse(company.socialLinksJson || '[]') as { platform: string; url: string }[];
  } catch {
    extra = [];
  }
  if (extra.length > 0) {
    lines.push('');
    lines.push('**Additional links (saved under “extra” social links):**');
    for (const s of extra) {
      if (s?.url?.trim()) {
        lines.push(`- **${(s.platform || 'link').trim()}:** ${s.url.trim()}`);
      }
    }
  }

  const trimmedUser = userInstructions.trim();
  if (trimmedUser) {
    lines.push('');
    lines.push('**Your instructions (full chat, all user messages):**');
    lines.push('');
    if (trimmedUser.length <= maxU) {
      lines.push(trimmedUser);
    } else {
      lines.push(trimmedUser.slice(0, maxU));
      lines.push('');
      lines.push(
        `_(Preview truncated at ${maxU} characters — the full text is included in the Manus task.)_`
      );
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}
