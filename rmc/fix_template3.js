const fs = require('fs');
const path = require('path');

const routePath = path.join('C:\\Users\\Gokhan\\Desktop\\rmc\\src\\app\\api\\export\\pdf', 'route.js');
let code = fs.readFileSync(routePath, 'utf8');

const startMarker = "    const html = `<!DOCTYPE html>";
const endMarker = "</html>`;";

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find markers!");
    process.exit(1);
}

const newTemplate = `    const html = \`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>\${report_name}</title>
<style>
  \${pageSize}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a1a2e; padding: 15px; background-color: #ffffff; }
  table.antet-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #0b2e59; margin-bottom: 15px; padding-bottom: 5px; }
  table.antet-table td { border: none; vertical-align: middle; padding: 5px; }
  
  .filters-box { background: #f0f4ff; padding: 8px 12px; font-size: 9px; border: 1px dashed #dde; margin-bottom: 10px; }
  .legends-box { background: #fffbeb; padding: 8px 12px; font-size: 9px; border: 1px solid #fde68a; margin-bottom: 10px; border-radius: 4px; color: #92400e; }
  
  table.data-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
  table.data-table th { background: #f1f5f9; color: #1e293b; padding: 6px 8px; text-align: left; font-size: 10px; border: 1px solid #cbd5e1; }
  table.data-table td { padding: 4px 8px; border: 1px solid #cbd5e1; font-size: 9px; text-align: left; }
  table.data-table tr:nth-child(even) { background: #fafafa; }
  
  .footer { margin-top: 20px; width: 100%; text-align: center; font-size: 8px; padding: 8px; color: #6b7280; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body style="background-color: #ffffff;">

<table class="antet-table">
  <tr>
    <td style="width: 20%; text-align: left;">
      \${iskiLogoBase64 ? \`<img src="\${iskiLogoBase64}" width="70" height="50" alt="İSKİ" style="display: block;" />\` : ''}
    </td>
    <td style="width: 60%; text-align: center;">
      <div style="font-size: 16px; font-weight: bold; color: #0b2e59; text-transform: uppercase;">Ömerli Su Arıtma Şube Müdürlüğü</div>
    </td>
    <td style="width: 20%; text-align: right;">
      \${ibbLogoBase64 ? \`<img src="\${ibbLogoBase64}" width="70" height="50" alt="İBB" style="display: block; margin-left: auto;" />\` : ''}
    </td>
  </tr>
</table>

<table style="width: 100%; border: none; margin-bottom: 15px;">
  <tr>
    <td style="text-align: right; font-size: 10px; color: #334155; line-height: 1.6; border: none; padding: 0;">
      <strong style="color: #0f172a;">Rapor Adı:</strong> \${report_name}<br />
      <strong style="color: #0f172a;">Oluşturan:</strong> \${user.fullname || user.username}<br />
      <strong style="color: #0f172a;">Tarih:</strong> \${now}<br />
      <strong style="color: #0f172a;">Kayıt Sayısı:</strong> \${resultRows.length}
    </td>
  </tr>
</table>

\${filterInfo.length > 0 ? \`<div class="filters-box"><strong>Filtreler:</strong> \${filterInfo.join(' | ')}</div>\` : ''}
\${legendItems.length > 0 ? \`<div class="legends-box"><strong>Aktif Limit Uyarıları:</strong><br/>\${legendItems.join('<br/>')}</div>\` : ''}

<table class="data-table">
  <thead>
    \${tableHeadHTML}
  </thead>
  <tbody>
    \${tableBodyHTML}
  </tbody>
</table>

<div class="footer">Rapor Sonu</div>

</body>
</html>\`;`;

const finalCode = code.substring(0, startIdx) + newTemplate + code.substring(endIdx + endMarker.length);
fs.writeFileSync(routePath, finalCode);
console.log('Template reconstructed smoothly!');
