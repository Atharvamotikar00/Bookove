const { spawn } = require('node:child_process');
const path = require('node:path');

let calibreChecked = false;
let calibreAvailable = false;

/**
 * Checks once (and caches) whether Calibre's `ebook-convert` CLI is
 * installed on this machine. MOBI has no good pure-JS parser, so
 * converting it to EPUB for in-browser reading depends on Calibre
 * being installed on the server (`apt-get install -y calibre` on Debian/Ubuntu).
 * If it's missing, MOBI files are still stored and can be downloaded,
 * they just can't be read in-browser.
 */
function checkCalibre() {
  return new Promise((resolve) => {
    if (calibreChecked) return resolve(calibreAvailable);
    const proc = spawn('ebook-convert', ['--version']);
    proc.on('error', () => {
      calibreChecked = true;
      calibreAvailable = false;
      resolve(false);
    });
    proc.on('close', (code) => {
      calibreChecked = true;
      calibreAvailable = code === 0;
      resolve(calibreAvailable);
    });
  });
}

/**
 * Converts a MOBI file to EPUB using Calibre. Returns the output path,
 * or null if Calibre isn't available or conversion failed.
 */
async function convertMobiToEpub(mobiPath, outputDir) {
  const available = await checkCalibre();
  if (!available) return null;

  const outputPath = path.join(
    outputDir,
    path.basename(mobiPath, path.extname(mobiPath)) + '.epub'
  );

  return new Promise((resolve) => {
    const proc = spawn('ebook-convert', [mobiPath, outputPath]);
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      resolve(code === 0 ? outputPath : null);
    });
  });
}

module.exports = { checkCalibre, convertMobiToEpub };
