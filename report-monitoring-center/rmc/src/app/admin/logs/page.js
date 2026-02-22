'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
    { value: '', label: 'Tümü' },
    { value: 'auth', label: 'Kimlik Doğrulama' },
    { value: 'report', label: 'Rapor' },
    { value: 'export', label: 'Export' },
    { value: 'admin', label: 'Yönetim' },
    { value: 'ticket', label: 'Destek' },
    { value: 'system', label: 'Sistem' },
];

export default function LogsPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedLog, setExpandedLog] = useState(null);
    const [filters, setFilters] = useState({
        category: '', action_type: '', start_date: '', end_date: '', page: 1
    });

    useEffect(() => {
        if (!isAdmin) { router.push('/dashboard'); return; }
        loadLogs();
    }, [isAdmin, router, filters]);

    const loadLogs = async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: filters.page.toString(), limit: '50' });
        if (filters.category) params.set('category', filters.category);
        if (filters.action_type) params.set('action_type', filters.action_type);
        if (filters.start_date) params.set('start_date', filters.start_date);
        if (filters.end_date) params.set('end_date', filters.end_date);

        try {
            const res = await fetch(`/api/logs?${params}`);
            const data = await res.json();
            setLogs(data.logs || []);
            setPagination(data.pagination || {});
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const getCategoryBadge = (cat) => {
        const map = { auth: 'badge-info', report: 'badge-success', export: 'badge-warning', admin: 'badge-error', ticket: 'badge-neutral' };
        return map[cat] || 'badge-neutral';
    };

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800 }}>Sistem Logları</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Audit trail ve sistem aktiviteleri</p>
            </div>

            <div className="filter-bar">
                <div className="form-group">
                    <label className="form-label">Kategori</label>
                    <select className="form-select" value={filters.category}
                        onChange={e => setFilters(f => ({ ...f, category: e.target.value, page: 1 }))}>
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Başlangıç</label>
                    <input type="datetime-local" className="form-input" value={filters.start_date}
                        onChange={e => setFilters(f => ({ ...f, start_date: e.target.value, page: 1 }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Bitiş</label>
                    <input type="datetime-local" className="form-input" value={filters.end_date}
                        onChange={e => setFilters(f => ({ ...f, end_date: e.target.value, page: 1 }))} />
                </div>
            </div>

            {loading ? (
                <div className="page-loading"><div className="loading-spinner" /> Yükleniyor...</div>
            ) : (
                <>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr><th>Tarih</th><th>Kullanıcı</th><th>Kategori</th><th>İşlem</th><th>Açıklama</th><th>IP</th><th>Detay</th></tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <>
                                        <tr key={log.id}>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                                                {new Date(log.created_at).toLocaleString('tr-TR')}
                                            </td>
                                            <td>{log.user_fullname || log.username || '-'}</td>
                                            <td><span className={`badge ${getCategoryBadge(log.category)}`}>{log.category}</span></td>
                                            <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{log.action_type}</span></td>
                                            <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {log.description}
                                            </td>
                                            <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{log.ip_address || '-'}</td>
                                            <td>
                                                {log.details && Object.keys(log.details).length > 0 && (
                                                    <button className="btn btn-sm btn-secondary"
                                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                                                        {expandedLog === log.id ? '▲' : '▼'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedLog === log.id && (
                                            <tr key={`${log.id}-detail`}>
                                                <td colSpan={7}>
                                                    <div className="log-details">
                                                        {JSON.stringify(log.details, null, 2)}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                                {logs.length === 0 && (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Log bulunamadı</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {pagination.totalPages > 1 && (
                        <div className="pagination">
                            <span>{pagination.total} toplam kayıt</span>
                            <div className="pagination-buttons">
                                <button className="pagination-btn" disabled={pagination.page <= 1}
                                    onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>← Önceki</button>
                                <span className="pagination-btn active">Sayfa {pagination.page}/{pagination.totalPages}</span>
                                <button className="pagination-btn" disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Sonraki →</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
