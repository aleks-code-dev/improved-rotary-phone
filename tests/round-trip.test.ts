import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { importPostmanCollection, exportPostmanCollection } from '../src/main/storage/import-export';

describe('Postman v2.1 round-trip', () => {
  const fixturesDir = join(__dirname, 'fixtures', 'postman');
  const fixtures = readdirSync(fixturesDir).filter(
    (f) => f.endsWith('.json') && f !== '.gitkeep'
  );

  it('has 20+ fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
  });

  for (const fixture of fixtures) {
    it(`round-trips ${fixture} without data loss`, () => {
      const original = readFileSync(join(fixturesDir, fixture), 'utf-8');

      // Step 1: Import
      const import1 = importPostmanCollection(original);
      if (!import1.ok) {
        expect(import1.ok, `Import 1 failed for ${fixture}: ${import1.error}`).toBe(true);
        return;
      }

      // Step 2: Export
      const export1 = exportPostmanCollection(import1.collection);
      if (!export1.ok) {
        expect(export1.ok, `Export 1 failed for ${fixture}: ${export1.error}`).toBe(true);
        return;
      }

      // Step 3: Re-import the export
      const import2 = importPostmanCollection(export1.json);
      expect(import2.ok, `Import 2 failed for ${fixture}`).toBe(true);
      if (!import2.ok) return;

      // Deep-equal on structural shape (strip _postman_id since import generates a new one)
      const stripPostmanId = (c: any) => ({
        ...c,
        info: { ...c.info, _postman_id: 'redacted' },
      });

      expect(
        stripPostmanId(import2.collection),
        `Round-trip mismatch for ${fixture}`
      ).toEqual(stripPostmanId(import1.collection));
    });
  }
});
