import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// Helper to ensure table exists
async function ensureTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS rc_user_report_settings (
            user_id INTEGER NOT NULL,
            report_id INTEGER NOT NULL,
            config JSONB DEFAULT '{}',
            updated_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (user_id, report_id)
        )
    `);
}

export async function GET(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const report_id = searchParams.get('report_id');

        if (!report_id) return NextResponse.json({ error: 'report_id gereklidir' }, { status: 400 });

        await ensureTable();

        const result = await query(
            'SELECT config FROM rc_user_report_settings WHERE user_id = $1 AND report_id = $2',
            [user.id, report_id]
        );

        return NextResponse.json({ config: result.rows[0]?.config || null });
    } catch (error) {
        console.error('User settings fetch error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { report_id, config } = body;

        if (!report_id) return NextResponse.json({ error: 'report_id gereklidir' }, { status: 400 });

        await ensureTable();

        await query(
            `INSERT INTO rc_user_report_settings (user_id, report_id, config, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id, report_id) 
             DO UPDATE SET config = $3, updated_at = NOW()`,
            [user.id, report_id, JSON.stringify(config)]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('User settings save error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
