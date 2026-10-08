'use client';
import { useId } from 'react';
import type { Agency } from '@/lib/model';
import {
  photoShapeOptions,
  portraitRatio,
  portraitRatioLabel,
  type PhotoAspectRatio,
} from '@/lib/portrait-shape';
export function PhotoShapePicker({
  agency,
  value,
  onChange,
  disabled = false,
}: {
  agency: Agency;
  value: PhotoAspectRatio;
  onChange: (value: PhotoAspectRatio) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="photo-shape-picker" disabled={disabled}>
      <legend>Photo shape for all officials</legend>
      <div className="photo-shape-choices">
        {photoShapeOptions.map((option) => (
          <label
            key={option.value}
            className={value === option.value ? 'selected' : ''}
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span
              className="photo-shape-outline"
              aria-hidden="true"
              style={{
                aspectRatio: portraitRatio({
                  ...agency,
                  photoAspectRatio: option.value,
                }),
              }}
            />
            <span>
              {option.label}
              {option.value === 'auto'
                ? ` · ${portraitRatioLabel(portraitRatio({ ...agency, photoAspectRatio: 'auto' }))}`
                : ''}
            </span>
          </label>
        ))}
      </div>
      <p className="small muted">
        One shape for every official, in all four layouts and biography pages.
        Images are cropped to fit without stretching.
      </p>
    </fieldset>
  );
}
