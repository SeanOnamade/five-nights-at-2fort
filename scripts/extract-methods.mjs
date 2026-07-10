#!/usr/bin/env node
// Refactoring helper: extracts class methods (with preceding comment block) from a
// source file, writes them to stdout-specified output, and removes them in place.
// Usage: node scripts/extract-methods.mjs <sourceFile> <outFile(txtappend)> <method1> <method2> ...
// Pass --dry to only report ranges without modifying anything.

import fs from 'node:fs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const rest = args.filter(a => a !== '--dry');
const [sourceFile, outFile, ...methodNames] = rest;

const src = fs.readFileSync(sourceFile, 'utf8');
const lines = src.split('\n');

function findMethod(name) {
  // Match e.g. "  private foo(", "  public foo(", "  foo(", "  private async foo("
  const re = new RegExp(`^  (?:private |public |protected )?(?:async )?${name}\\(`);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      // include preceding comment block (// or /** */) and blank line handling
      let start = i;
      let j = i - 1;
      while (j >= 0) {
        const t = lines[j].trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t === '*/') {
          start = j;
          j--;
        } else {
          break;
        }
      }
      // brace match from line i
      let depth = 0;
      let started = false;
      for (let k = i; k < lines.length; k++) {
        // naive brace count; good enough for this codebase (no braces in strings that unbalance across lines materially)
        const line = lines[k];
        for (const ch of stripStringsAndComments(line)) {
          if (ch === '{') { depth++; started = true; }
          else if (ch === '}') { depth--; }
        }
        if (started && depth === 0) {
          return { name, start, end: k }; // inclusive, 0-based
        }
      }
      throw new Error(`Brace matching failed for ${name}`);
    }
  }
  return null;
}

function stripStringsAndComments(line) {
  // remove string literals and line comments to avoid counting braces inside them
  let out = '';
  let i = 0;
  let mode = null; // null | '"' | "'" | '`'
  while (i < line.length) {
    const ch = line[i];
    if (mode) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === mode) mode = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { mode = ch; i++; continue; }
    if (ch === '/' && line[i + 1] === '/') break;
    out += ch;
    i++;
  }
  return out;
}

const found = [];
const missing = [];
for (const name of methodNames) {
  const m = findMethod(name);
  if (m) found.push(m);
  else missing.push(name);
}

if (missing.length) {
  console.error('MISSING: ' + missing.join(', '));
}

found.sort((a, b) => a.start - b.start);

// check overlaps
for (let i = 1; i < found.length; i++) {
  if (found[i].start <= found[i - 1].end) {
    throw new Error(`Overlap between ${found[i - 1].name} and ${found[i].name}`);
  }
}

for (const m of found) {
  console.log(`${m.name}: lines ${m.start + 1}-${m.end + 1} (${m.end - m.start + 1} lines)`);
}

if (dry) process.exit(0);

// build extracted text and remaining source
let extracted = '';
const keep = [];
let idx = 0;
for (let i = 0; i < lines.length; i++) {
  const m = found[idx];
  if (m && i >= m.start && i <= m.end) {
    extracted += lines[i] + '\n';
    if (i === m.end) {
      extracted += '\n';
      idx++;
      // swallow one following blank line to avoid double blanks in source
      if (i + 1 < lines.length && lines[i + 1].trim() === '') i++;
    }
  } else {
    keep.push(lines[i]);
  }
}

fs.appendFileSync(outFile, extracted);
fs.writeFileSync(sourceFile, keep.join('\n'));
console.log(`Extracted ${found.length} methods to ${outFile}; source now ${keep.length} lines.`);
