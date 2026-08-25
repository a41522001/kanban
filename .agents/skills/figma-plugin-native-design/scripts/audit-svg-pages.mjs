#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];

if (!input) {
  console.error("Usage: node audit-svg-pages.mjs <design-directory>");
  process.exit(2);
}

const designDir = path.resolve(input);

if (!fs.existsSync(designDir) || !fs.statSync(designDir).isDirectory()) {
  console.error("Design directory not found: " + designDir);
  process.exit(2);
}

const files = fs
  .readdirSync(designDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".svg"))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const errors = [];
const warnings = [];
const rows = [];

for (const file of files) {
  const fullPath = path.join(designDir, file);
  const source = fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
  const rootMatch = source.match(/<svg\b([^>]*)>/i);
  const closeCount = (source.match(/<\/svg\s*>/gi) ?? []).length;
  const rootCount = (source.match(/<svg\b/gi) ?? []).length;

  if (!rootMatch || rootCount !== 1 || closeCount !== 1) {
    errors.push(file + ": expected exactly one complete <svg> root");
    continue;
  }

  const nestingError = validateTagNesting(source);
  if (nestingError) errors.push(file + ": " + nestingError);

  const attrs = rootMatch[1];
  const width = readAttr(attrs, "width");
  const height = readAttr(attrs, "height");
  const viewBox = readAttr(attrs, "viewBox");

  if (!validDimension(width) && !validViewBox(viewBox)) {
    errors.push(file + ": missing a valid width or viewBox");
  }

  if (!validDimension(height) && !validViewBox(viewBox)) {
    errors.push(file + ": missing a valid height or viewBox");
  }

  if (!viewBox && validDimension(width) && validDimension(height)) {
    warnings.push(file + ": no viewBox; responsive scaling may be harder to inspect");
  }

  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length > 0) {
    errors.push(file + ": duplicate id values (" + duplicateIds.join(", ") + ")");
  }

  rows.push({
    file,
    size: viewBox || (width || "?") + " x " + (height || "?"),
    ids: ids.length,
  });
}

if (files.length === 0) {
  warnings.push("No SVG files found directly under " + designDir);
}

console.log("SVG audit: " + designDir);
for (const row of rows) console.log("  OK  " + row.file + " | " + row.size + " | " + row.ids + " id(s)");
for (const warning of warnings) console.warn("  WARN  " + warning);
for (const error of errors) console.error("  ERROR " + error);
console.log("Summary: " + rows.length + "/" + files.length + " readable, " + warnings.length + " warning(s), " + errors.length + " error(s)");

process.exit(errors.length ? 1 : 0);

function readAttr(attrs, name) {
  const match = attrs.match(new RegExp("\\b" + name + "\\s*=\\s*[\"']([^\"']+)[\"']", "i"));
  return match?.[1]?.trim() || "";
}

function validDimension(value) {
  return /^\d+(?:\.\d+)?(?:px)?$/i.test(value) && Number.parseFloat(value) > 0;
}

function validViewBox(value) {
  const values = value.trim().split(/[\s,]+/).map(Number);
  return values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0;
}

function validateTagNesting(source) {
  const cleaned = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "");

  const tags = cleaned.match(/<\/?[A-Za-z_][^>]*>/g) ?? [];
  const stack = [];

  for (const tag of tags) {
    if (/\/>$/.test(tag)) continue;

    const nameMatch = tag.match(/^<\/?\s*([A-Za-z_][\w:.-]*)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    if (/^<\//.test(tag)) {
      const expected = stack.pop();
      if (expected !== name) {
        return "mismatched closing tag </" + name + ">; expected </" + (expected || "none") + ">";
      }
    } else {
      stack.push(name);
    }
  }

  return stack.length ? "unclosed tag <" + stack[stack.length - 1] + ">" : "";
}