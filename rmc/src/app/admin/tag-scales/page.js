'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function TagScalesPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [scales, setScales] = useState([]);
    const [plcs, setPlcs] = useState([]);
    const [tables, setTables] = useState([]);
    const [tags, setTags] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedPlc, setSelectedPlc] = useState('');
    const [selectedTable, setSelectedTable] = useState('');
    const [form, setForm] = useState({
        tag_id: '', multiply_factor: 1, divide_factor: 1,
        offset_value: 0, decimal_precision: 2, unit: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin) { router.push('/dashboard'); return; }
        Promise.all([
            fetch('/api/tag-scales').then(r => r.json()),
            fetch('/api/plcs').then(r => r.json()),
        ]).then(([sc, plc]) => {
            setScales(sc.scales || []);
            setPlcs(plc.plcs || []);
            setLoading(false);
        });
    }, [isAdmin, router]);

    const loadTables = async (plcId) => {
        setSelectedPlc(plcId);
        if (!plcId) { setTables([]); setTags([]); return; }
        const res = await fetch(`/api/tables?plc_id=${plcId}`);
        const data = await res.json();
        setTables(data.tables || []);
    };

    const loadTags = async (tableId) => {
        setSelectedTable(tableId);
        if (!tableId) { setTags([]); return; }
        const res = await fetch(`/api/tags?table_id=${tableId}`);
        const data = await res.json();
        setTags(data.tags || []);
    };

    const handleSave = async () => {
        const body = {
            ...form,
            tag_id: parseInt(form.tag_id),
            multiply_factor: parseFloat(form.multiply_factor),
            divide_factor: parseFloat(form.divide_factor),
            offset_value: parseFloat(form.offset_value),
            decimal_precision: parseInt(form.decimal_precision),
        };
        const res = await fetch('/api/tag-scales', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        if (res.ok) {
            const updated = await fetch('/api/tag-scales').then(r => r.json());
            setScales(updated.scales || []);
            setShowModal(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu scala ayarını silmek istediğinize emin misiniz?')) return;
        await fetch(`/api/tag-scales?id=${id}`, { method: 'DELETE' });
        setScales(s => s.filter(sc => sc.id !== id));
    };

    const preview = (raw = 8754) => {
        let v = raw;
        if (form.multiply_factor != 1) v *= parseFloat(form.multiply_factor) || 1;
        if (form.divide_factor != 1 && form.divide_factor != 0) v /= parseFloat(form.divide_factor) || 1;
        if (form.offset_value) v += parseFloat(form.offset_value) || 0;
        const prec = parseInt(form.decimal_precision) || 2;
        return v.toFixed(prec) + (form.unit ? ` ${form.unit}` : '');
    };

    if (loading) return <div className="page-loading"><div className="loading-spinner" /> Yükleniyor...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800 }}>Tag Scala Yönetimi</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Tag verilerinin ölçeklendirme ayarları</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Yeni Scala</button>
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr><th>Tag</th><th>Çarpım</th><th>Bölüm</th><th>Offset</th><th>Hassasiyet</th><th>Birim</th><th>Önizleme</th><th>İşlem</th></tr>
                    </thead>
                    <tbody>
                        {scales.map(s => {
                            let demo = 8754 * (s.multiply_factor || 1) / (s.divide_factor || 1) + (s.offset_value || 0);
                            demo = demo.toFixed(s.decimal_precision || 2);
                            return (
                                <tr key={s.id}>
                                    <td style={{ fontWeight: 600 }}>{s.tag_name}</td>
                                    <td>×{s.multiply_factor}</td>
                                    <td>÷{s.divide_factor}</td>
                                    <td>+{s.offset_value}</td>
                                    <td>{s.decimal_precision} basamak</td>
                                    <td><span className="badge badge-info">{s.unit || '-'}</span></td>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>8754 → {demo} {s.unit}</td>
                                    <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>🗑️</button></td>
                                </tr>
                            );
                        })}
                        {scales.length === 0 && (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>Henüz scala ayarı yok</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Tag Scala Ayarı</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">PLC</label>
                                <select className="form-select" value={selectedPlc} onChange={e => loadTables(e.target.value)}>
                                    <option value="">-- PLC --</option>
                                    {plcs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tablo</label>
                                <select className="form-select" value={selectedTable} onChange={e => loadTags(e.target.value)}>
                                    <option value="">-- Tablo --</option>
                                    {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tag *</label>
                            <select className="form-select" value={form.tag_id} onChange={e => setForm(f => ({ ...f, tag_id: e.target.value }))}>
                                <option value="">-- Tag Seçin --</option>
                                {tags.map(t => <option key={t.id} value={t.id}>{t.name} ({t.data_type})</option>)}
                            </select>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Çarpma Faktörü</label>
                                <input type="number" step="any" className="form-input" value={form.multiply_factor}
                                    onChange={e => setForm(f => ({ ...f, multiply_factor: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Bölme Faktörü</label>
                                <input type="number" step="any" className="form-input" value={form.divide_factor}
                                    onChange={e => setForm(f => ({ ...f, divide_factor: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Offset</label>
                                <input type="number" step="any" className="form-input" value={form.offset_value}
                                    onChange={e => setForm(f => ({ ...f, offset_value: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ondalık Hassasiyet</label>
                                <input type="number" className="form-input" value={form.decimal_precision}
                                    onChange={e => setForm(f => ({ ...f, decimal_precision: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Birim</label>
                            <input className="form-input" value={form.unit} placeholder="bar, °C, kW, A, vb."
                                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                        </div>

                        <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 'var(--radius-sm)', marginTop: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Önizleme:</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                                Ham: 8754 → İşlenmiş: {preview()}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!form.tag_id}>Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
