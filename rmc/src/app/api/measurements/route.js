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
        const interval = searchParams.get('interval'); // e.g. '15min', '30min', '1hour', '2hour', '6hour', '1day'

        if (!tagIds) {
            return NextResponse.json({ error: 'tag_ids parametresi gereklidir' }, { status: 400 });
        }

        const tagIdArray = tagIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (tagIdArray.length === 0) {
            return NextResponse.json({ error: 'Geçerli tag_ids gereklidir' }, { status: 400 });
        }

        // Build conditions
        let conditions = [`m.tag_id = ANY($1)`];
        let params = [tagIdArray];
        let paramIndex = 2;

        if (startDate) { conditions.push(`m.timestamp >= $${paramIndex}`); params.push(startDate); paramIndex++; }
        if (endDate) { conditions.push(`m.timestamp <= $${paramIndex}`); params.push(endDate); paramIndex++; }
        if (minValue) { conditions.push(`m.value >= $${paramIndex}`); params.push(parseFloat(minValue)); paramIndex++; }
        if (maxValue) { conditions.push(`m.value <= $${paramIndex}`); params.push(parseFloat(maxValue)); paramIndex++; }

        const whereClause = 'WHERE ' + conditions.join(' AND ');
        const validSortColumns = ['timestamp', 'value', 'tag_id'];
        const safeSort = validSortColumns.includes(sortBy) ? sortBy : 'timestamp';
        const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Map interval to PostgreSQL date_trunc + custom intervals
        const intervalMap = {
            '5min': "date_trunc('hour', m.timestamp) + (floor(extract(minute from m.timestamp) / 5) * interval '5 minutes')",
            '15min': "date_trunc('hour', m.timestamp) + (floor(extract(minute from m.timestamp) / 15) * interval '15 minutes')",
            '30min': "date_trunc('hour', m.timestamp) + (floor(extract(minute from m.timestamp) / 30) * interval '30 minutes')",
            '1hour': "date_trunc('hour', m.timestamp)",
            '2hour': "date_trunc('day', m.timestamp) + (floor(extract(hour from m.timestamp) / 2) * interval '2 hours')",
            '6hour': "date_trunc('day', m.timestamp) + (floor(extract(hour from m.timestamp) / 6) * interval '6 hours')",
            '1day': "date_trunc('day', m.timestamp)",
        };

        const intervalExpr = interval && intervalMap[interval];

        if (intervalExpr) {
            // With interval: use DISTINCT ON to pick one measurement per tag per interval bucket
            const countResult = await query(
                `SELECT COUNT(*) FROM (
                    SELECT DISTINCT ON (m.tag_id, ${intervalExpr}) m.id
                    FROM measurements m ${whereClause}
                    ORDER BY m.tag_id, ${intervalExpr}, m.timestamp DESC
                ) sub`,
                params
            );
            const total = parseInt(countResult.rows[0].count);

            const dataResult = await query(
                `SELECT sub.* FROM (
                    SELECT DISTINCT ON (m.tag_id, ${intervalExpr})
                        m.id, m.tag_id, m.timestamp, m.value,
                        t.name as tag_name, t.unit as tag_unit, t.data_type,
                        ts.multiply_factor, ts.divide_factor, ts.offset_value,
                        ts.decimal_precision, ts.decimal_separator, ts.thousand_separator, ts.max_digits, ts.unit as scale_unit
                    FROM measurements m
                    JOIN tags t ON m.tag_id = t.id
                    LEFT JOIN rc_tag_scales ts ON t.id = ts.tag_id
                    ${whereClause}
                    ORDER BY m.tag_id, ${intervalExpr}, m.timestamp DESC
                ) sub
                ORDER BY sub.timestamp ${safeOrder}
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
                [...params, limit, offset]
            );

            return NextResponse.json({
                measurements: dataResult.rows,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            });
        }

        // Without interval: normal query
        const countResult = await query(
            `SELECT COUNT(*) FROM measurements m ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const dataResult = await query(
            `SELECT m.id, m.tag_id, m.timestamp, m.value,
              t.name as tag_name, t.unit as tag_unit, t.data_type,
              ts.multiply_factor, ts.divide_factor, ts.offset_value, 
              ts.decimal_precision, ts.decimal_separator, ts.thousand_separator, ts.max_digits, ts.unit as scale_unit
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
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Measurements query error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
