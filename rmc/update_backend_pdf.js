const fs = require('fs');
const path = require('path');

const file = path.join('C:', 'Users', 'Gokhan', 'Desktop', 'rmc', 'src', 'app', 'api', 'export', 'pdf', 'route.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Add puppeteer import
if (!content.includes("import puppeteer from 'puppeteer';")) {
    content = content.replace("import { logExport } from '@/lib/audit';", "import { logExport } from '@/lib/audit';\nimport puppeteer from 'puppeteer';");
}

// 2. Add action destructuring
if (!content.includes("action } = body")) {
    content = content.replace(/const { tag_ids(.*?) } = body;/, 'const { tag_ids$1, action } = body;');
}

// 3. Rewriting return block
const regexTarget = /return new NextResponse\(html, \{\s*headers: \{\s*'Content-Type': 'text\/html; charset=utf-8',\s*\},\s*\}\);/;

const replacement = `if (action === 'download') {
      try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: orientation === 'landscape',
          printBackground: true,
          margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
        });
        await browser.close();

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': \`attachment; filename="rapor_\${new Date().getTime()}.pdf"\`
          }
        });
      } catch (err) {
        console.error('Puppeteer generation error:', err);
        return NextResponse.json({ error: 'PDF oluşturulamadı: ' + err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ html });`;

if (regexTarget.test(content)) {
    content = content.replace(regexTarget, replacement);
    fs.writeFileSync(file, content);
    console.log("route.js updated successfully.");
} else {
    console.log("Regex target not found in route.js");
}
