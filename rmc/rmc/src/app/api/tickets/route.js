import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const isAdmin = user.role === 'admin';

        let sql = `SELECT t.*, u.fullname as user_fullname, u.username,
               (SELECT COUNT(*) FROM rc_ticket_messages tm WHERE tm.ticket_id = t.id) as message_count
               FROM rc_support_tickets t
               LEFT JOIN rc_users u ON t.user_id = u.id
               WHERE t.is_deleted = FALSE`;
        const params = [];
        let paramIndex = 1;

        if (!isAdmin) {
            sql += ` AND t.user_id = $${paramIndex}`;
            params.push(user.id);
            paramIndex++;
        }
        if (status) {
            sql += ` AND t.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        sql += ' ORDER BY t.created_at DESC';

        const result = await query(sql, params);
        return NextResponse.json({ tickets: result.rows });
    } catch (error) {
        console.error('Tickets error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { subject, category = 'general', priority = 'normal', message } = body;

        if (!subject) return NextResponse.json({ error: 'Konu gereklidir' }, { status: 400 });

        const result = await query(
            `INSERT INTO rc_support_tickets (user_id, subject, category, priority)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [user.id, subject, category, priority]
        );

        // Add initial message if provided
        if (message) {
            await query(
                `INSERT INTO rc_ticket_messages (ticket_id, user_id, message) VALUES ($1, $2, $3)`,
                [result.rows[0].id, user.id, message]
            );
        }

        await logAudit({
            userId: user.id,
            username: user.username,
            actionType: 'TICKET_CREATE',
            category: 'ticket',
            description: `Destek talebi oluşturuldu: ${subject}`,
            details: { ticketId: result.rows[0].id, category, priority },
        });

        return NextResponse.json({ ticket: result.rows[0] }, { status: 201 });
    } catch (error) {
        console.error('Ticket create error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, status: newStatus, message } = body;

        if (!id) return NextResponse.json({ error: 'id gereklidir' }, { status: 400 });

        // Only admin can change status, or user can add messages to own ticket
        if (newStatus) {
            if (user.role !== 'admin') {
                return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
            }

            let extraFields = '';
            if (newStatus === 'resolved') extraFields = ', resolved_at = NOW()';
            if (newStatus === 'closed') extraFields = ', closed_at = NOW()';

            await query(
                `UPDATE rc_support_tickets SET status = $2, updated_at = NOW() ${extraFields} WHERE id = $1`,
                [id, newStatus]
            );

            await logAudit({
                userId: user.id,
                username: user.username,
                actionType: 'TICKET_UPDATE',
                category: 'ticket',
                description: `Talep durumu güncellendi: #${id} → ${newStatus}`,
                details: { ticketId: id, newStatus },
            });
        }

        if (message) {
            await query(
                `INSERT INTO rc_ticket_messages (ticket_id, user_id, message, is_admin_reply)
         VALUES ($1, $2, $3, $4)`,
                [id, user.id, message, user.role === 'admin']
            );
            await query('UPDATE rc_support_tickets SET updated_at = NOW() WHERE id = $1', [id]);

            await logAudit({
                userId: user.id,
                username: user.username,
                actionType: 'TICKET_MESSAGE',
                category: 'ticket',
                description: `Talep #${id} mesaj eklendi`,
                details: { ticketId: id },
            });
        }

        const result = await query('SELECT * FROM rc_support_tickets WHERE id = $1', [id]);
        const messages = await query(
            `SELECT tm.*, u.fullname, u.username FROM rc_ticket_messages tm
       LEFT JOIN rc_users u ON tm.user_id = u.id
       WHERE tm.ticket_id = $1 ORDER BY tm.created_at ASC`,
            [id]
        );

        return NextResponse.json({
            ticket: result.rows[0],
            messages: messages.rows,
        });
    } catch (error) {
        console.error('Ticket update error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
