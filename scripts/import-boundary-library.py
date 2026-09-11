"""Import RP's inventoried final district boundaries, without changing source files.

Run from the workspace: python elected-lookup/scripts/import-boundary-library.py
Requires pyshp, shapely and pyproj. Only district IDs and geometry enter the app.
Full source paths and component hashes stay in the local audit output.
"""
from pathlib import Path, PurePosixPath
from collections import defaultdict, Counter
from datetime import datetime, timezone
import gzip, hashlib, io, json, math, re, sys, zipfile

WORKSPACE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(WORKSPACE / 'work/arpeeville-runtime'))
import shapefile
from shapely.geometry import shape, mapping
from shapely.ops import transform, unary_union
from shapely.validation import explain_validity
from pyproj import CRS, Transformer

REPO = WORKSPACE / 'elected-lookup'
OUT = REPO / 'data/boundaries'
AUDIT = WORKSPACE / 'outputs/boundary-library'
SOURCE_ROOT = 'C:\\PDI - Redistricting Dropbox\\Redistricting Files\\'
GROUPS = ['School districts', 'County education boards', 'Community colleges', 'Special districts']
FIELDS = {'district', 'districtnu', 'dist_id', 'districtid', 'trustee', 'trustarea', 'trusteeare', 'division', 'zone'}
# One source-specific legacy export, never a generic DATA/ID fallback.
FIELD_OVERRIDES = {SOURCE_ROOT + r'Grossmont Cuyamaca CCD\Final\GCCCD_Adopted_Plan.shp': 'DATA'}
SOURCE_HOLDS = {SOURCE_ROOT + r'OPUD\OPUD Draft Map Shapefiles\Final Plan from Plan B2.shp': 'This file duplicates the Mt. San Jacinto college map and does not establish Olivehurst boundaries. Locate the correct adopted OPUD shapefile.'}

def normalize_label(value):
    if value is None: return ''
    if isinstance(value, float):
        if not math.isfinite(value): return ''
        if value.is_integer(): return str(int(value))
    return str(value).strip()

def read_components(source):
    """Match .DBF and .dbf identically, including within ZIPs; never extract."""
    if ' :: ' in source:
        archive, member = source.split(' :: ', 1)
        stem = str(PurePosixPath(member).with_suffix('')).casefold()
        with zipfile.ZipFile(archive) as z:
            members = {n.casefold(): n for n in z.namelist()}
            return {ext: z.read(members[stem + ext]) for ext in ['.shp', '.shx', '.dbf', '.prj'] if stem + ext in members}
    p = Path(source)
    files = {f.name.casefold(): f for f in p.parent.iterdir() if f.is_file()}
    return {ext: files[(p.stem + ext).casefold()].read_bytes() for ext in ['.shp', '.shx', '.dbf', '.prj'] if (p.stem + ext).casefold() in files}

