import { NextResponse } from 'next/server';

export function middleware(request) {
    const { pathname } = request.nextUrl;

    // Public paths
    const publicPaths = ['/login', '/api/auth/login', '/_next', '/favicon.ico', '/logo.png'];
    const isPublic = publicPaths.some(p => pathname.startsWith(p));

    if (isPublic) {
        return NextResponse.next();
    }

    const token = request.cookies.get('rc_auth_token')?.value;

    if (!token) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
