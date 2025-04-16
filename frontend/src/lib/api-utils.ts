import * as jose from 'jose';

// --- Environment & Constants ---
export const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const GATEWAY_URL = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_URL;
const jwtSecret = process.env.NEXTAUTH_SECRET;

// --- Logging ---
// Helper to create prefixed loggers
export const createLogger = (prefix: string) => ({
  log: (...messages: any[]) => console.log(`[${prefix}]`, ...messages),
  error: (...messages: any[]) => console.error(`[${prefix}]`, ...messages),
});
// Example usage (can create specific loggers in each route file):
// export const projectLogger = createLogger("Frontend API /api/projects/[id]");

// Generic logger if needed directly
export const generalApiLogger = createLogger("Frontend API Route");

// --- JWT Signing Key Preparation ---
let signingKey: Uint8Array | null = null;
if (jwtSecret) {
  try {
    signingKey = new TextEncoder().encode(jwtSecret);
    generalApiLogger.log("JWT Signing key prepared successfully.");
  } catch (err) {
    generalApiLogger.error("CRITICAL: Failed to encode NEXTAUTH_SECRET:", err);
  }
} else {
  generalApiLogger.error("CRITICAL: NEXTAUTH_SECRET is not set! Cannot sign tokens for gateway calls.");
}

// --- Gateway Token Signing Function ---
export async function signGatewayToken(userId: string, name?: string | null, email?: string | null): Promise<string | null> {
  if (!signingKey) {
    generalApiLogger.error("Cannot sign token: Signing key is not available (check NEXTAUTH_SECRET).");
    return null;
  }
  try {
    const claimsToSign = {
      sub: userId,
      name: name ?? undefined,
      email: email ?? undefined,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 minute expiry
    };
    const token = await new jose.SignJWT(claimsToSign)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(signingKey);
    // generalApiLogger.log("Gateway token signed successfully."); // Optional: Can be noisy
    return token;
  } catch (signingError) {
    generalApiLogger.error("Failed to manually sign JWS token for gateway:", signingError);
    return null;
  }
} 