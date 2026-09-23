import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { gunzipSync } from "node:zlib";

const require = createRequire(import.meta.url);

function usage() {
  return "Usage: node ocr-image.mjs --input <png-or-jpeg> --lang <eng|chi_sim+jpn> [--cache-dir <dir>] [--lang-path <url-or-dir>]";
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (key === "--help") return { help: true };
    if (!["--input", "--lang", "--cache-dir", "--lang-path"].includes(key) || !argv[i + 1]) {
      throw new Error(usage());
    }
    args[key.slice(2)] = argv[i + 1];
  }
  if (!args.input || !args.lang) throw new Error(usage());
  if (!/^[a-z_]+(\+[a-z_]+)*$/.test(args.lang)) {
    throw new Error("Use Tesseract language codes such as eng, chi_sim, or jpn.");
  }
  return args;
}

function getTesseract() {
  try {
    return require("tesseract.js");
  } catch {
    const runtimeModules = path.resolve(path.dirname(process.execPath), "..", "node_modules");
    try {
      return require(path.join(runtimeModules, "tesseract.js"));
    } catch {
      throw new Error("Tesseract.js is unavailable in this Node runtime.");
    }
  }
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function obtainLanguage(lang, cacheDir, langPath) {
  const destination = path.join(cacheDir, `${lang}.traineddata`);
  if (await exists(destination)) return;

  let sources;
  if (langPath && !/^https?:\/\//i.test(langPath)) {
    sources = [
      path.join(path.resolve(langPath), `${lang}.traineddata`),
      path.join(path.resolve(langPath), `${lang}.traineddata.gz`)
    ];
  } else if (langPath) {
    const base = langPath.replace(/\/$/, "");
    sources = [`${base}/${lang}.traineddata.gz`, `${base}/${lang}.traineddata`];
  } else {
    sources = [
      `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
      `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${lang}.traineddata`
    ];
  }

  for (const source of sources) {
    try {
      let data;
      if (/^https?:\/\//i.test(source)) {
        const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = Buffer.from(await response.arrayBuffer());
      } else {
        data = await fs.readFile(source);
      }
      if (source.endsWith(".gz")) data = gunzipSync(data);
      if (data.length < 1000) throw new Error("Language data is unexpectedly small.");
      const temporary = `${destination}.part`;
      await fs.writeFile(temporary, data);
      await fs.rename(temporary, destination);
      return;
    } catch {
      // Try the next trusted source.
    }
  }
  throw new Error(`Could not obtain ${lang}.traineddata. Place it in ${cacheDir} or pass --lang-path to a local language-data directory.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const input = path.resolve(args.input);
  const stat = await fs.stat(input);
  if (!stat.isFile() || !/\.(png|jpe?g)$/i.test(input)) {
    throw new Error("Input must be an existing PNG or JPEG file.");
  }

  const cacheDir = path.resolve(args["cache-dir"] || path.join(os.tmpdir(), "bilingual-course-study-ocr-cache"));
  await fs.mkdir(cacheDir, { recursive: true });
  const languages = args.lang.split("+");
  for (const lang of languages) {
    await obtainLanguage(lang, cacheDir, args["lang-path"]);
  }

  const { createWorker } = getTesseract();
  const worker = await createWorker(languages, 1, { cachePath: cacheDir });
  try {
    const result = await worker.recognize(input);
    process.stdout.write(JSON.stringify({
      input,
      languages,
      text: (result.data.text || "").trim(),
      confidence: result.data.confidence ?? null
    }, null, 2) + "\n");
  } finally {
    await worker.terminate();
  }
}

main().catch(error => {
  process.stderr.write(`OCR failed: ${error.message}\n`);
  process.exitCode = 1;
});
