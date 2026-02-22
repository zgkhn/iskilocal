import { NextResponse } from 'next/server';

export function middleware(request) {
    const { pathname } = request.nextUrl;

    // Public paths and static assets
    const isPublicPath = ['/login', '/api/auth/login'].some(p => pathname.startsWith(p));
    const isStaticAsset = [
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.css', '.js'
    ].some(ext => pathname.toLowerCase().endsWith(ext));

    if (isPublicPath || isStaticAsset || pathname.startsWith('/_next')) {
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
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js)$).*)'],
};
