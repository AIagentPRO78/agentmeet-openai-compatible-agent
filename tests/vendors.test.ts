import { describe, it, expect } from 'vitest';
import { VENDOR_PRESETS, VENDOR_NAMES, type VendorName } from '../src/vendors.js';

describe('VENDOR_PRESETS', () => {
  it('has the expected set of vendors', () => {
    const expected: readonly VendorName[] = [
      'openai',
      'qwen',
      'deepseek',
      'mistral',
      'grok',
      'perplexity',
      'groq',
      'ollama',
      'custom',
    ];
    expect(VENDOR_NAMES.sort()).toEqual([...expected].sort());
  });

  it('every preset has the four required fields', () => {
    for (const name of VENDOR_NAMES) {
      const preset = VENDOR_PRESETS[name];
      // Every preset must declare these keys (custom has empty strings for the
      // first two, but the keys must still exist).
      expect(preset).toHaveProperty('baseURL');
      expect(preset).toHaveProperty('defaultModel');
      expect(preset).toHaveProperty('envKeyName');
      expect(preset).toHaveProperty('docs');
      expect(typeof preset.baseURL).toBe('string');
      expect(typeof preset.defaultModel).toBe('string');
      expect(typeof preset.envKeyName).toBe('string');
      expect(typeof preset.docs).toBe('string');
      // envKeyName and docs are always non-empty.
      expect(preset.envKeyName.length).toBeGreaterThan(0);
      expect(preset.docs.length).toBeGreaterThan(0);
    }
  });

  it('custom preset has empty baseURL and defaultModel', () => {
    expect(VENDOR_PRESETS.custom.baseURL).toBe('');
    expect(VENDOR_PRESETS.custom.defaultModel).toBe('');
  });

  it('non-custom presets have non-empty baseURL and defaultModel', () => {
    for (const name of VENDOR_NAMES) {
      if (name === 'custom') continue;
      const preset = VENDOR_PRESETS[name];
      expect(preset.baseURL.length, `${name} baseURL`).toBeGreaterThan(0);
      expect(preset.defaultModel.length, `${name} defaultModel`).toBeGreaterThan(0);
    }
  });

  it('no duplicate baseURLs except custom (which is empty)', () => {
    const seen = new Map<string, VendorName>();
    for (const name of VENDOR_NAMES) {
      const url = VENDOR_PRESETS[name].baseURL;
      if (name === 'custom') continue;
      if (seen.has(url)) {
        throw new Error(
          `Duplicate baseURL ${url} between ${seen.get(url) ?? '?'} and ${name}`,
        );
      }
      seen.set(url, name);
    }
    expect(seen.size).toBe(VENDOR_NAMES.length - 1);
  });

  it('non-custom baseURLs parse as valid URLs', () => {
    for (const name of VENDOR_NAMES) {
      if (name === 'custom') continue;
      const url = VENDOR_PRESETS[name].baseURL;
      expect(() => new URL(url), `${name} baseURL`).not.toThrow();
    }
  });

  it('docs URLs are absolute (start with http) except custom', () => {
    for (const name of VENDOR_NAMES) {
      if (name === 'custom') continue;
      const docs = VENDOR_PRESETS[name].docs;
      expect(docs.startsWith('http'), `${name} docs`).toBe(true);
    }
  });
});
