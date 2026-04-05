/** Header clients send so the server can use a user-provided key (priority over MANUS_API_KEY). */
export const MANUS_API_KEY_HEADER = 'x-manus-api-key';

/**
 * Reads optional Manus API key from an incoming request (browser sends the decrypted key from local settings).
 */
export function getManusApiKeyFromRequest(req: Request): string | undefined {
  const h = req.headers.get(MANUS_API_KEY_HEADER) ?? req.headers.get('X-Manus-API-Key');
  const v = h?.trim();
  return v || undefined;
}

/**
 * Priority: explicit client key (from settings) → `MANUS_API_KEY` in environment.
 */
export function resolveManusApiKey(optionalClientKey?: string | null): string {
  const fromClient = optionalClientKey?.trim();
  if (fromClient) return fromClient;
  const fromEnv = process.env.MANUS_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  throw new Error(
    'Manus API key is not configured. Add it in Settings or set MANUS_API_KEY in .env.'
  );
}
