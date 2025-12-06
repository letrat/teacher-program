import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * The frontend now relies entirely on the client-side AuthProvider
 * and the Express backend for authentication and authorization.
 *
 * To avoid conflicts and infinite redirects, the middleware simply
 * allows all requests to pass through.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
