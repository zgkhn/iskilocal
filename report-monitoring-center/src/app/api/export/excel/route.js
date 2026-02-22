import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logExport } from '@/lib/audit';
import ExcelJS from 'exceljs';

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
        const { tag_ids, start_date, end_date, min_value, max_value, report_name = 'Rapor' } = body;

        if (!tag_ids || tag_ids.length === 0) {
            return NextResponse.json({ error: 'tag_ids gereklidir' }, { status: 400 });
        }

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

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = user.fullname || user.username;
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(report_name);

        // Header styling
        sheet.columns = [
            { header: 'Tarih/Saat', key: 'timestamp', width: 22 },
            { header: 'Tag Adı', key: 'tag_name', width: 25 },
            { header: 'Ham Değer', key: 'raw_value', width: 15 },
            { header: 'İşlenmiş Değer', key: 'scaled_value', width: 18 },
            { header: 'Birim', key: 'unit', width: 12 },
        ];

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56DB' } };
        headerRow.alignment = { horizontal: 'center' };

        // Add data
        result.rows.forEach(row => {
            const scale = row.multiply_factor ? row : null;
            const scaledValue = applyScale(row.value, scale);
            const unit = row.scale_unit || row.tag_unit || '';

            sheet.addRow({
                timestamp: new Date(row.timestamp).toLocaleString('tr-TR'),
                tag_name: row.tag_name,
                raw_value: row.value,
                scaled_value: scaledValue,
                unit: unit,
            });
        });

        // Add filter info at the bottom
        sheet.addRow([]);
        sheet.addRow(['Filtre Bilgileri:']);
        if (start_date) sheet.addRow(['Başlangıç:', start_date]);
        if (end_date) sheet.addRow(['Bitiş:', end_date]);
        if (min_value !== undefined) sheet.addRow(['Min Değer:', min_value]);
        if (max_value !== undefined) sheet.addRow(['Max Değer:', max_value]);
        sheet.addRow(['Export Eden:', user.fullname || user.username]);
        sheet.addRow(['Tarih:', new Date().toLocaleString('tr-TR')]);

        const buffer = await workbook.xlsx.writeBuffer();

        await logExport(user, 'excel', report_name, { tag_ids, start_date, end_date, rowCount: result.rows.length });

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${report_name.replace(/[^a-zA-Z0-9_-\s]/g, '')}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
            },
        });
    } catch (error) {
        console.error('Excel export error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
