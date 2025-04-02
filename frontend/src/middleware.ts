import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname
  
  // Public paths that don't require authentication
  const isPublicPath = path === '/auth/signin'
  
  // Get the session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Redirect logic
  if (isPublicPath && token) {
    // If user is on a public path but has a token, redirect to dashboard
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!isPublicPath && !token) {
    // If user is on a protected path but has no token, redirect to signin
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

// Specify which paths should trigger this middleware
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /fonts (static files)
     * 4. /favicon.ico, /sitemap.xml (static files)
     */
    '/((?!api|_next|fonts|favicon.ico|sitemap.xml).*)',
  ],
} 