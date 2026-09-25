#!/usr/bin/env node
/**
 * Renders the "Coming soon" reel to Instagram-ready files.
 *
 *   node promo/coming-soon/render.js                 # both ratios: MP4 (+SFX), silent MP4, cover JPG
 *   node promo/coming-soon/render.js 9x16            # one ratio
 *   node promo/coming-soon/render.js stills 9x16 1.5 4 12.5   # PNG stills at given seconds
 *
 * Needs ffmpeg on PATH. Uses the repo's Playwright devDependency with the
 * pre-installed Chromium; set CHROMIUM_PATH to point at a specific binary.
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('@playwright/test');
const TL = require('./timeline.js');
const { writeWav } = require('./audio.js');

const DIR = __dirname;
const OUT = path.join(DIR, 'out');
const SIZES = { '9x16': [1080, 1920], '4x5': [1080, 1350] };
const COVER_T = 16.4; // lock-up fully in, before the fade

// Prefer Playwright's own browser; fall back to a pre-installed Chromium
// (e.g. /opt/pw-browsers/chromium) when the pinned version isn't downloaded.
async function launch() {
  const candidates = process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [null, '/opt/pw-browsers/chromium'];
  let lastErr;
  for (const executablePath of candidates) {
    if (executablePath && !fs.existsSync(executablePath)) continue;
    try { return await chromium.launch(executablePath ? { executablePath } : {}); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function openPage(browser, ratio) {
  const [w, h] = SIZES[ratio];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(DIR, 'index.html') + '?render&ratio=' + ratio);
  await page.evaluate(() => window.__ready);
  return page;
}

async function shot(page, t, type) {
  await page.evaluate((tt) => window.__frame(tt), t);
  return page.screenshot({ type: type || 'png', quality: type === 'jpeg' ? 95 : undefined });
}

function ffmpeg(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited ' + code))));
    if (input) input(p.stdin); else p.stdin.end();
  });
}

async function renderVideo(browser, ratio, wav) {
  const page = await openPage(browser, ratio);
  const frames = Math.round(TL.duration * TL.fps);
  const silent = path.join(OUT, 'alxanthia-coming-soon-' + ratio + '-silent.mp4');
  const withSfx = path.join(OUT, 'alxanthia-coming-soon-' + ratio + '.mp4');
  const started = Date.now();
  await ffmpeg([
    '-f', 'image2pipe', '-framerate', String(TL.fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.1',
    '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-r', String(TL.fps), '-movflags', '+faststart', silent
  ], async (stdin) => {
    for (let i = 0; i < frames; i++) {
      const buf = await shot(page, i / TL.fps);
      if (!stdin.write(buf)) await new Promise((r) => stdin.once('drain', r));
      if (i % 60 === 0) process.stdout.write('  ' + ratio + ' frame ' + i + '/' + frames + '\r');
    }
    stdin.end();
  });
  console.log('  ' + ratio + ': ' + frames + ' frames in ' + ((Date.now() - started) / 1000).toFixed(0) + 's');
  await ffmpeg(['-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', withSfx]);

  const cover = path.join(OUT, 'alxanthia-coming-soon-' + ratio + '-cover.jpg');
  fs.writeFileSync(cover, await shot(page, COVER_T, 'jpeg'));
  await page.close();
  for (const f of [withSfx, silent, cover]) console.log('  → ' + path.relative(process.cwd(), f) + ' (' + (fs.statSync(f).size / 1e6).toFixed(2) + ' MB)');
}

async function main() {
  const args = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  try {
    if (args[0] === 'stills') {
      const ratio = args[1] || '9x16';
      const dir = path.join(OUT, 'stills');
      fs.mkdirSync(dir, { recursive: true });
      const page = await openPage(browser, ratio);
      for (const t of args.slice(2).map(Number)) {
        const file = path.join(dir, ratio + '-' + t.toFixed(2) + 's.png');
        fs.writeFileSync(file, await shot(page, t));
        console.log('  → ' + path.relative(process.cwd(), file));
      }
      return;
    }
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    const wav = path.join(OUT, 'sfx.wav');
    writeWav(wav);
    const ratios = args.length ? args : Object.keys(SIZES);
    for (const r of ratios) {
      if (!SIZES[r]) throw new Error('Unknown ratio ' + r + ' (use 9x16 or 4x5)');
      await renderVideo(browser, r, wav);
    }
    fs.unlinkSync(wav);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
