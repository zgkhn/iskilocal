import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const tableId = searchParams.get('table_id');

        let sql = `SELECT t.*, ts.multiply_factor, ts.divide_factor, ts.offset_value, 
               ts.decimal_precision, ts.unit as scale_unit
               FROM tags t 
               LEFT JOIN rc_tag_scales ts ON t.id = ts.tag_id`;
        const params = [];

        if (tableId) {
            sql += ' WHERE t.monitoring_table_id = $1';
            params.push(parseInt(tableId));
        }
        sql += ' ORDER BY t.name';

        const result = await query(sql, params);
        return NextResponse.json({ tags: result.rows });
    } catch (error) {
        console.error('Tags list error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
