import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { AnthropicLlmProvider, TemplateLlmProvider, composeReplyWithFallback } from '../../src/modules/ai/llmProvider.js';

const originalFetch = global.fetch;

/**
 * A single unconditional restore at the file level — not scoped per
 * `describe` block and not relying on a test's own happy-path cleanup code
 * running — so a mocked `global.fetch` can never leak into another test
 * file's suite (which manifests as bizarre, hard-to-trace failures like
 * Node's HTTP client getting "Parse Error: Expected HTTP/..." from a mock
 * response shape) if an assertion throws before a test's own cleanup line.
 */
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
  jest.dontMock('../../src/config/env.js');
  jest.resetModules();
});

function mockFetch(): jest.MockedFunction<typeof fetch> {
  const mock = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
  global.fetch = mock;
  return mock;
}

describe('AnthropicLlmProvider', () => {
  it('returns the text content from a successful response', async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Here are some options.' }] })
    } as unknown as Response);

    const provider = new AnthropicLlmProvider('fake-key', 'claude-haiku-4-5-20251001');
    const reply = await provider.composeReply({ purpose: 'discovery', userMessage: 'hi', context: {} });
    expect(reply).toBe('Here are some options.');
  });

  it('throws when the API responds with a non-OK status, so the caller can fall back', async () => {
    mockFetch().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as unknown as Response);

    const provider = new AnthropicLlmProvider('fake-key', 'claude-haiku-4-5-20251001');
    await expect(provider.composeReply({ purpose: 'discovery', userMessage: 'hi', context: {} })).rejects.toThrow();
  });

  it('aborts and throws when the request exceeds the timeout, so a slow provider never hangs the response', async () => {
    mockFetch().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as { signal: AbortSignal }).signal;
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    const provider = new AnthropicLlmProvider('fake-key', 'claude-haiku-4-5-20251001');
    const promise = provider.composeReply({ purpose: 'discovery', userMessage: 'hi', context: {} });
    await expect(promise).rejects.toThrow();
  }, 10_000);
});

describe('composeReplyWithFallback', () => {
  it('returns the context fallbackReply when the provider is the template (no real LLM configured)', async () => {
    const reply = await composeReplyWithFallback({
      purpose: 'discovery',
      userMessage: 'hi',
      context: { fallbackReply: 'deterministic answer' }
    });
    expect(reply).toBe('deterministic answer');
  });

  it("TemplateLlmProvider itself never calls the network — it is a pure data echo", async () => {
    const provider = new TemplateLlmProvider();
    const reply = await provider.composeReply({ purpose: 'support', userMessage: 'hi', context: { fallbackReply: 'fixed reply' } });
    expect(reply).toBe('fixed reply');
  });

  it('falls back to the deterministic reply when a configured real provider throws, instead of propagating the error', async () => {
    jest.resetModules();
    jest.doMock('../../src/config/env.js', () => ({
      getEnv: () => ({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'fake-key', AI_MODEL: '' })
    }));
    const { composeReplyWithFallback: composeWithMockedEnv } = await import('../../src/modules/ai/llmProvider.js');
    mockFetch().mockRejectedValue(new Error('network down'));

    const reply = await composeWithMockedEnv({
      purpose: 'discovery',
      userMessage: 'hi',
      context: { fallbackReply: 'deterministic answer' }
    });

    expect(reply).toBe('deterministic answer');
  });
});
