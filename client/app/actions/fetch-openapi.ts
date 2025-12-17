"use server";

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchOpenAPIFromUrl(url: string) {
  if (!isValidUrl(url)) {
    return {
      error: "Invalid URL. Must be a valid HTTP or HTTPS URL",
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, application/yaml, text/yaml, */*",
      },
    });

    if (!response.ok) {
      return {
        error: `Failed to fetch OpenAPI: ${response.statusText}`,
      };
    }

    const content = await response.text();
    return { data: content };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

