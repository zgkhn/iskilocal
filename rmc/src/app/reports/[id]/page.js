'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { applyScaleMath, formatNumber, formatScaledValue } from '@/lib/scaling';

Chart.register(...registerables);

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const SETTINGS_KEY = 'rmc_table_settings';

export default function ReportViewPage() {
    const { id } = useParams();
    const [report, setReport] = useState(null);
    const [measurements, setMeasurements] = useState([]);
    const [pagination, setPagination] = useState({});
    const [loading, setLoading] = useState(true);
    const [chartVisible, setChartVisible] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [tooltip, setTooltip] = useState({ visible: false, content: '', x: 0, y: 0, tagName: '' });
    const tooltipTimer = useRef(null);

    // Default Settings
    const defaultSettings = {
        fontSize: 13,
        headerFontSize: 13,
        rowPad: 10,
        colPad: 14,
        align: 'left',
        pageLimit: 100,
        visibleTags: [], // all visible if empty
        tagOrder: [],
        colorAlerts: {}
    };

    const [tableSettings, setTableSettings] = useState(defaultSettings);
    const [showSettings, setShowSettings] = useState(false);

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('pdf'); // 'pdf' or 'excel'
    const [pdfOrientation, setPdfOrientation] = useState('landscape'); // 'portrait' or 'landscape'
    const [isExporting, setIsExporting] = useState(false);

    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Auto-dismiss success popup
    useEffect(() => {
        if (showSuccessPopup) {
            const timer = setTimeout(() => setShowSuccessPopup(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showSuccessPopup]);

    // Draggable popup state
    const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
    const dragRef = useRef(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    const [sortBy, setSortBy] = useState('timestamp');
    const [sortOrder, setSortOrder] = useState('DESC');
    const [filters, setFilters] = useState({
        start_date: '', end_date: '', min_value: '', max_value: '', page: 1, interval: ''
    });

    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    // Initial positioning of settings popup
    useEffect(() => {
        setPopupPos({ x: window.innerWidth - 420, y: 80 });

        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            try { setTableSettings(JSON.parse(saved)); } catch (e) { }
        }
    }, []);

    // Load report and settings
    useEffect(() => {
        fetch('/api/reports').then(r => r.json()).then(d => {
            const rpt = (d.reports || []).find(r => r.id === parseInt(id));
            if (rpt) {
                setReport(rpt);

                // Fetch user-specific settings for this report
                fetch(`/api/user-report-settings?report_id=${id}`)
                    .then(res => res.json())
                    .then(userSettings => {
                        if (userSettings.config) {
                            setTableSettings(prev => ({ ...prev, ...userSettings.config }));
                        } else if (rpt.config) {
                            // Fallback to report global config
                            setTableSettings(prev => ({ ...prev, ...rpt.config }));
                        }
                    });
            }
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
                limit: (tableSettings.pageLimit || 100).toString(),
            });
            if (filters.start_date) params.set('start_date', filters.start_date);
            if (filters.end_date) params.set('end_date', filters.end_date);
            if (filters.min_value) params.set('min_value', filters.min_value);
            if (filters.max_value) params.set('max_value', filters.max_value);
            if (filters.interval) params.set('interval', filters.interval);

            const res = await fetch(`/api/measurements?${params}`);
            const data = await res.json();
            setMeasurements(data.measurements || []);
            setPagination(data.pagination || {});

            fetch('/api/logs', { method: 'HEAD' }).catch(() => { });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [report, sortBy, sortOrder, filters, tableSettings.pageLimit]);

    useEffect(() => { if (report) loadData(); }, [report, loadData]);

    const updateSetting = (key, val) => {
        setTableSettings(prev => {
            const next = { ...prev, [key]: val };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
            return next;
        });
    };

    // Chart rendering
    useEffect(() => {
        if (!chartVisible || !chartRef.current || measurements.length === 0) return;
        if (chartInstance.current) chartInstance.current.destroy();

        const tagGroups = {};
        measurements.forEach(m => {
            if (!tagGroups[m.tag_name]) tagGroups[m.tag_name] = [];
            tagGroups[m.tag_name].push({
                x: new Date(m.timestamp),
                y: applyScaleMath(m.value, m),
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

    // Tooltip Handlers
    const handleMouseEnter = (e, tagName) => {
        const desc = tagDescriptions[tagName];
        if (!desc) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = rect.left + window.scrollX;
        const y = rect.bottom + window.scrollY + 5;

        tooltipTimer.current = setTimeout(() => {
            setTooltip({ visible: true, content: desc, x, y, tagName });
        }, 2000);
    };

    const handleMouseLeave = () => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        setTooltip(prev => ({ ...prev, visible: false }));
    };

    // Pivot Data Logic
    const { pivotRows, allTagNames, tagDescriptions } = useMemo(() => {
        const rowMap = {};
        const nameSet = new Set();
        const descMap = {};

        measurements.forEach(m => {
            nameSet.add(m.tag_name);
            if (m.description) descMap[m.tag_name] = m.description;
            const ts = new Date(m.timestamp).toLocaleString('tr-TR');
            if (!rowMap[ts]) {
                rowMap[ts] = { timestamp: ts, rawTimestamp: new Date(m.timestamp) };
            }
            const scaledNum = applyScaleMath(m.value, m);
            const formatted = formatNumber(scaledNum, m);
            const unit = m.scale_unit || m.tag_unit || '';
            rowMap[ts][m.tag_name] = formatted + (unit ? ` ${unit}` : '');
            rowMap[ts][m.tag_name + '_raw'] = scaledNum;
        });

        const rows = Object.values(rowMap).sort((a, b) => {
            if (sortOrder === 'ASC') return a.rawTimestamp - b.rawTimestamp;
            return b.rawTimestamp - a.rawTimestamp;
        });

        return { pivotRows: rows, allTagNames: [...nameSet], tagDescriptions: descMap };
    }, [measurements, sortOrder]);

    const handleToggleTag = (name) => {
        const current = tableSettings.visibleTags && tableSettings.visibleTags.length > 0 ? tableSettings.visibleTags : [...allTagNames];
        const next = current.includes(name) ? current.filter(n => n !== name) : [...current, name];
        updateSetting('visibleTags', next.length === allTagNames.length ? [] : next);
    };

    const moveTag = (idx, dir) => {
        const currentOrder = tableSettings.tagOrder && tableSettings.tagOrder.length > 0 ? [...tableSettings.tagOrder] : [...allTagNames];
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= currentOrder.length) return;

        const temp = currentOrder[idx];
        currentOrder[idx] = currentOrder[newIdx];
        currentOrder[newIdx] = temp;

        // Ensure all tags exist in order
        const finalOrder = [...new Set([...currentOrder, ...allTagNames])];
        updateSetting('tagOrder', finalOrder);
    };

    const handleClearTagAlert = (tagName) => {
        const newAlerts = { ...tableSettings.colorAlerts };
        delete newAlerts[tagName];
        updateSetting('colorAlerts', newAlerts);
    };

    const handleResetAlerts = () => {
        if (confirm('Tüm renkli uyarıları sıfırlamak istiyor musunuz?')) {
            updateSetting('colorAlerts', {});
        }
    };

    const handleSaveConfig = async () => {
        try {
            const res = await fetch('/api/user-report-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report_id: id, config: tableSettings }),
            });
            if (res.ok) {
                setSuccessMessage('Ayarlarınız başarıyla kaydedildi!');
                setShowSuccessPopup(true);
            } else {
                alert('Ayarlar kaydedilemedi.');
            }
        } catch (err) {
            console.error(err);
            alert('Kaydetme hatası.');
        }
    };

    const handleExport = async (format, action = 'download') => {
        setIsExporting(true);
        try {
            // Fetch all filtered data across all pages (max 50000)
            const tagIds = Array.isArray(report.tag_ids) ? report.tag_ids : JSON.parse(report.tag_ids || '[]');
            const params = new URLSearchParams({
                tag_ids: tagIds.join(','),
                sort_by: sortBy,
                sort_order: sortOrder,
                page: '1',
                limit: '50000',
            });
            if (filters.start_date) params.set('start_date', filters.start_date);
            if (filters.end_date) params.set('end_date', filters.end_date);
            if (filters.min_value) params.set('min_value', filters.min_value);
            if (filters.max_value) params.set('max_value', filters.max_value);
            if (filters.interval) params.set('interval', filters.interval);

            const resMeasurements = await fetch(`/api/measurements?${params}`);
            const dataMeasurements = await resMeasurements.json();
            const exportMeasurements = dataMeasurements.measurements || [];

            // Pivot the full dataset identically to the current UI view
            const rowMap = {};
            exportMeasurements.forEach(m => {
                const ts = new Date(m.timestamp).toLocaleString('tr-TR');
                if (!rowMap[ts]) {
                    rowMap[ts] = { timestamp: ts, rawTimestamp: new Date(m.timestamp) };
                }
                const scaledNum = applyScaleMath(m.value, m);
                const formatted = formatNumber(scaledNum, m);
                const unit = m.scale_unit || m.tag_unit || '';
                rowMap[ts][m.tag_name] = formatted + (unit ? ` ${unit}` : '');
                rowMap[ts][m.tag_name + '_raw'] = scaledNum;
            });

            const exportRows = Object.values(rowMap).sort((a, b) => {
                if (sortOrder === 'ASC') return a.rawTimestamp - b.rawTimestamp;
                return b.rawTimestamp - a.rawTimestamp;
            });

            const payload = {
                report_name: report.name,
                format: format,
                action: action,
                scope: 'filtered',
                orientation: pdfOrientation,
                tag_ids: report.tag_ids,
                start_date: filters.start_date,
                end_date: filters.end_date,
                min_value: filters.min_value,
                max_value: filters.max_value,
            };
            payload.columns = orderedTagNames;
            payload.rows = exportRows;
            payload.colorAlerts = tableSettings.colorAlerts;
            payload.headerFontSize = tableSettings.headerFontSize;

            const res = await fetch(`/api/export/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Export failed');

            if (format === 'pdf' && action === 'print') {
                // PDF route actually returns a printable HTML page
                const data = await res.json();
                const htmlText = data.html;

                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(htmlText);
                    printWindow.document.close();
                    // Give browser a moment to parse before triggering print
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
                } else {
                    alert('Pop-up engelleyici açık olabilir. Lütfen izin verin.');
                }
            } else {
                // Excel OR PDF Download return a binary blob directly from server now!
                // Fix for corrupt PDF: Always use arrayBuffer and create typed blob
                const arrayBuffer = await res.arrayBuffer();
                const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                const blob = new Blob([arrayBuffer], { type: mimeType });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `rapor_${report.id}_${new Date().getTime()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            }

            setShowExportModal(false);
        } catch (error) {
            console.error('Export error:', error);
            alert('Dışa aktarma sırasında bir hata oluştu.');
        } finally {
            setIsExporting(false);
        }
    };

    const orderedTagNames = useMemo(() => {
        let base = tableSettings.tagOrder && tableSettings.tagOrder.length > 0 ? tableSettings.tagOrder : allTagNames;
        // Include any new tags not in order list
        const missing = allTagNames.filter(n => !base.includes(n));
        const allSorted = [...base.filter(n => allTagNames.includes(n)), ...missing];

        // Filter by visibility
        if (tableSettings.visibleTags && tableSettings.visibleTags.length > 0) {
            return allSorted.filter(t => tableSettings.visibleTags.includes(t));
        }
        return allSorted;
    }, [allTagNames, tableSettings.tagOrder, tableSettings.visibleTags]);

    if (!report) return <div className="page-loading"><div className="loading-spinner" /> Rapor yükleniyor...</div>;

    return (
        <div className={isFullScreen ? 'full-screen-mode' : ''}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800 }}>{report.name}</h1>
                    {report.description && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{report.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>
                        📥 Dışa Aktar
                    </button>
                    <button className="btn btn-primary" onClick={() => setChartVisible(v => !v)}>
                        📈 {chartVisible ? 'Grafiği Gizle' : 'Trend Grafik'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)}>⚙️ Tablo Ayarları</button>
                    <button className="btn btn-secondary" onClick={() => setIsFullScreen(f => !f)}>
                        {isFullScreen ? '↙️ Çıkış' : '⛶ Tam Ekran'}
                    </button>
                </div>
            </div>

            {/* Export Options Modal */}
            {showExportModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)',
                        width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-xl)',
                        border: '1px solid var(--border-primary)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📥 Dışa Aktar</h3>
                            <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}>✖</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Dosya Formatı</label>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                        <input type="radio" name="format" value="pdf" checked={exportFormat === 'pdf'} onChange={e => setExportFormat(e.target.value)} /> PDF
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                        <input type="radio" name="format" value="excel" checked={exportFormat === 'excel'} onChange={e => setExportFormat(e.target.value)} /> Excel
                                    </label>
                                </div>
                            </div>



                            {exportFormat === 'pdf' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Sayfa Yönü (PDF)</label>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                            <input type="radio" name="orientation" value="landscape" checked={pdfOrientation === 'landscape'} onChange={e => setPdfOrientation(e.target.value)} /> Yatay (Tavsiye Edilen)
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                            <input type="radio" name="orientation" value="portrait" checked={pdfOrientation === 'portrait'} onChange={e => setPdfOrientation(e.target.value)} /> Dikey
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>İptal</button>
                                {exportFormat === 'pdf' && (
                                    <button className="btn btn-secondary" onClick={() => handleExport('pdf', 'print')} disabled={isExporting}>
                                        🖨️ Yazdır
                                    </button>
                                )}
                                <button className="btn btn-primary" onClick={() => handleExport(exportFormat, 'download')} disabled={isExporting}>
                                    {isExporting ? 'İşleniyor...' : 'İndir'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Draggable Settings Popup */}
            {showSettings && (
                <div ref={dragRef} style={{
                    position: 'fixed', left: popupPos.x, top: popupPos.y, zIndex: 9999,
                    width: 380, maxHeight: '80vh', overflowY: 'auto',
                    background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-xl)',
                }}>
                    <div
                        style={{ padding: '10px 16px', cursor: 'grab', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}
                        onMouseDown={e => {
                            dragOffset.current = { x: e.clientX - popupPos.x, y: e.clientY - popupPos.y };
                            const onMove = ev => setPopupPos({ x: ev.clientX - dragOffset.current.x, y: ev.clientY - dragOffset.current.y });
                            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                            document.addEventListener('mousemove', onMove);
                            document.addEventListener('mouseup', onUp);
                        }}
                    >
                        <span style={{ fontSize: 13, fontWeight: 700 }}>⚙️ Tablo Ayarları</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setTableSettings(defaultSettings); try { localStorage.removeItem(SETTINGS_KEY); } catch { } }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }} title="Sıfırla">🔄</button>
                            <button onClick={() => setShowSettings(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}>✖</button>
                        </div>
                    </div>
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                                    Sayfadaki Satır Sayısı: {tableSettings.pageLimit || 100}
                                </label>
                                <select className="form-input" style={{ width: '100%', padding: '4px 8px', fontSize: 13 }}
                                    value={tableSettings.pageLimit || 100}
                                    onChange={e => updateSetting('pageLimit', parseInt(e.target.value))}>
                                    <option value={20}>20 Satır</option>
                                    <option value={50}>50 Satır</option>
                                    <option value={100}>100 Satır</option>
                                    <option value={250}>250 Satır</option>
                                    <option value={500}>500 Satır</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                                    Hücre Yazı Boyutu: {tableSettings.fontSize}px
                                </label>
                                <input type="range" min="9" max="22" value={tableSettings.fontSize}
                                    onChange={e => updateSetting('fontSize', parseInt(e.target.value))}
                                    style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                                    Başlık Yazı Boyutu: {tableSettings.headerFontSize}px
                                </label>
                                <input type="range" min="9" max="22" value={tableSettings.headerFontSize}
                                    onChange={e => updateSetting('headerFontSize', parseInt(e.target.value))}
                                    style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                                    Satır Aralığı (Padding): {tableSettings.rowPad}px
                                </label>
                                <input type="range" min="2" max="24" value={tableSettings.rowPad}
                                    onChange={e => updateSetting('rowPad', parseInt(e.target.value))}
                                    style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                                    Sütun Aralığı (Padding): {tableSettings.colPad}px
                                </label>
                                <input type="range" min="4" max="32" value={tableSettings.colPad}
                                    onChange={e => updateSetting('colPad', parseInt(e.target.value))}
                                    style={{ width: '100%' }} />
                            </div>
                        </div>
                        {allTagNames.length > 0 && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Tag Sütunları (Gizle / Göster / Sırala)</div>
                                </div>
                                <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', padding: 6, maxHeight: 300, overflowY: 'auto', background: 'var(--bg-input)' }}>
                                    {(tableSettings.tagOrder && tableSettings.tagOrder.length > 0
                                        ? tableSettings.tagOrder.filter(n => allTagNames.includes(n)).concat(allTagNames.filter(n => !(tableSettings.tagOrder || []).includes(n)))
                                        : allTagNames
                                    ).map((name, idxOrFake) => {
                                        const idx = (tableSettings.tagOrder || []).indexOf(name);
                                        const isVisible = !tableSettings.visibleTags || tableSettings.visibleTags.length === 0 || tableSettings.visibleTags.includes(name);
                                        const alerts = tableSettings.colorAlerts?.[name] || { min: '', max: '', minColor: '#3b82f6', maxColor: '#ef4444' };

                                        const updateAlert = (k, v) => {
                                            const nextAlerts = { ...tableSettings.colorAlerts, [name]: { ...alerts, [k]: v } };
                                            updateSetting('colorAlerts', nextAlerts);
                                        };

                                        return (
                                            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 4px', borderBottom: '1px solid var(--border-primary)', opacity: isVisible ? 1 : 0.4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                                    <input type="checkbox" checked={isVisible} onChange={() => handleToggleTag(name)} style={{ accentColor: 'var(--primary-500)' }} />
                                                    <span style={{ flex: 1, fontWeight: 700 }}>{name}</span>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button onClick={() => moveTag(idx !== -1 ? idx : allTagNames.indexOf(name), -1)} disabled={(idx !== -1 ? idx : allTagNames.indexOf(name)) === 0}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>▲</button>
                                                        <button onClick={() => moveTag(idx !== -1 ? idx : allTagNames.indexOf(name), 1)} disabled={(idx !== -1 ? idx : allTagNames.indexOf(name)) === (tableSettings.tagOrder?.length || allTagNames.length) - 1}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>▼</button>
                                                    </div>
                                                </div>
                                                {isVisible && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Alt:</span>
                                                            <input type="number" step="any" placeholder="Min" value={alerts.min} onChange={e => updateAlert('min', e.target.value)}
                                                                style={{ width: 50, fontSize: 10, padding: 2, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
                                                            <input type="color" value={alerts.minColor} onChange={e => updateAlert('minColor', e.target.value)}
                                                                style={{ width: 14, height: 14, padding: 0, border: 'none', cursor: 'pointer' }} />
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Üst:</span>
                                                            <input type="number" step="any" placeholder="Max" value={alerts.max} onChange={e => updateAlert('max', e.target.value)}
                                                                style={{ width: 50, fontSize: 10, padding: 2, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
                                                            <input type="color" value={alerts.maxColor} onChange={e => updateAlert('maxColor', e.target.value)}
                                                                style={{ width: 14, height: 14, padding: 0, border: 'none', cursor: 'pointer' }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={handleSaveConfig} style={{ width: '100%', marginTop: 12 }}>
                                    💾 Ayarları Rapor Şablonuna Kaydet
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filter-bar">
                <div className="form-group" style={{ minWidth: 150 }}>
                    <label className="form-label">Veri Aralığı</label>
                    <select className="form-select" value={filters.interval} onChange={e => setFilters(f => ({ ...f, interval: e.target.value, page: 1 }))}>
                        <option value="">Tümü (Ham Veri)</option>
                        <option value="5min">5 Dakika</option>
                        <option value="15min">15 Dakika</option>
                        <option value="30min">30 Dakika</option>
                        <option value="1hour">1 Saat</option>
                        <option value="2hour">2 Saat</option>
                        <option value="6hour">6 Saat</option>
                        <option value="1day">1 Gün</option>
                    </select>
                </div>
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
                    <input type="number" step="any" className="form-input" placeholder="Min"
                        value={filters.min_value} onChange={e => setFilters(f => ({ ...f, min_value: e.target.value, page: 1 }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Max Değer</label>
                    <input type="number" step="any" className="form-input" placeholder="Max"
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
                    <div className="data-table-wrapper" style={{ overflowX: 'auto', display: 'flex', justifyContent: tableSettings.align === 'center' ? 'center' : 'flex-start' }}>
                        <table className="data-table" style={{ fontSize: tableSettings.fontSize, width: 'auto', minWidth: 'auto', margin: 0 }}>
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('timestamp')} className={`sticky-col ${sortBy === 'timestamp' ? 'sorted' : ''}`}
                                        style={{
                                            padding: `${tableSettings.rowPad}px ${tableSettings.colPad}px`,
                                            fontSize: tableSettings.headerFontSize
                                        }}>
                                        Tarih/Saat {sortBy === 'timestamp' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
                                    </th>
                                    {orderedTagNames.map(name => (
                                        <th key={name}
                                            onMouseEnter={(e) => handleMouseEnter(e, name)}
                                            onMouseLeave={handleMouseLeave}
                                            style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: `${tableSettings.rowPad}px ${tableSettings.colPad}px`, fontSize: tableSettings.headerFontSize, cursor: tagDescriptions[name] ? 'help' : 'default' }}>
                                            {name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pivotRows.map((row, i) => (
                                    <tr key={i}>
                                        <td className="sticky-col" style={{ whiteSpace: 'nowrap', fontWeight: 600, padding: `${tableSettings.rowPad}px ${tableSettings.colPad}px` }}>
                                            {row.timestamp}
                                        </td>
                                        {orderedTagNames.map(name => {
                                            const rawVal = row[name + '_raw'];
                                            const formattedVal = row[name] ?? '-';
                                            const alerts = tableSettings.colorAlerts?.[name];

                                            let cellStyle = { textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, padding: `${tableSettings.rowPad}px ${tableSettings.colPad}px` };

                                            if (rawVal !== undefined && alerts) {
                                                let currentVal = Number(rawVal);

                                                // Kullanıcı ekranda ne görüyorsa ona göre karşılaştırma yapmak için:
                                                if (typeof formattedVal === 'string' && formattedVal !== '-') {
                                                    let numStr = formattedVal.split(' ')[0]; // birimi ayır ("6.5 xbar" -> "6.5")
                                                    if (numStr.includes('.') && numStr.includes(',')) {
                                                        numStr = numStr.replace(/\./g, '').replace(',', '.'); // "1.234,56" -> 1234.56
                                                    } else if (numStr.includes(',')) {
                                                        numStr = numStr.replace(',', '.'); // "6,5" -> 6.5
                                                    }
                                                    const parsed = parseFloat(numStr);
                                                    if (!isNaN(parsed)) currentVal = parsed; // Ekranda kırpılmış/görünen değeri baz al
                                                }

                                                const maxLimit = (alerts.max !== undefined && alerts.max !== '') ? Number(alerts.max.toString().replace(',', '.')) : NaN;
                                                const minLimit = (alerts.min !== undefined && alerts.min !== '') ? Number(alerts.min.toString().replace(',', '.')) : NaN;

                                                if (!isNaN(maxLimit) && currentVal > maxLimit) {
                                                    cellStyle.color = alerts.maxColor || '#ef4444';
                                                } else if (!isNaN(minLimit) && currentVal < minLimit) {
                                                    cellStyle.color = alerts.minColor || '#3b82f6';
                                                }
                                            }

                                            return (
                                                <td key={name}
                                                    style={cellStyle}
                                                    onMouseEnter={(e) => handleMouseEnter(e, name)}
                                                    onMouseLeave={handleMouseLeave}
                                                >
                                                    {formattedVal}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {pivotRows.length === 0 && (
                                    <tr><td colSpan={1 + orderedTagNames.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                                        Veri bulunamadı
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {pagination.total} kayıttan {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} arası
                            </span>
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

            {/* Tag Tooltip */}
            {tooltip.visible && (
                <div style={{
                    position: 'absolute',
                    top: tooltip.y,
                    left: tooltip.x,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--primary-500)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 10002,
                    maxWidth: 300,
                    pointerEvents: 'none',
                    animation: 'fadeIn 0.2s ease-in-out'
                }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-500)', marginBottom: 2 }}>{tooltip.tagName}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{tooltip.content}</div>
                </div>
            )}

            {/* Success Popup */}
            {showSuccessPopup && (
                <div style={{
                    position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 10001, background: '#10b981', color: '#fff',
                    padding: '12px 24px', borderRadius: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    display: 'flex', alignItems: 'center', gap: 10, animation: 'slideInDown 0.3s ease-out'
                }}>
                    <span style={{ fontSize: 18 }}>✅</span>
                    <span style={{ fontWeight: 600 }}>{successMessage}</span>
                    <button onClick={() => setShowSuccessPopup(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 8, fontSize: 13, opacity: 0.8 }}>Kapat</button>
                </div>
            )}
            <style jsx="true">{`
                @keyframes slideInDown {
                    from { transform: translate(-50%, -100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
