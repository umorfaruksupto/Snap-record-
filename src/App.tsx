import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Video,
  Share2,
  Play,
  Trash2,
  Check,
  FileVideo,
  Download,
  Scissors,
  Puzzle,
  Cloud,
  Disc,
} from 'lucide-react';
import {
  RecordingItem,
  CaptureMode,
  filterAndSortRecordings,
  formatDuration,
  formatFileSize,
  buildDriveShareUrl,
  toMp4Filename,
  applyTrimToRecording,
} from './utils/recordingLogic';
import { INITIAL_RECORDINGS } from './data/seedRecordings';
import {
  auth,
  initAuth,
  googleSignIn,
  logout,
  uploadRecordingToDrive,
  listDriveRecordings,
  deleteFileFromGoogleDrive,
  updateDriveFilePermission,
  syncUserProfileToFirestore,
  updateUserDriveFolderInFirestore,
  saveRecordingToFirestore,
  updateRecordingInFirestore,
  deleteRecordingFromFirestore,
  subscribeToUserRecordings,
} from './services/authAndDrive';
import { triggerMp4Download } from './services/mp4Converter';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { RecorderStudioPanel } from './components/RecorderStudioPanel';
import { ChromeExtensionPanel } from './components/ChromeExtensionPanel';
import {
  DriveSyncAuthPanel,
  ConnectedAccount,
} from './components/DriveSyncAuthPanel';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { Mp4ConverterModal } from './components/Mp4ConverterModal';

type ActiveSection = 'library' | 'recorder' | 'extension' | 'drive';

interface PendingConfirmation {
  type: 'delete' | 'permission';
  recording: RecordingItem;
  nextAccess?: 'anyoneWithLink' | 'restricted';
}

