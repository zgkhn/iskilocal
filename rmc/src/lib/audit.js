import { query } from './db';

/**
 * Audit log kayıt fonksiyonu
 * @param {Object} params
 * @param {number} params.userId - Kullanıcı ID
 * @param {string} params.username - Kullanıcı adı
 * @param {string} params.actionType - İşlem tipi (LOGIN, LOGOUT, REPORT_VIEW, vb.)
 * @param {string} params.category - Kategori (auth, report, export, admin, ticket, system)
 * @param {string} params.description - Açıklama
 * @param {Object} params.details - Detay JSON
 * @param {string} params.ipAddress - IP adresi
 * @param {string} params.userAgent - Tarayıcı bilgisi
 */
export async function logAudit({
    userId,
    username,
    actionType,
    category = 'system',
    description = '',
    details = {},
    ipAddress = '',
    userAgent = '',
}) {
    try {
        await query(
            `INSERT INTO rc_audit_logs (user_id, username, action_type, category, description, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, username, actionType, category, description, JSON.stringify(details), ipAddress, userAgent]
        );
    } catch (err) {
        console.error('Audit log error:', err);
    }
}

// Yardımcı fonksiyonlar
export async function logLogin(user, ipAddress, userAgent) {
    await logAudit({
        userId: user.id,
        username: user.username,
        actionType: 'LOGIN',
        category: 'auth',
        description: `${user.fullname || user.username} sisteme giriş yaptı`,
        ipAddress,
        userAgent,
    });
}

export async function logFailedLogin(username, ipAddress, userAgent) {
    await logAudit({
        username,
        actionType: 'FAILED_LOGIN',
        category: 'auth',
        description: `Başarısız giriş denemesi: ${username}`,
        ipAddress,
        userAgent,
    });
}

export async function logLogout(user, ipAddress) {
    await logAudit({
        userId: user.id,
        username: user.username,
        actionType: 'LOGOUT',
        category: 'auth',
        description: `${user.fullname || user.username} çıkış yaptı`,
        ipAddress,
    });
}

export async function logReportView(user, reportId, reportName, filters) {
    await logAudit({
        userId: user.id,
        username: user.username,
        actionType: 'REPORT_VIEW',
        category: 'report',
        description: `Rapor görüntülendi: ${reportName}`,
        details: { reportId, filters },
    });
}

export async function logExport(user, exportType, reportName, filters) {
    await logAudit({
        userId: user.id,
        username: user.username,
        actionType: exportType === 'excel' ? 'EXPORT_EXCEL' : 'EXPORT_PDF',
        category: 'export',
        description: `${exportType.toUpperCase()} export: ${reportName}`,
        details: { exportType, reportName, filters },
    });
}

export async function logAdminAction(user, actionType, description, details = {}) {
    await logAudit({
        userId: user.id,
        username: user.username,
        actionType,
        category: 'admin',
        description,
        details,
    });
}

export function getClientInfo(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    return { ip, userAgent };
}
