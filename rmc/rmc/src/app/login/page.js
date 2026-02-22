'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Image from 'next/image';
import { ISKI_WHITE_LOGO } from '@/lib/logo-data';


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
            <div className="water-overlay"></div>
            <div className="water-wave"></div>
            <div className="login-card" style={{ position: 'relative', zIndex: 100 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ width: 154, height: 160, margin: '0 auto 16px', position: 'relative' }}>
                        <Image
                            src={ISKI_WHITE_LOGO}
                            alt="İSKİ Logo"
                            fill
                            style={{ objectFit: 'contain' }}
                            priority
                        />
                    </div>
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
                    İSKİ Ömerli Otomasyon
                </div>
            </div>
        </div>
    );
}
