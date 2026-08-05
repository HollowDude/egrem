import { describe, it, expect } from 'vitest';
import { sanitizeRedirect, isAuthPath } from '../redirect';

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

  it('should not redirect back to auth pages', () => {
    expect(sanitizeRedirect('/login')).toBe('/');
    expect(sanitizeRedirect('/registro')).toBe('/');
    expect(sanitizeRedirect('/recuperar-contrasena')).toBe('/');
    expect(sanitizeRedirect('/reset-password?uid=1&timestamp=2&hash=abc')).toBe('/');
    expect(sanitizeRedirect('/login?redirect=/mi-cuenta')).toBe('/');
  });
});

describe('isAuthPath', () => {
  it('should flag auth paths regardless of query strings', () => {
    expect(isAuthPath('/reset-password?uid=1&timestamp=2&hash=abc')).toBe(true);
    expect(isAuthPath('/login')).toBe(true);
    expect(isAuthPath('/registro?x=1')).toBe(true);
    expect(isAuthPath('/recuperar-contrasena')).toBe(true);
  });

  it('should not flag regular pages', () => {
    expect(isAuthPath('/mi-cuenta')).toBe(false);
    expect(isAuthPath('/catalogo/videos')).toBe(false);
    expect(isAuthPath(null)).toBe(false);
  });
});
