const BACKEND_URL = 
  process.env.BACKEND_API_URL || 
  (process.env.NODE_ENV === "production" 
    ? "https://api.faultline.ai" 
    : "http://localhost:8080");

export async function fastApiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${BACKEND_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FastAPI Error (${response.status}): ${errorText || response.statusText}`);
  }

  return response.json();
}

