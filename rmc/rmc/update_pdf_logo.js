const fs = require('fs');
const path = require('path');

const routePath = path.join('C:\\Users\\Gokhan\\Desktop\\rmc\\src\\app\\api\\export\\pdf', 'route.js');
let code = fs.readFileSync(routePath, 'utf8');

// 1. Replace the ISKI logo Base64 string
const newB64 = fs.readFileSync('C:\\Users\\Gokhan\\Desktop\\new_iski_logo_b64.txt', 'utf8').trim();
code = code.replace(/const ISKI_LOGO = 'data:image\/png;base64,.*?';/, `const ISKI_LOGO = 'data:image/png;base64,${newB64}';`);

// 2. Rewrite the HTML template to compact the header
const startMarker = "    const html = `<!DOCTYPE html>";
const endMarker = "</html>`;";

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const newTemplate = `    const html = \`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>\${report_name}</title>
<style>
  \${pageSize}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1a1a2e; padding: 15px; background-color: #ffffff; }
  table.antet-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #0b2e59; margin-bottom: 8px; padding-bottom: 5px; }
  table.antet-table td { border: none; vertical-align: middle; padding: 5px; }
  
  .details-bar { font-size: 9px; color: #334155; margin-bottom: 12px; padding: 4px 0; border-bottom: 1px solid #e2e8f0; display: block; }
  .details-item { display: inline-block; margin-right: 15px; }
  .details-item strong { color: #0f172a; }

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
      \${iskiLogoBase64 ? \`<img src="\${iskiLogoBase64}" width="70" height="70" style="object-fit: contain; max-height: 70px;" alt="İSKİ" style="display: block;" />\` : ''}
    </td>
    <td style="width: 60%; text-align: center;">
      <div style="font-size: 16px; font-weight: bold; color: #0b2e59; text-transform: uppercase;">Ömerli Su Arıtma Şube Müdürlüğü</div>
    </td>
    <td style="width: 20%; text-align: right;">
      \${ibbLogoBase64 ? \`<img src="\${ibbLogoBase64}" width="70" height="50" style="object-fit: contain; max-height: 50px;" alt="İBB" style="display: block; margin-left: auto;" />\` : ''}
    </td>
  </tr>
</table>

<div class="details-bar">
  <span class="details-item"><strong>Rapor Adı:</strong> \${report_name}</span>
  <span class="details-item"><strong>Oluşturan:</strong> \${user.fullname || user.username}</span>
  <span class="details-item"><strong>Tarih:</strong> \${now}</span>
  <span class="details-item"><strong>Kayıt Sayısı:</strong> \${resultRows.length}</span>
</div>

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
} else {
    console.error("Markers not found");
}

