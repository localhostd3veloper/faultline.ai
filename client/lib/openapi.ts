export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function detectContentType(
  filename: string,
  content: string,
): "openapi-yaml" | "openapi-json" | "markdown" {
  const lowerFilename = filename.toLowerCase();

  if (lowerFilename.includes("openapi") || lowerFilename.includes("swagger")) {
    if (lowerFilename.endsWith(".json") || content.trim().startsWith("{")) {
      return "openapi-json";
    }
    return "openapi-yaml";
  }

  return "markdown";
}

export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function isValidYAML(str: string): boolean {
  try {
    const trimmed = str.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
