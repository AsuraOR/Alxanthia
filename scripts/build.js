#!/usr/bin/env node
/**
 * Deterministic static build (ALX-01).
 *
 * The Sites config (.openai/hosting.json) publishes `dist/`, but source lives
 * at the repository root. This script is the one place that produces `dist/`
 * so the two can never drift apart by hand-editing: it always starts from a
 * clean directory, copies only an explicit allowlist of public files, and
 * resolves the image set from what index.html/app.js/styles.css/site-content.js
 * actually reference — so a removed reference automatically drops the file
 * from the published output instead of leaving an obsolete asset behind.
 *
 * Run with: npm run build
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Every one of these must exist at the repository root; the build fails
// loudly rather than silently shipping a partial site.
const TOP_LEVEL_FILES = [
  'index.html',
  'app.js',
  'site-content.js',
  'styles.css',
  'robots.txt',
  'sitemap.xml',
  'CNAME',
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'alxanthia-logo.png',
  'alxanthia-logo-96.webp',
  'alxanthia-logo-192.webp'
];

// Text sources scanned to decide which img/ files are actually reachable.
// Anything under img/ that none of these mention (master PSD-style sources,
// orphaned derivative sizes, old marketing renders) is excluded — see ALX-23.
const IMG_REFERENCE_SOURCES = ['index.html', 'app.js', 'styles.css', 'site-content.js'];

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyFile(rel) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) {
    throw new Error(`Build allowlist references a missing file: ${rel}`);
  }
  const dest = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function findReferencedImages() {
  const combinedText = IMG_REFERENCE_SOURCES.map((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')).join('\n');
  const imgDir = path.join(ROOT, 'img');
  const allImages = fs.readdirSync(imgDir);
  return allImages.filter((name) => combinedText.includes(name));
}

function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function build() {
  rimraf(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  for (const rel of TOP_LEVEL_FILES) copyFile(rel);

  const referencedImages = findReferencedImages();
  if (referencedImages.length === 0) {
    throw new Error('No referenced images found under img/ — refusing to publish an empty image set.');
  }
  for (const name of referencedImages) copyFile(path.join('img', name));

  const buildInfo = {
    commit: gitCommit(),
    builtAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(DIST, 'build-info.json'), JSON.stringify(buildInfo, null, 2) + '\n');

  console.log(`Built dist/ from commit ${buildInfo.commit}: ${TOP_LEVEL_FILES.length} top-level files, ${referencedImages.length} referenced images.`);
}

build();
