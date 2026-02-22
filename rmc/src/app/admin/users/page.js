'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
    const { isAdmin, user: currentUser } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState([]);
    const [allReports, setAllReports] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ username: '', password: '', fullname: '', email: '', role: 'viewer' });
    const [selectedReportIds, setSelectedReportIds] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin) { router.push('/dashboard'); return; }
        Promise.all([
            fetch('/api/users').then(r => r.json()),
            fetch('/api/reports').then(r => r.json()),
        ]).then(([userData, reportData]) => {
            setUsers(userData.users || []);
            setAllReports(reportData.reports || []);
            setLoading(false);
        });
    }, [isAdmin, router]);

    const handleSave = async () => {
        const method = editId ? 'PUT' : 'POST';
        const body = { ...form };
        if (editId) { body.id = editId; if (!body.password) delete body.password; }

        const res = await fetch('/api/users', {
            method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            const userId = editId || data.user?.id;

            // Save report permissions
            if (userId && form.role === 'viewer') {
                await fetch('/api/user-permissions', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, report_ids: selectedReportIds })
                });
            }

            if (editId) {
                setUsers(u => u.map(us => us.id === editId ? { ...us, ...data.user } : us));
            } else {
                setUsers(u => [data.user, ...u]);
            }
            resetForm();
        } else {
            const err = await res.json();
            alert(err.error || 'Hata oluştu');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
        await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
        setUsers(u => u.filter(us => us.id !== id));
    };

    const handleEdit = async (u) => {
        setEditId(u.id);
        setForm({ username: u.username, password: '', fullname: u.fullname || '', email: u.email || '', role: u.role });

        // Load user's current permissions
        if (u.role === 'viewer') {
            try {
                const res = await fetch(`/api/user-permissions?user_id=${u.id}`);
                const data = await res.json();
                setSelectedReportIds(data.report_ids || []);
            } catch {
                setSelectedReportIds([]);
            }
        } else {
            setSelectedReportIds([]);
        }
        setShowModal(true);
    };

    const resetForm = () => {
        setShowModal(false); setEditId(null);
        setForm({ username: '', password: '', fullname: '', email: '', role: 'viewer' });
        setSelectedReportIds([]);
    };

    const toggleReport = (reportId) => {
        setSelectedReportIds(prev =>
            prev.includes(reportId) ? prev.filter(id => id !== reportId) : [...prev, reportId]
        );
    };

    if (loading) return <div className="page-loading"><div className="loading-spinner" /> Yükleniyor...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800 }}>Kullanıcı Yönetimi</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>+ Yeni Kullanıcı</button>
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr><th>Kullanıcı</th><th>Ad Soyad</th><th>E-Posta</th><th>Rol</th><th>Durum</th><th>Kayıt Tarihi</th><th>İşlemler</th></tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id}>
                                <td style={{ fontWeight: 600 }}>{u.username}</td>
                                <td>{u.fullname || '-'}</td>
                                <td>{u.email || '-'}</td>
                                <td>
                                    <span className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-info'}`}>
                                        {u.role === 'admin' ? 'Yönetici' : 'İzleyici'}
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-error'}`}>
                                        {u.is_active ? 'Aktif' : 'Pasif'}
                                    </span>
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>{new Date(u.created_at).toLocaleDateString('tr-TR')}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(u)}>✏️</button>
                                        {u.id !== currentUser?.id && (
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id)}>🗑️</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && resetForm()}>
                    <div className="modal" style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editId ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h3>
                            <button className="modal-close" onClick={resetForm}>×</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Kullanıcı Adı *</label>
                            <input className="form-input" value={form.username} disabled={!!editId}
                                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{editId ? 'Yeni Şifre (boş bırakılırsa değişmez)' : 'Şifre *'}</label>
                            <input type="password" className="form-input" value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Ad Soyad</label>
                                <input className="form-input" value={form.fullname}
                                    onChange={e => setForm(f => ({ ...f, fullname: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">E-Posta</label>
                                <input type="email" className="form-input" value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Rol</label>
                            <select className="form-select" value={form.role}
                                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                <option value="viewer">İzleyici (Viewer)</option>
                                <option value="admin">Yönetici (Admin)</option>
                            </select>
                        </div>

                        {/* Report Permissions - only for viewers */}
                        {form.role === 'viewer' && allReports.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Rapor İzinleri</label>
                                <div style={{
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: 12,
                                    maxHeight: 200,
                                    overflowY: 'auto',
                                    background: 'var(--bg-input)',
                                }}>
                                    {allReports.map(r => (
                                        <label key={r.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '6px 4px', cursor: 'pointer',
                                            borderBottom: '1px solid var(--border-primary)',
                                            fontSize: 13,
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedReportIds.includes(r.id)}
                                                onChange={() => toggleReport(r.id)}
                                                style={{ width: 16, height: 16, accentColor: 'var(--primary-500)' }}
                                            />
                                            <span style={{ fontWeight: 500 }}>{r.name}</span>
                                            {r.plc_name && (
                                                <span style={{ color: 'var(--text-tertiary)', fontSize: 11, marginLeft: 'auto' }}>
                                                    {r.plc_name}
                                                </span>
                                            )}
                                        </label>
                                    ))}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                    {selectedReportIds.length} rapor seçili
                                </div>
                            </div>
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={resetForm}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSave}
                                disabled={!form.username || (!editId && !form.password)}>
                                {editId ? 'Güncelle' : 'Oluştur'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
