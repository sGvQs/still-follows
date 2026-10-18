import { isIndexable, normalizeSiteUrl } from './site-url.ts'

export interface SeoOptions {
  /** 未指定のときは、サイトURL依存の行（canonical / og:url / og:image 等）を除去する。 */
  siteUrl?: string
}

const ROBOTS_PLACEHOLDER = '<!--__ROBOTS__-->'
const NOINDEX_TAG = '<meta name="robots" content="noindex" />'

/**
 * index.html の SEO プレースホルダを解決する。
 * - siteUrl あり: `__SITE_URL__` を正規化URLに置換。isIndexable が false なら noindex を出す。
 * - siteUrl なし: `__SITE_URL__` を含む行を丸ごと除去（壊れた絶対URLを出さない）。noindex は出さない。
 */
export function applySeoToHtml(html: string, { siteUrl }: SeoOptions = {}): string {
  let out: string
  let robots = ''
  if (siteUrl) {
    const normalized = normalizeSiteUrl(siteUrl)
    out = html.split('__SITE_URL__').join(normalized)
    if (!isIndexable(normalized)) robots = NOINDEX_TAG
  } else {
    out = html.replace(/^[^\n]*__SITE_URL__[^\n]*\n?/gm, '')
  }
  return out.split(ROBOTS_PLACEHOLDER).join(robots)
}
