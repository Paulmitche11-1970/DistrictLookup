declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';
  const shp: (
    input: ArrayBuffer,
  ) => Promise<FeatureCollection | FeatureCollection[]>;
  export default shp;
}
