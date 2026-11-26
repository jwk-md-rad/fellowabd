#!/usr/bin/env node
/*
 * Bouwt de met een wachtwoord versleutelde pagina "Tijdsbesteding fellow".
 *
 * De leesbare bronnen staan in src/ (niet in git):
 *   src/index.html, src/fellow-tijdsbesteding.csv
 *
 * Gebruik (Node 18 of nieuwer, geen extra pakketten nodig):
 *   SITE_PASSWORD='...' node tools/build.mjs           bouw de site uit src/
 *   SITE_PASSWORD='...' node tools/build.mjs --unpack  zet src/ terug uit src.enc
 *
 * Zonder SITE_PASSWORD vraagt het script om het wachtwoord.
 *
 * Uit het wachtwoord wordt met PBKDF2-SHA256 (600.000 rondes) een AES-256-GCM-sleutel
 * afgeleid. Daarmee worden versleuteld: de inhoud en scripts van de pagina en de CSV
 * (data/index.enc.js) en een kopie van alle bronnen (src.enc).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto as crypto, createHash } from 'node:crypto';
import { createInterface } from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const PAGE = 'index';
const DATA = { fellow: 'fellow-tijdsbesteding.csv' };   // beschikbaar als dash.data('fellow')
const SRC_FILES = [PAGE + '.html', ...Object.values(DATA)];
const ITER = 600000;

const b64 = (buf) => Buffer.from(buf).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

async function askPassword() {
  if (process.env.SITE_PASSWORD) return process.env.SITE_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (s.includes('Wachtwoord')) process.stdout.write(s); };
  const pw = await new Promise((res) => rl.question('Wachtwoord: ', res));
  rl.close();
  process.stdout.write('\n');
  return pw;
}

async function deriveKey(pw, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decrypt(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return new TextDecoder().decode(pt);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const ver = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);

function splitPage(html) {
  const pick = (re, what) => { const m = html.match(re); if (!m) throw new Error(`${what} niet gevonden in src/${PAGE}.html`); return m; };
  const title = pick(/<title>([\s\S]*?)<\/title>/, 'title')[1];
  const desc = (html.match(/<meta name="description" content="([^"]*)">/) || [, ''])[1];
  const style = pick(/<style>([\s\S]*?)<\/style>/, 'style')[1];
  const nav = pick(/<nav[\s\S]*?<\/nav>/, 'nav')[0];
  const body = pick(/<div id="dash-root">([\s\S]*)<\/div>\s*<script>([\s\S]*?)<\/script>\s*<\/body>/, 'dash-root en script');
  return { title, desc, style, nav, html: body[1], script: body[2] };
}

function shell(p, v) {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${p.title}</title>
<meta name="description" content="${p.desc}">
<link rel="stylesheet" href="assets/theme.css?v=${v.theme}">
<script src="assets/d3.v7.9.0.min.js"></script>
</head>
<body>
${p.nav}
<div id="dash-root">
  <form class="gate" id="gate" autocomplete="on">
    <h1 class="gate-title">${esc(p.title)}</h1>
    <p class="gate-sub">Deze pagina is beveiligd. Vul het wachtwoord in.</p>
    <input type="text" name="username" value="fellow" autocomplete="username" hidden>
    <label class="gate-field">Wachtwoord
      <input type="password" id="gate-pw" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required autofocus>
    </label>
    <label class="gate-check"><input type="checkbox" id="gate-remember"> Onthouden op dit apparaat</label>
    <button type="submit" id="gate-btn">Openen</button>
    <p class="gate-msg" id="gate-msg" role="status"></p>
  </form>
</div>
<script>window.DASH_V = "${v.dash}";</script>
<script src="data/${PAGE}.enc.js?v=${v.page}"></script>
<script src="assets/gate.js?v=${v.gate}"></script>
</body>
</html>
`;
}

async function build(pw) {
  for (const f of SRC_FILES) if (!existsSync(join(SRC, f))) throw new Error('Ontbreekt: src/' + f + ' (zet src/ terug met --unpack)');
  // Zelfde salt als de vorige build (bij hetzelfde wachtwoord), zodat "Onthouden" geldig blijft.
  let salt = crypto.getRandomValues(new Uint8Array(16));
  if (existsSync(join(ROOT, 'src.enc'))) {
    try {
      const old = JSON.parse(readFileSync(join(ROOT, 'src.enc'), 'utf8'));
      if (old.kdf.iter === ITER) { const s0 = unb64(old.kdf.salt); await decrypt(await deriveKey(pw, s0, ITER), old.files); salt = s0; }
    } catch { /* ander wachtwoord: nieuwe salt */ }
  }
  const key = await deriveKey(pw, salt, ITER);
  const kdf = { salt: b64(salt), iter: ITER };
  mkdirSync(join(ROOT, 'data'), { recursive: true });

  const p = splitPage(readFileSync(join(SRC, PAGE + '.html'), 'utf8'));
  const extra = {};
  for (const [id, f] of Object.entries(DATA)) extra[id] = await encrypt(key, readFileSync(join(SRC, f), 'utf8'));
  const payload = JSON.stringify({ style: p.style, html: p.html, script: p.script });
  // own: true = de pagina laadt alleen haar eigen data (zie assets/gate.js)
  const pageJs = '// Versleuteld met tools/build.mjs\nwindow.ENC_PAGE = ' + JSON.stringify({ kdf, own: true, page: await encrypt(key, payload), extra }) + ';\n';
  writeFileSync(join(ROOT, 'data', PAGE + '.enc.js'), pageJs);
  const asset = (f) => ver(readFileSync(join(ROOT, 'assets', f), 'utf8'));
  writeFileSync(join(ROOT, PAGE + '.html'), shell(p, { page: ver(pageJs), theme: asset('theme.css'), gate: asset('gate.js'), dash: asset('dash.js') }));

  const files = Object.fromEntries(SRC_FILES.map((f) => [f, readFileSync(join(SRC, f), 'utf8')]));
  writeFileSync(join(ROOT, 'src.enc'), JSON.stringify({ kdf, files: await encrypt(key, JSON.stringify(files)) }) + '\n');
  console.log('Gebouwd: ' + PAGE + '.html, data/' + PAGE + '.enc.js, src.enc');
}

async function unpack(pw) {
  const enc = JSON.parse(readFileSync(join(ROOT, 'src.enc'), 'utf8'));
  const key = await deriveKey(pw, unb64(enc.kdf.salt), enc.kdf.iter);
  let files;
  try { files = JSON.parse(await decrypt(key, enc.files)); } catch { throw new Error('Onjuist wachtwoord'); }
  mkdirSync(SRC, { recursive: true });
  for (const [f, text] of Object.entries(files)) writeFileSync(join(SRC, f), text);
  console.log('Teruggezet in src/:', Object.keys(files).join(', '));
}

const pw = await askPassword();
if (!pw) { console.error('Geen wachtwoord opgegeven'); process.exit(1); }
try {
  await (process.argv.includes('--unpack') ? unpack(pw) : build(pw));
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
