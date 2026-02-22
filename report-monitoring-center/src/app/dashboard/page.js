'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function DashboardPage() {
    const { user, isAdmin } = useAuth();
    const [stats, setStats] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [plcRes, reportsRes] = await Promise.all([
                    fetch('/api/plcs'),
                    fetch('/api/reports'),
                ]);
                const plcData = await plcRes.json();
                const reportsData = await reportsRes.json();

                setStats({
                    plcCount: plcData.plcs?.length || 0,
                    reportCount: reportsData.reports?.length || 0,
                });

                if (isAdmin) {
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
                        <div className="stat-value">{user?.role === 'admin' ? 'Yönetici' : 'İzleyici'}</div>
                        <div className="stat-label">Rol</div>
                    </div>
                </div>
            </div>

            {isAdmin && recentLogs.length > 0 && (
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
