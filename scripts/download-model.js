// scripts/download-model.js
// Run ONCE before `npm run dist` to download the bundled AI model.
// Usage: node scripts/download-model.js
//
// Downloads Phi-3 Mini 4K Instruct (Q4_K_M quantisation) — ~2.4 GB.
// This is the best quality/size tradeoff for a bundled game model:
//   - Runs on CPU with no GPU required
//   - Fast enough on any modern laptop (5-15 seconds per response)
//   - Small enough to ship inside an NSIS installer
//
// If you want a different model, change MODEL_URL and MODEL_FILE below.
// Any GGUF from HuggingFace works — just re-run this script.

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

// ── Model to download ────────────────────────────────────────────────────────
// Phi-3 Mini 4K Instruct Q4_K_M (~2.4 GB) — good quality, CPU-friendly
const MODEL_URL  = 'https://huggingface.co/bartowski/Phi-3-mini-4k-instruct-GGUF/resolve/main/Phi-3-mini-4k-instruct-Q4_K_M.gguf';
const MODEL_FILE = 'phi3-mini-q4.gguf';  // name used inside the app

// ── Destination ──────────────────────────────────────────────────────────────
const MODELS_DIR = path.join(__dirname, '..', 'models');
const DEST       = path.join(MODELS_DIR, MODEL_FILE);

if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

if (fs.existsSync(DEST)) {
  console.log(`✓ Model already exists at models/${MODEL_FILE} — nothing to download.`);
  console.log('  Delete the file and re-run if you want to re-download.');
  process.exit(0);
}

console.log(`Downloading ${MODEL_FILE} (~2.4 GB) — this may take a few minutes…`);
console.log(`Source: ${MODEL_URL}\n`);

function download(url, dest, redirects = 0) {
  if (redirects > 5) { console.error('Too many redirects'); process.exit(1); }

  const client = url.startsWith('https') ? https : http;
  const tmp    = dest + '.tmp';
  const file   = fs.createWriteStream(tmp);

  client.get(url, res => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      file.close();
      fs.unlink(tmp, () => {});
      return download(res.headers.location, dest, redirects + 1);
    }
    if (res.statusCode !== 200) {
      file.close();
      fs.unlink(tmp, () => {});
      console.error(`HTTP ${res.statusCode} from ${url}`);
      process.exit(1);
    }

    const total   = parseInt(res.headers['content-length'] || '0', 10);
    let received  = 0;
    let lastPrint = 0;

    res.on('data', chunk => {
      received += chunk.length;
      if (total && Date.now() - lastPrint > 2000) {
        const pct = ((received / total) * 100).toFixed(1);
        const mb  = (received / 1024 / 1024).toFixed(0);
        const tot = (total   / 1024 / 1024).toFixed(0);
        process.stdout.write(`\r  ${pct}%  ${mb} / ${tot} MB`);
        lastPrint = Date.now();
      }
    });

    res.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        fs.renameSync(tmp, dest);
        console.log(`\n\n✓ Saved to models/${MODEL_FILE}`);
        console.log('  You can now run: npm run dist');
      });
    });
  }).on('error', err => {
    fs.unlink(tmp, () => {});
    console.error('Download error:', err.message);
    process.exit(1);
  });
}

download(MODEL_URL, DEST);
