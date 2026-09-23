import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  return "Usage: node prepare-notes-docx.mjs --output <new-docx-path> [--layout paragraph|table]";
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.length % 2 !== 0) throw new Error(usage());
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!["--output", "--layout"].includes(key) || !value || values.has(key)) throw new Error(usage());
    values.set(key, value);
  }
  if (!values.has("--output")) throw new Error(usage());
  const layout = values.get("--layout") ?? "paragraph";
  if (!["paragraph", "table"].includes(layout)) throw new Error("--layout must be paragraph or table.");
  return { output: values.get("--output"), layout };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const templateName = args.layout === "table"
    ? "course-study-table-template.docx"
    : "course-notes-template.docx";
  const template = path.join(skillRoot, "assets", templateName);
  const output = path.resolve(args.output);
  if (path.extname(output).toLowerCase() !== ".docx") throw new Error("Output path must end in .docx.");

  await fs.access(template, fsConstants.R_OK);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.copyFile(template, output, fsConstants.COPYFILE_EXCL);

  process.stdout.write(JSON.stringify({
    template,
    output,
    layout: args.layout,
    createdFromTemplate: true
  }, null, 2) + "\n");
}

main().catch(error => {
  process.stderr.write(`Template preparation failed: ${error.message}\n`);
  process.exitCode = 1;
});
