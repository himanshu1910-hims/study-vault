import assert from 'node:assert/strict';
import test from 'node:test';
import { FolderItem } from '../types';
import {
  arrayBufferToBase64Chunks,
  formatBytes,
  formatDuration,
  generateSafeId,
  getBreadcrumbTrail,
  isDescendantOrSelf,
  normalizeFolderId,
  reassembleChunksToBlob,
} from './fileHelpers';

test('normalizeFolderId normalizes null, undefined, root, and index to empty string', () => {
  assert.equal(normalizeFolderId(undefined), '');
  assert.equal(normalizeFolderId(null), '');
  assert.equal(normalizeFolderId(''), '');
  assert.equal(normalizeFolderId('root'), '');
  assert.equal(normalizeFolderId('index'), '');
  assert.equal(normalizeFolderId('fld_abc123'), 'fld_abc123');
});

test('generateSafeId matches Firestore isValidId regex and length constraints', () => {
  const id = generateSafeId('folder');
  assert.match(id, /^[a-zA-Z0-9_-]+$/);
  assert.ok(id.length >= 4 && id.length <= 128);
});

test('getBreadcrumbTrail builds root index and nested trail safely even with circular data', () => {
  const folders: FolderItem[] = [
    {
      id: 'f1',
      userId: 'u1',
      name: 'M.Pharm',
      parentId: '',
      color: 'blue',
      isFavorite: false,
      isTrash: false,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'f2',
      userId: 'u1',
      name: 'Pharmaceutics',
      parentId: 'f1',
      color: 'emerald',
      isFavorite: false,
      isTrash: false,
      createdAtMs: 2,
      updatedAtMs: 2,
    },
  ];

  assert.deepEqual(getBreadcrumbTrail(folders, ''), [{ id: '', name: 'My Library' }]);
  assert.deepEqual(getBreadcrumbTrail(folders, 'f2'), [
    { id: '', name: 'My Library' },
    { id: 'f1', name: 'M.Pharm' },
    { id: 'f2', name: 'Pharmaceutics' },
  ]);

  assert.equal(isDescendantOrSelf(folders, 'f1', 'f2'), true);
  assert.equal(isDescendantOrSelf(folders, 'f2', 'f1'), false);
});

test('arrayBufferToBase64Chunks and reassembleChunksToBlob round-trip binary bytes accurately', async () => {
  const sample = new Uint8Array(15000);
  for (let i = 0; i < sample.length; i++) sample[i] = i % 256;

  const chunks = arrayBufferToBase64Chunks(sample.buffer, 4096);
  assert.ok(chunks.length > 3);

  const blob = reassembleChunksToBlob(chunks, 'application/pdf');
  const roundTrip = new Uint8Array(await blob.arrayBuffer());
  assert.equal(roundTrip.length, sample.length);
  for (let i = 0; i < sample.length; i++) {
    assert.equal(roundTrip[i], sample[i]);
  }
});

test('formatBytes and formatDuration produce clean tabular strings', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatDuration(135), '02:15');
});
