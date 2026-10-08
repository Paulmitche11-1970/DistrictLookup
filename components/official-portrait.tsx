'use client';
import { useEffect, useState } from 'react';
import type { Official } from '@/lib/model';
import { defaultPhotoCrop } from '@/lib/portrait-shape';

export function Portrait({
  official,
  className = '',
}: {
  official: Pick<Official, 'name' | 'photo' | 'photoCrop'>;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [official.photo]);
  const crop = official.photoCrop || defaultPhotoCrop;
  const position = `${crop.x * 100}% ${crop.y * 100}%`;
  return (
    <span
      className={`official-portrait ${className}`}
      style={{
        height: 'auto',
        aspectRatio: 'var(--official-photo-ratio, 0.8)',
      }}
    >
      {official.photo && !failed ? (
        <img
          src={official.photo}
          alt={official.name || 'Official portrait'}
          onError={() => setFailed(true)}
          style={{
            objectPosition: position,
            transform: `scale(${crop.zoom})`,
            transformOrigin: position,
          }}
        />
      ) : (
        <span className="portrait-initials" aria-hidden="true">
          {official.name
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join('') || 'Photo'}
        </span>
      )}
    </span>
  );
}
