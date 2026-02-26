import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword, generateToken, setAuthCookie, hashPassword } from '@/lib/auth';
import { logLogin, logFailedLogin, getClientInfo } from '@/lib/audit';

// Seed admin
async function ensureAdminExists() {
    const res = await query('SELECT id FROM rc_users WHERE username = $1', ['admin']);
    if (res.rows.length === 0) {
        const hash = await hashPassword('admin123');
        await query(
            `INSERT INTO rc_users (username, password_hash, fullname, role, email)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING`,
            ['admin', hash, 'Sistem Yöneticisi', 'admin', 'admin@iski.gov.tr']
        );
    }
}

export async function POST(request) {
    try {
        const { username, password } = await request.json();
        const { ip, userAgent } = getClientInfo(request);

        if (!username || !password) {
            return NextResponse.json({ error: 'Kullanıcı adı ve şifre gereklidir' }, { status: 400 });
        }

        await ensureAdminExists();

        const result = await query(
            'SELECT * FROM rc_users WHERE username = $1 AND is_active = TRUE AND is_deleted = FALSE',
            [username]
        );

        if (result.rows.length === 0) {
            await logFailedLogin(username, ip, userAgent);
            return NextResponse.json({ error: 'Geçersiz kullanıcı adı veya şifre' }, { status: 401 });
        }

        const user = result.rows[0];
        const valid = await verifyPassword(password, user.password_hash);

        if (!valid) {
            await logFailedLogin(username, ip, userAgent);
            return NextResponse.json({ error: 'Geçersiz kullanıcı adı veya şifre' }, { status: 401 });
        }

        const token = generateToken(user);
        await logLogin(user, ip, userAgent);

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                fullname: user.fullname,
                role: user.role,
                theme_preference: user.theme_preference,
            },
        });

        const cookie = setAuthCookie(token);
        response.cookies.set(cookie.name, cookie.value, {
            ...cookie
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
