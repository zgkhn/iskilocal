import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireRole } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export async function GET(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const tagId = searchParams.get('tag_id');

        let sql = `SELECT ts.*, t.name as tag_name, t.unit as tag_unit
               FROM rc_tag_scales ts
               JOIN tags t ON ts.tag_id = t.id
               WHERE ts.is_active = TRUE`;
        const params = [];

        if (tagId) {
            sql += ' AND ts.tag_id = $1';
            params.push(parseInt(tagId));
        }
        sql += ' ORDER BY t.name';

        const result = await query(sql, params);
        return NextResponse.json({ scales: result.rows });
    } catch (error) {
        console.error('Tag scales error:', error);
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
        const { tag_id, multiply_factor = 1, divide_factor = 1, offset_value = 0, decimal_precision = 2, unit = '' } = body;

        if (!tag_id) {
            return NextResponse.json({ error: 'tag_id gereklidir' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO rc_tag_scales (tag_id, multiply_factor, divide_factor, offset_value, decimal_precision, unit, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tag_id) DO UPDATE SET
         multiply_factor = $2, divide_factor = $3, offset_value = $4,
         decimal_precision = $5, unit = $6, updated_at = NOW()
       RETURNING *`,
            [tag_id, multiply_factor, divide_factor, offset_value, decimal_precision, unit, user.id]
        );

        await logAdminAction(user, 'SCALE_UPDATE', `Tag scala güncellendi: Tag #${tag_id}`, {
            tag_id,
            multiply_factor,
            divide_factor,
            offset_value,
            decimal_precision,
            unit,
        });

        return NextResponse.json({ scale: result.rows[0] });
    } catch (error) {
        console.error('Tag scale create error:', error);
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

        const existing = await query('SELECT * FROM rc_tag_scales WHERE id = $1', [id]);
        await query('DELETE FROM rc_tag_scales WHERE id = $1', [id]);

        if (existing.rows.length > 0) {
            await logAdminAction(user, 'SCALE_DELETE', `Tag scala silindi: Tag #${existing.rows[0].tag_id}`, {
                before: existing.rows[0],
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Tag scale delete error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
