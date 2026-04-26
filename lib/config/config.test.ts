import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configSchema } from './schema';

describe('configSchema', () => {
  it('validates a complete postgresql config', () => {
    const config = {
      database: { type: 'postgresql', url: 'postgresql://user:pass@localhost:5432/db' },
      embeddings: { provider: 'gemini', apiKey: 'test-key' },
      extension: { pairingToken: 'abc-123' },
      xapi: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('validates an OpenAI embeddings config', () => {
    const config = {
      database: { type: 'postgresql', url: 'postgresql://user:pass@localhost:5432/db' },
      embeddings: { provider: 'openai', apiKey: 'test-key' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('validates a minimal sqlite config', () => {
    const config = {
      database: { type: 'sqlite', url: 'file:./feedsilo.db' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('rejects invalid database type', () => {
    const config = {
      database: { type: 'mysql', url: 'mysql://localhost' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('rejects missing database url', () => {
    const config = {
      database: { type: 'postgresql' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('applies defaults for optional fields', () => {
    const config = {
      database: { type: 'sqlite', url: 'file:./feedsilo.db' },
    };
    const result = configSchema.parse(config);
    expect(result.search.keywordWeight).toBe(0.4);
    expect(result.search.semanticWeight).toBe(0.6);
  });
});

import { readConfig, writeConfig, resolveConfig, isConfigured } from './index';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('readConfig', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedsilo-test-'));
    configPath = path.join(tmpDir, 'feedsilo.config.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when config file does not exist', () => {
    const result = readConfig(configPath);
    expect(result).toBeNull();
  });

  it('returns null when config file is malformed JSON', () => {
    fs.writeFileSync(configPath, '{ broken json');
    const result = readConfig(configPath);
    expect(result).toBeNull();
  });

  it('returns null when config file fails Zod validation', () => {
    fs.writeFileSync(configPath, JSON.stringify({ database: { type: 'mysql' } }));
    const result = readConfig(configPath);
    expect(result).toBeNull();
  });

  it('reads and validates a correct config file', () => {
    const config = { database: { type: 'postgresql', url: 'postgresql://localhost/db' } };
    fs.writeFileSync(configPath, JSON.stringify(config));
    const result = readConfig(configPath);
    expect(result).not.toBeNull();
    expect(result!.database.type).toBe('postgresql');
  });
});

describe('writeConfig', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedsilo-test-'));
    configPath = path.join(tmpDir, 'feedsilo.config.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes config and .env.local files', () => {
    const config = {
      database: { type: 'postgresql' as const, url: 'postgresql://localhost/db' },
      embeddings: { provider: 'gemini' as const, apiKey: 'key123' },
      extension: { pairingToken: 'token456' },
      xapi: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
      localMedia: {},
    };
    const envPath = path.join(tmpDir, '.env.local');
    writeConfig(config, configPath, envPath);

    const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(written.database.type).toBe('postgresql');

    const envContent = fs.readFileSync(envPath, 'utf-8');
    expect(envContent).toContain('DATABASE_URL=postgresql://localhost/db');
    expect(envContent).toContain('DATABASE_TYPE=postgresql');
    expect(envContent).toContain('GEMINI_API_KEY=key123');
    expect(envContent).toContain('CAPTURE_SECRET=token456');
  });

  it('writes OpenAI keys when OpenAI is selected', () => {
    const config = {
      database: { type: 'postgresql' as const, url: 'postgresql://localhost/db' },
      embeddings: { provider: 'openai' as const, apiKey: 'key123' },
      extension: {},
      xapi: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
      localMedia: {},
    };
    const envPath = path.join(tmpDir, '.env.local');
    writeConfig(config, configPath, envPath);

    const envContent = fs.readFileSync(envPath, 'utf-8');
    expect(envContent).toContain('OPENAI_API_KEY=key123');
    expect(envContent).not.toContain('GEMINI_API_KEY=key123');
  });
});

describe('resolveConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('env vars take precedence over file config', () => {
    process.env.DATABASE_URL = 'postgresql://env-override/db';
    process.env.DATABASE_TYPE = 'postgresql';
    const fileConfig = {
      database: { type: 'sqlite' as const, url: 'file:./test.db' },
      embeddings: { provider: 'gemini' as const },
      extension: {},
      xapi: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
      localMedia: {},
    };
    const resolved = resolveConfig(fileConfig);
    expect(resolved!.database.url).toBe('postgresql://env-override/db');
    expect(resolved!.database.type).toBe('postgresql');
  });

  it('builds config from env vars when file config is null', () => {
    process.env.DATABASE_URL = 'postgresql://env-only/db';
    process.env.DATABASE_TYPE = 'postgresql';
    const resolved = resolveConfig(null);
    expect(resolved).not.toBeNull();
    expect(resolved!.database.url).toBe('postgresql://env-only/db');
    expect(resolved!.database.type).toBe('postgresql');
  });

  it('returns null when no file config and no env vars', () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_TYPE;
    const resolved = resolveConfig(null);
    expect(resolved).toBeNull();
  });

  it('falls back to file config when env vars are not set', () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_TYPE;
    const fileConfig = {
      database: { type: 'sqlite' as const, url: 'file:./test.db' },
      embeddings: { provider: 'gemini' as const },
      extension: {},
      xapi: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
      localMedia: {},
    };
    const resolved = resolveConfig(fileConfig);
    expect(resolved!.database.type).toBe('sqlite');
    expect(resolved!.database.url).toBe('file:./test.db');
  });
});

describe('isConfigured', () => {
  it('returns false when config is null', () => {
    expect(isConfigured(null)).toBe(false);
  });

  it('returns true when config has database type and url', () => {
    const config = {
      database: { type: 'sqlite' as const, url: 'file:./test.db' },
      embeddings: { provider: 'gemini' as const },
      extension: {},
      xapi: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
      localMedia: {},
    };
    expect(isConfigured(config)).toBe(true);
  });
});
