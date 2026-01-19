/**
 * host からプロトコルを除去してホスト名のみを返す
 *
 * @example
 * normalizeHost('https://example.databricks.com') // => 'example.databricks.com'
 * normalizeHost('http://example.databricks.com')  // => 'example.databricks.com'
 * normalizeHost('example.databricks.com')         // => 'example.databricks.com'
 */
export function normalizeHost(host: string): string {
  if (host.startsWith('https://')) {
    return host.slice(8);
  }
  if (host.startsWith('http://')) {
    return host.slice(7);
  }
  return host;
}
