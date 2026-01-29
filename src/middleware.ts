import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login',
    '/register',          // ✅ NEW: register page public
    '/forgot-password',
    '/api/connect',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/status',
    '/api/auth/register', // ✅ NEW: register API public
    '/api/auth/forgot-password',
  ]

  // Check if the route is public
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Skip API routes - let them handle their own authentication
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // For non-API routes, check for admin-token cookie
  const token = request.cookies.get('admin-token')

  if (!token) {
    // Redirect to login page
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/connect (public API)
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/connect|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
