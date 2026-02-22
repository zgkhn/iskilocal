'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

const TICKET_CATEGORIES = [
    { value: 'general', label: 'Genel' },
    { value: 'bug', label: 'Hata Bildirimi' },
    { value: 'feature', label: 'Özellik İsteği' },
    { value: 'data', label: 'Veri Sorunu' },
    { value: 'access', label: 'Erişim Sorunu' },
];

const STATUS_MAP = {
    open: { label: 'Açık', badge: 'badge-info' },
    in_progress: { label: 'İşlemde', badge: 'badge-warning' },
    resolved: { label: 'Çözüldü', badge: 'badge-success' },
    closed: { label: 'Kapatıldı', badge: 'badge-neutral' },
};

const PRIORITY_MAP = {
    low: { label: 'Düşük', badge: 'badge-neutral' },
    normal: { label: 'Normal', badge: 'badge-info' },
    high: { label: 'Yüksek', badge: 'badge-warning' },
    critical: { label: 'Kritik', badge: 'badge-error' },
};

export default function SupportPage() {
    const { user, isAdmin } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [form, setForm] = useState({ subject: '', category: 'general', priority: 'normal', message: '' });

    useEffect(() => {
        loadTickets();
    }, [statusFilter]);

    const loadTickets = async () => {
        const params = statusFilter ? `?status=${statusFilter}` : '';
        const res = await fetch(`/api/tickets${params}`);
        const data = await res.json();
        setTickets(data.tickets || []);
        setLoading(false);
    };

    const createTicket = async () => {
        const res = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setShowCreate(false);
            setForm({ subject: '', category: 'general', priority: 'normal', message: '' });
            loadTickets();
        }
    };

    const viewTicket = async (ticket) => {
        setSelectedTicket(ticket);
        const res = await fetch('/api/tickets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: ticket.id }),
        });
        const data = await res.json();
        setMessages(data.messages || []);
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        const res = await fetch('/api/tickets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedTicket.id, message: newMessage }),
        });
        const data = await res.json();
        setMessages(data.messages || []);
        setSelectedTicket(data.ticket);
        setNewMessage('');
        loadTickets();
    };

    const changeStatus = async (status) => {
        const res = await fetch('/api/tickets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedTicket.id, status }),
        });
        const data = await res.json();
        setSelectedTicket(data.ticket);
        loadTickets();
    };

    if (loading) return <div className="page-loading"><div className="loading-spinner" /> Yükleniyor...</div>;

    // Ticket detail view
    if (selectedTicket) {
        const st = STATUS_MAP[selectedTicket.status] || STATUS_MAP.open;
        const pr = PRIORITY_MAP[selectedTicket.priority] || PRIORITY_MAP.normal;
        return (
            <div>
                <button className="btn btn-secondary" onClick={() => setSelectedTicket(null)} style={{ marginBottom: 16 }}>
                    ← Geri Dön
                </button>
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <h2 style={{ fontSize: 18, fontWeight: 700 }}>#{selectedTicket.id} – {selectedTicket.subject}</h2>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <span className={`badge ${st.badge}`}>{st.label}</span>
                                <span className={`badge ${pr.badge}`}>{pr.label}</span>
                                <span className="badge badge-neutral">
                                    {TICKET_CATEGORIES.find(c => c.value === selectedTicket.category)?.label}
                                </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                                {selectedTicket.user_fullname || selectedTicket.username} •{' '}
                                {new Date(selectedTicket.created_at).toLocaleString('tr-TR')}
                            </div>
                        </div>
                        {isAdmin && (
                            <div style={{ display: 'flex', gap: 6 }}>
                                {selectedTicket.status !== 'in_progress' && (
                                    <button className="btn btn-sm btn-primary" onClick={() => changeStatus('in_progress')}>İşleme Al</button>
                                )}
                                {selectedTicket.status !== 'resolved' && (
                                    <button className="btn btn-sm btn-success" onClick={() => changeStatus('resolved')}>Çözüldü</button>
                                )}
                                {selectedTicket.status !== 'closed' && (
                                    <button className="btn btn-sm btn-secondary" onClick={() => changeStatus('closed')}>Kapat</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Mesajlar</h3>
                    {messages.length === 0 ? (
                        <div className="empty-state" style={{ padding: 30 }}>
                            <div className="empty-state-text">Henüz mesaj yok</div>
                        </div>
                    ) : (
                        <div className="message-list">
                            {messages.map(m => (
                                <div key={m.id} className={`message-item ${m.is_admin_reply ? 'admin-reply' : ''}`}>
                                    <div className="message-meta">
                                        <strong>{m.fullname || m.username}</strong>
                                        {m.is_admin_reply && ' (Destek)'}
                                        {' • '}
                                        {new Date(m.created_at).toLocaleString('tr-TR')}
                                    </div>
                                    <div className="message-body">{m.message}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedTicket.status !== 'closed' && (
                    <div className="card">
                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <textarea className="form-textarea" placeholder="Mesajınızı yazın..."
                                value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                        </div>
                        <button className="btn btn-primary" onClick={sendMessage} disabled={!newMessage.trim()}>
                            Mesaj Gönder
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Ticket list
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800 }}>Destek Talepleri</h1>
                <div style={{ display: 'flex', gap: 10 }}>
                    <select className="form-select" style={{ width: 'auto' }} value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">Tüm Durumlar</option>
                        {Object.entries(STATUS_MAP).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Yeni Talep</button>
                </div>
            </div>

            {tickets.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🎫</div>
                    <div className="empty-state-text">Henüz destek talebi yok</div>
                </div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr><th>#</th><th>Konu</th><th>Kategori</th><th>Öncelik</th><th>Durum</th>
                                {isAdmin && <th>Kullanıcı</th>}
                                <th>Mesaj</th><th>Tarih</th></tr>
                        </thead>
                        <tbody>
                            {tickets.map(t => {
                                const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                                const pr = PRIORITY_MAP[t.priority] || PRIORITY_MAP.normal;
                                return (
                                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => viewTicket(t)}>
                                        <td style={{ fontWeight: 600 }}>#{t.id}</td>
                                        <td style={{ fontWeight: 500 }}>{t.subject}</td>
                                        <td>{TICKET_CATEGORIES.find(c => c.value === t.category)?.label}</td>
                                        <td><span className={`badge ${pr.badge}`}>{pr.label}</span></td>
                                        <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                                        {isAdmin && <td>{t.user_fullname || t.username}</td>}
                                        <td><span className="badge badge-neutral">{t.message_count || 0}</span></td>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(t.created_at).toLocaleString('tr-TR')}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showCreate && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Yeni Destek Talebi</h3>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Konu *</label>
                            <input className="form-input" value={form.subject} placeholder="Sorununuzu kısaca tanımlayın"
                                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Kategori</label>
                                <select className="form-select" value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                    {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Öncelik</label>
                                <select className="form-select" value={form.priority}
                                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                                    {Object.entries(PRIORITY_MAP).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Mesaj</label>
                            <textarea className="form-textarea" value={form.message} placeholder="Detaylı açıklama..."
                                onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={createTicket} disabled={!form.subject}>Talep Oluştur</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
