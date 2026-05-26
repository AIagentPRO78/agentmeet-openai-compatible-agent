import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildTranscript,
  collapseTurns,
  formatReply,
  LLMResponder,
} from '../src/llm/responder.js';
import type { MessageRow } from '../src/agentmeet/types.js';
import { VENDOR_PRESETS } from '../src/vendors.js';

function row(seq: number, sender: string | null, text: string, kind = 'chat'): MessageRow {
  return {
    id: `m_${seq}`,
    seq,
    hash: 'h',
    kind,
    body: { text },
    senderAgentId: sender,
    senderUserId: null,
    createdAt: new Date(seq * 1000).toISOString(),
  };
}

describe('buildTranscript', () => {
  it('routes self messages to assistant and others to user', () => {
    const history = [
      row(1, 'agent_alice', 'hello there'),
      row(2, 'agent_me', 'hi back'),
      row(3, 'agent_alice', '@claude what do you think?'),
    ];
    const turns = buildTranscript({ history, selfAgentId: 'agent_me' });
    expect(turns).toHaveLength(3);
    expect(turns[0]?.role).toBe('user');
    expect(turns[1]?.role).toBe('assistant');
    expect(turns[1]?.content).toBe('hi back');
    expect(turns[2]?.role).toBe('user');
    expect(turns[2]?.content).toContain('@claude what do you think?');
  });

  it('drops non-chat kinds', () => {
    const history = [
      row(1, 'agent_alice', 'first'),
      row(2, 'agent_alice', 'task body', 'task'),
      row(3, 'agent_bob', 'second'),
    ];
    const turns = buildTranscript({ history, selfAgentId: null });
    expect(turns).toHaveLength(2);
    expect(turns.map((t) => t.content)).not.toContain('task body');
  });

  it('respects windowSize', () => {
    const history = Array.from({ length: 50 }, (_, i) =>
      row(i + 1, 'agent_other', `msg-${i}`),
    );
    const turns = buildTranscript({ history, selfAgentId: null, windowSize: 5 });
    expect(turns).toHaveLength(5);
    expect(turns[0]?.content).toContain('msg-45');
  });

  it('drops malformed bodies', () => {
    const malformed: MessageRow = {
      id: 'm_x',
      seq: 9,
      hash: 'h',
      kind: 'chat',
      body: { not_text: 'oops' },
      senderAgentId: 'agent_alice',
      senderUserId: null,
      createdAt: new Date().toISOString(),
    };
    const turns = buildTranscript({ history: [malformed], selfAgentId: null });
    expect(turns).toHaveLength(0);
  });
});

describe('collapseTurns', () => {
  it('merges consecutive same-role turns', () => {
    const turns = [
      { role: 'user' as const, author: 'a', content: 'one' },
      { role: 'user' as const, author: 'a', content: 'two' },
      { role: 'assistant' as const, author: 'me', content: 'hi' },
    ];
    const out = collapseTurns(turns);
    expect(out).toHaveLength(2);
    expect(out[0]?.content).toBe('one\ntwo');
  });

  it('drops leading assistant turns', () => {
    const turns = [
      { role: 'assistant' as const, author: 'me', content: 'hi' },
      { role: 'user' as const, author: 'a', content: 'hey' },
    ];
    const out = collapseTurns(turns);
    expect(out).toHaveLength(1);
    expect(out[0]?.role).toBe('user');
  });
});

describe('formatReply', () => {
  it('returns trimmed text', () => {
    expect(formatReply({ raw: '  hello  ' })).toBe('hello');
  });

  it('truncates over the cap', () => {
    const raw = 'x'.repeat(5000);
    const out = formatReply({ raw, maxLength: 10 });
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out.endsWith('…')).toBe(true);
  });

  it('falls back when empty', () => {
    expect(formatReply({ raw: '   ' })).toBe('(no reply)');
  });
});

describe('LLMResponder vendor switch', () => {
  // Intercept fetch so we can verify that the openai SDK is targeting the
  // resolved baseURL for the chosen vendor. No network access required.
  const originalFetch = globalThis.fetch;
  let capturedUrl: string | null = null;

  beforeEach(() => {
    capturedUrl = null;
    globalThis.fetch = vi.fn(async (input: unknown) => {
      capturedUrl = typeof input === 'string' ? input : (input as { url: string }).url;
      return new Response(
        JSON.stringify({
          id: 'cmpl_test',
          object: 'chat.completion',
          created: 0,
          model: 'test',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'pong' },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('targets the openai preset baseURL when vendor=openai', async () => {
    const preset = VENDOR_PRESETS.openai;
    const responder = new LLMResponder({
      apiKey: 'test-key',
      model: preset.defaultModel,
      baseURL: preset.baseURL,
      persona: 'You are a test bot.',
      vendor: 'openai',
    });
    const reply = await responder.respond([
      { role: 'user', author: 'a', content: 'ping' },
    ]);
    expect(reply).toBe('pong');
    expect(capturedUrl).not.toBeNull();
    expect(capturedUrl ?? '').toContain('api.openai.com');
  });

  it('targets the qwen preset baseURL when vendor=qwen', async () => {
    const preset = VENDOR_PRESETS.qwen;
    const responder = new LLMResponder({
      apiKey: 'test-key',
      model: preset.defaultModel,
      baseURL: preset.baseURL,
      persona: 'You are a test bot.',
      vendor: 'qwen',
    });
    const reply = await responder.respond([
      { role: 'user', author: 'a', content: 'ping' },
    ]);
    expect(reply).toBe('pong');
    expect(capturedUrl).not.toBeNull();
    expect(capturedUrl ?? '').toContain('dashscope.aliyuncs.com');
  });

  it('returns fallback when there is no user context', async () => {
    const responder = new LLMResponder({
      apiKey: 'test-key',
      model: 'gpt-4o',
      baseURL: VENDOR_PRESETS.openai.baseURL,
      persona: 'You are a test bot.',
      vendor: 'openai',
    });
    const reply = await responder.respond([]);
    expect(reply).toBe('(no context to respond to)');
    // fetch should not have been called.
    expect(capturedUrl).toBeNull();
  });
});
