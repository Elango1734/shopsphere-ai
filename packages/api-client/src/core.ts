import type { ApiErrorDetail } from '@shopsphere/shared-types';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: ApiErrorDetail[],
    public readonly requestId: string | undefined
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** Thrown when the network itself fails (offline, timeout) — distinct from a server-returned error envelope. */
export class ApiNetworkError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = 'ApiNetworkError';
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Returns the current access token, or null/undefined when signed out. Never hardcode a token here. */
  getAccessToken?: () => string | null | undefined;
  /**
   * Extra headers merged into every request — e.g. a native client's own
   * `X-Guest-Token` (native apps do not reliably keep cookies across app
   * restarts the way a browser does, so the guest identifier travels as a
   * header instead — see apps/api's guestToken middleware).
   */
  getExtraHeaders?: () => Record<string, string> | undefined;
  /** Called with every response's headers — e.g. to persist a server-issued `X-Guest-Token`. */
  onResponseHeaders?: (headers: Headers) => void;
  /** Called once when a request comes back 401; the client never retries automatically — callers decide. */
  onUnauthorized?: () => void;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query) {
    // `.append` (not `.set`) — React Native's own built-in URLSearchParams
    // polyfill only implements append/toString/iteration and throws on
    // `.set()` ("not implemented"); each key is only ever added once here,
    // so append has identical results and also works in browsers.
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.append(key, String(value));
    }
  }
  return url.toString();
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

/**
 * The single place that knows about the `{success, data, meta, requestId}` /
 * `{success: false, error}` envelope (api-specification.md). Every domain
 * module in this package calls through here so the envelope is only parsed
 * once; callers of the client just get `data` back or an `ApiClientError`.
 */
export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  private async send(
    method: Method,
    path: string,
    body: unknown,
    options: RequestOptions & { idempotencyKey?: string }
  ): Promise<{ response: Response; json: { success: boolean; data?: unknown; meta?: unknown; error?: { code: string; message: string; details?: ApiErrorDetail[] }; requestId?: string } | null }> {
    const headers: Record<string, string> = { Accept: 'application/json', ...this.config.getExtraHeaders?.(), ...options.headers };
    const token = this.config.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 15000);
    const signal = options.signal ?? controller.signal;

    let response: Response;
    try {
      response = await fetch(buildUrl(this.config.baseUrl, path, options.query), {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal,
        credentials: 'include'
      });
    } catch (error) {
      throw new ApiNetworkError('Network request failed', error);
    } finally {
      clearTimeout(timeout);
    }

    this.config.onResponseHeaders?.(response.headers);
    const json = await response.json().catch(() => null);
    return { response, json };
  }

  async request<TResponse>(
    method: Method,
    path: string,
    body?: unknown,
    options: RequestOptions & { idempotencyKey?: string } = {}
  ): Promise<TResponse> {
    const { response, json } = await this.send(method, path, body, options);

    if (!response.ok || !json || json.success !== true) {
      if (response.status === 401) this.config.onUnauthorized?.();
      const errorBody = json?.error ?? { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred', details: [] };
      throw new ApiClientError(response.status, errorBody.code, errorBody.message, errorBody.details ?? [], json?.requestId);
    }

    return json.data as TResponse;
  }

  async requestWithMeta<TResponse, TMeta = Record<string, unknown>>(
    method: Method,
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<{ data: TResponse; meta: TMeta }> {
    const { response, json } = await this.send(method, path, body, options);

    if (!response.ok || !json || json.success !== true) {
      if (response.status === 401) this.config.onUnauthorized?.();
      const errorBody = json?.error ?? { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred', details: [] };
      throw new ApiClientError(response.status, errorBody.code, errorBody.message, errorBody.details ?? [], json?.requestId);
    }
    return { data: json.data as TResponse, meta: (json.meta ?? {}) as TMeta };
  }
}
