'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function AdminReportsPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [reports, setReports] = useState([]);
    const [plcs, setPlcs] = useState([]);
    const [tables, setTables] = useState([]);
    const [tags, setTags] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', plc_id: '', monitoring_table_id: '', tag_ids: [] });
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin) { router.push('/dashboard'); return; }
        Promise.all([
            fetch('/api/reports').then(r => r.json()),
            fetch('/api/plcs').then(r => r.json()),
        ]).then(([rpt, plc]) => {
            setReports(rpt.reports || []);
            setPlcs(plc.plcs || []);
            setLoading(false);
        });
    }, [isAdmin, router]);

    const loadTables = async (plcId) => {
        if (!plcId) { setTables([]); setTags([]); return; }
        const res = await fetch(`/api/tables?plc_id=${plcId}`);
        const data = await res.json();
        setTables(data.tables || []);
    };

    const loadTags = async (tableId) => {
        if (!tableId) { setTags([]); return; }
        const res = await fetch(`/api/tags?table_id=${tableId}`);
        const data = await res.json();
        setTags(data.tags || []);
    };

    const handleSave = async () => {
        const method = editId ? 'PUT' : 'POST';
        const body = { ...form, plc_id: parseInt(form.plc_id) || null, monitoring_table_id: parseInt(form.monitoring_table_id) || null };
        if (editId) body.id = editId;

        const res = await fetch('/api/reports', {
            method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            if (editId) {
                setReports(r => r.map(rp => rp.id === editId ? data.report : rp));
            } else {
                setReports(r => [data.report, ...r]);
            }
            resetForm();
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu rapor sayfasını silmek istediğinize emin misiniz?')) return;
        await fetch(`/api/reports?id=${id}`, { method: 'DELETE' });
        setReports(r => r.filter(rp => rp.id !== id));
    };

    const handleEdit = (report) => {
        setEditId(report.id);
        setForm({
            name: report.name,
            description: report.description || '',
            plc_id: report.plc_id?.toString() || '',
            monitoring_table_id: report.monitoring_table_id?.toString() || '',
            tag_ids: Array.isArray(report.tag_ids) ? report.tag_ids : JSON.parse(report.tag_ids || '[]'),
        });
        if (report.plc_id) loadTables(report.plc_id);
        if (report.monitoring_table_id) loadTags(report.monitoring_table_id);
        setShowModal(true);
    };

    const resetForm = () => {
        setShowModal(false); setEditId(null);
        setForm({ name: '', description: '', plc_id: '', monitoring_table_id: '', tag_ids: [] });
        setTables([]); setTags([]);
    };

    const toggleTag = (tagId) => {
        setForm(f => ({
            ...f,
            tag_ids: f.tag_ids.includes(tagId) ? f.tag_ids.filter(t => t !== tagId) : [...f.tag_ids, tagId]
        }));
    };

    if (loading) return <div className="page-loading"><div className="loading-spinner" /> Yükleniyor...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800 }}>Rapor Sayfası Yönetimi</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>+ Yeni Rapor</button>
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr><th>Rapor Adı</th><th>PLC</th><th>Tablo</th><th>Tag Sayısı</th><th>Tarih</th><th>İşlemler</th></tr>
                    </thead>
                    <tbody>
                        {reports.map(r => (
                            <tr key={r.id}>
                                <td style={{ fontWeight: 600 }}>{r.name}</td>
                                <td>{r.plc_name || '-'}</td>
                                <td>{r.table_name || '-'}</td>
                                <td><span className="badge badge-info">{Array.isArray(r.tag_ids) ? r.tag_ids.length : 0}</span></td>
                                <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(r)}>✏️</button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {reports.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Henüz rapor yok</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && resetForm()}>
                    <div className="modal" style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editId ? 'Rapor Düzenle' : 'Yeni Rapor Sayfası'}</h3>
                            <button className="modal-close" onClick={resetForm}>×</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Rapor Adı *</label>
                            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rapor adını girin" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Açıklama</label>
                            <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Rapor açıklaması" />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">PLC Seçin</label>
                                <select className="form-select" value={form.plc_id} onChange={e => {
                                    setForm(f => ({ ...f, plc_id: e.target.value, monitoring_table_id: '', tag_ids: [] }));
                                    loadTables(e.target.value);
                                }}>
                                    <option value="">-- PLC Seçin --</option>
                                    {plcs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.ip_address})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tablo Seçin</label>
                                <select className="form-select" value={form.monitoring_table_id} onChange={e => {
                                    setForm(f => ({ ...f, monitoring_table_id: e.target.value, tag_ids: [] }));
                                    loadTags(e.target.value);
                                }}>
                                    <option value="">-- Tablo Seçin --</option>
                                    {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {tags.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Tag Seçimi ({form.tag_ids.length} seçili)</label>
                                <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
                                    {tags.map(tag => (
                                        <label key={tag.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                                            cursor: 'pointer', borderRadius: 4, fontSize: 13,
                                            background: form.tag_ids.includes(tag.id) ? 'rgba(59,130,246,0.1)' : 'transparent',
                                        }}>
                                            <input type="checkbox" checked={form.tag_ids.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                                            <span style={{ fontWeight: 500 }}>{tag.name}</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({tag.unit || tag.data_type})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={resetForm}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!form.name}>
                                {editId ? 'Güncelle' : 'Oluştur'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
