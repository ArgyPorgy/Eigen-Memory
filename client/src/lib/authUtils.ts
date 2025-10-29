// API utilities - from Replit Auth blueprint
export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include", // Important for sessions
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${response.status}: ${data.message || "Request failed"}`);
  }

  return data;
}
