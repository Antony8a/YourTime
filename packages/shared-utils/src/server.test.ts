import { describe, expect, it } from 'vitest';
import { normalizeServerUrl } from './server';

describe('normalizeServerUrl', () => {
  it('completes a bare address with http and the API port', () => {
    expect(normalizeServerUrl('192.168.1.109')).toBe('http://192.168.1.109:8080');
    expect(normalizeServerUrl('  mi-pc  ')).toBe('http://mi-pc:8080');
  });

  it('keeps a port that was typed', () => {
    expect(normalizeServerUrl('192.168.1.109:9000')).toBe('http://192.168.1.109:9000');
    expect(normalizeServerUrl('http://10.0.0.5:8080/')).toBe('http://10.0.0.5:8080');
  });

  it('leaves https on its usual port', () => {
    expect(normalizeServerUrl('https://yourtime-api.onrender.com')).toBe(
      'https://yourtime-api.onrender.com'
    );
    expect(normalizeServerUrl('HTTPS://Api.Example.com/')).toBe('https://api.example.com');
  });

  it('drops trailing slashes, queries and fragments but keeps a base path', () => {
    expect(normalizeServerUrl('http://host:8080///')).toBe('http://host:8080');
    expect(normalizeServerUrl('https://host/base/?x=1#y')).toBe('https://host/base');
  });

  it('rejects what cannot be a server', () => {
    for (const bad of [
      '',
      '   ',
      'ftp://host',
      'http://',
      'http://host:99999',
      'http://host:0',
      'ho st',
    ]) {
      expect(normalizeServerUrl(bad)).toBeNull();
    }
  });
});
