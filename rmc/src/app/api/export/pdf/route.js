import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logExport } from '@/lib/audit';

function applyScale(value, scale) {
    if (!scale) return value;
    let v = value;
    if (scale.multiply_factor && scale.multiply_factor !== 1) v *= scale.multiply_factor;
    if (scale.divide_factor && scale.divide_factor !== 1 && scale.divide_factor !== 0) v /= scale.divide_factor;
    if (scale.offset_value) v += scale.offset_value;
    if (scale.decimal_precision !== null && scale.decimal_precision !== undefined) {
        v = parseFloat(v.toFixed(scale.decimal_precision));
    }
    return v;
}

export async function POST(request) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { tag_ids, start_date, end_date, min_value, max_value, report_name = 'Rapor', orientation = 'portrait' } = body;

        if (!tag_ids || tag_ids.length === 0) {
            return NextResponse.json({ error: 'tag_ids gereklidir' }, { status: 400 });
        }

        // Get settings
        const settingsResult = await query("SELECT key, value FROM rc_settings WHERE key IN ('company_name')");
        const settings = {};
        settingsResult.rows.forEach(r => { settings[r.key] = r.value; });
        const companyName = settings.company_name || 'İSKİ';

        // Get measurements
        let conditions = ['m.tag_id = ANY($1)'];
        let params = [tag_ids];
        let paramIndex = 2;
        if (start_date) { conditions.push(`m.timestamp >= $${paramIndex}`); params.push(start_date); paramIndex++; }
        if (end_date) { conditions.push(`m.timestamp <= $${paramIndex}`); params.push(end_date); paramIndex++; }
        if (min_value !== undefined && min_value !== null) { conditions.push(`m.value >= $${paramIndex}`); params.push(parseFloat(min_value)); paramIndex++; }
        if (max_value !== undefined && max_value !== null) { conditions.push(`m.value <= $${paramIndex}`); params.push(parseFloat(max_value)); paramIndex++; }

        const result = await query(
            `SELECT m.timestamp, m.value, t.name as tag_name, t.unit as tag_unit,
              ts.multiply_factor, ts.divide_factor, ts.offset_value, ts.decimal_precision, ts.unit as scale_unit
       FROM measurements m
       JOIN tags t ON m.tag_id = t.id
       LEFT JOIN rc_tag_scales ts ON t.id = ts.tag_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.timestamp DESC
       LIMIT 50000`,
            params
        );

        // Generate PDF as HTML (since pdfkit is complex to install, we use a printable HTML approach)
        const isLandscape = orientation === 'landscape';
        const pageSize = isLandscape ? '@page { size: A4 landscape; }' : '@page { size: A4 portrait; }';
        const now = new Date().toLocaleString('tr-TR');

        let tableRows = result.rows.map(row => {
            const scale = row.multiply_factor ? row : null;
            const scaledValue = applyScale(row.value, scale);
            const unit = row.scale_unit || row.tag_unit || '';
            return `<tr>
        <td>${new Date(row.timestamp).toLocaleString('tr-TR')}</td>
        <td>${row.tag_name}</td>
        <td style="text-align:right">${row.value}</td>
        <td style="text-align:right;font-weight:bold">${scaledValue}</td>
        <td>${unit}</td>
      </tr>`;
        }).join('');

        const filterInfo = [];
        if (start_date) filterInfo.push(`Başlangıç: ${start_date}`);
        if (end_date) filterInfo.push(`Bitiş: ${end_date}`);
        if (min_value !== undefined) filterInfo.push(`Min: ${min_value}`);
        if (max_value !== undefined) filterInfo.push(`Max: ${max_value}`);

        const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${report_name}</title>
<style>
  ${pageSize}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a1a2e; }
  .header { background: linear-gradient(135deg, #1a56db, #1e3a8a); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 18px; }
  .header .company { font-size: 14px; font-weight: bold; }
  .header .meta { font-size: 9px; text-align: right; line-height: 1.6; }
  .filters { background: #f0f4ff; padding: 8px 30px; font-size: 9px; border-bottom: 1px solid #dde; }
  table { width: 100%; border-collapse: collapse; margin: 10px 30px; }
  table { width: calc(100% - 60px); }
  th { background: #1a56db; color: white; padding: 6px 8px; text-align: left; font-size: 9px; }
  td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; font-size: 9px; }
  tr:nth-child(even) { background: #f9fafb; }
  .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 8px; padding: 8px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company">${companyName}</div>
    <h1>${report_name}</h1>
  </div>
  <div class="meta">
    Oluşturma: ${now}<br>
    Kullanıcı: ${user.fullname || user.username}<br>
    Toplam: ${result.rows.length} kayıt
  </div>
</div>
${filterInfo.length > 0 ? `<div class="filters">Filtreler: ${filterInfo.join(' | ')}</div>` : ''}
<table>
  <thead>
    <tr><th>Tarih/Saat</th><th>Tag Adı</th><th>Ham Değer</th><th>İşlenmiş Değer</th><th>Birim</th></tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="footer">${companyName} – Rapor İzleme Merkezi | Sayfa <span class="pageNumber"></span></div>
<script class="no-print">window.onload = function() { window.print(); }</script>
</body>
</html>`;

        await logExport(user, 'pdf', report_name, { tag_ids, start_date, end_date, rowCount: result.rows.length, orientation });

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
        });
    } catch (error) {
        console.error('PDF export error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
