import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { boundaryFor } from './boundary-catalog';
import type { DistrictMap } from './model';

export async function readBoundaryMap(id: string): Promise<DistrictMap | null> {
  const agency = boundaryFor(id);
  if (!agency?.mapAvailable) return null;
  // The catalog is the allowlist: URL input never supplies a filesystem path.
  const bytes = gunzipSync(
    await readFile(
      path.join(process.cwd(), 'data', 'boundaries', `${agency.id}.json.gz`),
    ),
  );
  if (createHash('sha256').update(bytes).digest('hex') !== agency.mapSha256)
    throw new Error('Boundary file does not match the imported source.');
  return JSON.parse(bytes.toString('utf8')) as DistrictMap;
}
