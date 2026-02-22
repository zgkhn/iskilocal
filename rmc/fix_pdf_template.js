const fs = require('fs');
const path = require('path');

const routePath = path.join('C:\\Users\\Gokhan\\Desktop\\rmc\\src\\app\\api\\export\\pdf', 'route.js');
let code = fs.readFileSync(routePath, 'utf8');

// Find and replace the HTML template string
const startMarker = "const html = `<!DOCTYPE html>";
const endMarker = "</html>`;";

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find template markers!', startIdx, endIdx);
    process.exit(1);
}

const newTemplate = `const html = \`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>\${report_name}</title>
<style>
  \${pageSize}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a1a2e; padding: 15px; background: #fff; }
  .data-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
  .data-table th { background: #e2e8f0; color: #1e293b; padding: 6px 10px; text-align: left; font-size: 10px; border: 1px solid #cbd5e1; }
  .data-table td { padding: 4px 10px; border: 1px solid #e2e8f0; font-size: 9px; text-align: left; }
  .data-table tr:nth-child(even) { background: #f8fafc; }
</style>
</head>
<body>

<!-- Antet: Table-based layout -->
<table style="width: 100%; border: none; border-collapse: collapse; border-bottom: 2px solid #0b2e59; margin-bottom: 12px;">
  <tr>
    <td style="width: 70px; vertical-align: middle; padding: 4px; border: none;">
      <img src="\${iskiLogoBase64}" style="height: 50px; width: auto;" />
    </td>
    <td style="vertical-align: middle; text-align: center; padding: 4px; border: none;">
      <div style="font-size: 15px; font-weight: bold; color: #0b2e59; text-transform: uppercase;">Ömerli Su Arıtma Şube Müdürlüğü</div>
    </td>
    <td style="width: 70px; vertical-align: middle; padding: 4px; border: none;">
      <img src="\${ibbLogoBase64}" style="height: 50px; width: auto;" />
    </td>
    <td style="vertical-align: middle; text-align: right; padding: 4px 8px; font-size: 10px; color: #334155; line-height: 1.6; border: none; white-space: nowrap;">
      <strong style="color:#0f172a;">Rapor Adı:</strong> \${report_name}<br/>
      <strong style="color:#0f172a;">Oluşturan:</strong> \${user.fullname || user.username}<br/>
      <strong style="color:#0f172a;">Tarih:</strong> \${now}<br/>
      <strong style="color:#0f172a;">Kayıt Sayısı:</strong> \${resultRows.length}
    </td>
  </tr>
</table>

\${filterInfo.length > 0 ? \`<div style="background:#f0f4ff;padding:6px 12px;font-size:9px;border-bottom:1px dashed #dde;margin-bottom:8px;"><strong>Filtreler:</strong> \${filterInfo.join(' | ')}</div>\` : ''}
\${legendItems.length > 0 ? \`<div style="background:#fffbeb;padding:6px 12px;font-size:9px;border:1px solid #fde68a;margin-bottom:8px;border-radius:4px;color:#92400e;"><strong>Aktif Limit Uyarıları:</strong><br/>\${legendItems.join('<br/>')}</div>\` : ''}

<table class="data-table">
  <thead>
    \${tableHeadHTML}
  </thead>
  <tbody>
    \${tableBodyHTML}
  </tbody>
</table>

<div style="margin-top:15px;text-align:center;font-size:8px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:6px;">Rapor Sonu</div>
</body>
</html>\`;`;

code = code.substring(0, startIdx) + newTemplate + code.substring(endIdx + endMarker.length);

// Also fix td alignment in filtered mode — change text-align: right to text-align: left
code = code.replace(/text-align: right;/g, 'text-align: left;');

// Add border to th and td inline styles in the table head/body generation
// For filtered th - add border
code = code.replace(
    /\<th style="font-size: \$\{headerFontSize\}px; text-align: left;"\>/g,
    '<th style="font-size: ${headerFontSize}px; text-align: left; border: 1px solid #cbd5e1; padding: 6px 10px; background: #e2e8f0;">'
);

// For filtered td - add border
code = code.replace(
    /\<td style="font-weight: bold; text-align: left;"\>/g,
    '<td style="font-weight: bold; text-align: left; border: 1px solid #e2e8f0; padding: 4px 10px;">'
);

// For filtered data td that has color alerts
code = code.replace(
    /rowHtml \+= `<td style="text-align: left; \$\{style\}">/g,
    'rowHtml += `<td style="text-align: left; border: 1px solid #e2e8f0; padding: 4px 10px; ${style}">'
);

// For raw data th
code = code.replace(
    /<th style="text-align: left;">Tarih\/Saat<\/th>/g,
    '<th style="text-align: left; border: 1px solid #cbd5e1; padding: 6px 10px; background: #e2e8f0;">Tarih/Saat</th>'
);
code = code.replace(
    /<th style="text-align: left;">Tag Adı<\/th>/g,
    '<th style="text-align: left; border: 1px solid #cbd5e1; padding: 6px 10px; background: #e2e8f0;">Tag Adı</th>'
);
code = code.replace(
    /<th style="text-align: left;">Ham Değer<\/th>/g,
    '<th style="text-align: left; border: 1px solid #cbd5e1; padding: 6px 10px; background: #e2e8f0;">Ham Değer</th>'
);
code = code.replace(
    /<th style="text-align: left;">İşlenmiş Değer<\/th>/g,
    '<th style="text-align: left; border: 1px solid #cbd5e1; padding: 6px 10px; background: #e2e8f0;">İşlenmiş Değer</th>'
);
code = code.replace(
    /<th style="text-align: left;">Birim<\/th>/g,
    '<th style="text-align: left; border: 1px solid #cbd5e1; padding: 6px 10px; background: #e2e8f0;">Birim</th>'
);

// For raw data td
code = code.replace(
    /<td style="text-align: left;">\$\{new Date/g,
    '<td style="text-align: left; border: 1px solid #e2e8f0; padding: 4px 10px;">${new Date'
);
code = code.replace(
    /<td style="text-align: left;">\$\{row\.tag_name\}/g,
    '<td style="text-align: left; border: 1px solid #e2e8f0; padding: 4px 10px;">${row.tag_name}'
);
code = code.replace(
    /<td style="text-align: left;">\$\{row\.value\}/g,
    '<td style="text-align: left; border: 1px solid #e2e8f0; padding: 4px 10px;">${row.value}'
);
code = code.replace(
    /<td style="text-align: left;font-weight:bold">\$\{scaledValue\}/g,
    '<td style="text-align: left; border: 1px solid #e2e8f0; padding: 4px 10px; font-weight: bold;">${scaledValue}'
);
code = code.replace(
    /<td style="text-align: left;">\$\{unit\}/g,
    '<td style="text-align: left; border: 1px solid #e2e8f0; padding: 4px 10px;">${unit}'
);

fs.writeFileSync(routePath, code);
console.log('Template rewritten! File size:', fs.statSync(routePath).size);
