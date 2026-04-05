/**
 * Rich company context for Manus — everything the user saved in Graphluence
 * must appear here so the model can ground research on it.
 */
export type ResearchCompanyProfile = {
  name: string;
  industry?: string | null;
  size?: string | null;
  description?: string | null;
  followerCount?: number | null;
  socialLinks: { platform: string; url: string }[];
};

export function buildResearchPrompt(
  profile: ResearchCompanyProfile,
  existingNodes: { name: string; nodeType: string; id: string }[] | undefined,
  userInstructions: string
): string {
  const linksText =
    profile.socialLinks.length > 0
      ? profile.socialLinks.map((l) => `- ${l.platform}: ${l.url}`).join('\n')
      : '- (none provided — discover official pages via search)';

  const workspaceLines: string[] = [];
  workspaceLines.push(`- **Legal / display name:** ${profile.name}`);
  if (profile.industry?.trim()) workspaceLines.push(`- **Industry (workspace):** ${profile.industry.trim()}`);
  if (profile.size?.trim()) workspaceLines.push(`- **Company size (workspace):** ${profile.size.trim()}`);
  if (profile.followerCount != null && profile.followerCount > 0) {
    workspaceLines.push(`- **Follower count hint (workspace, often LinkedIn):** ${profile.followerCount}`);
  }
  if (profile.description?.trim()) {
    workspaceLines.push(`- **Description (workspace):**\n${profile.description.trim()}`);
  }

  const workspaceBlock = workspaceLines.join('\n');

  const existingText = existingNodes?.length
    ? `\n\n## Already in the knowledge graph (merge & update; do not duplicate entities)\n${existingNodes.map((n) => `- [${n.nodeType}] ${n.name} (id: ${n.id})`).join('\n')}`
    : '';

  const userBlock =
    userInstructions.trim().length > 0
      ? userInstructions.trim()
      : 'Run the full competitive intelligence pipeline below. Use the workspace profile and URLs as the starting truth; verify everything on the live web and enrich with missing data.';

  return `You are a senior competitive intelligence researcher for Graphluence, a marketing consultancy product.

## Your mission
Produce a **complete, actionable** competitive landscape for the target company: positioning, competitors (direct and indirect), key people, content patterns, and strategic gaps. Marketing consultants will rely on this output — be thorough and cite concrete observations when possible.

## Workspace company profile (user-provided in Graphluence — treat as ground truth to verify & extend)
This block is authoritative **starting context**. Reconcile it with live pages; if the live web disagrees, note both and prefer fresh data for numbers (followers, headcount) while preserving nuance from the workspace.

${workspaceBlock}

### Social & web URLs (deduplicated; visit each that is valid)
${linksText}
${existingText}

## Instructions from the user (research chat — follow closely)
The user may have written multiple messages; **every requirement below must be satisfied** in addition to the pipeline steps. If they name specific competitors, regions, depth, or exclusions, obey them.

${userBlock}

## Research pipeline — execute in order (do not skip steps)

### Step 1 — Our company (deep pass)
- Open every workspace URL above; add official pages you discover if missing.
- Extract and reconcile: industry, size, positioning, products/services, geography, **audience**, tone, and recent content themes.
- Quantify where possible: follower counts, posting cadence, engagement proxies.
- Summarize **what makes their brand distinct** vs generic industry noise.

### Step 2 — Competitor landscape (5–8 entities, not just 5–6 if the user asks for more)
- Identify **direct** competitors (same offer + same buyer) and **meaningful indirect** alternatives (different category, same budget or workflow).
- Include at least one **adjacent** or **fast-growing** challenger if the user’s industry suggests it.
- For each competitor: official site + LinkedIn + Instagram (or note if absent); brief why they compete.

### Step 3 — People & voices
- For **our company** and **each competitor**: 3–7 key people who shape marketing or thought leadership (executives, content leads, founders).
- Prefer people with **recent public posts**; include title, LinkedIn, Instagram when available.

### Step 4 — Content evidence
- Sample **recent** posts per company and per notable person (LinkedIn and Instagram where relevant).
- For standout posts capture: copy or excerpt, format, platform, and **why it performed** (hook, topic, social proof, creative).
- If the user asked for specific topics (in the chat instructions), **over-index** on those themes.

### Step 5 — Strategy synthesis
- Per competitor: themes, format mix, platform split, posting rhythm, engagement level vs peers, **gaps and opportunities** for our company.
- Close with **actionable recommendations** our customer could run next (content angles, channels, experiments).

## Output discipline
- Prefer **real data** from page visits; label estimates clearly.
- Ensure the JSON below is **complete** and **valid** (no trailing commas, no comments inside JSON).

## OUTPUT FORMAT

Return your findings as structured JSON inside a \`\`\`json code block with this exact structure:

\`\`\`json
{
  "company": {
    "name": "...",
    "industry": "...",
    "size": "...",
    "description": "...",
    "linkedinFollowers": 0,
    "instagramFollowers": 0,
    "contentSummary": "..."
  },
  "competitors": [
    {
      "name": "...",
      "industry": "...",
      "linkedinUrl": "...",
      "instagramUrl": "...",
      "size": "...",
      "description": "...",
      "employees": [
        { "name": "...", "title": "...", "linkedinUrl": "...", "instagramUrl": "..." }
      ],
      "topPosts": [
        {
          "authorName": "...",
          "text": "...",
          "platform": "linkedin|instagram",
          "format": "text|image|carousel|video|reel",
          "likes": 0, "comments": 0, "shares": 0,
          "whyItWorked": "..."
        }
      ],
      "contentStrategy": {
        "themes": ["..."],
        "postingFrequency": "...",
        "platformBreakdown": { "linkedin": "60%", "instagram": "40%" },
        "formatMix": { "text": "30%", "carousel": "25%", "video": "20%", "reel": "15%", "image": "10%" },
        "avgEngagement": 0,
        "gaps": ["..."],
        "summary": "..."
      }
    }
  ]
}
\`\`\`

Be thorough. The consultant and downstream automation depend on accurate, complete competitive intelligence.`;
}
