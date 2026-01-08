export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `HTTP error: ${response.status}`;
    let details: string | undefined;

    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        errorMessage = errorBody.message;
      }
      if (errorBody.error) {
        details = errorBody.error;
      }
    } catch {
      // レスポンスボディのパースに失敗した場合は無視
    }

    throw new ApiClientError(response.status, errorMessage, details);
  }

  return response.json();
}
