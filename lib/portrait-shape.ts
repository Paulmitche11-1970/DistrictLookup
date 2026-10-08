export const photoAspectRatios = [
  'auto',
  '1:1',
  '4:5',
  '3:4',
  '2:3',
  '4:3',
] as const;
export type PhotoAspectRatio = (typeof photoAspectRatios)[number];
export type PhotoCrop = { x: number; y: number; zoom: number };
export const defaultPhotoCrop: PhotoCrop = { x: 0.5, y: 0.2, zoom: 1 };
export const photoShapeOptions: { value: PhotoAspectRatio; label: string }[] = [
  { value: 'auto', label: 'Match original photos' },
  { value: '1:1', label: 'Square · 1:1' },
  { value: '4:5', label: 'Portrait · 4:5' },
  { value: '3:4', label: 'Portrait · 3:4' },
  { value: '2:3', label: 'Tall portrait · 2:3' },
  { value: '4:3', label: 'Landscape · 4:3' },
];
export function portraitRatio(agency: {
  photoAspectRatio?: PhotoAspectRatio;
  sourcePhotoAspectRatio?: number;
}) {
  if (agency.photoAspectRatio && agency.photoAspectRatio !== 'auto') {
    const [w, h] = agency.photoAspectRatio.split(':').map(Number);
    return w / h;
  }
  const ratio = agency.sourcePhotoAspectRatio;
  return ratio && Number.isFinite(ratio) && ratio >= 0.4 && ratio <= 2.5
    ? ratio
    : 0.8;
}
export function portraitStyle(agency: Parameters<typeof portraitRatio>[0]) {
  return { '--official-photo-ratio': portraitRatio(agency) };
}
export function portraitRatioLabel(ratio: number) {
  for (const [width, height] of [
    [1, 1],
    [4, 5],
    [3, 4],
    [2, 3],
    [4, 3],
    [5, 7],
    [7, 10],
    [8, 9],
  ])
    if (Math.abs(width / height - ratio) < 0.002) return `${width}:${height}`;
  return `${ratio.toFixed(2)}:1`;
}
// Prefer the most common source shape, with the middle ratio as a tie-breaker.
// Small differences in exported pixel dimensions count as the same shape.
export function sourcePortraitRatio(
  sizes: { width: number; height: number }[],
) {
  const ratios = sizes
    .map(({ width, height }) => width / height)
    .filter((r) => Number.isFinite(r) && r >= 0.4 && r <= 2.5)
    .sort((a, b) => a - b);
  if (!ratios.length) return 0.8;
  const middle = ratios[Math.floor(ratios.length / 2)];
  const groups = new Map<number, number[]>();
  for (const ratio of ratios) {
    const key = Math.round(ratio * 50) / 50;
    groups.set(key, [...(groups.get(key) || []), ratio]);
  }
  const best = [...groups.entries()].sort(
    (a, b) =>
      b[1].length - a[1].length ||
      Math.abs(a[0] - middle) - Math.abs(b[0] - middle),
  )[0][1];
  return Number((best.reduce((sum, r) => sum + r, 0) / best.length).toFixed(5));
}
