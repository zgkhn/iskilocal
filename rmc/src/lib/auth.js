import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'iski-report-center-super-secret-key-2026';
const TOKEN_EXPIRY = '24h';
const COOKIE_NAME = 'rc_auth_token';

export async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

export function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            fullname: user.fullname,
            role: user.role,
            theme_preference: user.theme_preference,
        },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

export async function getAuthUser() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        if (!token) return null;
        return verifyToken(token);
    } catch {
        return null;
    }
}

export function setAuthCookie(token) {
    return {
        name: COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    };
}

export function clearAuthCookie() {
    return {
        name: COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    };
}

export function requireRole(user, requiredRole) {
    if (!user) return false;
    if (requiredRole === 'admin') return user.role === 'admin';
    return true;
}
