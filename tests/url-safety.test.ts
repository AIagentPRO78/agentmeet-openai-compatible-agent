import { describe, it, expect } from 'vitest';
import { isLoopbackHost, serviceUrlProblem } from '../src/url-safety.js';
import { parseEnv } from '../src/config.js';
import { VENDOR_PRESETS, VENDOR_NAMES } from '../src/vendors.js';

describe('serviceUrlProblem', () => {
  it.each([
    'https://api.openai.com/v1',
    'https://your-gateway.example.com/v1',
    'https://gateway.example.com:8443/openai/v1/',
    'https://localhost/v1',
    'http://localhost:11434/v1',
    'http://LOCALHOST:11434/v1',
    'http://127.0.0.1:11434/v1',
    'http://127.0.0.1/v1',
    'http://[::1]:11434/v1',
  ])('accepts %s', (url) => {
    expect(serviceUrlProblem(url)).toBeNull();
  });

  it.each([
    // plain http to anything that is not this machine
    'http://api.openai.com/v1',
    'http://llm-gw.internal/v1',
    'http://192.168.1.20:11434/v1',
    'http://10.0.0.5/v1',
    'http://0.0.0.0:11434/v1',
    'http://host.docker.internal:11434/v1',
    // hosts that only look like loopback
    'http://localhost.evil.test/v1',
    'http://127.0.0.1.evil.test/v1',
    'http://localhost.:11434/v1',
    'http://127.0.0.2/v1',
    'http://[::ffff:127.0.0.1]/v1',
    // other schemes
    'ftp://example.com/v1',
    'ws://localhost:11434/v1',
    'file:///etc/passwd',
    'javascript:alert(1)',
  ])('rejects %s (not https, not loopback)', (url) => {
    expect(serviceUrlProblem(url)).toMatch(/must use https/);
  });

  it.each([
    'https://user:pass@gateway.example.com/v1',
    'https://user@gateway.example.com/v1',
    'https://:pass@gateway.example.com/v1',
    'http://user:pass@localhost:11434/v1',
    // "localhost" here is a username; the real host is evil.test
    'http://localhost@evil.test/v1',
    'https://api.openai.com@evil.test/v1',
  ])('rejects embedded credentials in %s', (url) => {
    expect(serviceUrlProblem(url)).toMatch(/must not contain credentials/);
  });

  it.each(['', 'not a url', 'api.openai.com/v1', '//api.openai.com/v1', 'https://'])(
    'rejects %j (not an absolute URL)',
    (url) => {
      expect(serviceUrlProblem(url)).toMatch(/not a valid absolute URL/);
    },
  );

  it('never repeats the URL (or a secret inside it) in the reason', () => {
    for (const url of [
      'https://user:s3cr3t-value@gateway.example.com/v1',
      'http://gateway.example.com/v1?key=s3cr3t-value',
      's3cr3t-value',
    ]) {
      const problem = serviceUrlProblem(url) ?? '';
      expect(problem.length).toBeGreaterThan(0);
      expect(problem).not.toContain('s3cr3t-value');
      expect(problem).not.toContain('gateway.example.com');
    }
  });

  it('every built-in vendor preset passes', () => {
    for (const name of VENDOR_NAMES) {
      if (name === 'custom') continue;
      expect(serviceUrlProblem(VENDOR_PRESETS[name].baseURL), name).toBeNull();
    }
  });
});

describe('isLoopbackHost', () => {
  it('matches exactly localhost, 127.0.0.1 and [::1]', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
    expect(isLoopbackHost('localhost.example.com')).toBe(false);
    expect(isLoopbackHost('example.com')).toBe(false);
    expect(isLoopbackHost('')).toBe(false);
  });
});

describe('LLM_BASE_URL validation at startup', () => {
  const base = { LLM_API_KEY: 'test-key', AGENTMEET_BEARER_TOKEN: 'test-token' };

  it('is optional: unset or blank falls back to the vendor preset', () => {
    expect(parseEnv(base).LLM_BASE_URL).toBe('');
    expect(parseEnv({ ...base, LLM_BASE_URL: '' }).LLM_BASE_URL).toBe('');
  });

  it.each([
    'https://your-gateway.example.com/v1',
    'http://localhost:11434/v1',
    'http://127.0.0.1:8080/v1',
    'http://[::1]:8080/v1',
  ])('accepts %s', (url) => {
    expect(parseEnv({ ...base, LLM_BASE_URL: url }).LLM_BASE_URL).toBe(url);
    expect(
      parseEnv({ ...base, LLM_VENDOR: 'custom', LLM_MODEL: 'm', LLM_BASE_URL: url }).LLM_BASE_URL,
    ).toBe(url);
  });

  it.each([
    ['http://llm-gw.internal/v1', 'LLM_BASE_URL must use https://'],
    ['http://192.168.1.20:11434/v1', 'LLM_BASE_URL must use https://'],
    ['http://localhost@evil.test/v1', 'LLM_BASE_URL must not contain credentials'],
    ['https://user:pass@gateway.example.com/v1', 'LLM_BASE_URL must not contain credentials'],
    ['gateway.example.com/v1', 'LLM_BASE_URL is not a valid absolute URL'],
  ])('refuses to start with LLM_BASE_URL=%s', (url, message) => {
    expect(() => parseEnv({ ...base, LLM_BASE_URL: url })).toThrow(message);
    expect(() =>
      parseEnv({ ...base, LLM_VENDOR: 'custom', LLM_MODEL: 'm', LLM_BASE_URL: url }),
    ).toThrow(message);
  });

  it('does not put the rejected URL into the error', () => {
    let message = '';
    try {
      parseEnv({ ...base, LLM_BASE_URL: 'https://user:s3cr3t-value@gateway.example.com/v1' });
    } catch (err: unknown) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain('LLM_BASE_URL must not contain credentials');
    expect(message).not.toContain('s3cr3t-value');
  });

  it('still requires LLM_BASE_URL when LLM_VENDOR=custom', () => {
    expect(() => parseEnv({ ...base, LLM_VENDOR: 'custom', LLM_MODEL: 'm' })).toThrow(
      'LLM_BASE_URL is required when LLM_VENDOR=custom',
    );
  });
});
