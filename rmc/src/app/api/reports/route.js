import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireRole } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export async function GET(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const result = await query(
            `SELECT rp.*, p.name as plc_name, mt.name as table_name, u.fullname as created_by_name
       FROM rc_report_pages rp
       LEFT JOIN plcs p ON rp.plc_id = p.id
       LEFT JOIN monitoring_tables mt ON rp.monitoring_table_id = mt.id
       LEFT JOIN rc_users u ON rp.created_by = u.id
       WHERE rp.is_deleted = FALSE AND rp.is_active = TRUE
       ORDER BY rp.created_at DESC`
        );
        return NextResponse.json({ reports: result.rows });
    } catch (error) {
        console.error('Reports list error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const user = await getAuthUser();
        if (!user || !requireRole(user, 'admin')) {
            return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, plc_id, monitoring_table_id, tag_ids = [], config = {} } = body;

        if (!name) return NextResponse.json({ error: 'Rapor adı gereklidir' }, { status: 400 });

        const result = await query(
            `INSERT INTO rc_report_pages (name, description, plc_id, monitoring_table_id, tag_ids, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, description, plc_id, monitoring_table_id, JSON.stringify(tag_ids), JSON.stringify(config), user.id]
        );

        await logAdminAction(user, 'REPORT_PAGE_CREATE', `Rapor sayfası oluşturuldu: ${name}`, {
            reportId: result.rows[0].id,
            name,
            tag_ids,
        });

        return NextResponse.json({ report: result.rows[0] }, { status: 201 });
    } catch (error) {
        console.error('Report create error:', error);
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
        const { id, name, description, plc_id, monitoring_table_id, tag_ids, config } = body;

        if (!id) return NextResponse.json({ error: 'id gereklidir' }, { status: 400 });

        const existing = await query('SELECT * FROM rc_report_pages WHERE id = $1', [id]);

        const result = await query(
            `UPDATE rc_report_pages SET name = COALESCE($2, name), description = COALESCE($3, description),
       plc_id = COALESCE($4, plc_id), monitoring_table_id = COALESCE($5, monitoring_table_id),
       tag_ids = COALESCE($6, tag_ids), config = COALESCE($7, config), updated_at = NOW()
       WHERE id = $1 AND is_deleted = FALSE RETURNING *`,
            [id, name, description, plc_id, monitoring_table_id, tag_ids ? JSON.stringify(tag_ids) : null, config ? JSON.stringify(config) : null]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 });
        }

        await logAdminAction(user, 'REPORT_PAGE_UPDATE', `Rapor sayfası güncellendi: ${result.rows[0].name}`, {
            reportId: id,
            before: existing.rows[0],
            after: result.rows[0],
        });

        return NextResponse.json({ report: result.rows[0] });
    } catch (error) {
        console.error('Report update error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const user = await getAuthUser();
        if (!user || !requireRole(user, 'admin')) {
            return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'id gereklidir' }, { status: 400 });

        const existing = await query('SELECT name FROM rc_report_pages WHERE id = $1', [id]);
        await query('UPDATE rc_report_pages SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1', [id]);

        await logAdminAction(user, 'REPORT_PAGE_DELETE', `Rapor sayfası silindi (soft): ${existing.rows[0]?.name}`, {
            reportId: id,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Report delete error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
