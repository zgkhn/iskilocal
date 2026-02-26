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
    const [selectedTagsFull, setSelectedTagsFull] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', tag_ids: [] });
    // Filters for exploring and adding tags
    const [filterPlc, setFilterPlc] = useState('');
    const [filterTable, setFilterTable] = useState('');
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
        // plc_id and monitoring_table_id are not strictly bound to the report anymore since tags can be mixed. We can pass null.
        const body = { ...form, plc_id: null, monitoring_table_id: null };
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

    const handleEdit = async (report) => {
        setEditId(report.id);
        const tagIds = Array.isArray(report.tag_ids) ? report.tag_ids : JSON.parse(report.tag_ids || '[]');
        setForm({
            name: report.name,
            description: report.description || '',
            tag_ids: tagIds,
        });

        // Reset filters
        setFilterPlc('');
        setFilterTable('');
        setTables([]);
        setTags([]);

        // Fetch full tag info for selected tags
        if (tagIds.length > 0) {
            const res = await fetch(`/api/tags?tag_ids=${tagIds.join(',')}`);
            const data = await res.json();
            setSelectedTagsFull(data.tags || []);
        } else {
            setSelectedTagsFull([]);
        }
        setShowModal(true);
    };

    const resetForm = () => {
        setShowModal(false); setEditId(null);
        setForm({ name: '', description: '', tag_ids: [] });
        setFilterPlc('');
        setFilterTable('');
        setTables([]); setTags([]); setSelectedTagsFull([]);
    };

    const toggleTag = (tag) => {
        const tagId = tag.id;
        const exists = form.tag_ids.includes(tagId);

        setForm(f => ({
            ...f,
            tag_ids: exists ? f.tag_ids.filter(t => t !== tagId) : [...f.tag_ids, tagId]
        }));

        setSelectedTagsFull(prev => {
            if (exists) return prev.filter(t => t.id !== tagId);
            return [...prev, tag];
        });
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
                                <td>{r.plc_name || 'Karma PLC'}</td>
                                <td>{r.table_name || 'Karma Tablo'}</td>
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
                                <label className="form-label">PLC Seçimi (Filtre)</label>
                                <select className="form-select" value={filterPlc} onChange={e => {
                                    setFilterPlc(e.target.value);
                                    setFilterTable('');
                                    loadTables(e.target.value);
                                }}>
                                    <option value="">-- PLC Seçin --</option>
                                    {plcs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.ip_address})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tablo Seçimi (Filtre)</label>
                                <select className="form-select" value={filterTable} onChange={e => {
                                    setFilterTable(e.target.value);
                                    loadTags(e.target.value);
                                }}>
                                    <option value="">-- Tablo Seçin --</option>
                                    {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {tags.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Bu Tablodaki Taglar</label>
                                <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
                                    {tags.map(tag => (
                                        <label key={tag.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                                            cursor: 'pointer', borderRadius: 4, fontSize: 13,
                                            background: form.tag_ids.includes(tag.id) ? 'rgba(59,130,246,0.1)' : 'transparent',
                                        }}>
                                            <input type="checkbox" checked={form.tag_ids.includes(tag.id)} onChange={() => toggleTag(tag)} />
                                            <span style={{ fontWeight: 500 }}>{tag.name}</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({tag.unit || tag.data_type})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedTagsFull.length > 0 && (
                            <div className="form-group" style={{ marginTop: 16 }}>
                                <label className="form-label">Seçilen Tüm Taglar ({selectedTagsFull.length})</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflow: 'auto', padding: 4 }}>
                                    {selectedTagsFull.map(tag => (
                                        <div key={tag.id} title={`${tag.plc_name || ''} > ${tag.table_name || ''}`} style={{
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                                            padding: '4px 10px', borderRadius: 20, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 4 }}>
                                                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1.1 }}>{tag.plc_name || 'PLC'} - {tag.table_name || 'Tablo'}</span>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tag.name}</span>
                                            </div>
                                            <button type="button" onClick={() => toggleTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-tertiary)', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                                        </div>
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
