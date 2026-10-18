import { describe, expect, it } from 'vitest'
import { deriveBase, isIndexable, normalizeSiteUrl, validateSiteUrl } from './site-url'

describe('normalizeSiteUrl', () => {
  it('adds trailing slash', () => {
    expect(normalizeSiteUrl('https://example.com')).toBe('https://example.com/')
    expect(normalizeSiteUrl('https://example.com/sub')).toBe('https://example.com/sub/')
  })
  it('keeps existing trailing slash', () => {
    expect(normalizeSiteUrl('https://example.com/')).toBe('https://example.com/')
    expect(normalizeSiteUrl('https://example.com/sub/')).toBe('https://example.com/sub/')
  })
  it('drops query and hash', () => {
    expect(normalizeSiteUrl('https://example.com/a?x=1#h')).toBe('https://example.com/a/')
  })
})

describe('validateSiteUrl', () => {
  it('accepts http and https', () => {
    expect(validateSiteUrl('https://example.com/').hostname).toBe('example.com')
    expect(validateSiteUrl('http://example.com').protocol).toBe('http:')
  })
  it.each(['', ' ', ' https://example.com/', 'https://exa mple.com/', 'example.com', '/sub/', 'ftp://example.com/', 'javascript:alert(1)', 'https://'])(
    'rejects %j',
    (raw) => {
      expect(() => validateSiteUrl(raw)).toThrow()
    },
  )
})

describe('deriveBase', () => {
  it('returns root for root url', () => {
    expect(deriveBase('https://example.com')).toBe('/')
    expect(deriveBase('https://example.com/')).toBe('/')
  })
  it('returns sub-path with trailing slash', () => {
    expect(deriveBase('https://example.com/sub')).toBe('/sub/')
    expect(deriveBase('https://example.com/sub/')).toBe('/sub/')
    expect(deriveBase('https://u.github.io/repo/')).toBe('/repo/')
  })
})

describe('isIndexable', () => {
  it('is false for github.io in any case', () => {
    expect(isIndexable('https://user.github.io/repo/')).toBe(false)
    expect(isIndexable('https://User.GitHub.IO/repo/')).toBe(false)
  })
  it('is false for localhost', () => {
    expect(isIndexable('http://localhost:3000/')).toBe(false)
    expect(isIndexable('http://LOCALHOST/')).toBe(false)
  })
  it('is true otherwise', () => {
    expect(isIndexable('https://example.com/')).toBe(true)
    expect(isIndexable('https://github.io.example.com/')).toBe(true)
    expect(isIndexable('https://notgithub.io/')).toBe(true)
  })
})
