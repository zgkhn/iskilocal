import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, requireRole, hashPassword } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export async function GET() {
    try {
        const user = await getAuthUser();
        if (!user || !requireRole(user, 'admin')) {
            return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
        }

        const result = await query(
            `SELECT id, username, fullname, email, role, theme_preference, is_active, created_at, updated_at
       FROM rc_users WHERE is_deleted = FALSE ORDER BY created_at DESC`
        );
        return NextResponse.json({ users: result.rows });
    } catch (error) {
        console.error('Users list error:', error);
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
        const { username, password, fullname, email, role = 'viewer' } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Kullanıcı adı ve şifre gereklidir' }, { status: 400 });
        }

        const existing = await query('SELECT id FROM rc_users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return NextResponse.json({ error: 'Bu kullanıcı adı zaten mevcut' }, { status: 409 });
        }

        const passwordHash = await hashPassword(password);
        const result = await query(
            `INSERT INTO rc_users (username, password_hash, fullname, email, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, fullname, email, role, created_at`,
            [username, passwordHash, fullname, email, role]
        );

        await logAdminAction(user, 'USER_CREATE', `Yeni kullanıcı oluşturuldu: ${username}`, {
            newUserId: result.rows[0].id,
            username,
            role,
        });

        return NextResponse.json({ user: result.rows[0] }, { status: 201 });
    } catch (error) {
        console.error('User create error:', error);
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
        const { id, fullname, email, role, is_active, password } = body;

        if (!id) return NextResponse.json({ error: 'id gereklidir' }, { status: 400 });

        const existing = await query('SELECT * FROM rc_users WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
        }

        const oldUser = existing.rows[0];
        let updateFields = [];
        let params = [id];
        let paramIndex = 2;

        if (fullname !== undefined) { updateFields.push(`fullname = $${paramIndex}`); params.push(fullname); paramIndex++; }
        if (email !== undefined) { updateFields.push(`email = $${paramIndex}`); params.push(email); paramIndex++; }
        if (role !== undefined) { updateFields.push(`role = $${paramIndex}`); params.push(role); paramIndex++; }
        if (is_active !== undefined) { updateFields.push(`is_active = $${paramIndex}`); params.push(is_active); paramIndex++; }
        if (password) {
            const hash = await hashPassword(password);
            updateFields.push(`password_hash = $${paramIndex}`);
            params.push(hash);
            paramIndex++;
        }
        updateFields.push('updated_at = NOW()');

        const result = await query(
            `UPDATE rc_users SET ${updateFields.join(', ')} WHERE id = $1 RETURNING id, username, fullname, email, role, is_active`,
            params
        );

        // Log role change specifically
        if (role && role !== oldUser.role) {
            await logAdminAction(user, 'ROLE_CHANGE', `Rol değiştirildi: ${oldUser.username} (${oldUser.role} → ${role})`, {
                targetUserId: id,
                oldRole: oldUser.role,
                newRole: role,
            });
        } else {
            await logAdminAction(user, 'USER_UPDATE', `Kullanıcı güncellendi: ${oldUser.username}`, {
                targetUserId: id,
                changes: body,
            });
        }

        return NextResponse.json({ user: result.rows[0] });
    } catch (error) {
        console.error('User update error:', error);
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

        if (parseInt(id) === user.id) {
            return NextResponse.json({ error: 'Kendinizi silemezsiniz' }, { status: 400 });
        }

        const existing = await query('SELECT username FROM rc_users WHERE id = $1', [id]);
        await query('UPDATE rc_users SET is_deleted = TRUE, is_active = FALSE, updated_at = NOW() WHERE id = $1', [id]);

        await logAdminAction(user, 'USER_DELETE', `Kullanıcı silindi (soft): ${existing.rows[0]?.username}`, {
            targetUserId: id,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('User delete error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
