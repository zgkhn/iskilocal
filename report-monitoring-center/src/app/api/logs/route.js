import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireRole } from '@/lib/auth';

export async function GET(request) {
    try {
        const user = await getAuthUser();
        if (!user || !requireRole(user, 'admin')) {
            return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');
        const category = searchParams.get('category');
        const actionType = searchParams.get('action_type');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
        const offset = (page - 1) * limit;

        let conditions = [];
        let params = [];
        let paramIndex = 1;

        if (userId) { conditions.push(`al.user_id = $${paramIndex}`); params.push(parseInt(userId)); paramIndex++; }
        if (category) { conditions.push(`al.category = $${paramIndex}`); params.push(category); paramIndex++; }
        if (actionType) { conditions.push(`al.action_type = $${paramIndex}`); params.push(actionType); paramIndex++; }
        if (startDate) { conditions.push(`al.created_at >= $${paramIndex}`); params.push(startDate); paramIndex++; }
        if (endDate) { conditions.push(`al.created_at <= $${paramIndex}`); params.push(endDate); paramIndex++; }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countResult = await query(`SELECT COUNT(*) FROM rc_audit_logs al ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        const result = await query(
            `SELECT al.*, u.fullname as user_fullname
       FROM rc_audit_logs al
       LEFT JOIN rc_users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return NextResponse.json({
            logs: result.rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Logs list error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
