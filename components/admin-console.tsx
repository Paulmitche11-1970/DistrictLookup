'use client';
import type { FeatureCollection, Feature } from 'geojson';
import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Settings2,
  Map,
  Code,
  ShieldCheck,
  History,
  ExternalLink,
  LogOut,
  Mail,
  Phone,
  Pencil,
  Upload,
  Check,
  Eye,
  ArrowUpRight,
  Save,
  LockKeyhole,
  Copy,
  MapPin,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DistrictMapView from './district-map';
import type { Content, Official, Agency } from '@/lib/model';
import { colorFor, termLabel } from '@/lib/model';
import { normalizeMap } from '@/lib/geo';
import { designs } from '@/lib/designs';
type Activity = {
  id: number;
  actor: string;
  action: string;
  detail: string;
  created_at: string;
};
type Dashboard = {
  content: Content;
  revision: number;
  publishedRevision: number;
  publishedAt: string;
  hasChanges: boolean;
  admin: { name: string; email: string };
  addressCount: number;
  activity: Activity[];
};
const navigation = [
  { id: 'officials', label: 'Elected officials', icon: Users },
  { id: 'display', label: 'Display & contact options', icon: Settings2 },
  { id: 'map', label: 'District map', icon: Map },
  { id: 'embed', label: 'Add to your website', icon: Code },
  { id: 'security', label: 'Account security', icon: ShieldCheck },
  { id: 'activity', label: 'Change history', icon: History },
];
async function api(url: string, body?: unknown) {
  const r = await fetch(
    url,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const d = await r.json();
  if (!r.ok) {
    if (r.status === 401 && url === '/api/admin')
      location.assign('/admin/login');
    throw Error(d.error || 'The request could not be completed.');
  }
  return d;
}
export default function AdminConsole({
  previewContent,
  previewAddressCount = 0,
}: { previewContent?: Content; previewAddressCount?: number } = {}) {
  const previewMode = !!previewContent;
  const [data, setData] = useState<Dashboard | null>(() =>
    previewContent
      ? {
          content: previewContent,
          revision: 0,
          publishedRevision: 0,
          publishedAt: '',
          hasChanges: false,
          admin: { name: 'Agency administrator', email: '' },
          addressCount: previewAddressCount,
          activity: [],
        }
      : null,
  );
  const [section, setSection] = useState('officials');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Official | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  async function load() {
    if (previewMode) return;
    setData(await api('/api/admin'));
  }
  useEffect(() => {
    if (!previewMode)
      api('/api/admin')
        .then(setData)
        .catch((e) => setError(e.message));
  }, [previewMode]);
  async function mutate(body: Record<string, unknown>) {
    if (!data || previewMode) return false;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api('/api/admin', { ...body, revision: data.revision });
      await load();
      setSuccess(
        body.action === 'publish'
          ? 'Your changes are published.'
          : body.action === 'discard'
            ? 'Unpublished changes discarded.'
            : 'Draft saved. Preview it before publishing.',
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const a = data?.content.agency;
  return (
    <SidebarProvider className="admin-shell">
      <Sidebar className="admin-nav">
        <SidebarHeader>
          <div className="brand">
            <div className="row">
              <MapPin size={27} />
              <strong style={{ fontSize: 19 }}>District Lookup</strong>
            </div>
            <small>RP DATA</small>
          </div>
        </SidebarHeader>
        <SidebarContent style={{ padding: '0 14px' }}>
          <div
            className="eyebrow"
            style={{ color: '#7e9cab', padding: '0 12px 14px' }}
          >
            Martinez administration
          </div>
          <SidebarMenu>
            {navigation.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={section === item.id}
                  onClick={() => {
                    setSection(item.id);
                    setError('');
                    setSuccess('');
                  }}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <footer>
            <div className="row" style={{ marginBottom: 8 }}>
              <ShieldCheck size={16} />
              Two-factor protected
            </div>
            <div>City of Martinez</div>
          </footer>
        </SidebarFooter>
      </Sidebar>
      <div className="admin-content">
        <header className="admin-topbar">
          <div className="row">
            <SidebarTrigger />
            <span className="small muted">
              {previewMode
                ? 'Administration preview · Read only'
                : 'Agency workspace'}
            </span>
          </div>
          <div className="row">
            <a
              className="btn quiet"
              href="/martinez"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              View lookup designs
            </a>
            {!previewMode && (
              <button
                className="icon-btn"
                aria-label="Sign out"
                onClick={async () => {
                  await api('/api/auth/logout', {});
                  location.assign('/admin/login');
                }}
              >
                <LogOut size={17} />
              </button>
            )}
            {previewMode && (
              <a className="btn quiet" href="/admin">
                Agency sign in
              </a>
            )}
          </div>
        </header>
        <main className="admin-work">
          {previewMode && (
            <div className="notice admin-preview-notice">
              <strong>This is a read-only design preview.</strong> To edit
              officials, upload photos or publish changes,{' '}
              <a href="/admin">sign in to administration</a>. This preview uses
              public Martinez information. Editing, uploads, publishing, and
              account changes are available after agency sign-in.
            </div>
          )}
          {error && (
            <div
              className="notice error"
              role="alert"
              style={{ marginBottom: 20 }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="notice success"
              role="status"
              style={{ marginBottom: 20 }}
            >
              {success}
            </div>
          )}
          {!data ? (
            <div className="stack">
              <h1>Loading your workspace</h1>
              <Skeleton className="h-14 w-96" />
              <Skeleton className="h-80 w-full" />
            </div>
          ) : (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">{a?.name}</div>
                  <h1>{navigation.find((n) => n.id === section)?.label}</h1>
                  <p className="muted">
                    {section === 'officials'
                      ? 'Keep the people behind each district up to date.'
                      : section === 'display'
                        ? 'Choose what residents see when they find their representative.'
                        : section === 'map'
                          ? 'Review your boundaries before replacing the public map.'
                          : section === 'embed'
                            ? 'A simple lookup that fits into your existing website.'
                            : section === 'security'
                              ? 'Manage your password and account recovery.'
                              : 'A record of edits and publication.'}
                  </p>
                </div>
                <span className="pill">
                  {previewMode
                    ? 'Read-only preview'
                    : data.hasChanges
                      ? 'Unpublished changes'
                      : 'Published and up to date'}
                </span>
              </div>
              <div className="admin-grid">
                <fieldset
                  disabled={previewMode}
                  className="admin-preview-fields"
                >
                  {section === 'officials' && (
                    <div className="official-grid">
                      {data.content.officials.map((o) => (
                        <article className="official-tile" key={o.id}>
                          <div
                            className="tile-district"
                            style={{ color: colorFor(o.district || '') }}
                          >
                            {o.district
                              ? `DISTRICT ${o.district}`
                              : 'CITYWIDE MAYOR'}
                          </div>
                          <div className="row">
                            {o.photo ? (
                              <img
                                src={o.photo}
                                alt={o.name}
                                className="avatar"
                              />
                            ) : (
                              <div
                                className="avatar"
                                style={{
                                  display: 'grid',
                                  placeItems: 'center',
                                }}
                              >
                                <Users size={24} />
                              </div>
                            )}
                            <div>
                              <div className="small muted">{o.title}</div>
                              <h3>{o.vacant ? 'Vacant seat' : o.name}</h3>
                              <span className="small muted">
                                {o.termEnd
                                  ? 'Term ends ' + termLabel(o.termEnd)
                                  : 'Term not entered'}
                              </span>
                            </div>
                          </div>
                          <div className="tile-meta">
                            <div className="row">
                              <Mail size={14} />
                              <span style={{ overflowWrap: 'anywhere' }}>
                                {o.email || 'No email added'}
                              </span>
                            </div>
                            <div className="row">
                              <Phone size={14} />
                              {o.phone || 'No phone added'}
                            </div>
                          </div>
                          <button
                            className="btn"
                            onClick={() => setEditing({ ...o })}
                          >
                            <Pencil size={15} />
                            Edit official
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  {section === 'display' && (
                    <DisplayOptions
                      agency={data.content.agency}
                      busy={busy || previewMode}
                      save={(agency) => mutate({ action: 'agency', agency })}
                    />
                  )}
                  {section === 'map' && (
                    <BoundaryEditor
                      content={data.content}
                      busy={busy}
                      save={(input) => mutate({ action: 'map', ...input })}
                    />
                  )}
                  {section === 'embed' && (
                    <EmbedOptions
                      selected={data.content.agency.lookupDesign || 'classic'}
                      busy={busy || previewMode}
                      save={(design) => mutate({ action: 'design', design })}
                    />
                  )}
                  {section === 'security' &&
                    (previewMode ? (
                      <div className="panel stack">
                        <ShieldCheck size={30} />
                        <h3>Password and two-factor authentication</h3>
                        <p className="muted">
                          The live workspace requires an agency account and an
                          authenticator code. Signed-in administrators can
                          manage their password and recovery codes here.
                        </p>
                      </div>
                    ) : (
                      <SecurityOptions admin={data.admin} />
                    ))}
                  {section === 'activity' && (
                    <div className="panel">
                      <h3>Recent activity</h3>
                      {data.activity.length ? (
                        data.activity.map((item) => (
                          <div className="activity-row" key={item.id}>
                            <div>
                              <strong className="small">{item.action}</strong>
                              <p
                                className="small muted"
                                style={{ marginTop: 5 }}
                              >
                                {item.detail}
                              </p>
                              <p className="small muted">{item.actor}</p>
                            </div>
                            <time className="small muted">
                              {new Date(item.created_at).toLocaleString()}
                            </time>
                          </div>
                        ))
                      ) : (
                        <p className="muted small" style={{ marginTop: 18 }}>
                          {previewMode
                            ? 'Private change history is available to signed-in administrators.'
                            : 'Saved edits and publications will appear here.'}
                        </p>
                      )}
                    </div>
                  )}
                </fieldset>
                <aside className="admin-aside">
                  <div className="status-box">
                    <div
                      className="eyebrow"
                      style={{ color: '#82c2c7', marginBottom: 15 }}
                    >
                      Preview, then publish
                    </div>
                    <h3>
                      {data.hasChanges
                        ? 'Your draft is ready to review'
                        : 'Your public lookup is live'}
                    </h3>
                    <p>
                      {data.hasChanges
                        ? 'Saved edits stay private until you publish them. Check the resident view first.'
                        : 'Make changes at your own pace. Residents will continue to see the published version.'}
                    </p>
                    <a
                      className="btn"
                      href={previewMode ? '/martinez/lookup' : '/admin/preview'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Eye size={17} />
                      {previewMode ? 'View public lookup' : 'Preview draft'}
                      <ArrowUpRight size={15} />
                    </a>
                    <button
                      className="btn"
                      style={{
                        marginTop: 10,
                        background: '#70d0c5',
                        color: '#123b43',
                      }}
                      disabled={previewMode || !data.hasChanges || busy}
                      onClick={() => setPublishOpen(true)}
                    >
                      <Check size={17} />
                      Publish changes
                    </button>
                    {data.hasChanges && (
                      <button
                        onClick={() => setDiscardOpen(true)}
                        className="example-link"
                        style={{ color: '#d0e3eb', marginTop: 18 }}
                      >
                        Discard unpublished changes
                      </button>
                    )}
                    <p
                      className="small"
                      style={{ margin: '18px 0 0', fontSize: 12 }}
                    >
                      {previewMode ? (
                        'Preview uses published public content.'
                      ) : (
                        <>
                          Last published{' '}
                          {new Date(data.publishedAt).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="panel review-notes">
                    <h3>At a glance</h3>
                    <ul style={{ paddingLeft: 19 }}>
                      <li>
                        {data.content.map.features.length} council districts
                      </li>
                      <li>
                        {data.addressCount.toLocaleString()} city addresses
                      </li>
                      <li>
                        {data.content.officials.filter((o) => !o.vacant).length}{' '}
                        elected officials
                      </li>
                      <li>Street and satellite map views</li>
                    </ul>
                    <p className="small muted">
                      {previewMode
                        ? 'Reviewing without administrator access'
                        : `Signed in as ${data.admin.name}`}
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>
      <OfficialEditor
        official={editing}
        close={() => setEditing(null)}
        busy={busy}
        save={async (official) => {
          const done = await mutate({ action: 'official', official });
          if (done) setEditing(null);
          return done;
        }}
      />
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent style={{ maxWidth: 470, padding: 28 }}>
          <DialogHeader>
            <DialogTitle>Publish your changes?</DialogTitle>
            <DialogDescription>
              The saved council information, display options and district map
              will become the public version. Check that district assignments
              and contact details are correct.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className="btn" onClick={() => setPublishOpen(false)}>
              Keep reviewing
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                if (await mutate({ action: 'publish' })) setPublishOpen(false);
              }}
            >
              Publish now
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard the draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This restores the last published version. Unpublished edits will
              be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep draft</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await mutate({ action: 'discard' });
                setDiscardOpen(false);
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
function OfficialEditor({
  official,
  close,
  save,
  busy,
}: {
  official: Official | null;
  close: () => void;
  save: (official: Official) => Promise<unknown>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Official | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => {
    setDraft(official ? { ...official } : null);
    setError('');
  }, [official]);
  function field(key: keyof Official, value: string | boolean) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  function requestClose() {
    if (JSON.stringify(draft) !== JSON.stringify(official))
      setConfirmClose(true);
    else close();
  }
  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      const f = new FormData();
      f.append('photo', file);
      const r = await fetch('/api/photos', { method: 'POST', body: f });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      field('photo', d.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <Sheet
        open={!!official}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <SheetContent className="editor-sheet">
          <SheetHeader style={{ padding: '27px 28px 8px' }}>
            <SheetTitle>
              Edit {draft?.district ? 'District ' + draft.district : 'mayor'}
            </SheetTitle>
            <SheetDescription>
              Update this official’s details. Save a draft, then publish when
              ready.
            </SheetDescription>
          </SheetHeader>
          {draft && (
            <form
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                flex: 1,
              }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!(await save(draft)))
                  setError(
                    'The draft could not be saved. Check your entries. If someone else saved an edit, close this form and reload the page.',
                  );
              }}
            >
              <div className="editor-body">
                {error && (
                  <div
                    className="notice error"
                    role="alert"
                    style={{ marginBottom: 16 }}
                  >
                    {error}
                  </div>
                )}
                <div className="photo-editor">
                  {draft.photo ? (
                    <img
                      src={draft.photo}
                      alt={draft.name || 'Official portrait'}
                    />
                  ) : (
                    <div
                      className="avatar"
                      style={{
                        width: 85,
                        height: 105,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Users size={28} />
                    </div>
                  )}
                  <div>
                    <strong className="small">Official portrait</strong>
                    <p className="small muted" style={{ margin: '6px 0 10px' }}>
                      JPG, PNG or GIF, up to 5 MB.
                      <br />
                      Animated GIFs use the first frame.
                    </p>
                    <label className="btn" style={{ cursor: 'pointer' }}>
                      <Upload size={15} />
                      {uploading ? 'Uploading…' : 'Choose photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif"
                        className="sr-only"
                        disabled={uploading}
                        onChange={(e) => {
                          if (e.target.files?.[0])
                            void upload(e.target.files[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {draft.photo && (
                      <button
                        type="button"
                        className="example-link"
                        style={{ marginLeft: 12 }}
                        onClick={() => field('photo', '')}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <Tabs defaultValue="details">
                  <TabsList style={{ marginBottom: 20 }}>
                    <TabsTrigger value="details">Official details</TabsTrigger>
                    <TabsTrigger value="staff">Staff contact</TabsTrigger>
                  </TabsList>
                  <TabsContent value="details">
                    <div className="form-grid">
                      <label className="field wide">
                        Full name
                        <input
                          value={draft.name}
                          required={!draft.vacant}
                          maxLength={120}
                          onChange={(e) => field('name', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Title
                        <input
                          value={draft.title}
                          maxLength={100}
                          onChange={(e) => field('title', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Term ends
                        <input
                          type="month"
                          value={draft.termEnd}
                          onChange={(e) => field('termEnd', e.target.value)}
                        />
                      </label>
                      <label className="field wide">
                        Public email
                        <input
                          type="email"
                          value={draft.email}
                          onChange={(e) => field('email', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Public phone
                        <input
                          type="tel"
                          value={draft.phone}
                          maxLength={40}
                          onChange={(e) => field('phone', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Phone label
                        <input
                          value={draft.phoneLabel}
                          placeholder="e.g. Council office"
                          maxLength={80}
                          onChange={(e) => field('phoneLabel', e.target.value)}
                        />
                      </label>
                      <label className="field wide">
                        Official website or biography link
                        <input
                          type="url"
                          value={draft.website}
                          placeholder="https://"
                          onChange={(e) => field('website', e.target.value)}
                        />
                      </label>
                      <label className="field wide">
                        Short biography
                        <textarea
                          value={draft.bio}
                          maxLength={3000}
                          onChange={(e) => field('bio', e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="toggle-row">
                      <div>
                        <strong>Seat is vacant</strong>
                        <p>
                          Show a vacancy message and the city’s contact details.
                        </p>
                      </div>
                      <Switch
                        checked={draft.vacant}
                        onCheckedChange={(v) => field('vacant', v)}
                        aria-label="Seat is vacant"
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="staff">
                    <p className="small muted" style={{ marginBottom: 20 }}>
                      Add an optional chief of staff or office contact. Enable
                      staff contacts in Display & contact options to show these
                      publicly.
                    </p>
                    <div className="stack">
                      <label className="field">
                        Staff contact name
                        <input
                          value={draft.staffName}
                          maxLength={120}
                          onChange={(e) => field('staffName', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Staff email
                        <input
                          type="email"
                          value={draft.staffEmail}
                          onChange={(e) => field('staffEmail', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Staff phone
                        <input
                          type="tel"
                          value={draft.staffPhone}
                          maxLength={40}
                          onChange={(e) => field('staffPhone', e.target.value)}
                        />
                      </label>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              <footer className="editor-footer">
                <button className="btn" type="button" onClick={requestClose}>
                  Cancel
                </button>
                <button
                  className="btn primary"
                  type="submit"
                  disabled={busy || uploading}
                >
                  <Save size={16} />
                  {busy ? 'Saving…' : 'Save draft'}
                </button>
              </footer>
            </form>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Changes in this form have not been saved to the draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                close();
              }}
            >
              Leave form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function DisplayOptions({
  agency,
  busy,
  save,
}: {
  agency: Agency;
  busy: boolean;
  save: (a: Agency) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(agency);
  useEffect(() => setDraft(agency), [agency]);
  const options: [keyof Agency, string, string][] = [
    [
      'showPhotos',
      'Official photos',
      'Show a portrait alongside the representative’s name.',
    ],
    [
      'showEmail',
      'Email addresses',
      'Let residents email their representative directly.',
    ],
    [
      'showPhone',
      'Phone numbers',
      'Show the public office number and its label.',
    ],
    [
      'showWebsite',
      'Website and biography links',
      'Link to the official’s agency profile.',
    ],
    ['showTerm', 'Term-end dates', 'Show when the current term ends.'],
    [
      'showStaff',
      'Staff contacts',
      'Include the chief of staff or office contact, where entered.',
    ],
    [
      'showMayor',
      'Citywide mayor',
      'Show the mayor alongside the district representative.',
    ],
  ];
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        await save(draft);
      }}
    >
      <h3>Representative information</h3>
      {options.map(([key, title, desc]) => (
        <div className="toggle-row" key={key}>
          <div>
            <strong>{title}</strong>
            <p>{desc}</p>
          </div>
          <Switch
            disabled={busy}
            checked={!!draft[key]}
            onCheckedChange={(v) => setDraft({ ...draft, [key]: v })}
            aria-label={title}
          />
        </div>
      ))}
      <h3 style={{ margin: '28px 0 20px' }}>Page text and city contact</h3>
      <div className="form-grid">
        <label className="field wide">
          Page heading
          <input
            value={draft.heading}
            required
            maxLength={100}
            onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
          />
        </label>
        <label className="field wide">
          Introductory text
          <textarea
            value={draft.intro}
            maxLength={350}
            onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
          />
        </label>
        <label className="field">
          City contact email
          <input
            type="email"
            value={draft.contactEmail}
            onChange={(e) =>
              setDraft({ ...draft, contactEmail: e.target.value })
            }
          />
        </label>
        <label className="field">
          City contact phone
          <input
            type="tel"
            value={draft.contactPhone}
            onChange={(e) =>
              setDraft({ ...draft, contactPhone: e.target.value })
            }
          />
        </label>
        <label className="field wide">
          City website
          <input
            type="url"
            value={draft.website}
            onChange={(e) => setDraft({ ...draft, website: e.target.value })}
          />
        </label>
        <label className="field">
          Accent color
          <input
            type="color"
            value={draft.accent}
            onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
          />
        </label>
      </div>
      <button
        className="btn primary"
        style={{ marginTop: 24 }}
        disabled={busy}
        type="submit"
      >
        <Save size={16} />
        Save display options
      </button>
    </form>
  );
}
function BoundaryEditor({
  content,
  busy,
  save,
}: {
  content: Content;
  busy: boolean;
  save: (input: Record<string, unknown>) => Promise<unknown>;
}) {
  const [raw, setRaw] = useState<FeatureCollection | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [field, setField] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  async function read(file: File) {
    setError('');
    setReading(true);
    setRaw(null);
    setAck(false);
    try {
      if (file.size > 15_000_000)
        throw Error('Choose a map file smaller than 15 MB.');
      let value;
      if (file.name.toLowerCase().endsWith('.zip')) {
        const shp = (await import('shpjs')).default;
        value = await shp(await file.arrayBuffer());
        if (Array.isArray(value))
          throw Error('The zip must contain exactly one shapefile layer.');
      } else value = JSON.parse(await file.text());
      if (value.type !== 'FeatureCollection' || !value.features?.length)
        throw Error('Choose a polygon GeoJSON or a zipped shapefile.');
      setFields(Object.keys(value.features[0].properties || {}));
      setField('');
      setName(file.name.replace(/\.(zip|geojson|json)$/i, ''));
      setRaw(value);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }
  const values =
    raw && field
      ? [
          ...new Set(
            raw.features
              .map((f: Feature) => String(f.properties?.[field] ?? '').trim())
              .filter(Boolean),
          ),
        ]
      : [];
  const checked = useMemo(() => {
    if (!raw || !field) return { map: null, error: '' };
    try {
      return { map: normalizeMap(raw, field).map, error: '' };
    } catch (e) {
      return { map: null, error: (e as Error).message };
    }
  }, [raw, field]);
  return (
    <div className="stack">
      <div className="panel">
        <div className="row space-between">
          <div>
            <div className="eyebrow">Saved draft map</div>
            <h3 style={{ marginTop: 8 }}>{content.mapName}</h3>
            <p className="small muted" style={{ marginTop: 8 }}>
              Effective {content.mapEffectiveDate} ·{' '}
              {content.map.features.length} districts
            </p>
          </div>
          <Map size={24} />
        </div>
        <div className="boundary-preview" style={{ marginTop: 20 }}>
          <DistrictMapView
            geo={content.map}
            selected={selection}
            onSelect={setSelection}
            address={null}
          />
        </div>
      </div>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ack) return;
          if (
            await save({ map: raw, field, mapName: name, effectiveDate: date })
          ) {
            setRaw(null);
            setField('');
            setAck(false);
          }
        }}
      >
        <h3>Upload replacement boundaries</h3>
        <p className="small muted" style={{ marginTop: 10 }}>
          Use a zipped shapefile with its .shp, .shx, .dbf and .prj files, or
          polygon GeoJSON. Then choose the field that identifies each council
          district.
        </p>
        <div className="upload-box">
          <Upload size={28} />
          <label className="btn">
            <input
              type="file"
              className="sr-only"
              accept=".zip,.geojson,.json"
              disabled={reading}
              onChange={(e) => {
                if (e.target.files?.[0]) void read(e.target.files[0]);
                e.target.value = '';
              }}
            />
            {reading ? 'Reading map…' : 'Choose a map file'}
          </label>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {raw && (
          <div className="stack">
            <div className="field">
              <label htmlFor="district-field">District identifier field</label>
              <Select
                value={field}
                onValueChange={(v) => {
                  setField(v || '');
                  setAck(false);
                }}
              >
                <SelectTrigger id="district-field">
                  <SelectValue placeholder="Choose the district field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field && (
              <>
                <div className="notice">
                  Found labels: {values.map(String).join(', ')}. Blank labels
                  will be excluded and recorded.
                </div>
                {checked.error && (
                  <div className="notice error" role="alert">
                    {checked.error}
                  </div>
                )}
                {checked.map && (
                  <div className="boundary-preview">
                    <DistrictMapView
                      geo={checked.map}
                      selected={null}
                      onSelect={() => {}}
                      address={null}
                    />
                  </div>
                )}
              </>
            )}
            <div className="form-grid">
              <label className="field">
                Map name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                />
              </label>
              <label className="field">
                Effective date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="toggle-row">
              <div>
                <strong>I reviewed the district labels</strong>
                <p>
                  These are the city’s adopted boundaries. I will verify the
                  official assigned to each district before publishing.
                </p>
              </div>
              <Switch
                checked={ack}
                onCheckedChange={setAck}
                aria-label="I reviewed the district labels"
              />
            </div>
            <button
              className="btn primary"
              disabled={busy || !field || !ack || !checked.map}
              type="submit"
            >
              Validate and save map draft
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
function EmbedOptions({
  selected,
  busy,
  save,
}: {
  selected: string;
  busy: boolean;
  save: (design: string) => Promise<unknown>;
}) {
  const [origin, setOrigin] = useState('');
  const [design, setDesign] = useState(selected);
  useEffect(() => setDesign(selected), [selected]);
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(location.origin), []);
  const current = designs.find((item) => item.id === design)!;
  const code = `<iframe\n  src="${origin}/embed"\n  title="Find your Martinez councilmember"\n  width="100%" height="950"\n  style="border:0; border-radius:12px;"\n  loading="lazy">\n</iframe>`;
  return (
    <div className="panel stack">
      <div>
        <h3>Embed the lookup</h3>
        <p className="muted small" style={{ marginTop: 12 }}>
          Paste this into an HTML or embed block in your city website. It
          displays the published lookup and follows your display settings.
        </p>
      </div>
      <label className="stack small">
        Lookup design
        <select
          value={design}
          onChange={(event) => {
            setDesign(event.target.value);
            setCopied(false);
          }}
          className="input"
        >
          {designs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.number} — {item.name}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">
        Your public link stays the same when you change designs. Save the
        design, review your draft, then publish it.
      </p>
      <div className="row">
        <button
          className="btn primary"
          disabled={busy || design === selected}
          onClick={() => save(design)}
        >
          <Save size={16} /> Save design choice
        </button>
        <a className="btn" href={current.path} target="_blank" rel="noreferrer">
          Preview this design <ExternalLink size={16} />
        </a>
      </div>
      <pre className="code-box">{code}</pre>
      <div className="row">
        <button
          className="btn primary"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
          {copied ? 'Copied' : 'Copy embed code'}
        </button>
        <a className="btn" href="/embed" target="_blank" rel="noreferrer">
          Preview embed <ExternalLink size={16} />
        </a>
      </div>
      <hr />
      <h3>Use a direct link</h3>
      <p className="small muted">
        Add a “Find your councilmember” button that opens the lookup in its own
        page.
      </p>
      <code className="code-box">
        {origin}
        /martinez/lookup
      </code>
      <p className="small muted">
        Your website administrator can adjust the frame height to fit the page.
        The lookup adapts to smaller screens.
      </p>
    </div>
  );
}
function SecurityOptions({
  admin,
}: {
  admin: { name: string; email: string };
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.SubmitEvent<HTMLFormElement>, action: string) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = e.currentTarget;
    try {
      const body = Object.fromEntries(new FormData(form));
      if (action === 'password' && body.password !== body.confirm)
        throw Error('The new passwords do not match.');
      const r = await api('/api/auth/' + action, body);
      if (r.recoveryCodes) setCodes(r.recoveryCodes);
      setMessage(
        action === 'password'
          ? 'Password updated. Other sessions were signed out.'
          : 'New recovery codes created. Previous codes no longer work.',
      );
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="panel">
        <div className="row">
          <ShieldCheck size={27} color="#146b72" />
          <div>
            <h3>Two-factor authentication is on</h3>
            <p className="small muted" style={{ marginTop: 8 }}>
              {admin.name} · {admin.email}
            </p>
          </div>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      <form className="panel stack" onSubmit={(e) => submit(e, 'password')}>
        <h3>Change password</h3>
        <label className="field">
          Current password
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
          />
        </label>
        <label className="field">
          New password
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <label className="field">
          Confirm new password
          <input
            type="password"
            name="confirm"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>
        <button className="btn primary" disabled={busy}>
          <LockKeyhole size={16} />
          Update password
        </button>
      </form>
      <form className="panel stack" onSubmit={(e) => submit(e, 'recovery')}>
        <h3>Recovery codes</h3>
        <p className="small muted">
          Generate a fresh set if you have used or misplaced your recovery
          codes. This replaces all previous codes.
        </p>
        <label className="field">
          Confirm your password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
        <button className="btn" disabled={busy}>
          Generate new recovery codes
        </button>
        {codes.length > 0 && (
          <>
            <div className="recovery-codes">
              {codes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <a
              download="district-lookup-recovery-codes.txt"
              href={
                'data:text/plain;charset=utf-8,' +
                encodeURIComponent(codes.join('\n'))
              }
            >
              Download recovery codes
            </a>
          </>
        )}
      </form>
    </div>
  );
}
