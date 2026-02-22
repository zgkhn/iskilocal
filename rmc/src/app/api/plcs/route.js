import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const result = await query(
            'SELECT id, name, ip_address, port, protocol, is_active, created_at FROM plcs ORDER BY name'
        );
        return NextResponse.json({ plcs: result.rows });
    } catch (error) {
        console.error('PLC list error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
