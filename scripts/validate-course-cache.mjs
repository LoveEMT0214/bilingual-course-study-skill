import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

function usage() {
  return "Usage: node validate-course-cache.mjs --source <course-file> --cache <cache.md>";
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!["--source", "--cache"].includes(key) || !value) throw new Error(usage());
    args[key.slice(2)] = value;
  }
  if (!args.source || !args.cache) throw new Error(usage());
  return args;
}

function parseFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) throw new Error("Cache file must begin with YAML frontmatter.");
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("Cache frontmatter is not closed.");

  const values = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) throw new Error(`Invalid frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const source = path.resolve(args.source);
  const cache = path.resolve(args.cache);
  const [sourceStat, cacheText] = await Promise.all([
    fs.stat(source),
    fs.readFile(cache, "utf8")
  ]);
  if (!sourceStat.isFile()) throw new Error("Source must be a file.");

  const meta = parseFrontmatter(cacheText);
  const required = ["schema", "source_file", "source_sha256", "source_size", "source_format", "course"];
  const missing = required.filter(key => !meta[key]);
  if (missing.length) throw new Error(`Cache frontmatter is missing: ${missing.join(", ")}`);
  if (!/^[0-9a-f]{64}$/.test(meta.source_sha256)) {
    throw new Error("source_sha256 must be a 64-character lowercase SHA-256 value.");
  }
  if (!/^\d+$/.test(meta.source_size)) throw new Error("source_size must be a non-negative integer.");

  const actualSha256 = await sha256(source);
  const schemaSupported = meta.schema === "bilingual-course-cache/v1";
  const hashMatch = meta.source_sha256 === actualSha256;
  const sizeMatch = Number(meta.source_size) === sourceStat.size;
  const fileNameMatch = meta.source_file === path.basename(source);
  const fresh = schemaSupported && hashMatch && sizeMatch;

  process.stdout.write(JSON.stringify({
    status: fresh ? "fresh" : "stale",
    fresh,
    source,
    cache,
    schema: meta.schema,
    schemaSupported,
    expectedSha256: meta.source_sha256,
    actualSha256,
    expectedSize: Number(meta.source_size),
    actualSize: sourceStat.size,
    hashMatch,
    sizeMatch,
    fileNameMatch
  }, null, 2) + "\n");
}

main().catch(error => {
  process.stderr.write(`Cache validation failed: ${error.message}\n`);
  process.exitCode = 1;
});
