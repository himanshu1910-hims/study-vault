# Security Specification - StudyVault

## Data Invariants
1. Folders and Files must strictly belong to the authenticated user (`userId == request.auth.uid`).
2. An unauthenticated user cannot read, list, create, update, or delete any user document, folder, or file.
3. User profile data is restricted strictly to the user itself (`isOwner(userId)`).
4. No user can access or query another user's files or folder trees (`allow list: if isSignedIn() && resource.data.userId == request.auth.uid`).
5. Immutable fields (`userId`, `id`) cannot be altered on update.

## The Dirty Dozen Payloads Handled
1. Unauthenticated read/write to `/folders/f1` -> REJECTED (`!isSignedIn()`)
2. Cross-user read `/folders/userB_folder` by `userA` -> REJECTED (`existing().userId != request.auth.uid`)
3. List folders across all users -> REJECTED (Query must constrain `userId == request.auth.uid`)
4. Folder creation with spoofed `userId` -> REJECTED (`incoming().userId != request.auth.uid`)
5. Folder update attempting to reassign ownership -> REJECTED (`incoming().userId != existing().userId`)
6. Oversized folder name (> 120 chars) -> REJECTED (`data.name.size() <= 120`)
7. Malformed folder ID injection -> REJECTED (`isValidId(folderId)`)
8. File creation with negative size -> REJECTED (`data.size >= 0`)
9. File creation with spoofed owner UID -> REJECTED (`incoming().userId == request.auth.uid`)
10. Cross-user file deletion -> REJECTED (`existing().userId == request.auth.uid`)
11. Reading PII of other user `/users/targetUser` -> REJECTED (`request.auth.uid == userId`)
12. Random path traversal / undeclared collection write -> REJECTED (Default deny catchall)
