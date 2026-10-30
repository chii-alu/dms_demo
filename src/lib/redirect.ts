// Only allow same-site relative paths as post-login destinations (blocks open redirects).
export function safeNext(next: string, fallback = "/manage") {
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
