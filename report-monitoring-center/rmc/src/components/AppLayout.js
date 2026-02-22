'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { useTheme } from './ThemeProvider';
import Image from 'next/image';

const adminMenuItems = [
    { section: 'Ana Menü' },
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Raporlar', href: '/reports', icon: '📋' },
    { section: 'Yönetim' },
    { label: 'Rapor Oluştur', href: '/admin/reports', icon: '📝' },
    { label: 'Tag Scala', href: '/admin/tag-scales', icon: '⚙️' },
    { label: 'Kullanıcılar', href: '/admin/users', icon: '👥' },
    { label: 'Sistem Logları', href: '/admin/logs', icon: '📜' },
    { section: 'Destek' },
    { label: 'Destek Talepleri', href: '/support', icon: '🎫' },
];

export default function AppLayout({ children }) {
    const { user, logout, isAdmin } = useAuth();
    const { toggleTheme } = useTheme();
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [viewerReports, setViewerReports] = useState([]);

    // Fetch permitted reports for viewer sidebar
    useEffect(() => {
        if (user && !isAdmin) {
            fetch('/api/reports')
                .then(r => r.json())
                .then(d => setViewerReports(d.reports || []))
                .catch(() => { });
        }
    }, [user, isAdmin]);

    if (!user) return children;

    // Build viewer menu from permitted reports
    const viewerMenuItems = [
        { section: 'Raporlarım' },
        ...viewerReports.map(r => ({
            label: r.name,
            href: `/reports/${r.id}`,
            icon: '📋',
        })),
        { section: 'Destek' },
        { label: 'Destek Talepleri', href: '/support', icon: '🎫' },
    ];

    const menuItems = isAdmin ? adminMenuItems : viewerMenuItems;

    // Find current page title
    const currentTitle = menuItems.find(m => m.href === pathname)?.label || 'Rapor İzleme Merkezi';

    return (
        <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
            <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} id="sidebar">
                <div className="sidebar-logo">
                    <Image
                        src="/logo-iski.png"
                        alt="İSKİ Logo"
                        width={collapsed ? 32 : 40}
                        height={collapsed ? 32 : 40}
                        className="sidebar-logo-img"
                        style={{ borderRadius: 8, objectFit: 'contain' }}
                    />
                    {!collapsed && (
                        <div>
                            <div className="sidebar-logo-text">Rapor İzleme</div>
                            <div className="sidebar-logo-sub">Monitoring Center</div>
                        </div>
                    )}
                </div>
                <button
                    className="sidebar-toggle"
                    onClick={() => setCollapsed(c => !c)}
                    title={collapsed ? 'Menüyü Aç' : 'Menüyü Kapat'}
                >
                    {collapsed ? '»' : '«'}
                </button>
                <nav className="sidebar-nav">
                    {menuItems.map((item, i) => {
                        if (item.section) {
                            if (collapsed) return null;
                            return <div key={i} className="sidebar-section">{item.section}</div>;
                        }
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                            <button
                                key={i}
                                className={`sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={() => {
                                    router.push(item.href);
                                    // Close mobile menu if open
                                    document.getElementById('sidebar')?.classList.remove('open');
                                }}
                                title={collapsed ? item.label : ''}
                            >
                                <span className="icon">{item.icon}</span>
                                {!collapsed && <span className="sidebar-label">{item.label}</span>}
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
                        <h2 className="header-title">{currentTitle}</h2>
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
