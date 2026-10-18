import { describe, expect, it } from 'vitest'
import { applySeoToHtml } from './html'

describe('applySeoToHtml', () => {
  it('replaces every placeholder with normalized url', () => {
    const html = '<link rel="canonical" href="__SITE_URL__"><meta content="__SITE_URL__ogp.png">'
    expect(applySeoToHtml(html, { siteUrl: 'https://example.com/sub' })).toBe(
      '<link rel="canonical" href="https://example.com/sub/"><meta content="https://example.com/sub/ogp.png">',
    )
  })
  it('leaves html without placeholder unchanged', () => {
    expect(applySeoToHtml('<p>x</p>', { siteUrl: 'https://example.com/' })).toBe('<p>x</p>')
  })
  it('throws on invalid url', () => {
    expect(() => applySeoToHtml('__SITE_URL__', { siteUrl: 'nope' })).toThrow()
  })
})

describe('applySeoToHtml robots / unset', () => {
  const tpl = '<head>\n<!--__ROBOTS__-->\n<link rel="canonical" href="__SITE_URL__">\n<meta content="__SITE_URL__ogp.png">\n<title>t</title>\n</head>'
  it('emits noindex for github.io', () => {
    const out = applySeoToHtml(tpl, { siteUrl: 'https://Owner.github.io/repo' })
    expect(out).toContain('<meta name="robots" content="noindex" />')
    expect(out).toContain('href="https://owner.github.io/repo/"')
    expect(out).not.toContain('__')
  })
  it('emits noindex for localhost', () => {
    expect(applySeoToHtml(tpl, { siteUrl: 'http://localhost:3000/' })).toContain('noindex')
  })
  it('omits noindex for indexable hosts and removes placeholder', () => {
    const out = applySeoToHtml(tpl, { siteUrl: 'https://example.com/' })
    expect(out).not.toContain('noindex')
    expect(out).not.toContain('__ROBOTS__')
  })
  it('strips url-dependent lines when siteUrl is unset', () => {
    for (const opt of [{}, { siteUrl: undefined }, { siteUrl: '' }]) {
      const out = applySeoToHtml(tpl, opt)
      expect(out).toBe('<head>\n\n<title>t</title>\n</head>')
    }
  })
})
