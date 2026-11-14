const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const vendor = path.join(root, 'public', 'vendor');
const chart = path.join(root, 'node_modules', 'chart.js');
fs.mkdirSync(vendor, { recursive: true });
fs.copyFileSync(path.join(chart, 'dist', 'chart.umd.js'), path.join(vendor, 'chart.umd.js'));
fs.copyFileSync(path.join(chart, 'LICENSE.md'), path.join(vendor, 'chart.LICENSE.md'));
console.log('Prepared locally hosted chart assets.');
