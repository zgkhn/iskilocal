'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

function applyScale(value, row) {
    let v = value;
    if (row.multiply_factor && row.multiply_factor !== 1) v *= row.multiply_factor;
    if (row.divide_factor && row.divide_factor !== 1 && row.divide_factor !== 0) v /= row.divide_factor;
    if (row.offset_value) v += row.offset_value;
    if (row.decimal_precision !== null && row.decimal_precision !== undefined) {
        v = parseFloat(v.toFixed(row.decimal_precision));
    }
    return v;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function ReportViewPage() {
    const { id } = useParams();
    const [report, setReport] = useState(null);
    const [measurements, setMeasurements] = useState([]);
    const [pagination, setPagination] = useState({});
    const [loading, setLoading] = useState(true);
    const [chartVisible, setChartVisible] = useState(false);
    const [sortBy, setSortBy] = useState('timestamp');
    const [sortOrder, setSortOrder] = useState('DESC');
    const [filters, setFilters] = useState({
        start_date: '', end_date: '', min_value: '', max_value: '', page: 1
    });
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    // Load report
    useEffect(() => {
        fetch('/api/reports').then(r => r.json()).then(d => {
            const rpt = (d.reports || []).find(r => r.id === parseInt(id));
            if (rpt) setReport(rpt);
        });
    }, [id]);

    // Load measurements
    const loadData = useCallback(async () => {
        if (!report?.tag_ids || report.tag_ids.length === 0) { setLoading(false); return; }
        setLoading(true);
        try {
            const tagIds = Array.isArray(report.tag_ids) ? report.tag_ids : JSON.parse(report.tag_ids || '[]');
            const params = new URLSearchParams({
                tag_ids: tagIds.join(','),
                sort_by: sortBy,
                sort_order: sortOrder,
                page: filters.page.toString(),
                limit: '100',
            });
            if (filters.start_date) params.set('start_date', filters.start_date);
            if (filters.end_date) params.set('end_date', filters.end_date);
            if (filters.min_value) params.set('min_value', filters.min_value);
            if (filters.max_value) params.set('max_value', filters.max_value);

            const res = await fetch(`/api/measurements?${params}`);
            const data = await res.json();
            setMeasurements(data.measurements || []);
            setPagination(data.pagination || {});

            // Log report view
            fetch('/api/logs', { method: 'HEAD' }).catch(() => { });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [report, sortBy, sortOrder, filters]);

    useEffect(() => { if (report) loadData(); }, [report, loadData]);

    // Chart rendering
    useEffect(() => {
        if (!chartVisible || !chartRef.current || measurements.length === 0) return;
        if (chartInstance.current) chartInstance.current.destroy();

        const tagGroups = {};
        measurements.forEach(m => {
            if (!tagGroups[m.tag_name]) tagGroups[m.tag_name] = [];
            tagGroups[m.tag_name].push({
                x: new Date(m.timestamp),
                y: applyScale(m.value, m),
            });
        });

        const datasets = Object.entries(tagGroups).map(([name, data], i) => ({
            label: name,
            data: data.sort((a, b) => a.x - b.x),
            borderColor: CHART_COLORS[i % CHART_COLORS.length],
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '20',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 2,
        }));

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        chartInstance.current = new Chart(chartRef.current, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        type: 'time',
                        time: { displayFormats: { hour: 'HH:mm', day: 'dd MMM', month: 'MMM yyyy' } },
                        grid: { color: isDark ? '#334155' : '#e2e8f0' },
                        ticks: { color: isDark ? '#94a3b8' : '#64748b' },
                    },
                    y: {
                        grid: { color: isDark ? '#334155' : '#e2e8f0' },
                        ticks: { color: isDark ? '#94a3b8' : '#64748b' },
                    },
                },
                plugins: { legend: { labels: { color: isDark ? '#f1f5f9' : '#0f172a' } } },
            },
        });

        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [chartVisible, measurements]);

    const handleSort = (col) => {
        if (sortBy === col) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
        else { setSortBy(col); setSortOrder('DESC'); }
    };

    const handleExportExcel = async () => {
        const tagIds = Array.isArray(report.tag_ids) ? report.tag_ids : JSON.parse(report.tag_ids || '[]');
        const res = await fetch('/api/export/excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tag_ids: tagIds, report_name: report.name,
                start_date: filters.start_date || undefined,
                end_date: filters.end_date || undefined,
                min_value: filters.min_value || undefined,
                max_value: filters.max_value || undefined,
            }),
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = async (orientation = 'portrait') => {
        const tagIds = Array.isArray(report.tag_ids) ? report.tag_ids : JSON.parse(report.tag_ids || '[]');
        const res = await fetch('/api/export/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tag_ids: tagIds, report_name: report.name, orientation,
                start_date: filters.start_date || undefined,
                end_date: filters.end_date || undefined,
            }),
        });
        const html = await res.text();
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
    };

    if (!report) return <div className="page-loading"><div className="loading-spinner" /> Rapor yükleniyor...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800 }}>{report.name}</h1>
                    {report.description && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{report.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => setChartVisible(v => !v)}>
                        📈 {chartVisible ? 'Grafiği Gizle' : 'Trend Grafik'}
                    </button>
                    <button className="btn btn-success" onClick={handleExportExcel}>📊 Excel</button>
                    <button className="btn btn-secondary" onClick={() => handleExportPDF('portrait')}>📄 PDF (Dikey)</button>
                    <button className="btn btn-secondary" onClick={() => handleExportPDF('landscape')}>📄 PDF (Yatay)</button>
                </div>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <div className="form-group">
                    <label className="form-label">Başlangıç Tarihi</label>
                    <input type="datetime-local" className="form-input"
                        value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value, page: 1 }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Bitiş Tarihi</label>
                    <input type="datetime-local" className="form-input"
                        value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value, page: 1 }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Min Değer</label>
                    <input type="number" className="form-input" placeholder="Min"
                        value={filters.min_value} onChange={e => setFilters(f => ({ ...f, min_value: e.target.value, page: 1 }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Max Değer</label>
                    <input type="number" className="form-input" placeholder="Max"
                        value={filters.max_value} onChange={e => setFilters(f => ({ ...f, max_value: e.target.value, page: 1 }))} />
                </div>
                <button className="btn btn-primary" onClick={loadData}>🔍 Filtrele</button>
            </div>

            {/* Chart */}
            {chartVisible && (
                <div className="chart-container">
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Trend Grafik</h3>
                    <div style={{ height: 350 }}>
                        <canvas ref={chartRef} />
                    </div>
                </div>
            )}

            {/* Data Table */}
            {loading ? (
                <div className="page-loading"><div className="loading-spinner" /> Veriler yükleniyor...</div>
            ) : (
                <>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('timestamp')} className={sortBy === 'timestamp' ? 'sorted' : ''}>
                                        Tarih/Saat {sortBy === 'timestamp' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
                                    </th>
                                    <th>Tag Adı</th>
                                    <th>Ham Değer</th>
                                    <th onClick={() => handleSort('value')} className={sortBy === 'value' ? 'sorted' : ''}>
                                        İşlenmiş Değer {sortBy === 'value' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
                                    </th>
                                    <th>Birim</th>
                                </tr>
                            </thead>
                            <tbody>
                                {measurements.map((m, i) => {
                                    const scaled = applyScale(m.value, m);
                                    const unit = m.scale_unit || m.tag_unit || '';
                                    return (
                                        <tr key={i}>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {new Date(m.timestamp).toLocaleString('tr-TR')}
                                            </td>
                                            <td><span className="badge badge-info">{m.tag_name}</span></td>
                                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{m.value}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{scaled}</td>
                                            <td>{unit}</td>
                                        </tr>
                                    );
                                })}
                                {measurements.length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                                        Veri bulunamadı
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="pagination">
                            <span>{pagination.total} kayıttan {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} arası</span>
                            <div className="pagination-buttons">
                                <button className="pagination-btn" disabled={pagination.page <= 1}
                                    onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>← Önceki</button>
                                <span className="pagination-btn active">Sayfa {pagination.page}/{pagination.totalPages}</span>
                                <button className="pagination-btn" disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Sonraki →</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