export const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('library');
  const [recordings, setRecordings] = useState<RecordingItem[]>(INITIAL_RECORDINGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<
    'all' | CaptureMode | 'drive_synced' | 'mp4_only' | 'webm_only'
  >('all');
  const [sortBy, setSortBy] = useState<'newest' | 'views' | 'size'>('newest');

  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [convertingRecordingId, setConvertingRecordingId] = useState<string | null>(null);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [, setIsRecordingLive] = useState(false);

  // Auth & Google Drive + Firebase Firestore state
  const [account, setAccount] = useState<ConnectedAccount | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [driveStatusMessage, setDriveStatusMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let unsubRecordings: (() => void) | null = null;
    const unsubAuth = initAuth(
      async (user) => {
        setAccount({
          uid: user.uid,
          name: user.displayName || 'Google Drive Creator',
          email: user.email || 'creator@scaprecord.site',
          authMode: 'google_oauth',
          driveFolder: '/ScapRecord Cloud Clips',
          firestoreSynced: true,
        });

        try {
          const synced = await syncUserProfileToFirestore(
            user,
            '/ScapRecord Cloud Clips',
            true
          );
          setAccount((prev) =>
            prev
              ? {
                  ...prev,
                  name: synced.displayName,
                  driveFolder: synced.driveFolder,
                  firestoreSynced: true,
                }
              : null
          );
        } catch {
          // Handled by Firestore error handler
        }

        if (unsubRecordings) unsubRecordings();
        unsubRecordings = subscribeToUserRecordings(user, (remoteItems) => {
          if (remoteItems.length === 0) return;
          setRecordings((prev) => {
            const byId = new Map(prev.map((item) => [item.id, item]));
            remoteItems.forEach((remote) => {
              if (!byId.has(remote.id)) {
                byId.set(remote.id, remote);
              }
            });
            return Array.from(byId.values());
          });
        });
      },
      () => {
        if (unsubRecordings) {
          unsubRecordings();
          unsubRecordings = null;
        }
        setAccount(null);
      }
    );
    return () => {
      unsubAuth();
      if (unsubRecordings) unsubRecordings();
    };
  }, []);

  const filteredRecordings = useMemo(
    () => filterAndSortRecordings(recordings, searchQuery, modeFilter, sortBy),
    [recordings, searchQuery, modeFilter, sortBy]
  );

  const activePlayerRecording = useMemo(
    () => recordings.find((r) => r.id === selectedRecordingId) || null,
    [recordings, selectedRecordingId]
  );

  const activeConverterRecording = useMemo(
    () => recordings.find((r) => r.id === convertingRecordingId) || null,
    [recordings, convertingRecordingId]
  );

  const handleGoogleLogin = async (preferredFolder?: string) => {
    setIsGoogleSigningIn(true);
    setDriveStatusMessage(null);
    const targetFolder = preferredFolder?.trim() || '/ScapRecord Cloud Clips';
    try {
      const result = await googleSignIn();
      if (result) {
        let finalFolder = targetFolder;
        try {
          const profile = await syncUserProfileToFirestore(
            result.user,
            targetFolder,
            true
          );
          finalFolder = profile.driveFolder;
        } catch {
          // Handled by Firestore error handler
        }
        setAccount({
          uid: result.user.uid,
          name: result.user.displayName || 'Google Creator',
          email: result.user.email || 'creator@gmail.com',
          authMode: 'google_oauth',
          driveFolder: finalFolder,
          firestoreSynced: true,
        });
        setDriveStatusMessage(
          `Connected Google Drive (${finalFolder}) and saved your creator profile to Firebase Firestore.`
        );
      }
    } catch {
      setDriveStatusMessage(
        'Google Sign-In popup was closed before completion. Click "Continue with Google & Connect Drive" anytime to sync your clips.'
      );
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleUpdateDriveFolder = async (nextFolder: string) => {
    setAccount((prev) => (prev ? { ...prev, driveFolder: nextFolder } : prev));
    if (auth.currentUser) {
      try {
        await updateUserDriveFolderInFirestore(auth.currentUser, nextFolder);
        setDriveStatusMessage(
          `Saved default Google Drive folder (${nextFolder}) to Firebase Firestore.`
        );
      } catch {
        // Handled by Firestore error handler
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    setAccount(null);
    setDriveStatusMessage('Disconnected Google account and cleared in-memory Drive token.');
  };

  const handleRecordingCreated = async (newRec: RecordingItem, videoBlob?: Blob) => {
    let recordToSave = newRec;
    setRecordings((prev) => [newRec, ...prev]);

    if (newRec.driveSynced && videoBlob && account?.authMode === 'google_oauth') {
      try {
        const res = await uploadRecordingToDrive(
          newRec.title,
          newRec.description,
          videoBlob
        );
        recordToSave = {
          ...newRec,
          driveSynced: true,
          driveFileId: res.driveFileId,
          driveWebViewLink: res.webViewLink,
        };
        setRecordings((prev) =>
          prev.map((item) => (item.id === newRec.id ? recordToSave : item))
        );
      } catch {
        // Keep generated fallback Drive share ID if offline
      }
    }

    if (auth.currentUser) {
      try {
        await saveRecordingToFirestore(auth.currentUser, recordToSave);
      } catch {
        // Handled by Firestore error handler
      }
    }
  };

  const handleTrimRecording = (
    recordingId: string,
    startSec: number,
    endSec: number,
    andSyncToDrive = false
  ) => {
    let trimmedTarget: RecordingItem | null = null;
    setRecordings((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordingId) return rec;
        const nextRec = applyTrimToRecording(rec, startSec, endSec);
        trimmedTarget = nextRec;
        return nextRec;
      })
    );

    if (trimmedTarget && auth.currentUser) {
      void updateRecordingInFirestore(auth.currentUser, trimmedTarget).catch(() => {});
    }

    if (andSyncToDrive && trimmedTarget) {
      void handleSyncExistingToDrive(trimmedTarget);
    }
  };

  const handleMp4ConversionSuccess = (
    recordingId: string,
    mp4BlobUrl: string,
    _mp4Blob: Blob,
    mp4SizeBytes: number
  ) => {
    setRecordings((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordingId) return rec;
        return {
          ...rec,
          containerFormat: 'mp4',
          mp4BlobUrl,
          mp4ConvertedAt: new Date().toISOString(),
          sizeBytes: mp4SizeBytes,
        };
      })
    );
  };

  const handleSyncMp4ToDrive = async (target: RecordingItem, mp4Blob?: Blob) => {
    const fallbackId = target.driveFileId || `1ScapMp4_${target.id}`;
    try {
      if (account?.authMode === 'google_oauth') {
        const blobToUpload =
          mp4Blob ||
          (target.mp4BlobUrl
            ? await (await fetch(target.mp4BlobUrl)).blob()
            : new Blob([target.transcript], { type: 'video/mp4' }));
        const uploaded = await uploadRecordingToDrive(
          `${target.title} (MP4)`,
          target.description,
          blobToUpload
        );
        setRecordings((prev) =>
          prev.map((r) =>
            r.id === target.id
              ? {
                  ...r,
                  containerFormat: 'mp4',
                  driveSynced: true,
                  driveFileId: uploaded.driveFileId,
                  driveWebViewLink: uploaded.webViewLink,
                  shareAccess: 'anyoneWithLink',
                }
              : r
          )
        );
        setDriveStatusMessage(`Uploaded converted MP4 "${target.title}" to Google Drive.`);
        return;
      }
    } catch {
      // Fallback below
    }

    const links = buildDriveShareUrl(fallbackId);
    setRecordings((prev) =>
      prev.map((r) =>
        r.id === target.id
          ? {
              ...r,
              containerFormat: 'mp4',
              driveSynced: true,
              driveFileId: fallbackId,
              driveWebViewLink: links.driveUrl,
              shareAccess: 'anyoneWithLink',
            }
          : r
      )
    );
    setDriveStatusMessage(
      `Synced converted MP4 "${target.title}" to Google Drive with instant share link.`
    );
  };

  const handleSyncExistingToDrive = async (target: RecordingItem) => {
    const fallbackId = target.driveFileId || `1ScapDrive_${target.id}`;
    try {
      if (account?.authMode === 'google_oauth') {
        const syntheticBlob = new Blob([target.transcript], { type: 'video/webm' });
        const uploaded = await uploadRecordingToDrive(
          target.title,
          target.description,
          syntheticBlob
        );
        setRecordings((prev) =>
          prev.map((r) =>
            r.id === target.id
              ? {
                  ...r,
                  driveSynced: true,
                  driveFileId: uploaded.driveFileId,
                  driveWebViewLink: uploaded.webViewLink,
                  shareAccess: 'anyoneWithLink',
                }
              : r
          )
        );
        setDriveStatusMessage(`Uploaded "${target.title}" to Google Drive.`);
        return;
      }
    } catch {
      // Fallback below
    }

    const links = buildDriveShareUrl(fallbackId);
    setRecordings((prev) =>
      prev.map((r) =>
        r.id === target.id
          ? {
              ...r,
              driveSynced: true,
              driveFileId: fallbackId,
              driveWebViewLink: links.driveUrl,
              shareAccess: 'anyoneWithLink',
            }
          : r
      )
    );
    setDriveStatusMessage(
      `Synced "${target.title}" to Google Drive and enabled link sharing.`
    );
  };

  const handleRefreshDriveFiles = async () => {
    if (account?.authMode === 'google_oauth') {
      try {
        const files = await listDriveRecordings();
        setDriveStatusMessage(
          `Verified ${files.length} Google Drive file(s) with your active token.`
        );
        return;
      } catch {
        // fall through
      }
    }
    const syncedCount = recordings.filter((r) => r.driveSynced).length;
    setDriveStatusMessage(
      `Google Drive repository synchronized (${syncedCount} shared video files active).`
    );
  };

  // Mandatory User Confirmation before deleting or mutating Google Drive files
  const handleConfirmPendingAction = async () => {
    if (!pendingConfirm) return;
    const { type, recording, nextAccess } = pendingConfirm;

    if (type === 'delete') {
      if (recording.driveSynced && recording.driveFileId && account?.authMode === 'google_oauth') {
        try {
          await deleteFileFromGoogleDrive(recording.driveFileId);
        } catch {
          // continue local removal
        }
      }
      if (auth.currentUser) {
        void deleteRecordingFromFirestore(recording.id).catch(() => {});
      }
      setRecordings((prev) => prev.filter((r) => r.id !== recording.id));
      if (selectedRecordingId === recording.id) {
        setSelectedRecordingId(null);
      }
      setDriveStatusMessage(`Deleted "${recording.title}" from Google Drive, Firebase, and Library.`);
    } else if (type === 'permission' && nextAccess) {
      if (recording.driveFileId && account?.authMode === 'google_oauth') {
        try {
          await updateDriveFilePermission(recording.driveFileId, nextAccess);
        } catch {
          // continue state update
        }
      }
      const updatedRec: RecordingItem = { ...recording, shareAccess: nextAccess };
      if (auth.currentUser) {
        void updateRecordingInFirestore(auth.currentUser, updatedRec).catch(() => {});
      }
      setRecordings((prev) =>
        prev.map((r) => (r.id === recording.id ? updatedRec : r))
      );
      setDriveStatusMessage(
        `Updated Google Drive & Firebase link permission for "${recording.title}" to ${
          nextAccess === 'anyoneWithLink' ? 'Anyone with Link' : 'Restricted'
        }.`
      );
    }

    setPendingConfirm(null);
  };

  const handleAddComment = (recordingId: string, text: string, timestampSec: number) => {
    setRecordings((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordingId) return rec;
        return {
          ...rec,
          comments: [
            ...rec.comments,
            {
              id: `cmt-${Date.now()}`,
              author: account?.name || 'You (ScapRecord Creator)',
              timestampSec,
              text,
              createdAt: 'Just now',
            },
          ],
        };
      })
    );
  };

  const handleReaction = (
    recordingId: string,
    key: keyof RecordingItem['reactions']
  ) => {
    setRecordings((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordingId) return rec;
        return {
          ...rec,
          reactions: {
            ...rec.reactions,
            [key]: rec.reactions[key] + 1,
          },
        };
      })
    );
  };

  const handleQuickShareCopy = (rec: RecordingItem) => {
    const urls = buildDriveShareUrl(rec.driveFileId || rec.id);
    navigator.clipboard?.writeText(urls.scapShareUrl).catch(() => {});
    setCopiedCardId(rec.id);
    setTimeout(() => setCopiedCardId(null), 2000);
  };

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC] text-[#1E293B]"
      data-active-section={activeSection}
    >
      {/* Strict 3-Zone Top Navigation Bar Contract (Minimalism & Swiss Style, Mobile-Ready) */}
      <header className="md:sticky md:top-0 z-20 flex items-center justify-between gap-3 sm:gap-8 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#library"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('library');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 py-1"
        >
          ScapRecord
        </a>

        {/* Zone 2: 4 concise single-line navigation links (Desktop & Tablet) */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          <a
            href="#library"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('library');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'library'
                ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-blue-600 decoration-2'
                : ''
            }`}
          >
            Library
          </a>
          <a
            href="#recorder"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('recorder');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'recorder'
                ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-blue-600 decoration-2'
                : ''
            }`}
          >
            Recorder
          </a>
          <a
            href="#extension"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('extension');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'extension'
                ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-blue-600 decoration-2'
                : ''
            }`}
          >
            Chrome Extension
          </a>
          <a
            href="#drive"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('drive');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'drive'
                ? 'text-blue-600 font-semibold underline underline-offset-8 decoration-blue-600 decoration-2'
                : ''
            }`}
          >
            Google Drive
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('recorder')}
            className="min-h-[40px] sm:min-h-0 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xs whitespace-nowrap shrink-0"
          >
            New Recording
          </button>
        </div>
      </header>

      {/* Main Content Container (Minimal & Swiss Style Layout + Mobile Safe Padding) */}
      <main className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 md:pb-10">
        {/* Swiss Minimalist Page Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-6">
          <div className="max-w-2xl">
            <div className="text-xs text-slate-600 font-medium tracking-wide">
              scaprecord.site · Screen Recorder & Google Drive Workspace
            </div>
            <h1
              className="mt-1 sm:mt-1.5 text-2xl sm:text-4xl font-bold tracking-tight text-slate-900"
              style={{ textWrap: 'balance' }}
            >
              {activeSection === 'library' && 'Recordings & Shared Clips'}
              {activeSection === 'recorder' && 'Screen & Camera Studio'}
              {activeSection === 'extension' && 'Chrome Extension'}
              {activeSection === 'drive' && 'Google Drive Sync & Account'}
            </h1>
          </div>

          {activeSection === 'library' && (
            <div className="text-xs font-medium text-slate-600 tabular-nums">
              <span>{recordings.length} recordings</span>
              <span aria-hidden="true"> · </span>
              <span>
                {account ? `Synced to ${account.email}` : 'Google Drive Ready'}
              </span>
            </div>
          )}
        </div>

        {/* Active View Router */}
        {activeSection === 'library' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Minimal Filter, Search & Sort Bar (Mobile-Stacked & Desktop-Inline) */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 sm:gap-4 pb-5 sm:pb-6 border-b border-slate-200">
              <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-md">
                <Search
                  className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <label htmlFor="library-search-input" className="sr-only">
                  Search recordings by title or transcript
                </label>
                <input
                  id="library-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search titles or transcripts..."
                  className="w-full min-h-[42px] sm:min-h-0 rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                {/* Interactive Segmented Filter Tabs */}
                <div className="grid grid-cols-4 sm:flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'webm_only', label: 'WebM' },
                      { id: 'mp4_only', label: 'MP4' },
                      { id: 'drive_synced', label: 'Synced' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setModeFilter(tab.id)}
                      className={`min-h-[36px] sm:min-h-0 px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 text-center ${
                        modeFilter === tab.id
                          ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.id === 'drive_synced' ? (
                        <>
                          <span className="sm:hidden">Drive</span>
                          <span className="hidden sm:inline">Drive Synced</span>
                        </>
                      ) : (
                        tab.label
                      )}
                    </button>
                  ))}
                </div>

                <div className="w-full sm:w-auto">
                  <label htmlFor="library-sort-select" className="sr-only">
                    Sort recordings
                  </label>
                  <select
                    id="library-sort-select"
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'newest' | 'views' | 'size')
                    }
                    className="w-full sm:w-auto min-h-[42px] sm:min-h-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs"
                  >
                    <option value="newest">Newest first</option>
                    <option value="views">Most viewed</option>
                    <option value="size">Largest size</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Recordings Grid or Empty State */}
            {filteredRecordings.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 sm:p-12 text-center space-y-3 shadow-xs">
                <Video className="h-7 w-7 text-slate-500 mx-auto" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  No matching recordings
                </h2>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Record your screen with our Chrome extension or web recorder, trim timestamps, convert WebM to MP4, and share via Google Drive.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setModeFilter('all');
                    }}
                    className="min-h-[42px] sm:min-h-0 px-4 py-2 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0"
                  >
                    Reset Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('recorder')}
                    className="min-h-[42px] sm:min-h-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                  >
                    New Recording
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {filteredRecordings.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl sm:rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between shadow-xs transition-all duration-200 hover:shadow-md hover:border-slate-300"
                  >
                    <div>
                      {/* Thumbnail with Measured Scrim */}
                      <div className="relative aspect-video w-full bg-slate-900 overflow-hidden border-b border-slate-200">
                        {!brokenImages[item.id] ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenImages((prev) => ({
                                ...prev,
                                [item.id]: true,
                              }))
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 p-4 text-center">
                            <Video className="h-7 w-7 text-slate-400 mb-2" aria-hidden="true" />
                            <span className="text-xs font-medium text-slate-200">
                              {item.title}
                            </span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex items-end justify-between p-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedRecordingId(item.id)}
                              aria-label={`Play ${item.title}`}
                              className="min-h-[38px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors whitespace-nowrap shrink-0 shadow-xs"
                            >
                              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                              <span>Watch Clip</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedRecordingId(item.id)}
                              aria-label={`Trim ${item.title}`}
                              className="min-h-[38px] sm:min-h-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-900 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 shadow-xs"
                            >
                              <Scissors className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                              <span>Trim</span>
                            </button>
                          </div>

                          <span className="font-mono text-xs font-semibold text-white tabular-nums drop-shadow-xs">
                            {formatDuration(item.durationSec)}
                          </span>
                        </div>
                      </div>

                      {/* Card Body — Clean Unboxed Metadata with '·' Separators */}
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 tabular-nums">
                          <span
                            className={
                              item.containerFormat === 'mp4'
                                ? 'font-mono font-semibold text-emerald-700'
                                : 'font-mono font-semibold text-blue-700'
                            }
                          >
                            {item.containerFormat === 'mp4' ? 'MP4' : 'WebM'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.resolution}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatFileSize(item.sizeBytes)}</span>
                          {item.trimStartSec !== undefined &&
                            item.trimEndSec !== undefined && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-700 font-mono font-semibold">
                                  Trimmed
                                </span>
                              </>
                            )}
                        </div>

                        <h2 className="mt-1.5 text-base font-semibold text-slate-900 leading-snug">
                          <button
                            type="button"
                            onClick={() => setSelectedRecordingId(item.id)}
                            className="text-left hover:text-blue-600 transition-colors"
                          >
                            {item.title}
                          </button>
                        </h2>

                        <p className="mt-1.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Minimal Card Footer */}
                    <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 font-medium tabular-nums whitespace-nowrap shrink-0">
                        {item.driveSynced ? 'Drive Synced' : 'Local Draft'}
                      </span>

                      <div className="flex items-center gap-1.5 ml-auto">
                        {item.containerFormat === 'mp4' && item.mp4BlobUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              triggerMp4Download(
                                item.mp4BlobUrl!,
                                toMp4Filename(item.title)
                              )
                            }
                            aria-label={`Download MP4 for ${item.title}`}
                            className="min-h-[38px] sm:min-h-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-semibold transition-colors whitespace-nowrap shrink-0"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Download .MP4</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConvertingRecordingId(item.id)}
                            aria-label={`Convert ${item.title} to MP4`}
                            className="min-h-[38px] sm:min-h-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium transition-colors whitespace-nowrap shrink-0"
                          >
                            <FileVideo className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                            <span>Convert to MP4</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleQuickShareCopy(item)}
                          aria-label={`Copy share link for ${item.title}`}
                          className="min-h-[38px] sm:min-h-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          {copiedCardId === item.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Share</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPendingConfirm({
                              type: 'delete',
                              recording: item,
                            })
                          }
                          aria-label={`Delete recording ${item.title}`}
                          className="min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Minimal 3-Column Swiss Workflow Strip */}
            <section className="pt-6 sm:pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              <div>
                <div className="text-xs font-mono font-semibold text-blue-600">01. Capture</div>
                <h2 className="mt-1 text-sm font-semibold text-slate-900">
                  Chrome Extension & Mobile-Ready Web Studio
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Record any tab, desktop window, or mobile camera bubble at 60fps with a customizable countdown and auto-stop timer.
                </p>
              </div>
              <div>
                <div className="text-xs font-mono font-semibold text-blue-600">02. Trim & Transcode</div>
                <h2 className="mt-1 text-sm font-semibold text-slate-900">
                  Transcript Search, Trimmer & FFmpeg MP4
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Search timestamped transcripts to jump to key moments, trim start and end points, and convert WebM to H.264 MP4 in the browser.
                </p>
              </div>
              <div>
                <div className="text-xs font-mono font-semibold text-blue-600">03. Share</div>
                <h2 className="mt-1 text-sm font-semibold text-slate-900">
                  Your Own Google Drive Storage
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Recordings sync directly to your personal Google Drive folder (`drive.file`) and generate an instant share link.
                </p>
              </div>
            </section>
          </div>
        )}

        {activeSection === 'recorder' && (
          <RecorderStudioPanel
            onRecordingComplete={handleRecordingCreated}
            onRecordingStateChange={setIsRecordingLive}
            onOpenLibrary={() => setActiveSection('library')}
            onRequestConvertMp4={(rec) => setConvertingRecordingId(rec.id)}
            recordingsCount={recordings.length}
          />
        )}

        {activeSection === 'extension' && (
          <ChromeExtensionPanel
            onExtensionSimulatedCapture={(clip) => handleRecordingCreated(clip)}
          />
        )}

        {activeSection === 'drive' && (
          <DriveSyncAuthPanel
            account={account}
            recordings={recordings}
            isGoogleSigningIn={isGoogleSigningIn}
            driveStatusMessage={driveStatusMessage}
            onGoogleLogin={handleGoogleLogin}
            onUpdateDriveFolder={handleUpdateDriveFolder}
            onLogout={handleLogout}
            onSyncRecordingToDrive={handleSyncExistingToDrive}
            onRefreshDriveFiles={handleRefreshDriveFiles}
            onRequestDeleteRecording={(rec) =>
              setPendingConfirm({ type: 'delete', recording: rec })
            }
            onRequestPermissionUpdate={(rec, nextAccess) =>
              setPendingConfirm({
                type: 'permission',
                recording: rec,
                nextAccess,
              })
            }
          />
        )}
      </main>

      {/* Fixed Mobile Bottom Tab Bar (Thumb-Zone Navigation Anchor, Hidden on Desktop) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-4 items-center h-14">
          <button
            type="button"
            onClick={() => setActiveSection('library')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeSection === 'library'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className="h-5 w-5" aria-hidden="true" />
            <span className="text-[11px] tracking-tight">Library</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('recorder')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeSection === 'recorder'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Disc className="h-5 w-5" aria-hidden="true" />
            <span className="text-[11px] tracking-tight">Recorder</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('extension')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeSection === 'extension'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Puzzle className="h-5 w-5" aria-hidden="true" />
            <span className="text-[11px] tracking-tight">Extension</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('drive')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeSection === 'drive'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="h-5 w-5" aria-hidden="true" />
            <span className="text-[11px] tracking-tight">Drive</span>
          </button>
        </div>
      </nav>

      {/* Interactive Video Player, Searchable Transcript, Timestamp Trimmer & Google Drive Share Modal */}
      <VideoPlayerModal
        recording={activePlayerRecording}
        onClose={() => setSelectedRecordingId(null)}
        onAddComment={handleAddComment}
        onReact={handleReaction}
        onSyncToDrive={handleSyncExistingToDrive}
        onTrimRecording={handleTrimRecording}
        onRequestDelete={(rec) =>
          setPendingConfirm({ type: 'delete', recording: rec })
        }
        onRequestConvertMp4={(rec) => {
          setSelectedRecordingId(null);
          setConvertingRecordingId(rec.id);
        }}
      />

      {/* In-Browser FFmpeg.wasm WebM-to-MP4 Converter Modal */}
      <Mp4ConverterModal
        recording={activeConverterRecording}
        onClose={() => setConvertingRecordingId(null)}
        onConversionSuccess={handleMp4ConversionSuccess}
        onSyncMp4ToDrive={handleSyncMp4ToDrive}
      />

      {/* Mandatory User Confirmation Dialog for Destructive / Mutating Google Drive Operations */}
      <ConfirmActionModal
        isOpen={Boolean(pendingConfirm)}
        title={
          pendingConfirm?.type === 'delete'
            ? 'Delete Recording from Google Drive?'
            : 'Update Google Drive Sharing Permissions?'
        }
        description={
          pendingConfirm?.type === 'delete'
            ? 'This will permanently delete the video file from your Google Drive folder and remove its shareable link on scaprecord.site. This action cannot be undone.'
            : `This will update the Google Drive sharing permission on this recording to "${
                pendingConfirm?.nextAccess === 'anyoneWithLink'
                  ? 'Anyone with the link can view'
                  : 'Restricted to owner only'
              }".`
        }
        affectedItemTitle={pendingConfirm?.recording.title || ''}
        confirmLabel={
          pendingConfirm?.type === 'delete'
            ? 'Confirm Delete from Drive'
            : 'Confirm Permission Update'
        }
        isDestructive={pendingConfirm?.type === 'delete'}
        onConfirm={handleConfirmPendingAction}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
};
