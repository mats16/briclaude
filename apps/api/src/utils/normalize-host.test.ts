// apps/api/src/utils/normalize-host.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeHost } from './normalize-host.js';

describe('normalizeHost', () => {
  it('should remove https:// prefix', () => {
    expect(normalizeHost('https://example.databricks.com')).toBe('example.databricks.com');
  });

  it('should remove http:// prefix', () => {
    expect(normalizeHost('http://example.databricks.com')).toBe('example.databricks.com');
  });

  it('should return host as-is when no protocol prefix', () => {
    expect(normalizeHost('example.databricks.com')).toBe('example.databricks.com');
  });

  it('should handle host with port', () => {
    expect(normalizeHost('https://example.databricks.com:443')).toBe('example.databricks.com:443');
  });

  it('should handle host with path', () => {
    expect(normalizeHost('https://example.databricks.com/path')).toBe(
      'example.databricks.com/path'
    );
  });

  it('should handle empty string', () => {
    expect(normalizeHost('')).toBe('');
  });

  it('should not modify string that starts with http but is not a protocol', () => {
    expect(normalizeHost('httpbin.org')).toBe('httpbin.org');
  });
});
