import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const tagIds = searchParams.get('tag_ids');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        const minValue = searchParams.get('min_value');
        const maxValue = searchParams.get('max_value');
        const sortBy = searchParams.get('sort_by') || 'timestamp';
        const sortOrder = searchParams.get('sort_order') || 'DESC';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 5000);
        const offset = (page - 1) * limit;

        if (!tagIds) {
            return NextResponse.json({ error: 'tag_ids parametresi gereklidir' }, { status: 400 });
        }

        const tagIdArray = tagIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (tagIdArray.length === 0) {
            return NextResponse.json({ error: 'Geçerli tag_ids gereklidir' }, { status: 400 });
        }

        // Build dynamic query
        let conditions = [`m.tag_id = ANY($1)`];
        let params = [tagIdArray];
        let paramIndex = 2;

        if (startDate) {
            conditions.push(`m.timestamp >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            conditions.push(`m.timestamp <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }
        if (minValue) {
            conditions.push(`m.value >= $${paramIndex}`);
            params.push(parseFloat(minValue));
            paramIndex++;
        }
        if (maxValue) {
            conditions.push(`m.value <= $${paramIndex}`);
            params.push(parseFloat(maxValue));
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const validSortColumns = ['timestamp', 'value', 'tag_id'];
        const safeSort = validSortColumns.includes(sortBy) ? sortBy : 'timestamp';
        const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Count query
        const countResult = await query(
            `SELECT COUNT(*) FROM measurements m ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Data query with tag info and scales
        const dataResult = await query(
            `SELECT m.id, m.tag_id, m.timestamp, m.value,
              t.name as tag_name, t.unit as tag_unit, t.data_type,
              ts.multiply_factor, ts.divide_factor, ts.offset_value, 
              ts.decimal_precision, ts.unit as scale_unit
       FROM measurements m
       JOIN tags t ON m.tag_id = t.id
       LEFT JOIN rc_tag_scales ts ON t.id = ts.tag_id
       ${whereClause}
       ORDER BY m.${safeSort} ${safeOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return NextResponse.json({
            measurements: dataResult.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Measurements query error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
