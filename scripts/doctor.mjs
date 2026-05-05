#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const checks = [];

function addCheck(name, ok, detail, fix) {
  checks.push({ name, ok, detail, fix });
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    ...options,
  });
}

function firstLine(text) {
  return String(text || "").trim().split(/\r?\n/)[0] || "";
}

function summarizeNativeError(text) {
  const raw = String(text || "");
  if (raw.includes("not valid for use in process")) {
    return "native binary rejected by macOS code signing";
  }
  if (raw.includes("Cannot find native binding")) {
    return "native binding missing or installed for the wrong runtime";
  }
  if (raw.includes("Failed to load SWC binary")) {
    return "Next SWC binary failed to load";
  }
  return firstLine(raw);
}

function runNodeSnippet(snippet) {
  return run(process.execPath, ["-e", snippet]);
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  addCheck(
    "Node.js version",
    major === 22,
    `found ${process.version}`,
    "Install/use Node 22, then reinstall dependencies: rm -rf node_modules .next && npm ci"
  );
}

function checkNpmAvailable() {
  const result = run(npmCommand, ["--version"]);
  addCheck(
    "npm available",
    result.status === 0,
    result.status === 0 ? `found npm ${firstLine(result.stdout)}` : firstLine(result.stderr) || result.error?.message || "not found",
    "Install Node 22 from nodejs.org, nvm, fnm, Volta, or your package manager so npm is on PATH."
  );
}

function checkDependenciesInstalled() {
  addCheck(
    "dependencies installed",
    existsSync(path.join(root, "node_modules")),
    "node_modules directory",
    "Run npm ci for a clean install, or npm install while developing."
  );
}

function checkPrismaClientsGenerated() {
  const postgresClient = existsSync(path.join(root, "lib/generated/prisma/client.ts"));
  const sqliteClient = existsSync(path.join(root, "lib/generated/prisma-sqlite/client.ts"));
  addCheck(
    "Prisma clients generated",
    postgresClient && sqliteClient,
    `postgres=${postgresClient ? "yes" : "no"}, sqlite=${sqliteClient ? "yes" : "no"}`,
    "Run npm run prisma:generate."
  );
}

function checkPrismaSchema(schemaPath) {
  let prismaCli;
  try {
    prismaCli = require.resolve("prisma/build/index.js");
  } catch (error) {
    addCheck(
      `Prisma schema ${schemaPath}`,
      false,
      firstLine(error.message),
      "Run npm ci, then npm run prisma:generate."
    );
    return;
  }

  const result = run(process.execPath, [prismaCli, "validate", `--schema=${schemaPath}`]);
  addCheck(
    `Prisma schema ${schemaPath}`,
    result.status === 0,
    result.status === 0 ? "valid" : firstLine(result.stderr || result.stdout),
    "Fix the schema error shown above, then rerun npm run doctor."
  );
}

function checkNextSwc() {
  const result = runNodeSnippet(`
    (async () => {
      const swc = require("next/dist/build/swc");
      await swc.loadBindings();
    })().catch((error) => {
      console.error(error && error.message ? error.message : error);
      process.exit(1);
    });
  `);

  addCheck(
    "Next SWC native binding",
    result.status === 0,
    result.status === 0 ? "loadable" : summarizeNativeError(result.stderr || result.stdout),
    "Use Node 22, then reinstall native dependencies: rm -rf node_modules .next && npm ci"
  );
}

function checkRolldown() {
  const result = runNodeSnippet(`
    import("rolldown").catch((error) => {
      console.error(error && error.message ? error.message : error);
      process.exit(1);
    });
  `);

  addCheck(
    "Vitest/Rolldown native binding",
    result.status === 0,
    result.status === 0 ? "loadable" : summarizeNativeError(result.stderr || result.stdout),
    "Use Node 22, then reinstall native dependencies: rm -rf node_modules .next && npm ci"
  );
}

console.log("Scrollback doctor\n");

checkNodeVersion();
checkNpmAvailable();
checkDependenciesInstalled();
checkPrismaClientsGenerated();
checkPrismaSchema("prisma/schema.prisma");
checkPrismaSchema("prisma/schema-sqlite.prisma");
checkNextSwc();
checkRolldown();

const nameWidth = Math.max(...checks.map((check) => check.name.length));
for (const check of checks) {
  const status = check.ok ? "PASS" : "FAIL";
  console.log(`${status} ${check.name.padEnd(nameWidth)} ${check.detail}`);
  if (!check.ok) {
    console.log(`     Fix: ${check.fix}`);
  }
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log(`\n${failed.length} check${failed.length === 1 ? "" : "s"} failed.`);
  process.exit(1);
}

console.log("\nAll checks passed.");
