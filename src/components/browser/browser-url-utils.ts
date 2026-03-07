export const DEFAULT_PORTLESS_PROXY_PORT = 1355;

export function normalizeLocalDevHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "127.0.0.1" || normalized === "0.0.0.0") {
    return "localhost";
  }
  return normalized;
}

export function isLocalDevHostname(hostname: string): boolean {
  const normalized = normalizeLocalDevHostname(hostname);
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

export function isLocalDevUrl(url: string): boolean {
  try {
    return isLocalDevHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function localDevServerMessage(url: string): string {
  try {
    return `Couldn't reach ${new URL(url).host}. Start your dev server in the terminal (for example, pnpm dev), then reload.`;
  } catch {
    return "Couldn't reach this local URL. Start your dev server in the terminal, then reload.";
  }
}

export function buildBrowserSurfaceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "0.0.0.0") {
      parsed.hostname = "localhost";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function localDevOriginKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!isLocalDevHostname(parsed.hostname)) return null;
    const normalizedHostname = normalizeLocalDevHostname(parsed.hostname);
    const port = parsed.port || String(DEFAULT_PORTLESS_PROXY_PORT);
    return `${normalizedHostname}:${port}`;
  } catch {
    return null;
  }
}

export function isCrossProjectLocalDevUrl(
  candidateUrl: string,
  configuredRuntimeUrl: string
): boolean {
  const candidateOrigin = localDevOriginKey(candidateUrl);
  if (!candidateOrigin) return false;
  const configuredOrigin = localDevOriginKey(configuredRuntimeUrl);
  if (!configuredOrigin) return false;
  return candidateOrigin !== configuredOrigin;
}

export function normalizeNavigableUrl(rawAddress: string): string | null {
  const trimmed = rawAddress.trim();
  if (!trimmed) return null;
  try {
    const normalizedAddress =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `http://${trimmed}`;
    return new URL(normalizedAddress).toString();
  } catch {
    return null;
  }
}
