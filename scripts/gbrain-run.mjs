#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const envFile = process.env.GBRAIN_ENV_FILE || join(homedir(), '.gbrain', 'gbrain.env');
const gbrainBin = process.env.GBRAIN_BIN || 'gbrain';
const gbrainWorkdir = process.env.GBRAIN_WORKDIR || join(homedir(), 'gbrain');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: npm run gbrain -- <gbrain args>');
  console.error('Example: npm run gbrain -- doctor --json');
  process.exit(2);
}

if (!existsSync(envFile)) {
  console.error(`Missing GBrain env file: ${envFile}`);
  process.exit(1);
}

if (!existsSync(gbrainWorkdir)) {
  console.error(`Missing GBrain workdir: ${gbrainWorkdir}`);
  process.exit(1);
}

function parseEnvFile(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const child = spawn(gbrainBin, args, {
  stdio: 'inherit',
  cwd: gbrainWorkdir,
  env: {
    ...process.env,
    ...parseEnvFile(envFile),
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`gbrain exited from signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
