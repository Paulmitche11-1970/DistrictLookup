import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  clientPreviewPassword,
  matchesClientPreviewPassword,
  createClientPreviewToken,
  validClientPreviewToken,
  previewSessionSeconds,
} from '../lib/client-preview-token';
import { agencyPreviewToken } from '../lib/agency-preview-token';
import { inAgency, photoInScope } from '../lib/agency-scope';
import { inClientPreview } from '../lib/client-preview-scope';
import {
  state,
  changeDraft,
  resetClientPreview,
  publish,
  database,
} from '../lib/store';
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'preview-unit-'));
process.env.APP_SECRET = 'client-preview-unit-secret-'.repeat(3);
void test('Preview password sessions expire, bind to the agency and revoke on password or revision change', () => {
  assert.equal(clientPreviewPassword('galt'), 'GALTPreview');
  assert.equal(matchesClientPreviewPassword('galt', 'GALTPreview'), true);
  assert.equal(matchesClientPreviewPassword('galt', 'galtpreview'), false);
  const now = Date.now();
  const token = createClientPreviewToken('galt', now);
  assert.ok(validClientPreviewToken('galt', token, now));
  assert.equal(validClientPreviewToken('martinez', token, now), false);
  assert.equal(
    validClientPreviewToken('galt', token, now + previewSessionSeconds * 1000),
    false,
  );
  assert.equal(
    validClientPreviewToken('galt', agencyPreviewToken('galt')),
    false,
  );
  process.env.AGENCY_PREVIEW_PASSWORD_GALT = 'ReplacementPreview';
  assert.equal(validClientPreviewToken('galt', token, now), false);
  delete process.env.AGENCY_PREVIEW_PASSWORD_GALT;
  process.env.AGENCY_PREVIEW_REVISION_GALT = '2';
  assert.equal(validClientPreviewToken('galt', token, now), false);
  delete process.env.AGENCY_PREVIEW_REVISION_GALT;
});
void test('Shared edits and reset never mutate live drafts, published content or another agency; stale resets fail', () => {
  inAgency('arpeeville', () => {
    const live = state();
    const privateDraft = structuredClone(live.draft);
    privateDraft.agency.heading = 'A private live draft';
    changeDraft(live.revision, privateDraft, 'test', 'Live draft');
    const liveAfter = state();
    inClientPreview(() => {
      const original = state();
      assert.equal(
        original.draft.agency.heading,
        live.published.agency.heading,
      );
      assert.equal(original.previewEdited, false);
      const edit = structuredClone(original.draft);
      edit.officials[0].name = 'Preview edit';
      edit.agency.showEmail = false;
      changeDraft(original.revision, edit, 'test', 'Change preview');
      const changed = state();
      assert.equal(changed.published.officials[0].name, 'Preview edit');
      assert.equal(changed.previewEdited, true);
      assert.throws(
        () => resetClientPreview(original.revision),
        /Another edit/,
      );
      assert.throws(
        () => publish(changed.revision, 'test'),
        /cannot be published/,
      );
      resetClientPreview(changed.revision);
      assert.equal(state().previewEdited, false);
      assert.deepEqual(state().published, original.published);
      assert.equal(
        database()
          .prepare('SELECT count(*) AS n FROM client_preview_audit')
          .get()?.n,
        2,
      );
      assert.ok(
        photoInScope('/api/previews/arpeeville/photos/' + 'a'.repeat(32)),
      );
      assert.equal(
        photoInScope('/api/previews/galt/photos/' + 'a'.repeat(32)),
        false,
      );
    });
    assert.deepEqual(state(), liveAfter);
    assert.equal(
      photoInScope('/api/previews/arpeeville/photos/' + 'a'.repeat(32)),
      false,
    );
  });
});
