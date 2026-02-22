import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';
import AppLayout from '@/components/AppLayout';

export const metadata = {
    title: 'Rapor İzleme Merkezi | İSKİ',
    description: 'Endüstriyel veri raporlama ve izleme platformu',
};

export default function RootLayout({ children }) {
    return (
        <html lang="tr" data-theme="dark">
            <body>
                <ThemeProvider>
                    <AuthProvider>
                        <AppLayout>{children}</AppLayout>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
