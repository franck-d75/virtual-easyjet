export class ApiHttpClient {
  private accessToken: string | undefined;

  public constructor(private readonly baseUrl: string) {}

  public setAccessToken(token: string | undefined): void {
    this.accessToken = token;
  }

  public async request<TResponse>(
    path: string,
    init: RequestInit = {},
  ): Promise<TResponse> {
    const headers = new Headers(init.headers);

    if (!headers.has("Content-Type") && init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `HTTP ${response.status} while calling ${path}: ${message || response.statusText}`,
      );
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  }
}
