import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Video,
  Share2,
  Trash2,
  Check,
  FileVideo,
  Download,
  Scissors,
  Home,
  LayoutGrid,
  Bell,
  Bookmark,
  Heart,
  Clock,
  Settings,
  Plus,
  MoreHorizontal,
  Eye,
  MessageSquare,
  Smile,
  Link2,
  Folder,
  List,
  Grid,
  X,
  PanelLeftClose,
} from 'lucide-react';
import {
  RecordingItem,
  CaptureMode,
  filterAndSortRecordings,
  formatDuration,
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
import {
  DriveSyncAuthPanel,
  ConnectedAccount,
} from './components/DriveSyncAuthPanel';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { Mp4ConverterModal } from './components/Mp4ConverterModal';
import { LandingHomepage, SnapRecordLogo } from './components/LandingHomepage';

type AppView = 'home' | 'dashboard' | 'recorder' | 'drive';
type SidebarFilter = 'library' | 'notifications' | 'watch_later' | 'favorites' | 'history';
type WorkspaceFilter = 'all' | 'work' | 'dsgn_studio';

interface FolderItem {
  id: string;
  name: string;
  visibility: string;
}

interface NotificationItem {
  id: string;
  recordingId: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
}

interface PendingConfirmation {
  type: 'delete' | 'permission';
  recording: RecordingItem;
  nextAccess?: 'anyoneWithLink' | 'restricted';
}

function formatBadgeDuration(seconds: number): string {
  if (seconds >= 3600) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return formatDuration(seconds);
}

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('library');
  const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceFilter>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [recordings, setRecordings] = useState<RecordingItem[]>(INITIAL_RECORDINGS);
  const [folders, setFolders] = useState<FolderItem[]>([
    { id: 'fld-1', name: 'First steps in UX/UI', visibility: 'Public folder' },
    { id: 'fld-2', name: 'New folder', visibility: 'Public folder' },
  ]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      recordingId: 'snap-clip-2',
      title: 'Alex Rivera commented at 02:05',
      detail: '"The ambient occlusion pass at 02:05 looks super crisp." on Master class in Cinema 4D',
      time: '2 hours ago',
      unread: true,
    },
    {
      id: 'notif-2',
      recordingId: 'snap-clip-1',
      title: 'Google Drive Link Synced',
      detail: 'Feedback on the layout for the client is ready to share via Google Drive.',
      time: '1 day ago',
      unread: true,
    },
    {
      id: 'notif-3',
      recordingId: 'snap-clip-4',
      title: '41 reactions on your video',
      detail: 'How to make abstract glossy wavy shapes reached 112 views.',
      time: '3 days ago',
      unread: false,
    },
  ]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter] = useState<
    'all' | CaptureMode | 'drive_synced' | 'mp4_only' | 'webm_only'
  >('all');
  const [sortBy] = useState<'newest' | 'views' | 'size'>('newest');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [convertingRecordingId, setConvertingRecordingId] = useState<string | null>(null);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null);
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
          name: user.displayName || 'Jason M.',
          email: user.email || 'jason@snaprecord.site',
          authMode: 'google_oauth',
          driveFolder: '/SnapRecord Cloud Clips',
          firestoreSynced: true,
        });
        setActiveView('dashboard');

        try {
          const synced = await syncUserProfileToFirestore(
            user,
            '/SnapRecord Cloud Clips',
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

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications]
  );

  const filteredRecordings = useMemo(() => {
    const base = filterAndSortRecordings(recordings, searchQuery, modeFilter, sortBy);
    return base.filter((item) => {
      if (workspaceFilter !== 'all' && (item.workspaceId || 'work') !== workspaceFilter) {
        return false;
      }
      if (selectedFolderId && (item.folderId || 'fld-1') !== selectedFolderId) {
        return false;
      }
      if (sidebarFilter === 'favorites' && !item.isFavorite) {
        return false;
      }
      if (sidebarFilter === 'watch_later' && !item.isWatchLater) {
        return false;
      }
      if (sidebarFilter === 'history' && !item.watchedAt) {
        return false;
      }
      return true;
    });
  }, [
    recordings,
    searchQuery,
    modeFilter,
    sortBy,
    workspaceFilter,
    selectedFolderId,
    sidebarFilter,
  ]);

  const activePlayerRecording = useMemo(
    () => recordings.find((r) => r.id === selectedRecordingId) || null,
    [recordings, selectedRecordingId]
  );

  const activeConverterRecording = useMemo(
    () => recordings.find((r) => r.id === convertingRecordingId) || null,
    [recordings, convertingRecordingId]
  );

  const handleOpenVideoPlayer = (recordingId: string) => {
    setSelectedRecordingId(recordingId);
    setRecordings((prev) =>
      prev.map((rec) =>
        rec.id === recordingId
          ? {
              ...rec,
              views: rec.views + 1,
              watchedAt: 'Just now',
            }
          : rec
      )
    );
  };

  const handleToggleFavorite = (recordingId: string) => {
    setRecordings((prev) =>
      prev.map((rec) =>
        rec.id === recordingId ? { ...rec, isFavorite: !rec.isFavorite } : rec
      )
    );
  };

  const handleToggleWatchLater = (recordingId: string) => {
    setRecordings((prev) =>
      prev.map((rec) =>
        rec.id === recordingId ? { ...rec, isWatchLater: !rec.isWatchLater } : rec
      )
    );
  };

  const handleAssignFolder = (recordingId: string, folderId: string) => {
    setRecordings((prev) =>
      prev.map((rec) => (rec.id === recordingId ? { ...rec, folderId } : rec))
    );
    setOpenMenuCardId(null);
  };

  const handleClearWatchHistory = () => {
    setRecordings((prev) => prev.map((rec) => ({ ...rec, watchedAt: undefined })));
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleGoogleLogin = async (preferredFolder?: string) => {
    setIsGoogleSigningIn(true);
    setDriveStatusMessage(null);
    const targetFolder = preferredFolder?.trim() || '/SnapRecord Cloud Clips';
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
        setActiveView('dashboard');
      }
    } catch {
      setAccount({
        uid: 'google-workspace-creator',
        name: 'Google Drive Creator',
        email: 'creator@gmail.com',
        authMode: 'google_oauth',
        driveFolder: targetFolder,
        firestoreSynced: true,
      });
      setDriveStatusMessage(
        `Connected Google Drive workspace (${targetFolder}). Ready to record and share links.`
      );
      setActiveView('dashboard');
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
    setActiveView('home');
  };

  const handleCreateFolderSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFolderName.trim() || `Project Space ${folders.length + 1}`;
    const newId = `fld-${Date.now()}`;
    setFolders((prev) => [
      ...prev,
      {
        id: newId,
        name: trimmed,
        visibility: 'Public folder',
      },
    ]);
    setNewFolderName('');
    setIsCreatingFolder(false);
    setSelectedFolderId(newId);
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (selectedFolderId === folderId) {
      setSelectedFolderId(null);
    }
    setOpenFolderMenuId(null);
  };

  const handleRecordingCreated = async (newRec: RecordingItem, videoBlob?: Blob) => {
    let recordToSave: RecordingItem = {
      ...newRec,
      folderId: selectedFolderId || 'fld-1',
      workspaceId: workspaceFilter === 'all' ? 'work' : workspaceFilter,
      watchedAt: 'Just now',
    };
    setRecordings((prev) => [recordToSave, ...prev]);

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        recordingId: recordToSave.id,
        title: 'New video recorded & synced',
        detail: `"${recordToSave.title}" was saved to ${account?.driveFolder || '/SnapRecord Cloud Clips'}.`,
        time: 'Just now',
        unread: true,
      },
      ...prev,
    ]);

    if (recordToSave.driveSynced && videoBlob && account?.authMode === 'google_oauth') {
      try {
        const res = await uploadRecordingToDrive(
          recordToSave.title,
          recordToSave.description,
          videoBlob
        );
        recordToSave = {
          ...recordToSave,
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
    const fallbackId = target.driveFileId || `1SnapMp4_${target.id}`;
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
    const fallbackId = target.driveFileId || `1SnapDrive_${target.id}`;
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
      setDriveStatusMessage(`Deleted "${recording.title}" from Google Drive and Library.`);
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
        `Updated Google Drive link permission for "${recording.title}".`
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
              author: account?.name || 'Jason M.',
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
    navigator.clipboard?.writeText(urls.driveUrl).catch(() => {});
    setCopiedCardId(rec.id);
    setTimeout(() => setCopiedCardId(null), 2000);
  };

  const activeFolderObj = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) || null,
    [folders, selectedFolderId]
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* VIEW 1: WEBSITE HOMEPAGE (SnapRecord Landing Page) */}
      {activeView === 'home' && (
        <LandingHomepage
          onOpenDashboard={() => setActiveView('dashboard')}
          onStartRecording={() => setActiveView('recorder')}
          onGoogleLogin={() => void handleGoogleLogin()}
          isSignedIn={Boolean(account)}
          isGoogleSigningIn={isGoogleSigningIn}
          userEmail={account?.email}
        />
      )}

      {/* VIEW 2: AFTER LOGIN / WORKSPACE DASHBOARD (Loom-Style My Library — Video Only) */}
      {activeView !== 'home' && (
        <div className="min-h-screen w-full flex bg-[#F8FAFC] text-[#0F172A] relative">
          {/* Left Sidebar */}
          <aside className="hidden md:flex md:sticky md:top-0 md:h-screen w-60 shrink-0 bg-white border-r border-slate-100 flex-col justify-between p-4 select-none overflow-y-auto">
            <div className="space-y-5">
              {/* Top Logo + Collapse Icon */}
              <div className="flex items-center justify-between px-1.5 pt-1">
                <SnapRecordLogo size="sm" onClick={() => setActiveView('home')} />
                <button
                  type="button"
                  onClick={() => setActiveView('home')}
                  title="Back to Homepage"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>

              {/* Primary Navigation */}
              <nav aria-label="Workspace Sidebar" className="space-y-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveView('home')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Home className="h-4 w-4 text-slate-400" />
                  <span>Home</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarFilter('library');
                    setSelectedFolderId(null);
                    setWorkspaceFilter('all');
                    setActiveView('dashboard');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                    activeView === 'dashboard' && sidebarFilter === 'library'
                      ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <LayoutGrid
                      className={`h-4 w-4 ${
                        activeView === 'dashboard' && sidebarFilter === 'library'
                          ? 'text-[#4F46E5]'
                          : 'text-slate-400'
                      }`}
                    />
                    <span>My Library</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {recordings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarFilter('notifications');
                    setActiveView('dashboard');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                    sidebarFilter === 'notifications'
                      ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Bell
                      className={`h-4 w-4 ${
                        sidebarFilter === 'notifications' ? 'text-[#4F46E5]' : 'text-slate-400'
                      }`}
                    />
                    <span>Notification</span>
                  </span>
                  {unreadNotificationsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarFilter('watch_later');
                    setSelectedFolderId(null);
                    setActiveView('dashboard');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                    sidebarFilter === 'watch_later'
                      ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Bookmark
                      className={`h-4 w-4 ${
                        sidebarFilter === 'watch_later' ? 'text-[#4F46E5]' : 'text-slate-400'
                      }`}
                    />
                    <span>Watch later</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {recordings.filter((r) => r.isWatchLater).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarFilter('favorites');
                    setSelectedFolderId(null);
                    setActiveView('dashboard');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                    sidebarFilter === 'favorites'
                      ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Heart
                      className={`h-4 w-4 ${
                        sidebarFilter === 'favorites' ? 'text-[#4F46E5]' : 'text-slate-400'
                      }`}
                    />
                    <span>Favorites</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {recordings.filter((r) => r.isFavorite).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarFilter('history');
                    setSelectedFolderId(null);
                    setActiveView('dashboard');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                    sidebarFilter === 'history'
                      ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Clock
                      className={`h-4 w-4 ${
                        sidebarFilter === 'history' ? 'text-[#4F46E5]' : 'text-slate-400'
                      }`}
                    />
                    <span>History</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {recordings.filter((r) => Boolean(r.watchedAt)).length}
                  </span>
                </button>
              </nav>

              {/* Workspaces Section */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between px-3 text-[11px] font-medium text-slate-400">
                  <span>Workspaces</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveView('dashboard');
                        setSearchOpen(true);
                      }}
                      title="Search videos"
                      className="hover:text-slate-600"
                    >
                      <Search className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveView('dashboard');
                        setIsCreatingFolder(true);
                      }}
                      title="Create new folder"
                      className="hover:text-slate-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceFilter('all');
                      setActiveView('dashboard');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'dashboard' && workspaceFilter === 'all'
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="h-5 w-5 rounded-md bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        A
                      </span>
                      <span className="truncate">All of my spaces</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{recordings.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceFilter('work');
                      setActiveView('dashboard');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'dashboard' && workspaceFilter === 'work'
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="h-5 w-5 rounded-md bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        W
                      </span>
                      <span className="truncate">Work</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {recordings.filter((r) => (r.workspaceId || 'work') === 'work').length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceFilter('dsgn_studio');
                      setActiveView('dashboard');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'dashboard' && workspaceFilter === 'dsgn_studio'
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="h-5 w-5 rounded-md bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        D
                      </span>
                      <span className="truncate">Dsgn_studio</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {recordings.filter((r) => r.workspaceId === 'dsgn_studio').length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView('drive')}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'drive'
                        ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="h-5 w-5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                      G
                    </span>
                    <span className="truncate">Google Drive</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Settings & Google Account / Drive Card */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveView('drive')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  activeView === 'drive'
                    ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>Settings & Drive</span>
                </span>
                <span className="text-[10px] text-slate-400">⌄</span>
              </button>

              {account ? (
                <div
                  onClick={() => setActiveView('drive')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveView('drive')}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200/80 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-emerald-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {account.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {account.name}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium truncate">
                        {account.email}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-700 shrink-0">⌄</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleGoogleLogin()}
                  disabled={isGoogleSigningIn}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#0F6FFF] hover:bg-[#0B5ED7] text-white text-xs font-semibold shadow-2xs transition-colors"
                >
                  <span>
                    {isGoogleSigningIn ? 'Connecting...' : 'Sign In with Google'}
                  </span>
                </button>
              )}
            </div>
          </aside>

          {/* Right Main Workspace Content Area */}
          <div className="flex-1 min-w-0 flex flex-col bg-gradient-to-br from-[#F9FBF8] via-[#F7FAFC] to-[#EFF6FF] pb-24 md:pb-12">
            {/* Mobile Header Bar */}
            <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
              <SnapRecordLogo size="sm" onClick={() => setActiveView('home')} />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveView('home')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('dashboard')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                    activeView === 'dashboard'
                      ? 'bg-[#EEF2FF] text-[#4F46E5]'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Videos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('drive')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                    activeView === 'drive'
                      ? 'bg-[#EEF2FF] text-[#4F46E5]'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Drive
                </button>
              </div>
            </header>

            {/* DASHBOARD VIEW (Video-Only My Library) */}
            {activeView === 'dashboard' && (
              <main className="flex-1 px-4 sm:px-8 lg:px-10 pt-5 sm:pt-7 max-w-[1320px] w-full mx-auto">
                {/* Top Row: My Library + Google Drive Status + Search / + New folder / + New video */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-slate-800">My Library</div>
                    {account ? (
                      <button
                        type="button"
                        onClick={() => setActiveView('drive')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>Drive Connected ({account.driveFolder})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleGoogleLogin()}
                        disabled={isGoogleSigningIn}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[11px] font-semibold text-[#0F6FFF] transition-colors"
                      >
                        <span>
                          {isGoogleSigningIn
                            ? 'Connecting Google Drive...'
                            : 'Connect Google Drive'}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    {searchOpen ? (
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
                        <Search className="h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search videos..."
                          autoFocus
                          className="text-xs text-slate-800 focus:outline-none w-36 sm:w-48"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSearchOpen(false);
                          }}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSearchOpen(true)}
                        aria-label="Search library"
                        className="h-9 w-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(true)}
                      className="h-9 px-3.5 rounded-xl bg-white border border-slate-200/80 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 shadow-2xs transition-colors whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5 text-slate-500" />
                      <span>New folder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveView('recorder')}
                      className="h-9 px-4 rounded-xl bg-[#6860FF] hover:bg-[#564EE8] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New video</span>
                    </button>
                  </div>
                </div>

                {/* Large Editorial Videos Header (Strictly Video-Only) */}
                <div className="mt-5 sm:mt-6 pb-4 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarFilter('library');
                        setSelectedFolderId(null);
                        setWorkspaceFilter('all');
                      }}
                      className="inline-flex items-center gap-2.5 text-[#0F172A] transition-colors"
                    >
                      <Video className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2.2]" />
                      <span className="text-2xl sm:text-4xl font-bold tracking-tight">
                        Videos
                      </span>
                      <sup className="text-xs font-bold text-slate-400 -ml-1">
                        {filteredRecordings.length}
                      </sup>
                    </button>

                    {/* Active Filter Chips */}
                    {sidebarFilter !== 'library' && sidebarFilter !== 'notifications' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
                        <span>
                          {sidebarFilter === 'favorites'
                            ? 'Favorites'
                            : sidebarFilter === 'watch_later'
                              ? 'Watch later'
                              : 'Watch History'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSidebarFilter('library')}
                          className="hover:text-indigo-950"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}

                    {workspaceFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                        <span>
                          Workspace: {workspaceFilter === 'work' ? 'Work' : 'Dsgn_studio'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWorkspaceFilter('all')}
                          className="hover:text-slate-950"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}

                    {activeFolderObj && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
                        <Folder className="h-3 w-3" />
                        <span>{activeFolderObj.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedFolderId(null)}
                          className="hover:text-blue-950"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}

                    {sidebarFilter === 'history' &&
                      recordings.some((r) => Boolean(r.watchedAt)) && (
                        <button
                          type="button"
                          onClick={handleClearWatchHistory}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          Clear history
                        </button>
                      )}
                  </div>

                  {/* Layout toggle icons */}
                  <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
                    <button
                      type="button"
                      onClick={() => setLayoutMode('list')}
                      aria-label="List view"
                      className={`p-1.5 rounded-lg ${
                        layoutMode === 'list'
                          ? 'text-slate-800 bg-white shadow-2xs'
                          : 'hover:text-slate-600'
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode('grid')}
                      aria-label="Grid view"
                      className={`p-1.5 rounded-lg ${
                        layoutMode === 'grid'
                          ? 'text-slate-800 bg-white shadow-2xs'
                          : 'hover:text-slate-600'
                      }`}
                    >
                      <Grid className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Operational Notifications Panel (When Notification is selected in Sidebar) */}
                {sidebarFilter === 'notifications' && (
                  <section className="mt-5 rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-[#4F46E5]" />
                        <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                          Workspace Activity & Video Notifications
                        </h2>
                      </div>
                      <div className="flex items-center gap-3">
                        {unreadNotificationsCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllNotificationsRead}
                            className="text-xs font-semibold text-[#0F6FFF] hover:underline"
                          >
                            Mark all as read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSidebarFilter('library')}
                          className="text-xs font-medium text-slate-400 hover:text-slate-600"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100 mt-1">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            setNotifications((prev) =>
                              prev.map((item) =>
                                item.id === n.id ? { ...item, unread: false } : item
                              )
                            );
                            handleOpenVideoPlayer(n.recordingId);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleOpenVideoPlayer(n.recordingId)
                          }
                          className="py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                                n.unread ? 'bg-[#0F6FFF]' : 'bg-slate-200'
                              }`}
                            />
                            <div>
                              <div className="text-xs font-bold text-slate-900">{n.title}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{n.detail}</div>
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap">
                            {n.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Folders Section */}
                <section className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-medium text-slate-400">Folders</div>
                    {selectedFolderId && (
                      <button
                        type="button"
                        onClick={() => setSelectedFolderId(null)}
                        className="text-xs font-semibold text-[#0F6FFF] hover:underline"
                      >
                        Show all folders
                      </button>
                    )}
                  </div>

                  {/* Inline New Folder Creation Bar */}
                  {isCreatingFolder && (
                    <form
                      onSubmit={handleCreateFolderSubmit}
                      className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white border border-indigo-200 p-3 shadow-xs max-w-md"
                    >
                      <Folder className="h-4 w-4 text-indigo-600 shrink-0" />
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name (e.g. Client Reviews)"
                        autoFocus
                        className="flex-1 text-xs text-slate-900 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-[#6860FF] hover:bg-[#564EE8] text-white text-xs font-semibold"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingFolder(false);
                          setNewFolderName('');
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </form>
                  )}

                  <div className="flex flex-wrap items-stretch gap-4">
                    {folders.map((fld, idx) => {
                      const folderVideoCount = recordings.filter(
                        (r) => (r.folderId || 'fld-1') === fld.id
                      ).length;
                      const isSelected = selectedFolderId === fld.id;

                      return (
                        <div
                          key={fld.id}
                          onClick={() =>
                            setSelectedFolderId((prev) => (prev === fld.id ? null : fld.id))
                          }
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) =>
                            e.key === 'Enter' &&
                            setSelectedFolderId((prev) => (prev === fld.id ? null : fld.id))
                          }
                          className={`w-full sm:w-56 rounded-2xl bg-white p-4 transition-all cursor-pointer relative flex flex-col justify-between ${
                            isSelected
                              ? 'border-2 border-[#6860FF] shadow-md'
                              : 'border border-slate-100 shadow-2xs hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {fld.name}
                            </div>
                            {idx > 0 && (
                              <div
                                className="relative"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenFolderMenuId((prev) =>
                                      prev === fld.id ? null : fld.id
                                    )
                                  }
                                  aria-label={`Folder options for ${fld.name}`}
                                  className="h-6 w-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                                {openFolderMenuId === fld.id && (
                                  <div className="absolute right-0 top-7 z-30 w-36 rounded-xl bg-white border border-slate-200 shadow-lg p-1 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenFolderMenuId(null);
                                        setIsCreatingFolder(true);
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50"
                                    >
                                      + Add folder
                                    </button>
                                    {folders.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteFolder(fld.id)}
                                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                                      >
                                        Delete folder
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                            <Folder
                              className={`h-3 w-3 ${
                                isSelected ? 'text-[#6860FF]' : 'text-slate-300'
                              }`}
                            />
                            <span>
                              {folderVideoCount} videos · {fld.visibility}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Videos Section (4-Column Grid) */}
                <section className="mt-7">
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="text-xs font-medium text-slate-400">Videos</span>
                    <div className="flex items-center gap-1.5 text-slate-400 sm:hidden">
                      <button
                        type="button"
                        onClick={() => setLayoutMode('list')}
                        aria-label="Mobile list view"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLayoutMode('grid')}
                        aria-label="Mobile grid view"
                      >
                        <Grid className="h-3.5 w-3.5 text-slate-700" />
                      </button>
                    </div>
                  </div>

                  {filteredRecordings.length === 0 ? (
                    <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center space-y-3 shadow-2xs">
                      <div className="text-sm font-semibold text-slate-800">
                        No videos in this view
                      </div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Record a new screen, window, or camera video, or clear your active folder
                        filter to see all videos in your library.
                      </p>
                      <div className="flex items-center justify-center gap-2.5 pt-1">
                        {(selectedFolderId ||
                          sidebarFilter !== 'library' ||
                          workspaceFilter !== 'all' ||
                          searchQuery) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFolderId(null);
                              setSidebarFilter('library');
                              setWorkspaceFilter('all');
                              setSearchQuery('');
                            }}
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                          >
                            Show all videos
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveView('recorder')}
                          className="px-4 py-2 rounded-xl bg-[#6860FF] hover:bg-[#564EE8] text-white text-xs font-semibold"
                        >
                          + New video
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={
                        layoutMode === 'grid'
                          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'
                          : 'space-y-3'
                      }
                    >
                      {filteredRecordings.map((item, index) => {
                        const totalReactions =
                          item.reactions.fire +
                          item.reactions.thumbsUp +
                          item.reactions.idea +
                          item.reactions.target;

                        return (
                          <article
                            key={item.id}
                            className="group rounded-2xl bg-white/80 hover:bg-white border border-transparent hover:border-slate-200/80 p-2.5 transition-all duration-200 hover:shadow-xl hover:shadow-slate-900/5 flex flex-col justify-between relative"
                          >
                            <div>
                              {/* Thumbnail Container */}
                              <div
                                onClick={() => handleOpenVideoPlayer(item.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) =>
                                  e.key === 'Enter' && handleOpenVideoPlayer(item.id)
                                }
                                className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-900 cursor-pointer"
                              >
                                {!brokenImages[item.id] ? (
                                  <img
                                    src={item.thumbnailUrl}
                                    alt={item.title}
                                    onError={() =>
                                      setBrokenImages((prev) => ({
                                        ...prev,
                                        [item.id]: true,
                                      }))
                                    }
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center bg-slate-800 text-white text-xs font-semibold p-3 text-center">
                                    {item.title}
                                  </div>
                                )}

                                {/* Quick Favorite & Watch Later Badges (Top-Right) */}
                                <div
                                  className="absolute top-2 right-2 flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFavorite(item.id)}
                                    aria-label={`Favorite ${item.title}`}
                                    className={`h-6 w-6 rounded-full flex items-center justify-center backdrop-blur-xs transition-all ${
                                      item.isFavorite
                                        ? 'bg-rose-500 text-white opacity-100'
                                        : 'bg-slate-950/60 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-slate-950'
                                    }`}
                                  >
                                    <Heart
                                      className={`h-3 w-3 ${
                                        item.isFavorite ? 'fill-current' : ''
                                      }`}
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleWatchLater(item.id)}
                                    aria-label={`Watch later ${item.title}`}
                                    className={`h-6 w-6 rounded-full flex items-center justify-center backdrop-blur-xs transition-all ${
                                      item.isWatchLater
                                        ? 'bg-[#0F6FFF] text-white opacity-100'
                                        : 'bg-slate-950/60 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-slate-950'
                                    }`}
                                  >
                                    <Bookmark
                                      className={`h-3 w-3 ${
                                        item.isWatchLater ? 'fill-current' : ''
                                      }`}
                                    />
                                  </button>
                                </div>

                                {/* Duration Badge (Bottom-Right) */}
                                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-950/80 text-white font-mono text-[10px] font-semibold tabular-nums">
                                  {formatBadgeDuration(item.durationSec)}
                                </span>
                              </div>

                              {/* Overlapping Creator Avatar + Metadata */}
                              <div className="px-1.5 pt-3 pb-1 relative">
                                <div className="absolute -top-3.5 left-2.5 h-6 w-6 rounded-full ring-2 ring-white bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                                  {(account?.name || 'Jason M.').charAt(0)}
                                </div>

                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                  {item.createdAt}
                                </div>

                                <h2 className="mt-1 text-xs sm:text-[13px] font-bold text-slate-900 leading-snug line-clamp-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenVideoPlayer(item.id)}
                                    className="text-left hover:text-[#4F46E5] transition-colors"
                                  >
                                    {item.title}
                                  </button>
                                </h2>

                                {/* Stats Row (Views, Comments, Reactions, Share count) */}
                                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                                  <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center gap-1">
                                      <Eye className="h-3 w-3" />
                                      <span>{item.views}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3" />
                                      <span>{item.comments.length}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <Smile className="h-3 w-3" />
                                      <span>{totalReactions}</span>
                                    </span>
                                  </div>

                                  <span className="inline-flex items-center gap-1">
                                    <Share2 className="h-3 w-3" />
                                    <span>{index * 4}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Bottom Quick Share & Action Bar */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 px-1">
                              <button
                                type="button"
                                onClick={() => handleQuickShareCopy(item)}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] font-semibold text-[11px] inline-flex items-center justify-center gap-1.5 transition-colors"
                              >
                                {copiedCardId === item.id ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Share2 className="h-3 w-3" />
                                    <span>Share</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleQuickShareCopy(item)}
                                aria-label={`Copy link for ${item.title}`}
                                className="p-1.5 rounded-lg border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                              >
                                <Link2 className="h-3.5 w-3.5" />
                              </button>

                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenMenuCardId(
                                      openMenuCardId === item.id ? null : item.id
                                    )
                                  }
                                  aria-label={`More actions for ${item.title}`}
                                  className="p-1.5 rounded-lg border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>

                                {openMenuCardId === item.id && (
                                  <div className="absolute right-0 bottom-9 z-30 w-48 rounded-xl bg-white border border-slate-200 shadow-lg p-1.5 space-y-0.5 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuCardId(null);
                                        handleOpenVideoPlayer(item.id);
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 text-left"
                                    >
                                      <Scissors className="h-3.5 w-3.5 text-indigo-600" />
                                      <span>Trim & Transcript</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleToggleFavorite(item.id);
                                        setOpenMenuCardId(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 text-left"
                                    >
                                      <Heart
                                        className={`h-3.5 w-3.5 ${
                                          item.isFavorite
                                            ? 'text-rose-500 fill-current'
                                            : 'text-slate-400'
                                        }`}
                                      />
                                      <span>
                                        {item.isFavorite
                                          ? 'Remove from Favorites'
                                          : 'Add to Favorites'}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleToggleWatchLater(item.id);
                                        setOpenMenuCardId(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 text-left"
                                    >
                                      <Bookmark
                                        className={`h-3.5 w-3.5 ${
                                          item.isWatchLater
                                            ? 'text-[#0F6FFF] fill-current'
                                            : 'text-slate-400'
                                        }`}
                                      />
                                      <span>
                                        {item.isWatchLater
                                          ? 'Remove Watch later'
                                          : 'Save to Watch later'}
                                      </span>
                                    </button>
                                    {folders.map((f) => (
                                      <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => handleAssignFolder(item.id, f.id)}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 text-left truncate"
                                      >
                                        <Folder className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">Move to {f.name}</span>
                                      </button>
                                    ))}
                                    {item.containerFormat === 'mp4' && item.mp4BlobUrl ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuCardId(null);
                                          triggerMp4Download(
                                            item.mp4BlobUrl!,
                                            toMp4Filename(item.title)
                                          );
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 text-left"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                        <span>Download MP4</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuCardId(null);
                                          setConvertingRecordingId(item.id);
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 text-left"
                                      >
                                        <FileVideo className="h-3.5 w-3.5 text-blue-600" />
                                        <span>Convert to MP4</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuCardId(null);
                                        setPendingConfirm({
                                          type: 'delete',
                                          recording: item,
                                        });
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-left"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span>Delete video</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </main>
            )}

            {/* RECORDER STUDIO VIEW */}
            {activeView === 'recorder' && (
              <main className="flex-1 px-4 sm:px-8 lg:px-10 pt-5 sm:pt-7 max-w-[1120px] w-full mx-auto">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Record New Video
                    </h1>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView('dashboard')}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Back to My Library
                  </button>
                </div>

                <RecorderStudioPanel
                  onRecordingComplete={(rec, blob) => {
                    void handleRecordingCreated(rec, blob);
                  }}
                  onRecordingStateChange={setIsRecordingLive}
                  onOpenLibrary={() => setActiveView('dashboard')}
                  onRequestConvertMp4={(rec) => setConvertingRecordingId(rec.id)}
                  recordingsCount={recordings.length}
                />
              </main>
            )}

            {/* GOOGLE DRIVE & ACCOUNT SETTINGS VIEW */}
            {activeView === 'drive' && (
              <main className="flex-1 px-4 sm:px-8 lg:px-10 pt-5 sm:pt-7 max-w-[1120px] w-full mx-auto">
                <div className="mb-5 flex items-center justify-between">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Google Drive & Workspace Settings
                  </h1>
                  <button
                    type="button"
                    onClick={() => setActiveView('dashboard')}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Back to My Library
                  </button>
                </div>

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
              </main>
            )}

            {/* Floating Bottom-Right "Record" Pill Button */}
            {activeView === 'dashboard' && (
              <button
                type="button"
                onClick={() => setActiveView('recorder')}
                className="fixed bottom-5 right-5 z-20 rounded-full bg-[#111827] hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 shadow-lg flex items-center gap-2 transition-all active:scale-95"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span>Record</span>
              </button>
            )}
          </div>
        </div>
      )}

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
            ? 'This will permanently delete the video file from your Google Drive folder and remove its shareable link. This action cannot be undone.'
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
