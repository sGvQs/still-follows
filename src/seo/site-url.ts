/** http(s) の絶対URLとして妥当か検証する。不正なら Error を投げる。 */
export function validateSiteUrl(raw: string): URL {
  if (typeof raw !== 'string' || raw === '' || raw !== raw.trim() || /\s/.test(raw)) {
    throw new Error(`Invalid SITE_URL: ${JSON.stringify(raw)}`)
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Invalid SITE_URL: ${JSON.stringify(raw)}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`SITE_URL must be http(s): ${JSON.stringify(raw)}`)
  }
  return url
}

/** 絶対URLを末尾 `/` 付きに正規化する（query/hash は除去）。 */
export function normalizeSiteUrl(raw: string): string {
  const url = validateSiteUrl(raw)
  url.search = ''
  url.hash = ''
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}

/** Vite の base に使うパス（末尾 `/` 付き）。 */
export function deriveBase(siteUrl: string): string {
  return new URL(normalizeSiteUrl(siteUrl)).pathname
}

/** github.io / localhost は検索エンジンに載せない。 */
export function isIndexable(siteUrl: string): boolean {
  const host = new URL(siteUrl).hostname.toLowerCase()
  return !(host === 'localhost' || host.endsWith('.github.io'))
}
