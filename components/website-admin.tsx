'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  FileText,
  Images,
  Plus,
  Settings,
  ArrowLeft,
  Globe,
} from 'lucide-react';
import {
  emptyItem,
  emptySection,
  sectionNames,
  sectionTypes,
  type WebsiteDocument,
  type WebsitePage,
  type WebsiteRecord,
  type WebsiteMedia,
  type WebsiteSection,
  type WebsiteItem,
} from '@/lib/website-model';
import RichEditor from './website-rich-editor';
import styles from './website-admin.module.css';

type ChooseMedia = (choose: (media: WebsiteMedia) => void) => void;
function Field({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className={styles.field}>
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}{' '}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
function ImageField({
  image,
  alt,
  onChange,
  chooseMedia,
  disabled,
}: {
  image: string;
  alt: string;
  onChange: (image: string, alt: string) => void;
  chooseMedia: ChooseMedia;
  disabled: boolean;
}) {
  return (
    <div className={styles.imageField}>
      {image && <img src={image} alt={alt} />}
      <div>
        <div className={styles.inline}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => chooseMedia((m) => onChange(m.url, m.alt))}
          >
            {image ? 'Replace image' : 'Choose image'}
          </button>
          {image && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange('', '')}
            >
              Remove image
            </button>
          )}
        </div>
        {image && (
          <Field
            label="Image description (alt text)"
            value={alt}
            onChange={(v) => onChange(image, v)}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
function MediaLibrary({
  media,
  onUpload,
  onChoose,
  close,
}: {
  media: WebsiteMedia[];
  onUpload: (m: WebsiteMedia) => void;
  onChoose?: (m: WebsiteMedia) => void;
  close?: () => void;
}) {
  const [alt, setAlt] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('alt', alt);
      const response = await fetch('/api/website/media', {
        method: 'POST',
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      onUpload(data.media);
      setAlt('');
      if (onChoose) onChoose(data.media);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>RP DATA / MEDIA</p>
          <h2>{onChoose ? 'Choose an image' : 'Media library'}</h2>
        </div>
        {close && (
          <button type="button" onClick={close} disabled={busy}>
            Close
          </button>
        )}
      </div>
      <p>
        Upload a picture once, then reuse it on any page. Draft-only uploads
        stay private until a page using them is published.
      </p>
      <div className={styles.upload}>
        <Field
          label="Describe the new image"
          value={alt}
          onChange={setAlt}
          disabled={busy}
        />
        <button
          type="button"
          disabled={busy || !alt.trim()}
          onClick={() => input.current?.click()}
        >
          {busy ? 'Uploading…' : 'Upload image'}
        </button>
        <input
          className="sr-only"
          type="file"
          ref={input}
          aria-label="Upload website image"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(e) => {
            if (e.target.files?.[0]) void upload(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <p className={styles.hint}>
          JPG, PNG, WebP, or GIF · up to 8 MB / 30 megapixels. GIFs use the
          first frame. Images are resized for the web.
        </p>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Field label="Search media" value={query} onChange={setQuery} />
      <div className={styles.mediaGrid}>
        {media
          .filter((m) =>
            (m.name + ' ' + m.alt).toLowerCase().includes(query.toLowerCase()),
          )
          .map((m) => (
            <article key={m.id}>
              <img src={m.url} alt={m.alt} loading="lazy" />
              <div>
                <strong>{m.alt || m.name}</strong>
                <p className={styles.hint}>
                  {m.name}
                  {m.width > 0 && ` · ${m.width} × ${m.height}`}
                </p>
                {onChoose && (
                  <button type="button" onClick={() => onChoose(m)}>
                    Use image
                  </button>
                )}
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}
function ItemEditor({
  item,
  onChange,
  disabled,
  chooseMedia,
  index,
  type,
}: {
  item: WebsiteItem;
  onChange: (value: WebsiteItem) => void;
  disabled: boolean;
  chooseMedia: ChooseMedia;
  index: number;
  type: WebsiteSection['type'];
}) {
  const set = (key: keyof WebsiteItem, value: string) =>
    onChange({ ...item, [key]: value });
  return (
    <>
      <Field
        label={type === 'profiles' ? 'Name' : 'Title'}
        value={item.title}
        onChange={(v) => set('title', v)}
        disabled={disabled}
      />
      <Field
        label={type === 'profiles' ? 'Role / focus' : 'Subtitle'}
        value={item.subtitle}
        onChange={(v) => set('subtitle', v)}
        disabled={disabled}
      />
      {type !== 'services' && (
        <ImageField
          image={item.image}
          alt={item.alt}
          onChange={(image, alt) => onChange({ ...item, image, alt })}
          chooseMedia={chooseMedia}
          disabled={disabled}
        />
      )}
      <RichEditor
        value={item.body}
        onChange={(v) => set('body', v)}
        disabled={disabled}
        chooseMedia={chooseMedia}
        label={
          type === 'profiles'
            ? `Biography for ${item.title || index + 1}`
            : `Card ${index + 1} content`
        }
      />
      <div className={styles.columns}>
        <Field
          label="Link text (optional)"
          value={item.linkLabel}
          onChange={(v) => set('linkLabel', v)}
          disabled={disabled}
        />
        <Field
          label="Link address"
          value={item.link}
          onChange={(v) => set('link', v)}
          disabled={disabled}
        />
      </div>
      {type === 'services' && (
        <Field
          label="Section anchor"
          value={item.id}
          onChange={(v) => set('id', v)}
          disabled={disabled}
          hint="For links to this service, such as #census-data."
        />
      )}
    </>
  );
}
function SectionEditor({
  section,
  onChange,
  disabled,
  chooseMedia,
}: {
  section: WebsiteSection;
  onChange: (value: WebsiteSection) => void;
  disabled: boolean;
  chooseMedia: ChooseMedia;
}) {
  const set = (key: keyof WebsiteSection, value: string) =>
    onChange({ ...section, [key]: value });
  const move = (index: number, direction: number) => {
    const items = [...section.items];
    [items[index], items[index + direction]] = [
      items[index + direction],
      items[index],
    ];
    onChange({ ...section, items });
  };
  return (
    <>
      <Field
        label="Eyebrow / small heading"
        value={section.eyebrow}
        onChange={(v) => set('eyebrow', v)}
        disabled={disabled}
      />
      <Field
        label="Section heading"
        value={section.title}
        onChange={(v) => set('title', v)}
        multiline
        disabled={disabled}
        hint="A new line creates a line break in the heading."
      />
      <RichEditor
        value={section.body}
        onChange={(v) => set('body', v)}
        disabled={disabled}
        chooseMedia={chooseMedia}
        label="Section content"
      />
      {!['profiles', 'services', 'cards'].includes(section.type) && (
        <ImageField
          image={section.image}
          alt={section.alt}
          onChange={(image, alt) => onChange({ ...section, image, alt })}
          chooseMedia={chooseMedia}
          disabled={disabled}
        />
      )}
      <div className={styles.columns}>
        <Field
          label="Button / link text (optional)"
          value={section.linkLabel}
          onChange={(v) => set('linkLabel', v)}
          disabled={disabled}
        />
        <Field
          label="Button / link address"
          value={section.link}
          onChange={(v) => set('link', v)}
          disabled={disabled}
          hint="For an RP Data page use /about; for another website use https://…"
        />
      </div>
      {['profiles', 'services', 'cards'].includes(section.type) && (
        <div className={styles.items}>
          {section.items.map((item, index) => (
            <details key={index} className={styles.item}>
              <summary>
                {index + 1}. {item.title || 'Untitled item'}
              </summary>
              <div className={styles.detailsBody}>
                <div className={styles.inline}>
                  <button
                    type="button"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index === section.items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...section,
                        items: section.items.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove item
                  </button>
                </div>
                <ItemEditor
                  item={item}
                  index={index}
                  type={section.type}
                  onChange={(value) =>
                    onChange({
                      ...section,
                      items: section.items.map((x, i) =>
                        i === index ? value : x,
                      ),
                    })
                  }
                  chooseMedia={chooseMedia}
                  disabled={disabled}
                />
              </div>
            </details>
          ))}
          <button
            type="button"
            disabled={disabled || section.items.length >= 40}
            onClick={() =>
              onChange({ ...section, items: [...section.items, emptyItem()] })
            }
          >
            <Plus size={16} />
            Add {section.type === 'profiles' ? 'person' : 'item'}
          </button>
        </div>
      )}
    </>
  );
}

export default function WebsiteAdmin({
  initialRecords,
  initialMedia,
}: {
  initialRecords: WebsiteRecord[];
  initialMedia: WebsiteMedia[];
}) {
  const [records, setRecords] = useState(initialRecords),
    [media, setMedia] = useState(initialMedia),
    [selected, setSelected] = useState('home'),
    [document, setDocument] = useState<WebsiteDocument>(
      structuredClone(initialRecords.find((r) => r.id === 'home')!.draft),
    ),
    [tab, setTab] = useState<'pages' | 'media' | 'settings'>('pages');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [query, setQuery] = useState(''),
    [newTitle, setNewTitle] = useState(''),
    [newSlug, setNewSlug] = useState(''),
    [creating, setCreating] = useState(false),
    [newType, setNewType] = useState<WebsiteSection['type']>('text'),
    [history, setHistory] = useState<
      | { id: number; revision: number; action: string; createdAt: string }[]
      | null
    >(null);
  const [choose, setChoose] = useState<((m: WebsiteMedia) => void) | null>(
    null,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const current = records.find((r) => r.id === selected)!;
  const dirty = JSON.stringify(document) !== JSON.stringify(current.draft);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  useEffect(() => {
    if (choose) dialog.current?.showModal();
    else dialog.current?.close();
  }, [choose]);
  const chooseMedia: ChooseMedia = (callback) => setChoose(() => callback);
  const discardOkay = () =>
    !dirty ||
    window.confirm('Discard your unsaved edits? Saved drafts are kept.');
  function select(id: string, nextTab: 'pages' | 'settings' = 'pages') {
    if (!discardOkay()) return;
    setSelected(id);
    setDocument(structuredClone(records.find((r) => r.id === id)!.draft));
    setTab(nextTab);
    setError('');
    setNotice('');
    setHistory(null);
  }
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id: selected,
          revision: current.revision,
          document,
          ...extra,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || 'The change could not be saved.');
      const record: WebsiteRecord = result.record;
      setRecords((old) =>
        old.some((x) => x.id === record.id)
          ? old.map((x) => (x.id === record.id ? record : x))
          : [...old, record],
      );
      setSelected(record.id);
      setDocument(structuredClone(record.draft));
      setHistory(null);
      setNotice(
        action === 'publish'
          ? 'Published. The live website now uses these changes.'
          : action === 'unpublish'
            ? 'Unpublished. This page is now a private draft.'
            : action === 'restore'
              ? 'Earlier version restored as a draft. Review it, then publish when ready.'
              : 'Draft saved. The live website is unchanged.',
      );
      setCreating(false);
      if (action === 'create') setTab('pages');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadHistory() {
    setError('');
    try {
      const r = await fetch(
        '/api/website?history=' + encodeURIComponent(selected),
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setHistory(data.history);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  const page = document.kind === 'page' ? document : null;
  const editPage = (patch: Partial<WebsitePage>) => {
    if (page) setDocument({ ...page, ...patch });
  };
  const updateSection = (index: number, value: WebsiteSection) => {
    if (page)
      editPage({
        sections: page.sections.map((x, i) => (i === index ? value : x)),
      });
  };
  const moveSection = (index: number, direction: number) => {
    if (!page) return;
    const sections = [...page.sections];
    [sections[index], sections[index + direction]] = [
      sections[index + direction],
      sections[index],
    ];
    editPage({ sections });
  };
  const pages = records
    .filter((r) => r.draft.kind === 'page')
    .sort(
      (a, b) => (a.draft as WebsitePage).order - (b.draft as WebsitePage).order,
    );
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <a href="/admin">
          <ArrowLeft size={17} />
          RP workspace
        </a>
        <a href="https://rpdata.net" target="_blank" rel="noreferrer">
          <Globe size={17} />
          View website
          <ArrowUpRight size={15} />
        </a>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>RP DATA</p>
          <h1>Website editor</h1>
          <p className={styles.hint}>Your pages, pictures, and words.</p>
          <nav className={styles.tabs} aria-label="Website editor">
            <button
              type="button"
              aria-current={tab === 'pages' ? 'page' : undefined}
              disabled={busy}
              onClick={() => select(page ? selected : 'home')}
            >
              <FileText size={18} />
              Pages
            </button>
            <button
              type="button"
              aria-current={tab === 'media' ? 'page' : undefined}
              disabled={busy}
              onClick={() => {
                if (discardOkay()) {
                  setDocument(structuredClone(current.draft));
                  setTab('media');
                  setNotice('');
                }
              }}
            >
              <Images size={18} />
              Media library
            </button>
            <button
              type="button"
              aria-current={tab === 'settings' ? 'page' : undefined}
              disabled={busy}
              onClick={() => select('settings', 'settings')}
            >
              <Settings size={18} />
              Site settings
            </button>
          </nav>
          <div className={styles.pageList}>
            <Field label="Find a page" value={query} onChange={setQuery} />
            {pages
              .filter((r) =>
                (r.draft as WebsitePage).title
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((r) => (
                <button
                  type="button"
                  key={r.id}
                  disabled={busy}
                  aria-current={
                    selected === r.id && tab === 'pages' ? 'page' : undefined
                  }
                  onClick={() => select(r.id)}
                >
                  <span>{(r.draft as WebsitePage).title}</span>
                  <small>
                    {r.published
                      ? r.revision === r.publishedRevision
                        ? 'Published'
                        : 'Draft changes'
                      : 'Draft'}
                  </small>
                </button>
              ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (discardOkay()) {
                setDocument(structuredClone(current.draft));
                setCreating(true);
                setNewTitle('');
                setNewSlug('');
              }
            }}
          >
            <Plus size={17} />
            Add page
          </button>
          <p className={styles.sidebarNote}>
            Save a draft to keep working. Publish when you want visitors to see
            it.
          </p>
        </aside>
        <main className={styles.main}>
          {creating && (
            <section className={styles.panel}>
              <h2>Create a page</h2>
              <div className={styles.columns}>
                <Field
                  label="New page title"
                  value={newTitle}
                  onChange={(value) => {
                    setNewTitle(value);
                    setNewSlug(
                      value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, ''),
                    );
                  }}
                  disabled={busy}
                />
                <Field
                  label="New page address"
                  value={newSlug}
                  onChange={setNewSlug}
                  disabled={busy}
                  hint={'rpdata.net/' + newSlug}
                />
              </div>
              <div className={styles.inline}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy || !newTitle.trim() || !newSlug.trim()}
                  onClick={() =>
                    void act('create', {
                      document: {
                        kind: 'page',
                        title: newTitle,
                        slug: newSlug,
                        description: '',
                        navLabel: newTitle.slice(0, 45),
                        showInNav: false,
                        order: pages.length * 10,
                        sections: [
                          { ...emptySection('intro'), title: newTitle },
                        ],
                      },
                    })
                  }
                >
                  Create draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCreating(false)}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
          {error && (
            <div className={styles.error} role="alert">
              {error}
              <p>
                If another editor made changes, copy your unsaved text before
                reloading this page.
              </p>
            </div>
          )}
          {notice && (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          )}
          {tab === 'media' ? (
            <div className={styles.panel}>
              <MediaLibrary
                media={media}
                onUpload={(m) => setMedia((old) => [m, ...old])}
              />
            </div>
          ) : (
            <>
              <div className={styles.editHeader}>
                <div>
                  <p className={styles.eyebrow}>
                    {page ? 'PAGE EDITOR' : 'SHARED WEBSITE CONTENT'}
                  </p>
                  <h2>{page?.title || 'Site settings'}</h2>
                  <p>
                    {dirty
                      ? 'Unsaved edits'
                      : current.revision !== current.publishedRevision
                        ? 'Saved draft · ready to preview'
                        : 'Published · no pending edits'}
                  </p>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act('save')}
                  >
                    Save draft
                  </button>
                  {!dirty && (
                    <a
                      href={'/admin/website/preview/' + selected}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Preview
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={() => void act('publish')}
                  >
                    {busy ? 'Working…' : 'Publish'}
                  </button>
                </div>
                {dirty && (
                  <p className={styles.hint}>
                    Save your draft to open a preview.
                  </p>
                )}
              </div>
              {page ? (
                <>
                  <section className={styles.panel}>
                    <details>
                      <summary>Page details & navigation</summary>
                      <div className={styles.detailsBody}>
                        <div className={styles.columns}>
                          <Field
                            label="Page title"
                            value={page.title}
                            onChange={(v) => editPage({ title: v })}
                            disabled={busy}
                          />
                          <Field
                            label="Page address"
                            value={page.slug}
                            onChange={(v) => editPage({ slug: v })}
                            disabled={busy || !selected.startsWith('page-')}
                            hint={'rpdata.net/' + page.slug}
                          />
                        </div>
                        <Field
                          label="Search description"
                          value={page.description}
                          onChange={(v) => editPage({ description: v })}
                          multiline
                          disabled={busy}
                        />
                        <div className={styles.columns}>
                          <Field
                            label="Navigation label"
                            value={page.navLabel}
                            onChange={(v) => editPage({ navLabel: v })}
                            disabled={busy}
                          />
                          <label className={styles.field}>
                            Navigation order
                            <input
                              type="number"
                              min={0}
                              max={1000}
                              value={page.order}
                              disabled={busy}
                              onChange={(e) =>
                                editPage({ order: Number(e.target.value) })
                              }
                            />
                            <span className={styles.hint}>
                              Lower numbers appear first.
                            </span>
                          </label>
                        </div>
                        <label className={styles.checkbox}>
                          <input
                            type="checkbox"
                            checked={page.showInNav}
                            disabled={busy}
                            onChange={(e) =>
                              editPage({ showInNav: e.target.checked })
                            }
                          />
                          Show this page in the website navigation
                        </label>
                        <p className={styles.hint}>
                          Only published pages appear in navigation. Hidden
                          published pages can still be opened by their URL.
                        </p>
                      </div>
                    </details>
                  </section>
                  <section
                    className={styles.sections}
                    aria-label="Page sections"
                  >
                    {page.sections.map((section, index) => (
                      <details
                        key={section.id}
                        open={index === 0 || undefined}
                        className={styles.section}
                      >
                        <summary>
                          <span className={styles.sectionNumber}>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span>
                            {section.title || sectionNames[section.type]}
                            <small>
                              {sectionNames[section.type]}
                              {section.items.length > 0
                                ? ` · ${section.items.length} items`
                                : ''}
                            </small>
                          </span>
                        </summary>
                        <div className={styles.detailsBody}>
                          <div className={styles.inline}>
                            <button
                              type="button"
                              disabled={busy || index === 0}
                              onClick={() => moveSection(index, -1)}
                            >
                              Move up
                            </button>
                            <button
                              type="button"
                              disabled={
                                busy || index === page.sections.length - 1
                              }
                              onClick={() => moveSection(index, 1)}
                            >
                              Move down
                            </button>
                            <button
                              type="button"
                              disabled={busy || page.sections.length < 2}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    'Remove this section from the draft? The published page stays unchanged until you publish.',
                                  )
                                )
                                  editPage({
                                    sections: page.sections.filter(
                                      (_, i) => i !== index,
                                    ),
                                  });
                              }}
                            >
                              Remove section
                            </button>
                          </div>
                          <SectionEditor
                            section={section}
                            onChange={(value) => updateSection(index, value)}
                            disabled={busy}
                            chooseMedia={chooseMedia}
                          />
                        </div>
                      </details>
                    ))}
                  </section>
                  <div className={styles.addSection}>
                    <label>
                      Section layout
                      <select
                        value={newType}
                        onChange={(e) =>
                          setNewType(e.target.value as WebsiteSection['type'])
                        }
                      >
                        {sectionTypes.map((t) => (
                          <option value={t} key={t}>
                            {sectionNames[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={busy || page.sections.length >= 40}
                      onClick={() =>
                        editPage({
                          sections: [...page.sections, emptySection(newType)],
                        })
                      }
                    >
                      <Plus size={16} />
                      Add section
                    </button>
                  </div>
                </>
              ) : (
                <section className={styles.panel}>
                  {document.kind === 'settings' && (
                    <>
                      <h3>Brand & footer</h3>
                      <div className={styles.columns}>
                        <Field
                          label="Site name"
                          value={document.siteName}
                          onChange={(v) =>
                            setDocument({ ...document, siteName: v })
                          }
                          disabled={busy}
                        />
                        <Field
                          label="Tagline"
                          value={document.tagline}
                          onChange={(v) =>
                            setDocument({ ...document, tagline: v })
                          }
                          disabled={busy}
                        />
                      </div>
                      <Field
                        label="Website / footer description"
                        value={document.description}
                        onChange={(v) =>
                          setDocument({ ...document, description: v })
                        }
                        multiline
                        disabled={busy}
                      />
                      <ImageField
                        image={document.logo}
                        alt="Website logo"
                        onChange={(image) =>
                          setDocument({ ...document, logo: image })
                        }
                        chooseMedia={chooseMedia}
                        disabled={busy}
                      />
                      <p className={styles.hint}>
                        Leave the logo empty to use the original RP Data mark.
                      </p>
                      <div className={styles.columns}>
                        <Field
                          label="Partner link label"
                          value={document.partnerLabel}
                          onChange={(v) =>
                            setDocument({ ...document, partnerLabel: v })
                          }
                          disabled={busy}
                        />
                        <Field
                          label="Partner website"
                          value={document.partnerUrl}
                          onChange={(v) =>
                            setDocument({ ...document, partnerUrl: v })
                          }
                          disabled={busy}
                        />
                      </div>
                      <h3>Contact section · shown on every page</h3>
                      <Field
                        label="Contact eyebrow"
                        value={document.contactEyebrow}
                        onChange={(v) =>
                          setDocument({ ...document, contactEyebrow: v })
                        }
                        disabled={busy}
                      />
                      <Field
                        label="Contact heading"
                        value={document.contactTitle}
                        onChange={(v) =>
                          setDocument({ ...document, contactTitle: v })
                        }
                        multiline
                        disabled={busy}
                      />
                      <RichEditor
                        label="Contact content"
                        value={document.contactBody}
                        onChange={(v) =>
                          setDocument({ ...document, contactBody: v })
                        }
                        chooseMedia={chooseMedia}
                        disabled={busy}
                      />
                      <div className={styles.columns}>
                        <Field
                          label="Contact email"
                          value={document.contactEmail}
                          onChange={(v) =>
                            setDocument({ ...document, contactEmail: v })
                          }
                          disabled={busy}
                        />
                        <Field
                          label="Contact button text"
                          value={document.contactButton}
                          onChange={(v) =>
                            setDocument({ ...document, contactButton: v })
                          }
                          disabled={busy}
                        />
                      </div>
                    </>
                  )}
                </section>
              )}
              <section className={styles.panel}>
                <div className={styles.inline}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      history ? setHistory(null) : void loadHistory()
                    }
                  >
                    {history ? 'Hide revision history' : 'Revision history'}
                  </button>
                  {current.published &&
                    !['home', 'settings'].includes(selected) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Unpublish this page? It will disappear from the public website and navigation, but remain here as a draft.',
                            )
                          )
                            void act('unpublish');
                        }}
                      >
                        Unpublish page
                      </button>
                    )}
                </div>
                {history && (
                  <div className={styles.history}>
                    <p>
                      Restore an earlier version as a draft. The live page
                      changes only after you publish.
                    </p>
                    {history.map((h) => (
                      <div key={h.id}>
                        <span>
                          Revision {h.revision} · {h.action}
                          <small>
                            {new Date(h.createdAt).toLocaleString()}
                          </small>
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (discardOkay())
                              void act('restore', { historyId: h.id });
                          }}
                        >
                          Restore draft
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      <dialog
        ref={dialog}
        className={styles.mediaDialog}
        onCancel={() => setChoose(null)}
        aria-label="Choose a website image"
      >
        {choose && (
          <MediaLibrary
            media={media}
            onUpload={(m) => setMedia((old) => [m, ...old])}
            onChoose={(m) => {
              choose(m);
              setChoose(null);
            }}
            close={() => setChoose(null)}
          />
        )}
      </dialog>
    </div>
  );
}
