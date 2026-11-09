'use client';
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  ArrowRight,
  Archive,
  Copy,
  Eye,
  Plus,
  RefreshCw,
  Rocket,
  Pencil,
} from 'lucide-react';
import { termLabel, type Content, type Official } from '@/lib/model';
import type {
  Board,
  BoardTransition,
  BoardArchive,
} from '@/lib/board-transition';
import type { OfficialEditorProps } from './admin-console';
import { RepresentationEditor } from './representation-editor';
import { Portrait } from './official-portrait';
import { constituencyLabel, titleLabel } from '@/lib/representation';
import { designs } from '@/lib/designs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
type Dashboard = {
  transition: BoardTransition | null;
  content: Content;
  liveRevision: number;
  hasChanges: boolean;
  readinessIssue: string | null;
  archives: BoardArchive[];
};

export function BoardTransitions({
  agencyId,
  clientPreview,
  readOnly,
  Editor,
  onLaunch,
}: {
  agencyId: string;
  clientPreview: boolean;
  readOnly: boolean;
  Editor: ComponentType<OfficialEditorProps>;
  onLaunch: () => Promise<void>;
}) {
  const api = `/api/transitions/${agencyId}`;
  const suffix = clientPreview ? '?demo=1' : '';
  const previewPath = `/${agencyId}/transition${suffix}`;
  const [data, setData] = useState<Dashboard | null>(null);
  const [title, setTitle] = useState('Incoming board');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Official | null>(null);
  const [confirm, setConfirm] = useState<
    'launch' | 'discard' | 'rotate' | null
  >(null);
  const [archive, setArchive] = useState<{
    info: BoardArchive;
    content: Content;
  } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(api + suffix, { cache: 'no-store' });
    const result = await r.json();
    if (!r.ok) throw Error(result.error || 'Unable to load board transitions.');
    setData(result);
    setTitle(result.transition?.title || 'Incoming board');
    setDate(result.transition?.swearingIn || '');
  }, [api, suffix]);
  useEffect(() => {
    if (!readOnly) load().catch((e) => setError(e.message));
  }, [load, readOnly]);
  async function mutate(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch(api + suffix, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data?.transition?.id,
          revision: data?.transition?.revision,
          ...body,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || 'Unable to save.');
      await load();
      setMessage(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function save(board: Board) {
    return mutate(
      { action: 'save', board, title, swearingIn: date },
      'Incoming board saved. All four transition previews have been updated.',
    );
  }
  function addOfficial() {
    setEditing({
      id: 'official-' + crypto.randomUUID().slice(0, 16),
      district: null,
      name: '',
      title:
        data?.content.agency.kind === 'county'
          ? 'Supervisor'
          : data?.content.agency.kind === 'college'
            ? 'Trustee'
            : data?.content.agency.kind === 'city'
              ? 'Councilmember'
              : 'Board Member',
      email: '',
      phone: '',
      phoneLabel: 'Office',
      website: '',
      termEnd: '',
      photo: '',
      bio: '',
      staffName: '',
      staffEmail: '',
      staffPhone: '',
      vacant: false,
    });
  }
  async function openArchive(info: BoardArchive) {
    setError('');
    setBusy(true);
    try {
      const r = await fetch(
        `${api}/archive?id=${info.id}${clientPreview ? '&demo=1' : ''}`,
        { cache: 'no-store' },
      );
      const value = await r.json();
      if (!r.ok) throw Error(value.error);
      setArchive({ info, content: value.content });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (readOnly)
    return (
      <div className="panel stack">
        <h2>Prepare the next board</h2>
        <p>
          Administrators can prepare incoming officials, share a private preview
          in all four layouts, and launch it when the new board is sworn in. The
          outgoing board is archived automatically.
        </p>
        <p className="muted">
          Sign in to administration to create a transition.
        </p>
      </div>
    );
  const incoming = data?.transition;
  const content = data?.content;
  return (
    <div className="stack board-transitions">
      {error && (
        <div className="notice error" role="alert">
          {error}{' '}
          <button
            className="btn quiet"
            onClick={() => {
              setError('');
              load().catch((e) => setError(e.message));
            }}
          >
            Reload workspace
          </button>
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {clientPreview && (
        <div className="notice">
          You are trying transitions in the agency preview. Launching here
          updates the shared preview only.
        </div>
      )}
      {!data && !error && <p>Loading board transitions…</p>}
      {data && (
        <>
          <section className="panel stack">
            <div className="row">
              <RefreshCw size={24} />
              <h2>{incoming ? incoming.title : 'Prepare the next board'}</h2>
            </div>
            <p className="muted">
              Build the incoming roster while residents continue to see the
              current board. Share a private preview, then launch when the new
              members are sworn in.
            </p>
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (incoming) await save(incoming.board);
                else
                  await mutate(
                    { action: 'create', title, swearingIn: date },
                    'Transition created from the current board.',
                  );
              }}
            >
              <div className="form-grid">
                <label className="field">
                  Transition name
                  <input
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  Swearing-in date (optional)
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={busy}
                  />
                  <span className="small muted">
                    For reference. Launch is always a manual action.
                  </span>
                </label>
              </div>
              <button className="btn primary" disabled={busy}>
                {incoming ? 'Save transition details' : 'Create transition'}{' '}
                <ArrowRight size={16} />
              </button>
            </form>
          </section>
          {incoming && content && (
            <>
              <section className="panel stack">
                <h3>Share with staff</h3>
                <p className="small muted">
                  Anyone with this private link can review the incoming board.
                  It does not grant editing access. Replacing the link revokes
                  earlier links and preview sessions.
                </p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          location.origin +
                            previewPath +
                            (clientPreview ? '&' : '?') +
                            'key=' +
                            incoming.shareKey,
                        );
                        setMessage('Private staff preview link copied.');
                      } catch {
                        setError(
                          'Copying is unavailable. Use the link field below.',
                        );
                      }
                    }}
                  >
                    <Copy size={16} /> Copy staff preview link
                  </button>
                  <button
                    className="btn quiet"
                    disabled={busy}
                    onClick={() => setConfirm('rotate')}
                  >
                    Replace sharing link
                  </button>
                </div>
                <input
                  className="transition-link"
                  aria-label="Private staff preview link"
                  readOnly
                  value={
                    typeof window === 'undefined'
                      ? ''
                      : location.origin +
                        previewPath +
                        (clientPreview ? '&' : '?') +
                        'key=' +
                        incoming.shareKey
                  }
                  onFocus={(e) => e.target.select()}
                />
                <div className="transition-layouts">
                  {designs.map((d) => (
                    <a
                      key={d.id}
                      className="btn"
                      href={
                        previewPath +
                        (clientPreview ? '&' : '?') +
                        'design=' +
                        d.id
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Eye size={16} />
                      {d.name}
                    </a>
                  ))}
                </div>
              </section>
              <section className="stack">
                <div className="row space-between" style={{ flexWrap: 'wrap' }}>
                  <h3>Incoming officials</h3>
                  <button
                    className="btn"
                    disabled={busy || incoming.board.officials.length >= 100}
                    onClick={addOfficial}
                  >
                    <Plus size={16} />
                    Add at-large official
                  </button>
                </div>
                <p className="small muted">
                  Edit each seat to replace an outgoing member, update titles,
                  or mark a vacancy. District assignments can be adjusted below.
                </p>
                <div className="official-grid">
                  {incoming.board.officials.map((o) => (
                    <article className="official-tile" key={o.id}>
                      <div className="tile-district">
                        {constituencyLabel(o, content.agency)}
                      </div>
                      <div className="row">
                        <Portrait official={o} className="avatar" />
                        <div>
                          <span className="small muted">{titleLabel(o)}</span>
                          <h3>{o.vacant ? 'Vacant seat' : o.name}</h3>
                          <p className="small muted">
                            {o.termEnd
                              ? 'Term ends ' + termLabel(o.termEnd)
                              : 'Term not entered'}
                          </p>
                        </div>
                      </div>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => setEditing({ ...o })}
                      >
                        <Pencil size={16} />
                        Edit incoming official
                      </button>
                      {o.district === null && (
                        <button
                          className="btn quiet"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${o.name || 'this at-large profile'} from the incoming board?`,
                              )
                            )
                              void save({
                                ...incoming.board,
                                officials: incoming.board.officials.filter(
                                  (p) => p.id !== o.id,
                                ),
                              });
                          }}
                        >
                          Remove at-large profile
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              <details className="panel">
                <summary>Districts &amp; at-large representation</summary>
                <RepresentationEditor
                  content={content}
                  busy={busy}
                  save={async (body) => {
                    const assignments = body.assignments as Pick<
                      Official,
                      'id' | 'district' | 'selectionMethod'
                    >[];
                    return save({
                      ...incoming.board,
                      officials: incoming.board.officials.map((o) => ({
                        ...o,
                        ...assignments.find((p) => p.id === o.id),
                      })),
                      districtElections:
                        body.districtElections as Board['districtElections'],
                    });
                  }}
                />
              </details>
              <section className="panel stack transition-launch">
                <div className="row">
                  <Rocket size={24} />
                  <h3>Ready for swearing-in?</h3>
                </div>
                <p>
                  Launch replaces the current board in all four layouts and
                  archives the outgoing board’s photos, biographies, contacts
                  and assignments. The current map and agency settings are
                  retained.
                </p>
                {data.hasChanges && (
                  <div className="notice">
                    There are unpublished changes to the current site. Publish
                    or discard those in the main editor before launching this
                    transition.
                  </div>
                )}
                {data.readinessIssue && (
                  <div className="notice error">
                    Complete the district assignments before launch:{' '}
                    {data.readinessIssue}
                  </div>
                )}
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <button
                    className="btn primary"
                    disabled={busy || data.hasChanges || !!data.readinessIssue}
                    onClick={() => setConfirm('launch')}
                  >
                    <Rocket size={16} />
                    {clientPreview
                      ? 'Launch in shared preview'
                      : 'Launch incoming board'}
                  </button>
                  <button
                    className="btn quiet"
                    disabled={busy}
                    onClick={() => setConfirm('discard')}
                  >
                    Discard transition
                  </button>
                </div>
              </section>
            </>
          )}
          <section className="panel stack">
            <div className="row">
              <Archive size={24} />
              <h2>Previous boards</h2>
            </div>
            <p className="small muted">
              An archive is created every time a transition launches. Restoring
              an archive creates a new transition for review; it does not
              immediately change the current board.
            </p>
            {!data.archives.length ? (
              <p className="muted">No boards have been archived yet.</p>
            ) : (
              data.archives.map((item) => (
                <div className="transition-archive-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="small muted">
                      {new Date(item.createdAt).toLocaleString()} ·{' '}
                      {item.memberCount} profiles · {item.actor}
                    </p>
                  </div>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => openArchive(item)}
                  >
                    View archive
                  </button>
                </div>
              ))
            )}
          </section>
        </>
      )}
      <Editor
        agencyId={agencyId}
        clientPreview={clientPreview}
        agency={content?.agency}
        kind={content?.agency.kind}
        transitionPath={previewPath}
        official={editing}
        isNew={
          !!editing &&
          !incoming?.board.officials.some((o) => o.id === editing.id)
        }
        close={() => setEditing(null)}
        busy={busy}
        save={async (official, photoAspectRatio) => {
          if (!incoming) return false;
          const exists = incoming.board.officials.some(
            (o) => o.id === official.id,
          );
          const ok = await save({
            ...incoming.board,
            photoAspectRatio,
            officials: exists
              ? incoming.board.officials.map((o) =>
                  o.id === official.id ? official : o,
                )
              : [...incoming.board.officials, official],
          });
          if (ok) setEditing(null);
          return ok;
        }}
      />
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === 'launch'
                ? 'Launch the incoming board?'
                : confirm === 'rotate'
                  ? 'Replace the sharing link?'
                  : 'Discard this transition?'}
            </DialogTitle>
            <DialogDescription>
              {confirm === 'launch'
                ? `All four ${clientPreview ? 'shared preview' : 'public'} layouts will switch to the saved incoming board immediately. The outgoing board will be archived. Only saved edits are included.`
                : confirm === 'rotate'
                  ? 'Staff will need the new link. Earlier links and their preview sessions will stop working.'
                  : 'Incoming edits and the staff preview link will be removed. The current board will remain unchanged.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <button
              className="btn"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Keep reviewing
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                const action = confirm;
                if (!action) return;
                if (
                  await mutate(
                    {
                      action,
                      ...(action === 'launch'
                        ? {
                            confirm: 'LAUNCH',
                            liveRevision: data?.liveRevision,
                          }
                        : {}),
                    },
                    action === 'launch'
                      ? 'Incoming board launched. The outgoing board is in Previous boards.'
                      : action === 'rotate'
                        ? 'Sharing link replaced. Copy the new link above.'
                        : 'Transition discarded.',
                  )
                ) {
                  setConfirm(null);
                  if (action === 'launch') await onLaunch();
                }
              }}
            >
              {busy
                ? 'Working…'
                : confirm === 'launch'
                  ? 'Confirm launch'
                  : confirm === 'rotate'
                    ? 'Replace link'
                    : 'Discard transition'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!archive}
        onOpenChange={(open) => {
          if (!open) setArchive(null);
        }}
      >
        <DialogContent className="transition-archive-dialog">
          <DialogHeader>
            <DialogTitle>{archive?.info.title}</DialogTitle>
            <DialogDescription>
              Historical board information saved before launch.
            </DialogDescription>
          </DialogHeader>
          {archive && (
            <>
              <div className="stack">
                {archive.content.officials.map((o) => (
                  <details className="panel" key={o.id}>
                    <summary>
                      {o.vacant ? 'Vacant seat' : o.name} ·{' '}
                      {constituencyLabel(o, archive.content.agency)}
                    </summary>
                    <div className="row">
                      <Portrait official={o} className="avatar" />
                      <div>
                        <p>{titleLabel(o)}</p>
                        <p>
                          {o.termEnd && 'Term ends ' + termLabel(o.termEnd)}
                        </p>
                        <p>{o.email}</p>
                        <p>{o.phone}</p>
                      </div>
                    </div>
                    <p>{o.website}</p>
                    <p>
                      {o.staffName} {o.staffEmail} {o.staffPhone}
                    </p>
                    <p className="small muted">
                      Biography and complete saved fields are included in the
                      archive download.
                    </p>
                    <pre className="transition-archive-bio">
                      {o.bioFormat === 'html'
                        ? o.bio.replace(/<[^>]+>/g, ' ')
                        : o.bio}
                    </pre>
                  </details>
                ))}
              </div>
              <DialogFooter>
                <a
                  className="btn"
                  download={`${agencyId}-board-archive.json`}
                  href={
                    'data:application/json;charset=utf-8,' +
                    encodeURIComponent(JSON.stringify(archive.content, null, 2))
                  }
                >
                  Download archive
                </a>
                <button
                  className="btn primary"
                  disabled={busy || !!incoming}
                  onClick={async () => {
                    if (
                      await mutate(
                        {
                          action: 'restore',
                          archiveId: archive.info.id,
                          title: 'Restored board',
                          swearingIn: '',
                        },
                        'Archive copied into a new transition. Review it before launching.',
                      )
                    )
                      setArchive(null);
                  }}
                >
                  Restore into transition
                </button>
              </DialogFooter>
              {incoming && (
                <p className="small muted">
                  Finish or discard the current transition before restoring an
                  archive.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