def import_source(source, suggested_field):
    if source in SOURCE_HOLDS: raise ValueError(SOURCE_HOLDS[source])
    raw = read_components(source)
    missing = sorted(set(['.shp', '.shx', '.dbf', '.prj']) - raw.keys())
    if missing: raise ValueError('Missing shapefile components: ' + ', '.join(missing))
    reader = shapefile.Reader(shp=io.BytesIO(raw['.shp']), shx=io.BytesIO(raw['.shx']), dbf=io.BytesIO(raw['.dbf']), encoding='latin1')
    fields = [f[0] for f in reader.fields[1:]]
    # Never infer districts from feature IDs, row order, names, or colors.
    field = FIELD_OVERRIDES.get(source) or next((f for f in fields if f.casefold() == 'district'), None)
    if not field and suggested_field in fields and suggested_field.casefold() in FIELDS: field = suggested_field
    if not field:
        candidates = [f for f in fields if f.casefold() in FIELDS]
        if len(candidates) == 1: field = candidates[0]
    if not field: raise ValueError('No unambiguous district-assignment field; inspect the source attributes.')
    crs = CRS.from_wkt(raw['.prj'].decode('utf-8-sig'))
    to_wgs = Transformer.from_crs(crs, 4326, always_xy=True).transform
    to_meters = Transformer.from_crs(4326, 3310, always_xy=True).transform
    grouped = defaultdict(list)
    skipped = []
    for index, record in enumerate(reader.iterShapeRecords()):
        attrs = record.record.as_dict()
        label = normalize_label(attrs[field])
        if not label:
            skipped.append({'record': index + 1, 'sourceLabel': attrs.get('DISTRICT_L', ''), 'population': attrs.get('PPA_POPULA')})
            continue
        if label.casefold() in {'unassigned', 'unassigne', 'null', 'none'}:
            raise ValueError('A nonblank unassigned district label requires source review.')
        if len(label) > 40 or not re.fullmatch(r'[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*', label):
            raise ValueError('District label contains unsupported characters; inspect the source field.')
        g = shape(record.shape.__geo_interface__)
        if g.geom_type not in ['Polygon', 'MultiPolygon'] or g.is_empty: raise ValueError(f'District {label}: empty or non-polygon geometry.')
        if not g.is_valid: raise ValueError(f'District {label}: source geometry requires repair ({explain_validity(g)}).')
        grouped[label].append(g)
    if not 2 <= len(grouped) <= 30: raise ValueError(f'Found {len(grouped)} assigned districts; a whole district plan is required.')
    if source in FIELD_OVERRIDES and set(grouped) != {'1', '2', '3', '4', '5'}: raise ValueError('Legacy DATA mapping no longer matches the reviewed five-area source.')
    geometries = {}
    for label, pieces in grouped.items():
        # Dissolve by the explicit district field; retain islands and holes.
        g = transform(to_wgs, unary_union(pieces))
        if g.is_empty or not g.is_valid: raise ValueError(f'District {label}: invalid geometry after projection.')
        if not all(math.isfinite(v) for v in g.bounds): raise ValueError('Nonfinite map coordinates.')
        west, south, east, north = g.bounds
        if not (-125.5 < west <= east < -113 and 31 < south <= north < 43): raise ValueError('Projected bounds fall outside the California review extent.')
        geometries[label] = g
    labels = sorted(geometries, key=lambda x: (0, int(x)) if x.isdigit() else (1, x))
    metric = {d: transform(to_meters, g) for d, g in geometries.items()}
    overlaps = []
    for i, d in enumerate(labels):
        for e in labels[i+1:]:
            area = metric[d].intersection(metric[e]).area
            if area > 0.01: overlaps.append({'districts': [d, e], 'squareMeters': round(area, 3)})
    warnings = []
    if source in FIELD_OVERRIDES:
        warnings.append('Legacy export: DATA supplies the five area labels. Confirm all assignments against the adopted plan before public address lookup.')
    if skipped:
        warnings.append(f'{len(skipped)} feature(s) with blank district assignments excluded from the district map.')
    populated_unassigned = any(x['population'] not in [None, 0, 0.0] for x in skipped)
    if populated_unassigned: warnings.append('The source has population in an unassigned feature. Resolve coverage before address lookup.')
    if overlaps: warnings.append('District polygons overlap. Review the recorded overlap areas before address lookup.')
    fc = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'district': d}, 'geometry': mapping(geometries[d])} for d in labels]}
    qa = {'districtField': field, 'districts': labels, 'sourceRecords': len(reader), 'assignedRecords': sum(len(g) for g in grouped.values()), 'excludedRecords': len(skipped), 'sourceCrs': crs.to_string(), 'bounds': list(unary_union(list(geometries.values())).bounds), 'parts': {d: len(g.geoms) if g.geom_type == 'MultiPolygon' else 1 for d, g in geometries.items()}, 'overlaps': overlaps, 'warnings': warnings, 'geometryValid': True, 'needsReview': bool(overlaps or populated_unassigned or source in FIELD_OVERRIDES), 'componentHashes': {k: hashlib.sha256(v).hexdigest() for k, v in raw.items()}, 'excludedSourceRecords': skipped}
    return fc, qa

