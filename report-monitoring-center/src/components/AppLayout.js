'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { useTheme } from './ThemeProvider';

const menuItems = [
    { section: 'Ana Menü' },
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Raporlar', href: '/reports', icon: '📋' },
    { section: 'Yönetim', adminOnly: true },
    { label: 'Rapor Oluştur', href: '/admin/reports', icon: '📝', adminOnly: true },
    { label: 'Tag Scala', href: '/admin/tag-scales', icon: '⚙️', adminOnly: true },
    { label: 'Kullanıcılar', href: '/admin/users', icon: '👥', adminOnly: true },
    { label: 'Sistem Logları', href: '/admin/logs', icon: '📜', adminOnly: true },
    { section: 'Destek' },
    { label: 'Destek Talepleri', href: '/support', icon: '🎫' },
];

export default function AppLayout({ children }) {
    const { user, logout, isAdmin } = useAuth();
    const { toggleTheme } = useTheme();
    const pathname = usePathname();
    const router = useRouter();

    if (!user) return children;

    return (
        <div className="app-layout">
            <aside className="sidebar" id="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">İM</div>
                    <div>
                        <div className="sidebar-logo-text">Rapor İzleme</div>
                        <div className="sidebar-logo-sub">Monitoring Center</div>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    {menuItems.map((item, i) => {
                        if (item.adminOnly && !isAdmin) return null;
                        if (item.section) {
                            return <div key={i} className="sidebar-section">{item.section}</div>;
                        }
                        return (
                            <button
                                key={i}
                                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                                onClick={() => router.push(item.href)}
                            >
                                <span className="icon">{item.icon}</span>
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            <div className="main-area">
                <header className="header">
                    <div className="header-left">
                        <button className="mobile-menu-btn" onClick={() => {
                            document.getElementById('sidebar')?.classList.toggle('open');
                        }}>☰</button>
                        <h2 className="header-title">
                            {menuItems.find(m => m.href === pathname)?.label || 'Rapor İzleme Merkezi'}
                        </h2>
                    </div>
                    <div className="header-right">
                        <button className="theme-toggle" onClick={toggleTheme} title="Tema değiştir" />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="user-avatar">{(user.fullname || user.username)[0].toUpperCase()}</div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{user.fullname || user.username}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                    {user.role === 'admin' ? 'Yönetici' : 'İzleyici'}
                                </div>
                            </div>
                        </div>
                        <button className="btn btn-sm btn-secondary" onClick={logout}>Çıkış</button>
                    </div>
                </header>
                <main className="main-content">{children}</main>
            </div>
        </div>
    );
}
