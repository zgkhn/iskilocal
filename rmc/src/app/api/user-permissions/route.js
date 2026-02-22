import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireRole } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

// GET: Fetch permitted report IDs for a user
export async function GET(request) {
    try {
        const user = await getAuthUser();
        if (!user || !requireRole(user, 'admin')) {
            return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');
        if (!userId) return NextResponse.json({ error: 'user_id gereklidir' }, { status: 400 });

        const result = await query(
            `SELECT report_id FROM rc_user_report_permissions WHERE user_id = $1`,
            [userId]
        );

        return NextResponse.json({
            report_ids: result.rows.map(r => r.report_id)
        });
    } catch (error) {
        console.error('User permissions GET error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}

// PUT: Replace all permissions for a user
export async function PUT(request) {
    try {
        const user = await getAuthUser();
        if (!user || !requireRole(user, 'admin')) {
            return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
        }

        const body = await request.json();
        const { user_id, report_ids = [] } = body;

        if (!user_id) return NextResponse.json({ error: 'user_id gereklidir' }, { status: 400 });

        // Delete existing permissions
        await query('DELETE FROM rc_user_report_permissions WHERE user_id = $1', [user_id]);

        // Insert new permissions
        if (report_ids.length > 0) {
            const values = report_ids.map((rid, i) => `($1, $${i + 2})`).join(', ');
            await query(
                `INSERT INTO rc_user_report_permissions (user_id, report_id) VALUES ${values}`,
                [user_id, ...report_ids]
            );
        }

        await logAdminAction(user, 'PERMISSION_UPDATE', `Kullanıcı #${user_id} rapor izinleri güncellendi`, {
            targetUserId: user_id,
            report_ids,
        });

        return NextResponse.json({ success: true, report_ids });
    } catch (error) {
        console.error('User permissions PUT error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
