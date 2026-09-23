import fs from "node:fs/promises";
import path from "node:path";

function usage() {
  return "Usage: node validate-source-coverage.mjs --total <positive-integer> --coverage <coverage.json>";
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(usage());
    values.set(key, value);
  }
  if (!values.has("--total") || !values.has("--coverage")) throw new Error(usage());
  const total = Number(values.get("--total"));
  if (!Number.isSafeInteger(total) || total < 1) throw new Error("--total must be a positive integer.");
  return { total, coverage: path.resolve(values.get("--coverage")) };
}

function compressUnits(units) {
  if (units.length === 0) return [];
  const ranges = [];
  let start = units[0];
  let end = units[0];
  for (const unit of units.slice(1)) {
    if (unit === end + 1) {
      end = unit;
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = unit;
      end = unit;
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const payload = JSON.parse(await fs.readFile(args.coverage, "utf8"));
  if (!Array.isArray(payload.ranges)) throw new Error("Coverage JSON must contain a ranges array.");

  const allowedStatuses = new Set(["parsed", "excluded", "unresolved"]);
  const seen = new Map();
  const invalid = [];
  const counts = { parsed: 0, excluded: 0, unresolved: 0 };

  payload.ranges.forEach((range, index) => {
    const label = `ranges[${index}]`;
    const start = range?.start;
    const end = range?.end;
    const status = range?.status;
    const note = typeof range?.note === "string" ? range.note.trim() : "";
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > args.total) {
      invalid.push(`${label} has an invalid or out-of-bounds range.`);
      return;
    }
    if (!allowedStatuses.has(status)) invalid.push(`${label} has an invalid status.`);
    if (!note) invalid.push(`${label} must include a non-empty note.`);
    if (!allowedStatuses.has(status)) return;
    for (let unit = start; unit <= end; unit += 1) {
      if (!seen.has(unit)) seen.set(unit, []);
      seen.get(unit).push(index);
      counts[status] += 1;
    }
  });

  const missing = [];
  const overlapping = [];
  for (let unit = 1; unit <= args.total; unit += 1) {
    const owners = seen.get(unit) ?? [];
    if (owners.length === 0) missing.push(unit);
    if (owners.length > 1) overlapping.push(unit);
  }

  const complete = invalid.length === 0 && missing.length === 0 && overlapping.length === 0;
  process.stdout.write(JSON.stringify({
    complete,
    total: args.total,
    counts,
    missing: compressUnits(missing),
    overlapping: compressUnits(overlapping),
    invalid
  }, null, 2) + "\n");
  if (!complete) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`Coverage validation failed: ${error.message}\n`);
  process.exitCode = 1;
});
