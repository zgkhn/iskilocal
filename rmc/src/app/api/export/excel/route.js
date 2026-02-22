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
        const { tag_ids, start_date, end_date, min_value, max_value, report_name = 'Rapor', scope = 'full', columns = [], rows: frontendRows = [], colorAlerts = {} } = body;

        let resultRows = [];
        let isFiltered = scope === 'filtered';

        if (isFiltered) {
            resultRows = frontendRows;
        } else {
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
            resultRows = result.rows;
        }

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = user.fullname || user.username;
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(report_name.substring(0, 31)); // Max length for sheet name is 31

        if (isFiltered) {
            // Setup columns mapped from frontend
            let excelCols = [{ header: 'Tarih/Saat', key: 'timestamp', width: 22 }];
            columns.forEach(col => {
                excelCols.push({ header: col, key: col, width: 18 });
            });
            sheet.columns = excelCols;

            // Style header row
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56DB' } };
            headerRow.alignment = { horizontal: 'center' };

            // Add data rows with potential color formatting
            resultRows.forEach(row => {
                const rowData = { timestamp: row.timestamp };
                columns.forEach(col => {
                    rowData[col] = row[col] !== undefined ? row[col] : '-';
                });

                const addedRow = sheet.addRow(rowData);

                // Base colors on limits
                columns.forEach((col, idx) => {
                    const valStr = row[col];
                    const rawVal = row[col + '_raw'];
                    const alerts = colorAlerts[col];

                    if (rawVal !== undefined && alerts) {
                        let currentVal = Number(rawVal);
                        if (typeof valStr === 'string' && valStr !== '-') {
                            let numStr = valStr.split(' ')[0];
                            if (numStr.includes('.') && numStr.includes(',')) numStr = numStr.replace(/\\./g, '').replace(',', '.');
                            else if (numStr.includes(',')) numStr = numStr.replace(',', '.');
                            const parsed = parseFloat(numStr);
                            if (!isNaN(parsed)) currentVal = parsed;
                        }
                        const maxLimit = (alerts.max !== undefined && alerts.max !== '') ? Number(alerts.max.toString().replace(',', '.')) : NaN;
                        const minLimit = (alerts.min !== undefined && alerts.min !== '') ? Number(alerts.min.toString().replace(',', '.')) : NaN;

                        let fontColor = null;
                        if (!isNaN(maxLimit) && currentVal > maxLimit) fontColor = 'FFEF4444'; // Red
                        else if (!isNaN(minLimit) && currentVal < minLimit) fontColor = 'FF3B82F6'; // Blue

                        if (fontColor) {
                            const cell = addedRow.getCell(idx + 2); // +2 because 1-based index and col 1 is timestamp
                            cell.font = { color: { argb: fontColor }, bold: true };
                        }
                    }
                });
            });

        } else {
            // Header styling for raw data
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
            resultRows.forEach(row => {
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
        }

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

        await logExport(user, 'excel', report_name, { tag_ids, start_date, end_date, rowCount: resultRows.length, scope });

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
