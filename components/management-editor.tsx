'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Plus, Save, Trash2, Upload } from 'lucide-react';
import type { Content, ManagementProfile } from '@/lib/model';
import { apiPath } from '@/lib/instances';
import { ManagementPortrait } from './management-profiles';

const titles = [
  'City Manager',
  'Assistant City Manager',
  'Deputy City Manager',
  'City Administrator',
  'County Executive',
  'County Administrator',
  'County Administrative Officer',
  'Assistant County Executive',
  'Deputy County Executive',
  'Chief Administrative Officer',
  'General Manager',
  'Assistant General Manager',
  'Executive Director',
  'Superintendent',
  'Chancellor',
];

type Props = {
  content: Content;
  busy: boolean;
  agencyId: string;
  save: (body: Record<string, unknown>) => Promise<boolean>;
};

export function ManagementEditor(props: Props) {
  // A saved/discarded source or a different agency starts a fresh editor.
  return (
    <ManagementEditorForm
      key={
        props.agencyId + ':' + JSON.stringify(props.content.management || [])
      }
      {...props}
    />
  );
}

function ManagementEditorForm({ content, busy, agencyId, save }: Props) {
  const [draft, setDraft] = useState<ManagementProfile[]>(() =>
    (content.management || []).map((profile) => ({ ...profile })),
  );
  const [customTitles, setCustomTitles] = useState<string[]>(() =>
    (content.management || [])
      .filter((profile) => !titles.includes(profile.title))
      .map((profile) => profile.id),
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const uploadController = useRef<AbortController | null>(null);
  const saveInProgress = useRef(false);
  const working = busy || saving || uploading !== null;
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(content.management || []);

  useEffect(() => () => uploadController.current?.abort(), []);

  function update(id: string, changes: Partial<ManagementProfile>) {
    setDraft((profiles) =>
      profiles.map((profile) =>
        profile.id === id ? { ...profile, ...changes } : profile,
      ),
    );
    setMessage('');
  }

  function addProfile() {
    const kind = content.agency.kind;
    const title =
      kind === 'county'
        ? 'County Executive'
        : kind === 'school'
          ? 'Superintendent'
          : kind === 'college'
            ? 'Chancellor'
            : kind === 'special'
              ? 'General Manager'
              : 'City Manager';
    setDraft((profiles) => [
      ...profiles,
      {
        id: 'staff-' + crypto.randomUUID().replaceAll('-', '').slice(0, 24),
        name: '',
        title,
        email: '',
        phone: '',
        website: '',
        photo: '',
        bio: '',
        visible: true,
      },
    ]);
    setMessage('');
  }

  async function upload(id: string, file: File) {
    if (working || saveInProgress.current || uploadController.current) return;
    setError('');
    setMessage('');
    if (!file.size || file.size > 5_000_000) {
      setError('Choose a JPG, PNG or GIF smaller than 5 MB.');
      return;
    }
    const controller = new AbortController();
    uploadController.current = controller;
    setUploading(id);
    try {
      const form = new FormData();
      form.append('photo', file);
      const response = await fetch(apiPath(agencyId) + '/photos', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || 'The photo could not be uploaded.');
      const prefix = apiPath(agencyId) + '/photos/';
      if (
        typeof result.url !== 'string' ||
        !result.url.startsWith(prefix) ||
        !/^[a-f0-9]{32}$/.test(result.url.slice(prefix.length))
      )
        throw Error('The uploaded photo could not be matched to this agency.');
      if (!controller.signal.aborted) {
        update(id, { photo: result.url });
        setMessage(
          'Photo uploaded. Save the management draft to keep this change.',
        );
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : 'The photo could not be uploaded.',
        );
    } finally {
      if (uploadController.current === controller)
        uploadController.current = null;
      if (!controller.signal.aborted) setUploading(null);
    }
  }

  async function saveDraft() {
    if (working || saveInProgress.current || uploadController.current) return;
    saveInProgress.current = true;
    setSaving(true);
    setError('');
    setMessage('');
    const management = draft.map((profile) => ({
      ...profile,
      name: profile.name.trim(),
      title: profile.title.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
      website: profile.website.trim(),
      bio: profile.bio.trim(),
    }));
    try {
      if (
        management.some(
          (profile) => profile.name.length < 2 || profile.title.length < 2,
        )
      )
        throw Error(
          'Enter a name and title of at least two characters for every profile.',
        );
      if (!(await save({ action: 'management', management })))
        throw Error(
          'The management draft could not be saved. Check your entries and try again.',
        );
      setDraft(management);
      setMessage(
        'Management draft saved. Publish when you are ready to show these changes.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The management draft could not be saved.',
      );
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void saveDraft();
      }}
    >
      <div
        className="row space-between"
        style={{ flexWrap: 'wrap', marginBottom: 18 }}
      >
        <div>
          <h3 style={{ margin: '0 0 8px' }}>Management profiles</h3>
          <p className="small muted" style={{ margin: 0, maxWidth: 620 }}>
            Add the people who manage agency services. Choose which profiles
            appear in the administration section, then save a draft and publish.
          </p>
        </div>
        <button
          className="btn"
          type="button"
          disabled={working}
          onClick={addProfile}
        >
          <Plus size={16} aria-hidden="true" /> Add profile
        </button>
      </div>
      {content.agency.showManagement === false && (
        <p className="notice" style={{ marginBottom: 18 }}>
          The administration section is hidden in display options. You can
          prepare profiles here and turn the section on when ready.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      <div className="stack" style={{ marginTop: 18 }}>
        {draft.length === 0 && (
          <div className="panel" style={{ textAlign: 'center', padding: 32 }}>
            <Building2
              size={30}
              aria-hidden="true"
              style={{ color: 'var(--primary)' }}
            />
            <h4 style={{ margin: '12px 0 8px' }}>No management profiles yet</h4>
            <p className="small muted" style={{ margin: 0 }}>
              Add a manager, administrator, or other appointed leader to get
              started.
            </p>
          </div>
        )}
        {draft.map((profile, index) => (
          <fieldset
            key={profile.id}
            className="panel"
            disabled={working}
            aria-label={profile.name || `Management profile ${index + 1}`}
            style={{ minWidth: 0, margin: 0 }}
          >
            <div
              className="row space-between"
              style={{ flexWrap: 'wrap', marginBottom: 22 }}
            >
              <strong>{profile.name || `New profile ${index + 1}`}</strong>
              <button
                className="btn danger quiet"
                type="button"
                aria-label={`Remove ${profile.name || 'management profile'} from the draft`}
                onClick={() => {
                  setDraft((profiles) =>
                    profiles.filter((item) => item.id !== profile.id),
                  );
                  setMessage(
                    'Profile removed from this draft. Publish to update the public page.',
                  );
                }}
              >
                <Trash2 size={15} aria-hidden="true" /> Remove profile
              </button>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', marginBottom: 22 }}>
              <ManagementPortrait profile={profile} size={84} />
              <div style={{ minWidth: 0 }}>
                <strong className="small">Profile photo</strong>
                <p className="small muted" style={{ margin: '6px 0 10px' }}>
                  JPG, PNG or GIF, under 5 MB. Animated GIFs use the first
                  frame.
                </p>
                <label
                  className="btn"
                  style={{ cursor: working ? 'default' : 'pointer' }}
                >
                  <Upload size={15} aria-hidden="true" />
                  {uploading === profile.id ? 'Uploading…' : 'Choose photo'}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    aria-label={`Choose photo for ${profile.name || `profile ${index + 1}`}`}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void upload(profile.id, file);
                    }}
                  />
                </label>
                {profile.photo && (
                  <button
                    className="btn quiet"
                    type="button"
                    style={{ marginLeft: 8 }}
                    onClick={() => update(profile.id, { photo: '' })}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={profile.name}
                  onChange={(event) =>
                    update(profile.id, { name: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Title
                <select
                  value={
                    customTitles.includes(profile.id)
                      ? '__custom'
                      : profile.title
                  }
                  onChange={(event) => {
                    if (event.target.value === '__custom') {
                      setCustomTitles((ids) => [...ids, profile.id]);
                      update(profile.id, { title: '' });
                    } else {
                      setCustomTitles((ids) =>
                        ids.filter((id) => id !== profile.id),
                      );
                      update(profile.id, { title: event.target.value });
                    }
                  }}
                >
                  {titles.map((title) => (
                    <option key={title}>{title}</option>
                  ))}
                  <option value="__custom">Custom title</option>
                </select>
              </label>
              {customTitles.includes(profile.id) && (
                <label className="field wide">
                  Custom title
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={profile.title}
                    onChange={(event) =>
                      update(profile.id, { title: event.target.value })
                    }
                  />
                </label>
              )}
              <label className="field">
                Email
                <input
                  type="email"
                  maxLength={254}
                  value={profile.email}
                  onChange={(event) =>
                    update(profile.id, { email: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Phone
                <input
                  type="tel"
                  maxLength={40}
                  value={profile.phone}
                  onChange={(event) =>
                    update(profile.id, { phone: event.target.value })
                  }
                />
              </label>
              <label className="field wide">
                Website
                <input
                  type="url"
                  maxLength={2000}
                  pattern="https://.*"
                  title="Use a website beginning with https://"
                  placeholder="https://"
                  value={profile.website}
                  onChange={(event) =>
                    update(profile.id, { website: event.target.value })
                  }
                />
              </label>
              <label className="field wide">
                Phone label
                <input
                  maxLength={80}
                  value={profile.phoneLabel || ''}
                  placeholder="Office, City Hall, or general information"
                  onChange={(event) =>
                    update(profile.id, { phoneLabel: event.target.value })
                  }
                />
              </label>
              <label className="field wide">
                About this person
                <textarea
                  maxLength={3000}
                  rows={4}
                  value={profile.bio}
                  onChange={(event) =>
                    update(profile.id, { bio: event.target.value })
                  }
                />
              </label>
            </div>
            <label
              aria-label="Show this profile on the public page"
              className="row"
              style={{
                marginTop: 22,
                cursor: 'pointer',
                minHeight: 44,
                alignItems: 'flex-start',
              }}
            >
              <input
                type="checkbox"
                checked={profile.visible}
                onChange={(event) =>
                  update(profile.id, { visible: event.target.checked })
                }
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 3,
                  accentColor: 'var(--primary)',
                }}
              />
              <span>
                <strong className="small">
                  Show this profile on the public page
                </strong>
                <span
                  className="small muted"
                  style={{ display: 'block', marginTop: 4 }}
                >
                  Hidden profiles stay available here for future updates.
                </span>
              </span>
            </label>
          </fieldset>
        ))}
      </div>
      <div className="row" style={{ marginTop: 24, flexWrap: 'wrap' }}>
        <button
          className="btn primary"
          type="submit"
          disabled={working || !dirty}
        >
          <Save size={16} aria-hidden="true" />
          {saving || busy ? 'Saving…' : 'Save management draft'}
        </button>
        {dirty && (
          <span className="small muted">Unsaved management changes</span>
        )}
      </div>
    </form>
  );
}
