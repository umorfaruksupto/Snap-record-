import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { buildDriveShareUrl, RecordingItem } from '../utils/recordingLogic';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Validate Connection to Firestore on boot (Mandatory per firebase-integration-rpc skill)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Sanitize IDs and strings to strictly match firebase-blueprint.json & firestore.rules
function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'doc_1';
}

function clampString(val: string, minLen: number, maxLen: number, fallback: string): string {
  const trimmed = (val || '').trim();
  const base = trimmed.length >= minLen ? trimmed : fallback;
  return base.slice(0, maxLen);
}

/**
 * Stores or updates the Google-authenticated user profile in Firestore
 * using the Split Collection strategy (/users/{uid} + /users/{uid}/private/info).
 */
export async function syncUserProfileToFirestore(
  user: User,
  driveFolder = '/ScapRecord Cloud Clips',
  driveConnected = true
): Promise<{ displayName: string; driveFolder: string }> {
  const uid = sanitizeId(user.uid);
  const userRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');

  const safeDisplayName = clampString(
    user.displayName || user.email?.split('@')[0] || 'Google Creator',
    1,
    100,
    'Google Creator'
  );
  const safeFolder = clampString(
    driveFolder,
    1,
    120,
    '/ScapRecord Cloud Clips'
  );
  const safeEmail = clampString(
    user.email || 'creator@scaprecord.site',
    3,
    254,
    'creator@scaprecord.site'
  );

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }

  try {
    if (!existingSnap.exists()) {
      const batch = writeBatch(db);
      batch.set(userRef, {
        uid,
        displayName: safeDisplayName,
        driveFolder: safeFolder,
        driveConnected: Boolean(driveConnected),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(privateRef, {
        uid,
        email: safeEmail,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return { displayName: safeDisplayName, driveFolder: safeFolder };
    } else {
      const existingData = existingSnap.data();
      const folderToKeep = clampString(
        existingData?.driveFolder || safeFolder,
        1,
        120,
        '/ScapRecord Cloud Clips'
      );
      await updateDoc(userRef, {
        displayName: safeDisplayName,
        driveFolder: folderToKeep,
        driveConnected: Boolean(driveConnected),
        updatedAt: serverTimestamp(),
      });
      return { displayName: safeDisplayName, driveFolder: folderToKeep };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export async function updateUserDriveFolderInFirestore(
  user: User,
  driveFolder: string
): Promise<string> {
  const uid = sanitizeId(user.uid);
  const userRef = doc(db, 'users', uid);
  const safeDisplayName = clampString(
    user.displayName || user.email?.split('@')[0] || 'Google Creator',
    1,
    100,
    'Google Creator'
  );
  const safeFolder = clampString(
    driveFolder,
    1,
    120,
    '/ScapRecord Cloud Clips'
  );

  try {
    await updateDoc(userRef, {
      displayName: safeDisplayName,
      driveFolder: safeFolder,
      driveConnected: true,
      updatedAt: serverTimestamp(),
    });
    return safeFolder;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function saveRecordingToFirestore(
  user: User,
  rec: RecordingItem
): Promise<void> {
  const uid = sanitizeId(user.uid);
  const recordingId = sanitizeId(rec.id);
  const recRef = doc(db, 'recordings', recordingId);

  const payload = {
    id: recordingId,
    ownerId: uid,
    ownerName: clampString(
      user.displayName || 'Google Creator',
      1,
      100,
      'Google Creator'
    ),
    title: clampString(rec.title, 1, 160, 'ScapRecord Capture'),
    description: clampString(rec.description || '', 0, 1000, ''),
    durationSec: Math.max(1, Math.min(86400, Math.round(rec.durationSec || 1))),
    sizeBytes: Math.max(0, Math.min(10737418240, Math.round(rec.sizeBytes || 0))),
    resolution: clampString(rec.resolution || '1080p 60fps', 1, 40, '1080p 60fps'),
    captureMode: ['screen_cam', 'screen_only', 'cam_only', 'tab_audio'].includes(
      rec.captureMode
    )
      ? rec.captureMode
      : 'screen_cam',
    containerFormat: rec.containerFormat === 'mp4' ? 'mp4' : 'webm',
    driveSynced: Boolean(rec.driveSynced),
    driveFileId: clampString(rec.driveFileId || '', 0, 128, ''),
    driveWebViewLink: clampString(rec.driveWebViewLink || '', 0, 500, ''),
    shareAccess:
      rec.shareAccess === 'restricted' ? 'restricted' : 'anyoneWithLink',
    transcript: clampString(rec.transcript || '', 0, 5000, ''),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(recRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `recordings/${recordingId}`);
  }
}

export async function updateRecordingInFirestore(
  user: User,
  rec: RecordingItem
): Promise<void> {
  const recordingId = sanitizeId(rec.id);
  const recRef = doc(db, 'recordings', recordingId);

  try {
    const snap = await getDoc(recRef);
    if (!snap.exists()) {
      await saveRecordingToFirestore(user, rec);
      return;
    }
    await updateDoc(recRef, {
      durationSec: Math.max(1, Math.min(86400, Math.round(rec.durationSec || 1))),
      sizeBytes: Math.max(0, Math.min(10737418240, Math.round(rec.sizeBytes || 0))),
      containerFormat: rec.containerFormat === 'mp4' ? 'mp4' : 'webm',
      driveSynced: Boolean(rec.driveSynced),
      driveFileId: clampString(rec.driveFileId || '', 0, 128, ''),
      driveWebViewLink: clampString(rec.driveWebViewLink || '', 0, 500, ''),
      shareAccess:
        rec.shareAccess === 'restricted' ? 'restricted' : 'anyoneWithLink',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `recordings/${recordingId}`);
  }
}

export async function deleteRecordingFromFirestore(
  recordingId: string
): Promise<void> {
  const safeId = sanitizeId(recordingId);
  const recRef = doc(db, 'recordings', safeId);
  try {
    await deleteDoc(recRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `recordings/${safeId}`);
  }
}

export function subscribeToUserRecordings(
  user: User,
  onLoaded: (items: RecordingItem[]) => void
): () => void {
  const uid = sanitizeId(user.uid);
  const q = query(collection(db, 'recordings'), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const docs: RecordingItem[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          title: String(d.title || 'ScapRecord Clip'),
          description: String(d.description || ''),
          createdAt: 'Synced via Firebase',
          durationSec: Number(d.durationSec || 30),
          sizeBytes: Number(d.sizeBytes || 4200000),
          views: 1,
          resolution:
            (d.resolution as RecordingItem['resolution']) || '1080p 60fps',
          captureMode: (d.captureMode as RecordingItem['captureMode']) || 'screen_cam',
          source: 'web_studio',
          containerFormat: d.containerFormat === 'mp4' ? 'mp4' : 'webm',
          driveSynced: Boolean(d.driveSynced),
          driveFileId: String(d.driveFileId || ''),
          driveWebViewLink: String(d.driveWebViewLink || ''),
          shareAccess:
            d.shareAccess === 'restricted' ? 'restricted' : 'anyoneWithLink',
          thumbnailUrl:
            'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1000&q=80',
          transcript: String(d.transcript || '00:00 Recorded with ScapRecord Studio.'),
          reactions: { fire: 1, thumbsUp: 1, idea: 0, target: 0 },
          comments: [],
        };
      });
      onLoaded(docs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'recordings');
    }
  );
}

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token strictly in memory (never localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || '';
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface DriveFileResource {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
}

export async function listDriveRecordings(): Promise<DriveFileResource[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authentication required: Sign in with Google to access Drive files.');
  }

  const qStr = encodeURIComponent(
    "trashed = false and (mimeType contains 'video/' or name contains 'ScapRecord')"
  );
  const fields = encodeURIComponent(
    'files(id,name,mimeType,size,createdTime,webViewLink)'
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${qStr}&fields=${fields}&pageSize=25&orderBy=createdTime desc`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Google Drive API error (${res.status}): Failed to list files.`);
  }
  const data = await res.json();
  return data.files || [];
}

export async function uploadRecordingToDrive(
  title: string,
  description: string,
  videoBlob: Blob
): Promise<{ driveFileId: string; webViewLink: string; scapShareUrl: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authentication required: Sign in with Google to upload to Google Drive.');
  }

  const metadata = {
    name: `${title.replace(/[^\w\s-]/g, '') || 'ScapRecord-Capture'}.webm`,
    description: `${description} — Recorded with ScapRecord (scaprecord.site)`,
    mimeType: videoBlob.type || 'video/webm',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', videoBlob);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    throw new Error(`Google Drive upload failed (${uploadRes.status}).`);
  }

  const uploaded = await uploadRes.json();
  const driveFileId: string = uploaded.id;

  // Enable anyoneWithLink sharing permission so the user can share the Drive link immediately
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }
  );

  const links = buildDriveShareUrl(driveFileId);
  return {
    driveFileId,
    webViewLink: uploaded.webViewLink || links.driveUrl,
    scapShareUrl: links.scapShareUrl,
  };
}

export async function updateDriveFilePermission(
  driveFileId: string,
  accessType: 'anyoneWithLink' | 'restricted'
): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authentication required: Sign in with Google to update Drive permissions.');
  }

  if (accessType === 'anyoneWithLink') {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Failed to update Google Drive sharing permission (${res.status}).`);
    }
  }
}

export async function deleteFileFromGoogleDrive(driveFileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authentication required: Sign in with Google to delete Drive files.');
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete file from Google Drive (${res.status}).`);
  }
}
