'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const reportsRes = await fetch('/api/reports');
                const reportsData = await reportsRes.json();
                setReports(reportsData.reports || []);

                if (isAdmin) {
                    const plcRes = await fetch('/api/plcs');
                    const plcData = await plcRes.json();
                    setStats({
                        plcCount: plcData.plcs?.length || 0,
                        reportCount: reportsData.reports?.length || 0,
                    });
                    const logsRes = await fetch('/api/logs?limit=10');
                    const logsData = await logsRes.json();
                    setRecentLogs(logsData.logs || []);
                }
            } catch (err) {
                console.error('Dashboard load error:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [isAdmin]);

    if (loading) {
        return <div className="page-loading"><div className="loading-spinner" /> Yükleniyor...</div>;
    }

    // ---- VIEWER DASHBOARD ----
    if (!isAdmin) {
        return (
            <div>
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800 }}>Hoş Geldiniz, {user?.fullname || user?.username}</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                        İzniniz olan raporlar aşağıda listelenmektedir.
                    </p>
                </div>

                {reports.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔒</div>
                        <div className="empty-state-text">Henüz size atanmış rapor bulunmamaktadır.</div>
                        <p style={{ color: 'var(--text-tertiary)', marginTop: 8, fontSize: 13 }}>
                            Rapor erişimi için yöneticinize başvurunuz.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                        {reports.map(r => {
                            const tagCount = Array.isArray(r.tag_ids)
                                ? r.tag_ids.length
                                : JSON.parse(r.tag_ids || '[]').length;
                            return (
                                <div key={r.id} className="card" style={{ cursor: 'pointer', transition: 'var(--transition)' }}
                                    onClick={() => router.push(`/reports/${r.id}`)}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                        <div className="stat-icon blue">📋</div>
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</div>
                                            {r.plc_name && (
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>PLC: {r.plc_name}</div>
                                            )}
                                        </div>
                                    </div>
                                    {r.description && (
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                                            {r.description}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <span className="badge badge-info">{tagCount} Tag</span>
                                        {r.table_name && <span className="badge badge-neutral">{r.table_name}</span>}
                                    </div>
                                    <div style={{ marginTop: 12, textAlign: 'right' }}>
                                        <span style={{ fontSize: 12, color: 'var(--primary-500)', fontWeight: 600 }}>
                                            Raporu Aç →
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ---- ADMIN DASHBOARD ----
    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Hoş Geldiniz, {user?.fullname || user?.username}</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                    Rapor İzleme Merkezi kontrol paneli
                </p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon blue">📡</div>
                    <div>
                        <div className="stat-value">{stats?.plcCount || 0}</div>
                        <div className="stat-label">Toplam PLC</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green">📋</div>
                    <div>
                        <div className="stat-value">{stats?.reportCount || 0}</div>
                        <div className="stat-label">Rapor Sayfası</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon purple">👤</div>
                    <div>
                        <div className="stat-value">Yönetici</div>
                        <div className="stat-label">Rol</div>
                    </div>
                </div>
            </div>

            {recentLogs.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Son İşlemler</div>
                            <div className="card-subtitle">Son 10 sistem aktivitesi</div>
                        </div>
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Kullanıcı</th>
                                    <th>İşlem</th>
                                    <th>Açıklama</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentLogs.map(log => (
                                    <tr key={log.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {new Date(log.created_at).toLocaleString('tr-TR')}
                                        </td>
                                        <td>{log.user_fullname || log.username || '-'}</td>
                                        <td><span className="badge badge-info">{log.action_type}</span></td>
                                        <td>{log.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
