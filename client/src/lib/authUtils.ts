// Utility for checking unauthorized errors - from Replit Auth blueprint
export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}
