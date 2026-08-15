export type ApiErrorDetail = { path?: string; message?: string } & Record<string, unknown>;

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  error?: { code?: string; details?: ApiErrorDetail[] };
};

type RefreshResult = { accessToken: string };

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: ApiErrorDetail[],
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:4000/api/v1" : "/api/v1");

export class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private onAuthenticationLost: (() => void) | null = null;

  setAuthenticationLostHandler(handler: () => void) {
    this.onAuthenticationLost = handler;
  }

  setAccessToken(accessToken: string | null) {
    this.accessToken = accessToken;
  }

  getAccessToken() {
    return this.accessToken;
  }

  publicRequest<T>(path: string, init?: RequestInit) {
    return this.send<T>(path, init, false, false);
  }

  request<T>(path: string, init?: RequestInit) {
    return this.send<T>(path, init, true, true);
  }

  refreshAccessToken() {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh() {
    try {
      const result = await this.send<RefreshResult>(
        "/auth/refresh",
        { method: "POST" },
        false,
        false,
      );
      this.accessToken = result.accessToken;
      return true;
    } catch (error) {
      this.accessToken = null;
      if (error instanceof ApiClientError && error.status === 401) return false;
      throw error;
    }
  }

  private async send<T>(
    path: string,
    init: RequestInit | undefined,
    authenticated: boolean,
    retryAfterRefresh: boolean,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...(authenticated && this.accessToken
            ? { Authorization: `Bearer ${this.accessToken}` }
            : {}),
          ...init?.headers,
        },
      });
    } catch {
      throw new ApiClientError(
        "The MakerSpace service is unavailable. Check your connection and try again.",
        0,
        "NETWORK_ERROR",
        [],
        null,
      );
    }

    if (response.status === 401 && authenticated && retryAfterRefresh) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) return this.send<T>(path, init, true, false);
      this.onAuthenticationLost?.();
    }

    if (response.status === 204) return undefined as T;

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !payload?.success) {
      throw new ApiClientError(
        payload?.message ?? "The request could not be completed.",
        response.status,
        payload?.error?.code ?? "REQUEST_FAILED",
        payload?.error?.details ?? [],
        response.headers.get("x-request-id"),
      );
    }
    return payload.data;
  }
}
