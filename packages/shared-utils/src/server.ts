/**
 * Turns what someone types for the server address into the API's base URL, or null
 * if it cannot be one. "192.168.1.109" becomes "http://192.168.1.109:8080": a bare
 * address is almost always the API on a computer in the same network, and the API
 * listens on 8080 there. A hosted API is reached over https on the usual port.
 * Parsed by hand: React Native's URL class is incomplete.
 */
export function normalizeServerUrl(input: string, defaultPort = 8080): string | null {
  const text = input.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  const match =
    /^(https?):\/\/([a-z0-9]([a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?(\/[^?#]*)?(?:[?#].*)?$/i.exec(
      withScheme
    );
  if (!match) return null;
  const scheme = (match[1] as string).toLowerCase();
  const host = (match[2] as string).toLowerCase();
  const port = match[4];
  if (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) return null;
  const path = (match[5] ?? '').replace(/\/+$/, '');
  const hostPort =
    port !== undefined ? `${host}:${port}` : scheme === 'http' ? `${host}:${defaultPort}` : host;
  return `${scheme}://${hostPort}${path}`;
}
