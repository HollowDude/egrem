import { describe, it, expect } from 'vitest';
import { sanitizeRedirect } from '../redirect';

describe('sanitizeRedirect', () => {
  it('should return "/" when null or undefined', () => {
    expect(sanitizeRedirect(null)).toBe('/');
    expect(sanitizeRedirect(undefined)).toBe('/');
  });

  it('should return "/" when empty string', () => {
    expect(sanitizeRedirect('')).toBe('/');
  });

  it('should allow internal paths', () => {
    expect(sanitizeRedirect('/catalogo/musica')).toBe('/catalogo/musica');
  });

  it('should preserve query strings (filters)', () => {
    expect(sanitizeRedirect('/catalogo/musica?decada=1960s&disco=2')).toBe('/catalogo/musica?decada=1960s&disco=2');
  });

  it('should reject protocol-relative URLs (open redirect)', () => {
    expect(sanitizeRedirect('//evil.com')).toBe('/');
    expect(sanitizeRedirect('/\\evil.com')).toBe('/');
  });

  it('should reject external URLs', () => {
    expect(sanitizeRedirect('https://evil.com')).toBe('/');
    expect(sanitizeRedirect('javascript:alert(1)')).toBe('/');
  });
});
