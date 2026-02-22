const fs = require('fs');
const file = 'C:\\Users\\Gokhan\\Desktop\\rmc\\src\\app\\reports\\[id]\\page.js';
let content = fs.readFileSync(file, 'utf8');

const target1 = `const [exportScope, setExportScope] = useState('filtered'); // 'filtered' or 'full'\n    `;
content = content.replace(target1, '');

const target2 = `                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Dışa Aktarılacak Veri
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" name="exportScope" value="filtered" checked={exportScope === 'filtered'} onChange={() => setExportScope('filtered')} className="text-blue-600 focus:ring-blue-500" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Ekranda Görünen (Filtrelenmiş ve Sıralanmış)</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" name="exportScope" value="full" checked={exportScope === 'full'} onChange={() => setExportScope('full')} className="text-blue-600 focus:ring-blue-500" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Ham Veriler (Sadece Tarih Aralığı)</span>
                                    </label>
                                </div>
                            </div>\n
`;
content = content.replace(target2, '');

const target3 = `PDF Yönü (Sadece PDF için)`;
content = content.replace(target3, `PDF Yönü`);

fs.writeFileSync(file, content);
console.log('Update finished.');
