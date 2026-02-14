import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { buildTestApp } from './setup.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('OpenAPI contract', () => {
  it('generates a valid OpenAPI 3.0 spec', async () => {
    const spec = app.swagger();
    // SwaggerParser.validate() throws on invalid specs
    const validated = await SwaggerParser.validate(structuredClone(spec)) as Record<string, unknown>;
    expect(validated.openapi).toBe('3.0.3');
  });

  it('does not leak raw Zod internals', () => {
    const spec = app.swagger();
    const json = JSON.stringify(spec);
    expect(json).not.toContain('"typeName":"Zod');
    expect(json).not.toContain('"~standard"');
    expect(json).not.toContain('"_def"');
    expect(json).not.toContain('"_cached"');
  });

  it('every 2xx response (except 204) has a JSON schema', () => {
    const spec = app.swagger();
    const missing: string[] = [];

    for (const [path, methods] of Object.entries(spec.paths ?? {})) {
      for (const [method, operation] of Object.entries(methods as Record<string, unknown>)) {
        if (!operation || typeof operation !== 'object') continue;
        const op = operation as { responses?: Record<string, unknown> };
        if (!op.responses) continue;

        for (const [statusCode, response] of Object.entries(op.responses)) {
          const code = Number(statusCode);
          if (code < 200 || code >= 300 || code === 204) continue;

          const resp = response as { content?: { 'application/json'?: { schema?: unknown } } };
          if (!resp.content?.['application/json']?.schema) {
            missing.push(`${method.toUpperCase()} ${path} → ${statusCode}`);
          }
        }
      }
    }

    expect(missing, `Routes missing response schemas:\n${missing.join('\n')}`).toEqual([]);
  });

  it('committed openapi.json matches the generated spec (drift detection)', () => {
    const spec = app.swagger();
    const generated = JSON.stringify(spec, null, 2);

    const committedPath = resolve(import.meta.dirname, '../../openapi.json');
    const committed = readFileSync(committedPath, 'utf-8');

    expect(
      generated,
      'openapi.json is out of date — run `pnpm gen` and commit the result',
    ).toBe(committed);
  });
});
