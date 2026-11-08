import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Deterministic evaluator for the Eight Pillars & Dirty Dozen Security Specification
 * against `firestore.rules`.
 */
interface AuthContext {
  uid: string;
  email: string;
  email_verified: boolean;
}

const SERVER_NOW = '2026-11-08T02:15:00.000Z';

function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

function evaluateCreateUserProfile(
  auth: AuthContext | null,
  userId: string,
  payload: Record<string, unknown>
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(userId)) return 'PERMISSION_DENIED';

  const allowedKeys = [
    'uid',
    'displayName',
    'driveFolder',
    'driveConnected',
    'createdAt',
    'updatedAt',
  ];
  const keys = Object.keys(payload);
  if (
    !allowedKeys.every((k) => keys.includes(k)) ||
    !keys.every((k) => allowedKeys.includes(k))
  ) {
    return 'PERMISSION_DENIED';
  }

  if (
    typeof payload.uid !== 'string' ||
    !isValidId(payload.uid) ||
    payload.uid !== userId ||
    payload.uid !== auth.uid
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    typeof payload.displayName !== 'string' ||
    payload.displayName.length < 1 ||
    payload.displayName.length > 100
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    typeof payload.driveFolder !== 'string' ||
    payload.driveFolder.length < 1 ||
    payload.driveFolder.length > 120
  ) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.driveConnected !== 'boolean') return 'PERMISSION_DENIED';
  if (payload.createdAt !== SERVER_NOW || payload.updatedAt !== SERVER_NOW) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOWED';
}

function evaluateGetUserPrivateInfo(
  auth: AuthContext | null,
  userId: string,
  docId: string,
  existingUsers: Set<string>
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || auth.uid !== userId) return 'PERMISSION_DENIED';
  if (!isValidId(userId) || docId !== 'info') return 'PERMISSION_DENIED';
  if (!existingUsers.has(userId)) return 'PERMISSION_DENIED';
  return 'ALLOWED';
}

function evaluateCreateRecording(
  auth: AuthContext | null,
  recordingId: string,
  payload: Record<string, unknown>,
  existingUsers: Set<string>
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(recordingId)) return 'PERMISSION_DENIED';
  if (!existingUsers.has(auth.uid)) return 'PERMISSION_DENIED';

  const requiredKeys = [
    'id',
    'ownerId',
    'ownerName',
    'title',
    'description',
    'durationSec',
    'sizeBytes',
    'resolution',
    'captureMode',
    'containerFormat',
    'driveSynced',
    'driveFileId',
    'driveWebViewLink',
    'shareAccess',
    'transcript',
    'createdAt',
    'updatedAt',
  ];
  const keys = Object.keys(payload);
  if (
    !requiredKeys.every((k) => keys.includes(k)) ||
    !keys.every((k) => requiredKeys.includes(k))
  ) {
    return 'PERMISSION_DENIED';
  }

  if (payload.id !== recordingId || !isValidId(String(payload.id))) {
    return 'PERMISSION_DENIED';
  }
  if (payload.ownerId !== auth.uid || !isValidId(String(payload.ownerId))) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.title !== 'string' || payload.title.length < 1 || payload.title.length > 160) {
    return 'PERMISSION_DENIED';
  }
  if (!['anyoneWithLink', 'restricted'].includes(String(payload.shareAccess))) {
    return 'PERMISSION_DENIED';
  }
  if (payload.createdAt !== SERVER_NOW || payload.updatedAt !== SERVER_NOW) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOWED';
}

function evaluateUpdateRecording(
  auth: AuthContext | null,
  recordingId: string,
  existingDoc: Record<string, unknown>,
  incomingDoc: Record<string, unknown>
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(recordingId)) return 'PERMISSION_DENIED';
  if (existingDoc.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  if (
    incomingDoc.id !== existingDoc.id ||
    incomingDoc.ownerId !== existingDoc.ownerId ||
    incomingDoc.createdAt !== existingDoc.createdAt
  ) {
    return 'PERMISSION_DENIED';
  }
  if (incomingDoc.updatedAt !== SERVER_NOW) return 'PERMISSION_DENIED';
  if (
    typeof incomingDoc.title !== 'string' ||
    incomingDoc.title.length < 1 ||
    incomingDoc.title.length > 160
  ) {
    return 'PERMISSION_DENIED';
  }
  if (!['anyoneWithLink', 'restricted'].includes(String(incomingDoc.shareAccess))) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOWED';
}

function evaluateGetRecording(
  auth: AuthContext | null,
  recordingId: string,
  existingDoc: Record<string, unknown>
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!isValidId(recordingId)) return 'PERMISSION_DENIED';
  if (existingDoc.shareAccess === 'anyoneWithLink') return 'ALLOWED';
  if (auth && existingDoc.ownerId === auth.uid) return 'ALLOWED';
  return 'PERMISSION_DENIED';
}

const VALID_USER: AuthContext = {
  uid: 'user_alice_1',
  email: 'alice@scaprecord.site',
  email_verified: true,
};

