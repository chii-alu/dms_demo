// Fixed-window limiter, kept in memory for this server instance. Good enough for dev and
// a single instance. Before launch, move this to shared storage (Upstash or Vercel KV) so the
// limit holds across instances (SPEC §8).
const WINDOW_MS = 60_000;
const hits = new Map<string, { start: number; count: number }>();

export function allowRequest(key: string, limit: number, now = Date.now()) {
  const entry = hits.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) {
    hits.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
