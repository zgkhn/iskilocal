'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await login(username, password);
        if (!result.success) {
            setError(result.error || 'Giriş başarısız');
        }
        setLoading(false);
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, fontWeight: 800, color: 'white'
                    }}>İM</div>
                    <h1>Rapor İzleme Merkezi</h1>
                    <p className="login-subtitle">Endüstriyel veri raporlama platformu</p>
                </div>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Kullanıcı Adı</label>
                        <input
                            type="text" className="form-input" placeholder="Kullanıcı adınızı girin"
                            value={username} onChange={e => setUsername(e.target.value)}
                            autoFocus required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Şifre</label>
                        <input
                            type="password" className="form-input" placeholder="Şifrenizi girin"
                            value={password} onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    İSKİ Rapor İzleme Merkezi v1.0
                </div>
            </div>
        </div>
    );
}
