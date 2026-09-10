'use client';

import { useId, useState } from 'react';
import {
  CUSTOM_OFFICE_TITLE,
  isStandardOfficeTitle,
  officeTitleGroups,
  type AgencyKind,
} from '@/lib/office-titles';

export function TitlePicker({
  value,
  onChange,
  kind,
  label = 'Title',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  kind?: AgencyKind;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [customForValue, setCustomForValue] = useState<string | null>(null);
  const custom = customForValue === value || !isStandardOfficeTitle(value);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={custom ? CUSTOM_OFFICE_TITLE : value}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value === CUSTOM_OFFICE_TITLE) {
            setCustomForValue(value);
          } else {
            setCustomForValue(null);
            onChange(event.target.value);
          }
        }}
      >
        {officeTitleGroups(kind).map((group) => (
          <optgroup label={group.label} key={group.label}>
            {group.options.map((title) => (
              <option key={title.label} value={title.label}>
                {title.label}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM_OFFICE_TITLE}>Custom title…</option>
      </select>
      {custom && (
        <>
          <label htmlFor={`${id}-custom`} className="small">
            {label === 'Title'
              ? 'Custom title'
              : `Custom ${label.toLowerCase()}`}
          </label>
          <input
            id={`${id}-custom`}
            value={value}
            maxLength={100}
            disabled={disabled}
            placeholder="Enter the title used by your agency"
            onChange={(event) => {
              setCustomForValue(event.target.value);
              onChange(event.target.value);
            }}
          />
        </>
      )}
    </div>
  );
}

export default TitlePicker;
