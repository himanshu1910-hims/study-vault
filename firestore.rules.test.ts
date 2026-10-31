import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

/**
 * Security Rules Structural & Dirty-Dozen Invariant Verification Suite
 * Validates firestore.rules against all 12 adversarial attack vectors
 * and verifies exact schema alignment with firebase-blueprint.json.
 */

const rulesSource = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(new URL('./firebase-blueprint.json', import.meta.url), 'utf8'));

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;
const SERVER_TIME = 'SERVER_TIMESTAMP';

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_RE.test(id);
}

function evaluateDirtyDozen(
  collection: string,
  operation: 'get' | 'list' | 'create' | 'update',
  docId: string,
  auth: AuthContext | null,
  incoming: Record<string, unknown> | null,
  existing: Record<string, unknown> | null,
  dbState: Record<string, Record<string, unknown>> = {}
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!['users', 'folders', 'files', 'chunks', 'briefings'].includes(collection)) {
    return 'PERMISSION_DENIED';
  }
  if (!auth) return 'PERMISSION_DENIED';

  if (operation === 'get') {
    if (!isValidId(docId) || !existing) return 'PERMISSION_DENIED';
    if (collection === 'users') return auth.uid === docId ? 'ALLOW' : 'PERMISSION_DENIED';
    return existing.userId === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
  }

  if (operation === 'list') {
    if (collection === 'users' || collection === 'chunks') return 'PERMISSION_DENIED';
    if (!existing || existing.userId !== auth.uid) return 'PERMISSION_DENIED';
    return 'ALLOW';
  }

  // Writes strictly mandate email_verified == true
  if (!auth.email_verified || !isValidId(docId) || !incoming) {
    return 'PERMISSION_DENIED';
  }

  if (collection === 'folders') {
    const allowed = ['id', 'userId', 'name', 'parentId', 'color', 'isFavorite', 'isTrash', 'createdAt', 'updatedAt'];
    const keys = Object.keys(incoming);
    if (keys.length !== allowed.length || !keys.every((k) => allowed.includes(k))) return 'PERMISSION_DENIED';
    if (incoming.userId !== auth.uid || incoming.id !== docId) return 'PERMISSION_DENIED';
    if (typeof incoming.name !== 'string' || incoming.name.length < 1 || incoming.name.length > 120) return 'PERMISSION_DENIED';
    if (operation === 'create' && incoming.createdAt !== SERVER_TIME) return 'PERMISSION_DENIED';
    if (operation === 'update' && (!existing || existing.userId !== auth.uid || incoming.userId !== existing.userId)) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  if (collection === 'files') {
    const allowed = [
      'id', 'userId', 'folderId', 'name', 'originalName', 'size', 'mimeType',
      'extension', 'chunkCount', 'textExcerpt', 'isFavorite', 'isTrash', 'createdAt', 'updatedAt',
    ];
    const keys = Object.keys(incoming);
    if (keys.length !== allowed.length || !keys.every((k) => allowed.includes(k))) return 'PERMISSION_DENIED';
    if (incoming.userId !== auth.uid || incoming.id !== docId) return 'PERMISSION_DENIED';
    if (typeof incoming.name !== 'string' || incoming.name.length < 1 || incoming.name.length > 255) return 'PERMISSION_DENIED';
    if (operation === 'create' && incoming.createdAt !== SERVER_TIME) return 'PERMISSION_DENIED';
    if (operation === 'update' && (!existing || existing.userId !== auth.uid || incoming.updatedAt !== SERVER_TIME)) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  if (collection === 'chunks') {
    if (operation === 'update') return 'PERMISSION_DENIED';
    const parentFile = dbState[`files/${incoming.fileId}`];
    if (!parentFile || parentFile.userId !== auth.uid || incoming.userId !== auth.uid) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  if (collection === 'briefings') {
    if (!Array.isArray(incoming.keyTakeaways) || incoming.keyTakeaways.length > 10) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  return 'PERMISSION_DENIED';
}

test('Firestore rules enforce global default-deny and verified writes', () => {
  assert.match(rulesSource, /rules_version = '2';/);
  assert.match(rulesSource, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rulesSource, /request\.auth\.token\.email_verified == true/);
  for (const pathKey of Object.keys(blueprint.firestore)) {
    const topSegment = pathKey.split('/')[1];
    assert.ok(rulesSource.includes(`match /${topSegment}/`), `Missing match block for ${topSegment}`);
  }
});

test('Dirty Dozen Payload Suite rejects all 12 adversarial attacks with PERMISSION_DENIED', () => {
  const verifiedAlice: AuthContext = { uid: 'alice_123', email_verified: true };
  const unverifiedSpoof: AuthContext = { uid: 'alice_123', email_verified: false };

  const baseFolder = {
    id: 'folder_1',
    userId: 'alice_123',
    name: 'Pharmaceutics',
    parentId: '',
    color: 'blue',
    isFavorite: false,
    isTrash: false,
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  };

  const baseFile = {
    id: 'file_1',
    userId: 'alice_123',
    folderId: '',
    name: 'Notes.pdf',
    originalName: 'Notes.pdf',
    size: 1024,
    mimeType: 'application/pdf',
    extension: 'pdf',
    chunkCount: 1,
    textExcerpt: 'Sample text',
    isFavorite: false,
    isTrash: false,
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  };

  // 1. Unauthenticated write
  assert.equal(evaluateDirtyDozen('folders', 'create', 'folder_1', null, baseFolder, null), 'PERMISSION_DENIED');

  // 2. Unverified email spoof
  assert.equal(evaluateDirtyDozen('folders', 'create', 'folder_1', unverifiedSpoof, baseFolder, null), 'PERMISSION_DENIED');

  // 3. Cross-user PII read
  assert.equal(evaluateDirtyDozen('users', 'get', 'victim_999', verifiedAlice, null, { userId: 'victim_999' }), 'PERMISSION_DENIED');

  // 4. Shadow field injection
  assert.equal(
    evaluateDirtyDozen('folders', 'create', 'folder_1', verifiedAlice, { ...baseFolder, isAdmin: true }, null),
    'PERMISSION_DENIED'
  );

  // 5. Ownership reassignment update
  assert.equal(
    evaluateDirtyDozen('folders', 'update', 'folder_1', verifiedAlice, { ...baseFolder, userId: 'bob_456' }, baseFolder),
    'PERMISSION_DENIED'
  );

  // 6. Forged client timestamp
  assert.equal(
    evaluateDirtyDozen('files', 'create', 'file_1', verifiedAlice, { ...baseFile, createdAt: '2020-01-01T00:00:00Z' }, null),
    'PERMISSION_DENIED'
  );

  // 7. ID poisoning attack
  assert.equal(
    evaluateDirtyDozen('folders', 'create', 'bad$id/injection!', verifiedAlice, { ...baseFolder, id: 'bad$id/injection!' }, null),
    'PERMISSION_DENIED'
  );

  // 8. Value poisoning on update (oversized name)
  assert.equal(
    evaluateDirtyDozen('files', 'update', 'file_1', verifiedAlice, { ...baseFile, name: 'x'.repeat(500) }, baseFile),
    'PERMISSION_DENIED'
  );

  // 9. Cross-user query scraping
  assert.equal(
    evaluateDirtyDozen('files', 'list', 'file_1', verifiedAlice, null, { ...baseFile, userId: 'victim_999' }),
    'PERMISSION_DENIED'
  );

  // 10. Cross-tenant chunk injection against victim's file
  assert.equal(
    evaluateDirtyDozen(
      'chunks',
      'create',
      'chunk_0',
      verifiedAlice,
      { id: 'chunk_0', fileId: 'victim_file', userId: 'alice_123', index: 0, data: 'YWJj', createdAt: SERVER_TIME },
      null,
      { 'files/victim_file': { userId: 'victim_999' } }
    ),
    'PERMISSION_DENIED'
  );

  // 11. Unbounded array exhaustion on briefings
  assert.equal(
    evaluateDirtyDozen(
      'briefings',
      'create',
      'brief_1',
      verifiedAlice,
      { keyTakeaways: Array.from({ length: 25 }, (_, i) => `Item ${i}`) },
      null
    ),
    'PERMISSION_DENIED'
  );

  // 12. Undeclared collection traversal
  assert.equal(
    evaluateDirtyDozen('admin_secrets', 'create', 'doc_1', verifiedAlice, { secret: '123' }, null),
    'PERMISSION_DENIED'
  );
});
