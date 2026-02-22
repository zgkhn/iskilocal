import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const plcId = searchParams.get('plc_id');

        let sql = 'SELECT mt.*, p.name as plc_name FROM monitoring_tables mt LEFT JOIN plcs p ON mt.plc_id = p.id';
        const params = [];

        if (plcId) {
            sql += ' WHERE mt.plc_id = $1';
            params.push(parseInt(plcId));
        }
        sql += ' ORDER BY mt.name';

        const result = await query(sql, params);
        return NextResponse.json({ tables: result.rows });
    } catch (error) {
        console.error('Tables list error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
