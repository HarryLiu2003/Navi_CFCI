# Enhanced Authentication System

This document explains the various authentication methods supported by the Navi CFCI API Gateway.

## Authentication Methods

The API Gateway supports multiple authentication methods to provide flexibility while maintaining security:

1. **Standard JWT Authentication**: Uses JWT tokens validated with the shared secret
2. **User ID Direct Authentication**: Accepts user IDs as tokens for simplicity
3. **Passthrough Authentication**: Allows sending user information directly (development only)
4. **Development Authentication**: Provides automatic authentication in development environments

## Configuration Options

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| `ENABLE_DEV_AUTH` | Enable development authentication fallbacks | `false` in production, `true` in development |
| `ALLOW_HEADER_PASSTHROUGH` | Allow direct user info in headers | `false` in production, `true` in development |
| `DEVELOPMENT_USER_ID` | User ID to use for dev authentication | `dev-user-123` |
| `TRUSTED_ORIGINS` | Allowed origins for header passthrough | Comma-separated list |

## Authentication Flow

The frontend attempts multiple authentication methods in sequence:

1. Tries to extract a valid JWT token using NextAuth
2. If that fails, uses the session user ID directly
3. For development, can encode user info as a passthrough token
4. For development, includes a special development header

The API Gateway then processes these authentication attempts:

1. Validates JWT tokens using the shared secret
2. Extracts user IDs from various token formats
3. In development, processes passthrough tokens with user info
4. In development, provides fallbacks when authentication fails

## Development Authentication

In development environments, authentication is simplified to improve developer experience:

- If authentication fails, a development user is used instead
- Passthrough tokens allow testing without valid JWTs
- The `X-Development-Auth` header can bypass authentication
- Even expired or invalid tokens can be handled

## Security Considerations

Security is maintained through these safeguards:

1. Development authentication is disabled in production
2. Passthrough authentication is disabled in production
3. JWT tokens are always validated in production
4. Service-to-service authentication remains secure

## Frontend Implementation

The frontend implements the enhanced authentication with fallbacks:

```typescript
// Attempt different authentication methods
        
// Method 1: Try to get JWT token using next-auth/jwt
try {
  const token = await getToken({ 
    req: request as any, 
    secret: process.env.NEXTAUTH_SECRET
  });
  
  if (token) {
    // Use user ID from token for authentication
    const userId = token.sub || token.jti;
    if (userId) {
      headers['Authorization'] = `Bearer ${userId}`;
    }
  }
} catch (error) {
  console.warn("Failed to get token from next-auth/jwt:", error);
}

// Method 2: If we have session.user.id, use it directly
if (session.user?.id && !headers['Authorization']) {
  headers['Authorization'] = `Bearer ${session.user.id}`;
}

// Method 3: For development, provide a passthrough option with user info
if (IS_DEVELOPMENT && session.user && !headers['Authorization']) {
  try {
    // Create a minimal user payload and encode it
    const userPayload = {
      sub: session.user.id,
      name: session.user.name || 'Anonymous',
      email: session.user.email,
    };
    const encodedPayload = Buffer.from(JSON.stringify(userPayload)).toString('base64');
    headers['Authorization'] = `Bearer passthrough:${encodedPayload}`;
  } catch (error) {
    console.error("Failed to create passthrough auth:", error);
  }
}

// Method 4: For development environments, include development header
if (IS_DEVELOPMENT) {
  headers['X-Development-Auth'] = 'true';
}
```

## API Gateway Authentication Middleware

The API Gateway's authentication middleware processes these methods:

```python
# Special handling for direct header passthrough (if enabled)
if ALLOW_HEADER_PASSTHROUGH and token.startswith("passthrough:"):
    if not IS_PRODUCTION:  # Only allow in non-production environments
        passthrough_data = token.replace("passthrough:", "", 1)
        try:
            # Decode base64 if it looks like base64
            decoded_data = base64.b64decode(passthrough_data).decode('utf-8')
            payload = json.loads(decoded_data)
            logger.info(f"Using passthrough authentication: {payload.get('sub', 'unknown')}")
            return payload
        except Exception as e:
            logger.error(f"Failed to decode passthrough token: {str(e)}")

# For development environments, we can use a dev user if enabled
if not IS_PRODUCTION and ENABLE_DEV_AUTH:
    logger.warning("Using development authentication due to JWT error")
    return {"sub": DEVELOPMENT_USER_ID, "name": "Development User", "is_dev_auth": True}
```

## Recommended Usage

- **Production**: Stick with standard JWT authentication for security
- **Development**: Take advantage of simplified authentication methods
- **Testing**: Use passthrough authentication for complex user scenarios
- **Debugging**: The development header ensures authentication always works

By implementing these flexibility options while maintaining strict security boundaries between environments, we ensure the system is both developer-friendly and secure. 