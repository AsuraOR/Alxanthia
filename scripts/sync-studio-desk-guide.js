const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const guidePath = path.join(root, 'STUDIO-DESK-SETUP.md');
const sourceDir = path.join(root, 'studio-order-portal');
const codePath = path.join(sourceDir, 'Code.gs');
const htmlPath = path.join(sourceDir, 'Index.html');

function replaceBlock(source, language, marker, replacement) {
  const pattern = new RegExp('```' + language + '\\r?\\n([\\s\\S]*?' + marker + '[\\s\\S]*?)\\r?\\n```');
  if (!pattern.test(source)) throw new Error('Could not find ' + language + ' block containing ' + marker);
  return source.replace(pattern, '```' + language + '\n' + replacement.trimEnd() + '\n```');
}

function extractBlock(source, language, marker) {
  const blocks = [...source.matchAll(new RegExp('```' + language + '\\r?\\n([\\s\\S]*?)\\r?\\n```', 'g'))];
  const match = blocks.find((entry) => entry[1].includes(marker));
  if (!match) throw new Error('Could not find ' + language + ' block containing ' + marker);
  return match[1] + '\n';
}

const mode = process.argv[2] || 'sync';
const guide = fs.readFileSync(guidePath, 'utf8');
fs.mkdirSync(sourceDir, { recursive: true });

if (mode === 'extract') {
  fs.writeFileSync(codePath, extractBlock(guide, 'javascript', 'function doGet'), 'utf8');
  fs.writeFileSync(htmlPath, extractBlock(guide, 'html', 'function paymentBlock'), 'utf8');
  console.log('Extracted Code.gs and Index.html from STUDIO-DESK-SETUP.md');
} else if (mode === 'sync') {
  let next = replaceBlock(guide, 'javascript', 'function doGet', fs.readFileSync(codePath, 'utf8'));
  next = replaceBlock(next, 'html', 'function paymentBlock', fs.readFileSync(htmlPath, 'utf8'));
  fs.writeFileSync(guidePath, next, 'utf8');
  console.log('Synchronized STUDIO-DESK-SETUP.md from studio-order-portal');
} else {
  throw new Error('Use "extract" or "sync".');
}
