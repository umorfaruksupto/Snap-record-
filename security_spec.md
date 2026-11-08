# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched (`/databases/{database}/documents/{document=**}`) deny all `read` and `write` operations (`if false`).
2. **Verified Google Identity**: Every write operation (`create`, `update`, `delete`) requires `request.auth != null` and `request.auth.token.email_verified == true`.
3. **PII Isolation (Split Collection Strategy)**:
   - `/users/{userId}` stores only non-PII workspace profile fields (`uid`, `displayName`, `driveFolder`, `driveConnected`, `createdAt`, `updatedAt`).
   - `/users/{userId}/private/{docId}` (`docId == 'info'`) stores PII (`uid`, `email`, `updatedAt`) and is strictly accessible (`get`, `create`, `update`, `delete`) only when `request.auth.uid == userId` and `exists(/databases/$(database)/documents/users/$(userId))`.
4. **Master Gate & Relational Consistency**:
   - Creating a `/recordings/{recordingId}` document requires `incoming().ownerId == request.auth.uid`, `incoming().id == recordingId`, and `exists(/databases/$(database)/documents/users/$(request.auth.uid))` so no orphaned recording can exist without a valid parent user profile.
5. **Immutable & Temporal Fields**:
   - `uid`, `id`, `ownerId`, and `createdAt` are immutable across all updates.
   - `createdAt` (on create) and `updatedAt` (on create and update) must equal `request.time`.
6. **Query Enforcer on `list`**:
   - `/recordings` `allow list` strictly evaluates `resource.data.shareAccess == 'anyoneWithLink' || (request.auth != null && resource.data.ownerId == request.auth.uid)`.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 — Identity Spoofing on Recording Create**: Authenticated user `uid_attacker` attempts to create `/recordings/rec_1` with `ownerId: "uid_victim"`. -> `PERMISSION_DENIED`
2. **Payload 2 — Shadow Field Injection on User Profile Create**: Authenticated user attempts to create `/users/uid_1` with extra field `isAdmin: true`. -> `PERMISSION_DENIED`
3. **Payload 3 — Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create `/users/uid_1`. -> `PERMISSION_DENIED`
4. **Payload 4 — PII Leak on Private Subcollection**: Authenticated user `uid_attacker` attempts `get` on `/users/uid_victim/private/info`. -> `PERMISSION_DENIED`
5. **Payload 5 — Orphaned Recording Create**: Authenticated user `uid_no_profile` attempts to create `/recordings/rec_1` before `/users/uid_no_profile` exists. -> `PERMISSION_DENIED`
6. **Payload 6 — Immutable `ownerId` Mutation on Recording Update**: Owner attempts to update `ownerId` on `/recordings/rec_1` to another user. -> `PERMISSION_DENIED`
7. **Payload 7 — Immutable `createdAt` Tampering on Update**: Owner attempts to modify `createdAt` during an update on `/recordings/rec_1`. -> `PERMISSION_DENIED`
8. **Payload 8 — Client Timestamp Spoofing on Create**: User provides a forged past timestamp (`createdAt != request.time`) when creating `/recordings/rec_1`. -> `PERMISSION_DENIED`
9. **Payload 9 — Value Poisoning / Boundary Overflow**: Owner attempts to update `title` on `/recordings/rec_1` with a 5,000-character string (`maxLength` is 160). -> `PERMISSION_DENIED`
10. **Payload 10 — Invalid Enum State on Recording**: Owner attempts to set `shareAccess: "public_world"` (not in `['anyoneWithLink', 'restricted']`). -> `PERMISSION_DENIED`
11. **Payload 11 — Unauthorized Private Recording Read**: Unauthenticated or non-owner user attempts `get` on `/recordings/rec_private` where `shareAccess == 'restricted'`. -> `PERMISSION_DENIED`
12. **Payload 12 — Path ID Poisoning**: User attempts to create `/recordings/invalid$id!with/slashes` or an ID exceeding 128 chars. -> `PERMISSION_DENIED`

---

## 3. Test Runner
See `/firestore.rules.test.ts` for the executable verification suite testing all 12 Dirty Dozen payloads and valid workflows.
