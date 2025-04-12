import { NextResponse, NextRequest } from 'next/server'
import { getToken } from "next-auth/jwt"
import * as jose from 'jose'

// Ensure API_URL is read correctly, provide a default if necessary
const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production'

// Determine the correct Gateway URL based on environment
const gatewayUrl = IS_DEVELOPMENT ? "http://api_gateway:8000" : API_GATEWAY_URL

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const personaId = params.id
  const secret = process.env.NEXTAUTH_SECRET
  
  if (!secret) {
    console.error("[/api/personas/[id]] NEXTAUTH_SECRET is not set.")
    return NextResponse.json({ message: 'Server configuration error' }, { status: 500 })
  }
  
  // Prepare the signing key
  let signingKey: Uint8Array = new TextEncoder().encode(secret)

  try {
    // Get the DECODED token payload from the request using next-auth
    const decodedTokenPayload = await getToken({ req: request, secret: secret })

    // Check if payload exists and contains the subject (user ID)
    if (!decodedTokenPayload || !decodedTokenPayload.sub) {
      console.warn("[/api/personas/[id]] No valid decoded token payload found for request.")
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Manually sign a NEW JWS Token for API Gateway
    let signedApiToken: string
    try {
      const claimsToSign = { 
        sub: decodedTokenPayload.sub,
        name: decodedTokenPayload.name,
        email: decodedTokenPayload.email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 min expiry
      }
      signedApiToken = await new jose.SignJWT(claimsToSign)
        .setProtectedHeader({ alg: 'HS256' })
        .sign(signingKey)
    } catch (signingError) {
      console.error("[/api/personas/[id]] Failed to manually sign JWS token:", signingError)
      return NextResponse.json({ status: 'error', message: 'Failed to prepare authentication token' }, { status: 500 })
    }

    // Construct the target URL for the API Gateway
    const targetUrl = `${gatewayUrl}/api/personas/${personaId}`
    console.info(`[/api/personas/[id]] Forwarding DELETE request for persona ${personaId} (user ${decodedTokenPayload.sub}) to ${targetUrl}`)

    // Make the authenticated request to the API Gateway using the NEWLY SIGNED token
    const apiResponse = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${signedApiToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    // If the response is 204 No Content (success with no body)
    if (apiResponse.status === 204) {
      console.info(`[/api/personas/[id]] Successfully deleted persona ${personaId}`)
      return new NextResponse(null, { status: 204 })
    }

    // For other response types, try to parse JSON
    let data
    try {
      data = await apiResponse.json()
    } catch (e) {
      // If we can't parse JSON, use an empty object
      data = {}
    }

    // Check if the gateway request was successful
    if (!apiResponse.ok) {
      console.error(
        `[/api/personas/[id]] API Gateway returned error ${apiResponse.status}: ${JSON.stringify(data)}`
      )
      return NextResponse.json(
        { message: data.detail || data.message || 'Error deleting persona from gateway' }, 
        { status: apiResponse.status }
      )
    }

    return NextResponse.json(data, { status: apiResponse.ok ? 200 : apiResponse.status })

  } catch (error: any) {
    console.error(`[/api/personas/[id]] Internal error: ${error.message}`, { error })
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
} 