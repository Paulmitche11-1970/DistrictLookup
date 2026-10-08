'use client';
import { useEffect, useId, useState } from 'react';
import { Crop, Upload } from 'lucide-react';
import type { Agency, Official } from '@/lib/model';
import { apiPath } from '@/lib/instances';
import {
  defaultPhotoCrop,
  portraitRatio,
  portraitRatioLabel,
  portraitStyle,
  type PhotoAspectRatio,
  type PhotoCrop,
} from '@/lib/portrait-shape';
import { Portrait } from './official-portrait';
import { PhotoShapePicker } from './photo-shape-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';

type PendingPhoto = { url: string; file?: File; width: number; height: number };
export function OfficialPhotoEditor({
  official,
  agency,
  agencyId,
  clientPreview,
  disabled,
  onBusyChange,
  onAccept,
  onRemove,
}: {
  official: Official;
  agency: Agency;
  agencyId: string;
  clientPreview: boolean;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onAccept: (photo: string, crop: PhotoCrop, ratio: PhotoAspectRatio) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [ratio, setRatio] = useState<PhotoAspectRatio>('auto');
  const [crop, setCrop] = useState<PhotoCrop>(defaultPhotoCrop);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      if (pending?.file) URL.revokeObjectURL(pending.url);
    },
    [pending],
  );
  async function prepare(file?: File) {
    setError('');
    if (
      file &&
      (file.size > 5_000_000 ||
        !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
          file.type,
        ))
    ) {
      setError('Choose a JPG, PNG, GIF or WebP image smaller than 5 MB.');
      return;
    }
    const url = file ? URL.createObjectURL(file) : official.photo;
    if (!url) return;
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 25_000_000)
        throw Error(
          'This image is too large. Use an image under 25 megapixels.',
        );
      setRatio(agency.photoAspectRatio || 'auto');
      setCrop(
        file
          ? { ...defaultPhotoCrop }
          : { ...(official.photoCrop || defaultPhotoCrop) },
      );
      setPending({
        url,
        file,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    } catch (e) {
      if (file) URL.revokeObjectURL(url);
      setError((e as Error).message || 'This image could not be opened.');
    }
  }
  async function accept() {
    if (!pending || busy) return;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      let url = pending.url;
      if (pending.file) {
        const form = new FormData();
        form.append('photo', pending.file);
        const response = await fetch(
          apiPath(agencyId, clientPreview) + '/photos',
          { method: 'POST', body: form },
        );
        const result = await response.json();
        if (!response.ok)
          throw Error(result.error || 'The image could not be uploaded.');
        url = result.url;
      }
      onAccept(url, { ...crop }, ratio);
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  const adjusted = { ...agency, photoAspectRatio: ratio };
  return (
    <>
      <div
        className="photo-editor official-photo-editor"
        style={portraitStyle(agency) as React.CSSProperties}
      >
        <Portrait official={official} className="editor-portrait" />
        <div>
          <strong>Official portrait</strong>
          <p className="small muted">
            JPG, PNG, GIF or WebP, up to 5 MB. Animated images use the first
            frame.
          </p>
          <div className="photo-editor-actions">
            <label className="btn">
              <Upload size={15} /> Choose photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="sr-only"
                aria-label="Choose official photo"
                disabled={disabled || busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void prepare(file);
                  e.target.value = '';
                }}
              />
            </label>
            {official.photo && (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={disabled || busy}
                  onClick={() => void prepare()}
                >
                  <Crop size={15} /> Adjust crop
                </button>
                <button
                  type="button"
                  className="example-link"
                  disabled={disabled || busy}
                  onClick={onRemove}
                >
                  Remove
                </button>
              </>
            )}
          </div>
          <p className="small muted">
            Choose a photo to preview its crop before saving. The uncropped
            image stays available for later adjustments.
          </p>
        </div>
      </div>
      {error && !pending && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
      >
        <DialogContent className="photo-crop-dialog">
          <DialogHeader>
            <DialogTitle>Frame your official’s photo</DialogTitle>
            <DialogDescription>
              Choose a shared photo shape, then position this photo within it.
              Save the official afterward to apply your changes.
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <div className="photo-crop-body">
              <PhotoShapePicker
                agency={agency}
                value={ratio}
                onChange={setRatio}
                disabled={busy}
              />
              <div className="photo-crop-workspace">
                <div>
                  <div
                    className="photo-crop-stage"
                    style={portraitStyle(adjusted) as React.CSSProperties}
                  >
                    <Portrait
                      official={{
                        ...official,
                        photo: pending.url,
                        photoCrop: crop,
                      }}
                      className="crop-portrait"
                    />
                  </div>
                  <p className="small muted">
                    Original: {pending.width} × {pending.height} pixels.
                    <br />
                    Shared photo shape:{' '}
                    {portraitRatioLabel(portraitRatio(adjusted))}.
                  </p>
                </div>
                <div className="photo-crop-controls">
                  <p className="small">
                    This framing is used everywhere this official appears.
                  </p>
                  {(['x', 'y', 'zoom'] as const).map((key) => (
                    <label className="field" key={key} htmlFor={`${id}-${key}`}>
                      {key === 'x'
                        ? 'Horizontal position'
                        : key === 'y'
                          ? 'Vertical position'
                          : 'Zoom'}
                      <input
                        id={`${id}-${key}`}
                        type="range"
                        min={key === 'zoom' ? 1 : 0}
                        max={key === 'zoom' ? 3 : 1}
                        step="0.01"
                        value={crop[key]}
                        disabled={busy}
                        onChange={(e) =>
                          setCrop({ ...crop, [key]: Number(e.target.value) })
                        }
                      />
                      <output htmlFor={`${id}-${key}`}>
                        {key === 'zoom'
                          ? `${crop[key].toFixed(2)}×`
                          : `${Math.round(crop[key] * 100)}%`}
                      </output>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => setCrop({ ...defaultPhotoCrop })}
                  >
                    Reset crop
                  </button>
                </div>
              </div>
              {ratio !== (agency.photoAspectRatio || 'auto') && (
                <p className="notice" role="status">
                  This shape will apply to every official in the agency when you
                  save. Each official keeps their own photo positioning.
                </p>
              )}
              {error && (
                <p role="alert" className="notice error">
                  {error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy || !pending}
              onClick={() => void accept()}
            >
              {busy ? 'Uploading…' : 'Use this crop'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
