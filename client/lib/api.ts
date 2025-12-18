const BACKEND_URL =
  process.env.BACKEND_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://api.faultline.ai"
    : "http://localhost:8080");

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export async function api<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${BACKEND_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        data: null,
        error: `API Error (${response.status}): ${errorText || response.statusText}`,
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
