import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const designDir = path.resolve(scriptDir, '..');
const archiveDir = path.resolve(designDir, 'archive');

if (path.dirname(archiveDir) !== designDir) {
  throw new Error(`Unsafe archive target: ${archiveDir}`);
}

function sourcePath(file) {
  const current = path.resolve(designDir, file);
  const archived = path.resolve(archiveDir, file);
  if (fs.existsSync(current)) return current;
  if (fs.existsSync(archived)) return archived;
  throw new Error(`Missing SVG source: ${file}`);
}

function extractDefs(source) {
  return source.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? '';
}

function extractGroup(source, id) {
  const startPattern = new RegExp(`<g\\s+id=["']${id}["'][^>]*>`);
  const startMatch = startPattern.exec(source);
  if (!startMatch) throw new Error(`Missing group #${id}`);

  const start = startMatch.index;
  const tokenPattern = /<g\b[^>]*>|<\/g>/g;
  tokenPattern.lastIndex = start;
  let depth = 0;
  for (let token = tokenPattern.exec(source); token; token = tokenPattern.exec(source)) {
    if (token[0].startsWith('</')) depth -= 1;
    else depth += 1;
    if (depth === 0) return source.slice(start, tokenPattern.lastIndex);
  }
  throw new Error(`Unclosed group #${id}`);
}

function writePage({ source, id, output, x, y, width, height }) {
  const input = fs.readFileSync(sourcePath(source), 'utf8');
  const defs = extractDefs(input);
  const group = extractGroup(input, id);
  const result = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">`,
    defs,
    group,
    '</svg>',
    '',
  ].filter(Boolean).join('\n');
  fs.writeFileSync(path.resolve(designDir, output), result, 'utf8');
}

const pages = [
  { source: 'kanban-trello-ui.svg', id: 'desktop-login', output: 'auth-login.svg', x: 40, y: 80, width: 1440, height: 900 },
  { source: 'kanban-trello-ui.svg', id: 'desktop-signup', output: 'auth-signup.svg', x: 1520, y: 80, width: 1440, height: 900 },
  { source: 'kanban-trello-rwd.svg', id: 'mobile-login', output: 'auth-login-mobile.svg', x: 40, y: 80, width: 390, height: 844 },
  { source: 'kanban-trello-rwd.svg', id: 'mobile-signup', output: 'auth-signup-mobile.svg', x: 470, y: 80, width: 390, height: 844 },
  { source: 'workspace-overview-rwd.svg', id: 'tablet-workspace', output: 'workspace-overview-tablet.svg', x: 40, y: 80, width: 768, height: 1024 },
  { source: 'workspace-overview-rwd.svg', id: 'mobile-workspace', output: 'workspace-overview-mobile.svg', x: 848, y: 80, width: 390, height: 844 },
  { source: 'board-overview-rwd.svg', id: 'tablet-board-current', output: 'board-overview-tablet.svg', x: 40, y: 80, width: 768, height: 1024 },
  { source: 'board-overview-rwd.svg', id: 'mobile-board-current', output: 'board-overview-mobile.svg', x: 848, y: 80, width: 390, height: 844 },
  { source: 'create-card-dialog-rwd.svg', id: 'mobile-create-card', output: 'create-card-dialog-mobile.svg', x: 84, y: 80, width: 390, height: 844 },
  { source: 'card-detail-rwd.svg', id: 'mobile-card-detail-current', output: 'card-detail-mobile.svg', x: 84, y: 80, width: 390, height: 844 },
];

for (const page of pages) writePage(page);

fs.mkdirSync(archiveDir, { recursive: true });
for (const file of [
  'kanban-trello-ui.svg',
  'kanban-trello-rwd.svg',
  'workspace-overview-rwd.svg',
  'board-overview-rwd.svg',
  'create-card-dialog-rwd.svg',
  'card-detail-rwd.svg',
]) {
  const current = path.resolve(designDir, file);
  const archived = path.resolve(archiveDir, file);
  if (fs.existsSync(current) && !fs.existsSync(archived)) fs.renameSync(current, archived);
}

console.log(`Generated ${pages.length} single-page SVG files.`);
