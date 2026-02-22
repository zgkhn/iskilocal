'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportsPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const router = useRouter();

    useEffect(() => {
        fetch('/api/reports').then(r => r.json()).then(d => {
            setReports(d.reports || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const filtered = reports.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.plc_name || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="page-loading"><div className="loading-spinner" /> Yükleniyor...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800 }}>Raporlar</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Tüm rapor sayfalarını görüntüleyin</p>
                </div>
                <input
                    type="text" className="form-input" placeholder="Rapor ara..."
                    style={{ maxWidth: 260 }}
                    value={search} onChange={e => setSearch(e.target.value)}
                />
            </div>

            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-text">Henüz rapor sayfası oluşturulmamış</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {filtered.map(report => (
                        <div key={report.id} className="card" style={{ cursor: 'pointer' }}
                            onClick={() => router.push(`/reports/${report.id}`)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700 }}>{report.name}</h3>
                                <span className="badge badge-info">
                                    {Array.isArray(report.tag_ids) ? report.tag_ids.length : 0} Tag
                                </span>
                            </div>
                            {report.description && (
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                    {report.description}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
                                {report.plc_name && <span>📡 {report.plc_name}</span>}
                                {report.table_name && <span>📊 {report.table_name}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                                Oluşturan: {report.created_by_name || '-'} |{' '}
                                {new Date(report.created_at).toLocaleDateString('tr-TR')}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
