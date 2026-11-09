import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inAgency } from '../lib/agency-scope';
import { inClientPreview } from '../lib/client-preview-scope';
import { state, changeDraft, publish, database } from '../lib/store';
import {
  transition,
  createTransition,
  saveTransition,
  launchTransition,
  boardArchives,
  archiveContent,
  rotateTransitionKey,
  discardTransition,
  transitionKeyValid,
  transitionContent,
} from '../lib/board-transition';
process.env.DATA_DIR = mkdtempSync(
  path.join(tmpdir(), 'board-transition-unit-'),
);

void test('Incoming edits remain private; launch archives the exact outgoing board and changes all published data together', () =>
  inAgency('arpeeville', () => {
    const original = state();
    let incoming = createTransition('November board', '2026-11-20', 'test');
    const board = structuredClone(incoming.board);
    board.officials[0].name = 'Incoming member';
    board.officials[0].bio = 'A newly elected member.';
    saveTransition(
      incoming.id,
      incoming.revision,
      board,
      incoming.title,
      incoming.swearingIn,
      'test',
    );
    assert.deepEqual(state(), original);
    assert.equal(transitionContent().officials[0].name, 'Incoming member');
    assert.throws(
      () =>
        saveTransition(
          incoming.id,
          incoming.revision,
          board,
          'Stale edit',
          '',
          'test',
        ),
      /changed/,
    );
    incoming = transition()!;
    const beforeLaunch = state();
    launchTransition(
      incoming.id,
      incoming.revision,
      beforeLaunch.revision,
      'test',
    );
    assert.equal(state().published.officials[0].name, 'Incoming member');
    assert.deepEqual(state().draft, state().published);
    assert.deepEqual(state().published.map, original.published.map);
    assert.deepEqual(
      state().published.management,
      original.published.management,
    );
    const archives = boardArchives();
    assert.equal(archives.length, 1);
    assert.deepEqual(
      archiveContent(archives[0].id),
      JSON.parse(JSON.stringify(original.published)),
    );
    assert.equal(transition(), null);
    assert.equal(transitionKeyValid(incoming.shareKey), false);
    assert.throws(
      () =>
        launchTransition(
          incoming.id,
          incoming.revision,
          beforeLaunch.revision,
          'test',
        ),
      /changed/,
    );
    assert.equal(boardArchives().length, 1);
  }));
void test('Restoration is staged; launch preserves later site settings and protects unpublished work', () =>
  inAgency('arpeeville', () => {
    const before = state();
    const old = archiveContent(boardArchives()[0].id);
    let restored = createTransition(
      'Restore previous board',
      '',
      'test',
      boardArchives()[0].id,
    );
    assert.deepEqual(state(), before);
    assert.deepEqual(restored.board.officials, old.officials);
    const edit = structuredClone(before.draft);
    edit.agency.heading = 'A new agency heading';
    changeDraft(before.revision, edit, 'test', 'Update heading');
    assert.throws(
      () =>
        launchTransition(
          restored.id,
          restored.revision,
          before.revision,
          'test',
        ),
      /site changed/,
    );
    assert.throws(
      () =>
        launchTransition(
          restored.id,
          restored.revision,
          state().revision,
          'test',
        ),
      /unpublished edits/,
    );
    assert.equal(boardArchives().length, 1);
    assert.ok(transition());
    publish(state().revision, 'test');
    restored = transition()!;
    launchTransition(restored.id, restored.revision, state().revision, 'test');
    assert.equal(state().published.agency.heading, 'A new agency heading');
    assert.deepEqual(state().published.officials, old.officials);
    assert.equal(boardArchives().length, 2);
  }));
void test('Sharing grants revoke on rotation and discard, and are isolated by agency and demo scope', () =>
  inAgency('arpeeville', () => {
    const incoming = createTransition('Grant test', '', 'test');
    assert.equal(transitionKeyValid(incoming.shareKey), true);
    assert.equal(transitionKeyValid('x'.repeat(64)), false);
    inAgency('martinez', () =>
      assert.equal(transitionKeyValid(incoming.shareKey), false),
    );
    inClientPreview(() =>
      assert.equal(transitionKeyValid(incoming.shareKey), false),
    );
    rotateTransitionKey(incoming.id, incoming.revision, 'test');
    assert.equal(transitionKeyValid(incoming.shareKey), false);
    const changed = transition()!;
    assert.equal(transitionKeyValid(changed.shareKey), true);
    assert.throws(
      () => discardTransition(incoming.id, incoming.revision, 'test'),
      /changed/,
    );
    discardTransition(changed.id, changed.revision, 'test');
    assert.equal(transitionKeyValid(changed.shareKey), false);
  }));
void test('Bad assignments, duplicate profiles, foreign photos and unsafe biography markup cannot launch', () =>
  inAgency('arpeeville', () => {
    const incoming = createTransition('Validation', '', 'test');
    const save = (board: unknown) =>
      saveTransition(
        incoming.id,
        transition()!.revision,
        board,
        'Validation',
        '',
        'test',
      );
    let board = structuredClone(incoming.board);
    board.officials[0].district = '999';
    save(board);
    assert.throws(
      () =>
        launchTransition(
          incoming.id,
          transition()!.revision,
          state().revision,
          'test',
        ),
      /outside this map/,
    );
    board = structuredClone(incoming.board);
    board.officials[0].id = board.officials[1].id;
    assert.throws(() => save(board), /unique/);
    board = structuredClone(incoming.board);
    board.officials[0].photo = '/api/agencies/galt/photos/' + 'a'.repeat(32);
    assert.throws(() => save(board), /this agency/);
    board = structuredClone(incoming.board);
    board.officials[0].bioFormat = 'html';
    board.officials[0].bio = '<p>Hello</p><script>alert(1)</script>';
    save(board);
    assert.equal(transition()!.board.officials[0].bio, '<p>Hello</p>');
    const current = transition()!;
    discardTransition(current.id, current.revision, 'test');
  }));
void test('Demo launch, archive and restore never affect a real board, private draft or live archive', () =>
  inAgency('arpeeville', () => {
    const live = state();
    const archives = boardArchives();
    inClientPreview(() => {
      let incoming = createTransition('Demo only', '', 'visitor');
      const board = structuredClone(incoming.board);
      board.officials[0].name = 'Demo incoming';
      saveTransition(
        incoming.id,
        incoming.revision,
        board,
        'Demo only',
        '',
        'visitor',
      );
      incoming = transition()!;
      launchTransition(
        incoming.id,
        incoming.revision,
        state().revision,
        'visitor',
      );
      assert.equal(state().published.officials[0].name, 'Demo incoming');
      assert.equal(boardArchives().length, 1);
      assert.throws(() => archiveContent(archives[0].id), /not found/);
    });
    assert.deepEqual(state(), live);
    assert.deepEqual(boardArchives(), archives);
  }));
void test('A failed archive write rolls back the whole launch', () =>
  inAgency('arpeeville', () => {
    const before = state();
    const incoming = createTransition('Atomicity', '', 'test');
    const count = boardArchives().length;
    database().exec(
      "CREATE TRIGGER fail_board_archive BEFORE INSERT ON board_archive BEGIN SELECT RAISE(ABORT, 'simulated archive failure'); END;",
    );
    try {
      assert.throws(
        () =>
          launchTransition(
            incoming.id,
            incoming.revision,
            before.revision,
            'test',
          ),
        /simulated archive failure/,
      );
    } finally {
      database().exec('DROP TRIGGER fail_board_archive');
    }
    assert.deepEqual(state(), before);
    assert.equal(boardArchives().length, count);
    assert.equal(transition()?.id, incoming.id);
  }));
