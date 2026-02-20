#!/usr/bin/env node
// Usage:
//   node scripts/release.mjs patch          → 0.0.1 → 0.0.2        (tag: v0.0.2)
//   node scripts/release.mjs minor          → 0.0.1 → 0.1.0        (tag: v0.1.0)
//   node scripts/release.mjs major          → 0.0.1 → 1.0.0        (tag: v1.0.0)
//   node scripts/release.mjs patch --dev    → 0.0.1 → 0.0.2-dev.1  (tag: v0.0.2-dev.1)
//   node scripts/release.mjs minor --dev    → 0.0.1 → 0.1.0-dev.1  (tag: v0.1.0-dev.1)

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const bump = args[0] ?? "patch";
const dev = args.includes("--dev");

if (!["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: node scripts/release.mjs [patch|minor|major] [--dev]");
  process.exit(1);
}

// Read current version from api package.json (source of truth)
const apiPkg = JSON.parse(readFileSync("apps/api/package.json", "utf8"));
const current = apiPkg.version;

// Split into parts (strip pre-release suffix)
const base = current.replace(/-.*$/, "");
let [major, minor, patch] = base.split(".").map(Number);

if (bump === "major") { major++; minor = 0; patch = 0; }
else if (bump === "minor") { minor++; patch = 0; }
else { patch++; }

const newBase = `${major}.${minor}.${patch}`;
const version = dev ? `${newBase}-dev.1` : newBase;
const tag = `v${version}`;

console.log(`Bumping ${current} → ${version}`);

// Update all package.json files
const pkgs = [
  "package.json",
  "apps/api/package.json",
  "apps/web/package.json",
  "packages/shared/package.json",
];

for (const pkgPath of pkgs) {
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.version !== undefined) {
    pkg.version = version;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`  ✓ ${pkgPath}`);
  }
}

// Commit + tag
execSync(`git add package.json apps/api/package.json apps/web/package.json packages/shared/package.json`);
execSync(`git commit -m "chore: release ${tag}"`);
execSync(`git tag ${tag}`);

console.log("");
console.log(`Created commit + tag ${tag}`);
console.log(`Push with: git push origin main --tags`);
console.log(`      or: git push origin dev --tags`);
