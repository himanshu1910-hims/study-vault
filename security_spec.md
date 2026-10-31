# Security Specification - StudyVault & Commute Audio Studio

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every `Folder`, `FileItem`, `FileChunk`, and `AudioBriefing` must strictly belong to the authenticated creator (`userId == request.auth.uid`).
2. **Verified Write Enforcement**: All write operations (`create`, `update`, `delete`) require a verified authenticated account (`request.auth != null && request.auth.token.email_verified == true`).
3. **PII Isolation**: `/users/{userId}` contains user email and profile data; `get` is strictly restricted to `isOwner(userId)` and `list` is completely denied.
4. **Master Gate Relational Integrity**: Subcollection `/files/{fileId}/chunks/{chunkId}` requires `get(/databases/$(database)/documents/files/$(fileId)).data.userId == request.auth.uid` on every read, create, and delete. Non-root `parentId` / `folderId` references verify parent folder ownership via `get()`.
5. **Strict Key Allowlisting & Anti-Shadow Fields**: Every `create` enforces `hasAll` + `hasOnly` on exact schema keys. Every `update` wraps `isValid[Entity](incoming())` and partitions mutations into explicit action branches with `affectedKeys().hasOnly(...)`.
6. **Temporal & Identity Immutability**: `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`. `updatedAt` must equal `request.time` on both `create` and `update`. `id` and `userId` are strictly immutable.
7. **Secure List Queries**: `allow list` on `/folders`, `/files`, and `/briefings` strictly enforces `isSignedIn() && resource.data.userId == request.auth.uid` with zero `get()` calls inside list rules.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Folder Creation**: `POST /folders/f_unauth` with `auth = null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof Write**: `POST /folders/f_spoof` with `auth = { uid: "u1", token: { email: "victim@gmail.com", email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Cross-User PII Read**: `GET /users/victim_uid` by `attacker_uid` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Folder Create**: `POST /folders/f_shadow` including `{ ..., isAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` gate).
5. **Ownership Reassignment Update**: `PATCH /folders/f1` changing `userId` from `"u1"` to `"u2"` -> `PERMISSION_DENIED`.
6. **Forged Client Timestamp**: `POST /files/file_1` with `createdAt = Timestamp(2020-01-01)` instead of `request.time` -> `PERMISSION_DENIED`.
7. **ID Poisoning Attack**: `POST /folders/invalid$id!with/slashes_or_200_chars...` -> `PERMISSION_DENIED` (`isValidId` regex & length gate).
8. **Value Poisoning on Update**: `PATCH /files/file_1` updating whitelisted key `name` with a 10KB string or boolean -> `PERMISSION_DENIED` (`isValidFile` wrapper).
9. **Cross-User Query Scraping**: `LIST /files` without `where('userId', '==', request.auth.uid)` -> `PERMISSION_DENIED` (`resource.data.userId == request.auth.uid`).
10. **Orphan / Cross-Tenant Chunk Injection**: `POST /files/victim_file/chunks/chunk_0` with `userId: attacker_uid` -> `PERMISSION_DENIED` (Master Gate `get()` on parent `/files/{fileId}`).
11. **Unbounded Array Exhaustion in AudioBriefing**: `POST /briefings/b1` with 50 items in `keyTakeaways` -> `PERMISSION_DENIED` (`keyTakeaways.size() <= 10`).
12. **Undeclared Collection Traversal**: `POST /admin_secrets/doc1` -> `PERMISSION_DENIED` (Global default-deny catch-all).
