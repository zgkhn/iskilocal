import { NextResponse } from 'next/server';
import { clearAuthCookie, getAuthUser } from '@/lib/auth';
import { logLogout, getClientInfo } from '@/lib/audit';

export async function POST(request) {
    try {
        const user = await getAuthUser();
        if (user) {
            const { ip } = getClientInfo(request);
            await logLogout(user, ip);
        }

        const response = NextResponse.json({ success: true });
        const cookie = clearAuthCookie();
        response.cookies.set(cookie.name, cookie.value, {
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
            path: cookie.path,
            maxAge: cookie.maxAge,
        });

        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