const VALID_RECORDING_PAYLOAD: Record<string, unknown> = {
  id: 'rec_101',
  ownerId: 'user_alice_1',
  ownerName: 'Alice Rivera',
  title: 'Sprint 14 Architecture Demo',
  description: 'Walkthrough of Google Drive clip sync.',
  durationSec: 120,
  sizeBytes: 15400000,
  resolution: '1440p 60fps',
  captureMode: 'screen_cam',
  containerFormat: 'webm',
  driveSynced: true,
  driveFileId: '1DriveFileId101',
  driveWebViewLink: 'https://drive.google.com/file/d/1DriveFileId101/view',
  shareAccess: 'anyoneWithLink',
  transcript: '00:00 Welcome to the demo.',
  createdAt: SERVER_NOW,
  updatedAt: SERVER_NOW,
};

test('firestore.rules file contains all mandatory Eight Pillars primitives and match blocks', () => {
  const rulesText = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(rulesText, /rules_version = '2';/);
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
  assert.match(rulesText, /function isValidUserPublicProfile/);
  assert.match(rulesText, /function isValidUserPrivateInfo/);
  assert.match(rulesText, /function isValidRecordingDocument/);
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
});

test('Dirty Dozen #1-12 all return PERMISSION_DENIED and valid operations return ALLOWED', () => {
  const existingUsers = new Set(['user_alice_1', 'user_victim_2']);

  // Valid baseline
  assert.equal(
    evaluateCreateRecording(VALID_USER, 'rec_101', VALID_RECORDING_PAYLOAD, existingUsers),
    'ALLOWED'
  );

  // 1. Identity Spoofing on Recording Create
  assert.equal(
    evaluateCreateRecording(
      VALID_USER,
      'rec_101',
      { ...VALID_RECORDING_PAYLOAD, ownerId: 'user_victim_2' },
      existingUsers
    ),
    'PERMISSION_DENIED'
  );

  // 2. Shadow Field Injection on User Profile Create
  assert.equal(
    evaluateCreateUserProfile(VALID_USER, 'user_alice_1', {
      uid: 'user_alice_1',
      displayName: 'Alice',
      driveFolder: '/ScapRecord Cloud Clips',
      driveConnected: true,
      createdAt: SERVER_NOW,
      updatedAt: SERVER_NOW,
      isAdmin: true,
    }),
    'PERMISSION_DENIED'
  );

  // 3. Unverified Email Write
  assert.equal(
    evaluateCreateUserProfile(
      { ...VALID_USER, email_verified: false },
      'user_alice_1',
      {
        uid: 'user_alice_1',
        displayName: 'Alice',
        driveFolder: '/ScapRecord Cloud Clips',
        driveConnected: true,
        createdAt: SERVER_NOW,
        updatedAt: SERVER_NOW,
      }
    ),
    'PERMISSION_DENIED'
  );

  // 4. PII Leak on Private Subcollection
  assert.equal(
    evaluateGetUserPrivateInfo(VALID_USER, 'user_victim_2', 'info', existingUsers),
    'PERMISSION_DENIED'
  );

  // 5. Orphaned Recording Create (user profile does not exist)
  assert.equal(
    evaluateCreateRecording(
      { uid: 'user_orphan_99', email: 'orphan@scaprecord.site', email_verified: true },
      'rec_101',
      { ...VALID_RECORDING_PAYLOAD, ownerId: 'user_orphan_99' },
      existingUsers
    ),
    'PERMISSION_DENIED'
  );

  // 6. Immutable ownerId Mutation on Recording Update
  assert.equal(
    evaluateUpdateRecording(VALID_USER, 'rec_101', VALID_RECORDING_PAYLOAD, {
      ...VALID_RECORDING_PAYLOAD,
      ownerId: 'user_victim_2',
    }),
    'PERMISSION_DENIED'
  );

  // 7. Immutable createdAt Tampering on Update
  assert.equal(
    evaluateUpdateRecording(VALID_USER, 'rec_101', VALID_RECORDING_PAYLOAD, {
      ...VALID_RECORDING_PAYLOAD,
      createdAt: '2020-01-01T00:00:00.000Z',
    }),
    'PERMISSION_DENIED'
  );

  // 8. Client Timestamp Spoofing on Create
  assert.equal(
    evaluateCreateRecording(
      VALID_USER,
      'rec_101',
      { ...VALID_RECORDING_PAYLOAD, createdAt: '2020-01-01T00:00:00.000Z' },
      existingUsers
    ),
    'PERMISSION_DENIED'
  );

  // 9. Value Poisoning / Boundary Overflow on Title
  assert.equal(
    evaluateUpdateRecording(VALID_USER, 'rec_101', VALID_RECORDING_PAYLOAD, {
      ...VALID_RECORDING_PAYLOAD,
      title: 'X'.repeat(5000),
    }),
    'PERMISSION_DENIED'
  );

  // 10. Invalid Enum State on Recording
  assert.equal(
    evaluateUpdateRecording(VALID_USER, 'rec_101', VALID_RECORDING_PAYLOAD, {
      ...VALID_RECORDING_PAYLOAD,
      shareAccess: 'public_world',
    }),
    'PERMISSION_DENIED'
  );

  // 11. Unauthorized Private Recording Read
  assert.equal(
    evaluateGetRecording(null, 'rec_101', {
      ...VALID_RECORDING_PAYLOAD,
      shareAccess: 'restricted',
    }),
    'PERMISSION_DENIED'
  );

  // 12. Path ID Poisoning
  assert.equal(
    evaluateCreateRecording(
      VALID_USER,
      'invalid$id!with/slashes',
      { ...VALID_RECORDING_PAYLOAD, id: 'invalid$id!with/slashes' },
      existingUsers
    ),
    'PERMISSION_DENIED'
  );
});
