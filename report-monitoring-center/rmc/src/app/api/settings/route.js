import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireRole } from '@/lib/auth';

export async function GET() {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const result = await query('SELECT * FROM rc_settings ORDER BY key');
        const settings = {};
        result.rows.forEach(r => { settings[r.key] = r.value; });
        return NextResponse.json({ settings });
    } catch (error) {
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const user = await getAuthUser();
        if (!user || !requireRole(user, 'admin')) {
            return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
        }

        const body = await request.json();
        for (const [key, value] of Object.entries(body)) {
            await query(
                `INSERT INTO rc_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
                [key, String(value)]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
