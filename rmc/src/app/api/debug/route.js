import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        msg: 'Debug endpoint works',
        time: new Date().toISOString()
    });
}