def main():
    OUT.mkdir(parents=True, exist_ok=True); AUDIT.mkdir(parents=True, exist_ok=True)
    inventory = json.loads((WORKSPACE/'outputs/agency-expansion-sep11/agency-expansion-inventory.json').read_text())
    candidates = json.loads((WORKSPACE/'work/agency-expansion/sonoma-sep11/fresh-boundary-candidates.json').read_text())
    rows = [r for r in inventory['rows'] if r['agency_type'] in GROUPS]
    manifest, audit = [], []
    for row in rows:
        source = row['preferred_shapefile_path']
        selection_note = 'Selected final/adopted source from RP file inventory; current adoption still requires confirmation.'
        if row['agency'] == 'Yosemite Community College District':
            source = next(c['path'] for c in candidates if c['agency'] == row['agency'] and '\\2026 Final Packet\\' in c['path'] and c['districtLabelCount'] == 7)
            selection_note = 'Selected the 2026 Final Packet cleanup map instead of the older Final Packet plan.'
        if row['agency'] == 'Olivehurst Public Utility District':
            source = SOURCE_ROOT + r'OPUD\Final Plan\OPUD Final Plan Base on Parcels.shp'
            selection_note = 'Selected the parcel-based plan in OPUD/Final Plan. Rejected a misplaced final-labeled file in the draft-shapefile folder that duplicated Mt. San Jacinto CCD.'
        # Agency identity includes its type: Napa COE must never become Napa County.
        slug = re.sub(r'[^a-z0-9]+', '-', row['agency'].lower()).strip('-')
        entry = {'id': slug, 'name': row['agency'], 'category': row['agency_type'], 'status': 'needs-source-review', 'mapAvailable': False, 'source': source.removeprefix(SOURCE_ROOT).replace('\\', '/'), 'shapefile': Path(source.split(' :: ')[-1]).name, 'selectionNote': selection_note, 'districts': [], 'districtField': row.get('district_field_candidate') or '', 'sourceRecords': row.get('record_count') or 0, 'excludedRecords': 0, 'warnings': [], 'localRosterCount': row.get('local_roster_count') or 0, 'currentAdoptionVerified': False}
        try:
            fc, qa = import_source(source, row.get('district_field_candidate'))
            encoded = json.dumps(fc, separators=(',', ':'), allow_nan=False).encode()
            data = gzip.compress(encoded, compresslevel=9, mtime=0)
            (OUT/(slug+'.json.gz')).write_bytes(data)
            entry.update({k: qa[k] for k in ['districts', 'districtField', 'sourceRecords', 'excludedRecords', 'warnings', 'sourceCrs', 'bounds', 'parts', 'overlaps']})
            entry.update(status='imported-needs-review' if qa['needsReview'] else 'imported', mapAvailable=True, mapSha256=hashlib.sha256(encoded).hexdigest(), compressedBytes=len(data))
            audit.append({'id': slug, 'source': source, **qa})
        except Exception as error:
            entry['warnings'] = [str(error)]
            audit.append({'id': slug, 'source': source, 'error': str(error)})
        manifest.append(entry)
        print(f"{entry['status']:24} {len(entry['districts']):2} {row['agency']} {entry['warnings'] if not entry['mapAvailable'] else ''}", flush=True)
    counts = {g: dict(Counter(r['status'] for r in manifest if r['category'] == g)) for g in GROUPS}
    identical = defaultdict(list)
    for entry in manifest:
        if entry['mapAvailable']: identical[entry['mapSha256']].append(entry['name'])
    for names in identical.values():
        if len(names) > 1: print('IDENTICAL SOURCE GEOMETRY - review adoption for each agency: ' + ' / '.join(names))
    result = {'importedAt': datetime.now(timezone.utc).isoformat(), 'sourceRootLabel': 'RP Redistricting Files', 'categories': GROUPS, 'summary': counts, 'agencies': manifest}
    (OUT/'index.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf8')
    (AUDIT/'source-audit.json').write_text(json.dumps(audit, indent=2, ensure_ascii=False), encoding='utf8')
    print(json.dumps(counts))

if __name__ == '__main__': main()
