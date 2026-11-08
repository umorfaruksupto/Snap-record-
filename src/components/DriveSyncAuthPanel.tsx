import React, { useState, useEffect } from 'react';
import {
  Check,
  Copy,
  Trash2,
  RefreshCw,
  LogOut,
  ShieldCheck,
  FolderSync,
  UploadCloud,
  Database,
  Share2,
} from 'lucide-react';
import {
  RecordingItem,
  calculateStorageUsage,
  formatFileSize,
  buildDriveShareUrl,
} from '../utils/recordingLogic';

export interface ConnectedAccount {
  uid?: string;
  name: string;
  email: string;
  authMode: 'google_oauth';
  driveFolder: string;
  firestoreSynced?: boolean;
}

interface DriveSyncAuthPanelProps {
  account: ConnectedAccount | null;
  recordings: RecordingItem[];
  isGoogleSigningIn: boolean;
  driveStatusMessage: string | null;
  onGoogleLogin: (preferredFolder?: string) => void;
  onUpdateDriveFolder: (nextFolder: string) => void;
  onLogout: () => void;
  onSyncRecordingToDrive: (recording: RecordingItem) => void;
  onRefreshDriveFiles: () => void;
  onRequestDeleteRecording: (recording: RecordingItem) => void;
  onRequestPermissionUpdate: (
    recording: RecordingItem,
    nextAccess: 'anyoneWithLink' | 'restricted'
  ) => void;
}

export const GoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled, label = 'Continue with Google & Connect Drive' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="gsi-material-button w-full sm:w-auto whitespace-nowrap shrink-0"
  >
    <div className="gsi-material-button-state"></div>
    <div className="gsi-material-button-content-wrapper">
      <div className="gsi-material-button-icon">
        <svg
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          style={{ display: 'block' }}
        >
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          ></path>
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          ></path>
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          ></path>
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          ></path>
          <path fill="none" d="M0 0h48v48H0z"></path>
        </svg>
      </div>
      <span className="gsi-material-button-contents">{label}</span>
      <span style={{ display: 'none' }}>{label}</span>
    </div>
  </button>
);

export const DriveSyncAuthPanel: React.FC<DriveSyncAuthPanelProps> = ({
  account,
  recordings,
  isGoogleSigningIn,
  driveStatusMessage,
  onGoogleLogin,
  onUpdateDriveFolder,
  onLogout,
  onSyncRecordingToDrive,
  onRefreshDriveFiles,
  onRequestDeleteRecording,
  onRequestPermissionUpdate,
}) => {
  const [driveFolderInput, setDriveFolderInput] = useState(
    account?.driveFolder || '/ScapRecord Cloud Clips'
  );
  const [folderSavedToast, setFolderSavedToast] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (account?.driveFolder) {
      setDriveFolderInput(account.driveFolder);
    }
  }, [account?.driveFolder]);

  const storageStats = calculateStorageUsage(recordings);

  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = driveFolderInput.trim() || '/ScapRecord Cloud Clips';
    setDriveFolderInput(cleaned);
    onUpdateDriveFolder(cleaned);
    setFolderSavedToast(true);
    setTimeout(() => setFolderSavedToast(false), 2000);
  };

  const handleCopyShareLink = (rec: RecordingItem) => {
    const urls = buildDriveShareUrl(rec.driveFileId || rec.id);
    navigator.clipboard?.writeText(urls.driveUrl).catch(() => {});
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left 5 Columns: Google-Only Drive & Firebase Workspace Card */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Google Drive & Firebase Cloud
                </h2>
              </div>
              <span className="text-xs font-medium text-slate-600">
                Google-Only Sign In
              </span>
            </div>

            {account ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Google Account</span>
                    <span className="text-xs font-semibold text-emerald-700">
                      Connected · Firebase + Drive
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {account.name}
                  </div>
                  <div className="text-xs font-mono text-slate-700 break-all">
                    {account.email}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span>Firestore Profile</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {account.firestoreSynced ? 'Synced (/users)' : 'Active'}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveFolder} className="space-y-2.5">
                  <label
                    htmlFor="drive-folder-input"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Default Google Drive Sync Folder
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="drive-folder-input"
                      type="text"
                      value={driveFolderInput}
                      onChange={(e) => setDriveFolderInput(e.target.value)}
                      className="flex-1 min-h-[40px] sm:min-h-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-[40px] sm:min-h-0 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      {folderSavedToast ? 'Saved' : 'Save Folder'}
                    </button>
                  </div>
                </form>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <GoogleSignInButton
                    onClick={() => onGoogleLogin(driveFolderInput)}
                    disabled={isGoogleSigningIn}
                    label="Refresh Google Drive Token"
                  />
                  <button
                    type="button"
                    onClick={onLogout}
                    className="min-h-[40px] sm:min-h-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="text-xs font-semibold text-slate-900">
                    One-Click Google Sign-In & Drive Sharing
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    No separate account or password required. Record Loom-style screen and camera clips immediately, and connect your Google account to save your profile in Firebase Firestore and share videos directly from your personal Google Drive.
                  </p>

                  <div className="pt-1">
                    <label
                      htmlFor="initial-drive-folder-input"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Default Google Drive Sync Folder
                    </label>
                    <input
                      id="initial-drive-folder-input"
                      type="text"
                      value={driveFolderInput}
                      onChange={(e) => setDriveFolderInput(e.target.value)}
                      className="w-full min-h-[40px] sm:min-h-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="pt-1">
                    <GoogleSignInButton
                      onClick={() => onGoogleLogin(driveFolderInput)}
                      disabled={isGoogleSigningIn}
                      label={
                        isGoogleSigningIn
                          ? 'Connecting Google Drive...'
                          : 'Continue with Google'
                      }
                    />
                  </div>
                </div>

                {/* Minimal Architecture Capabilities Summary */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Database className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <div className="font-semibold text-slate-900">
                        Firebase Firestore User & Clip Metadata
                      </div>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">
                        Stores your Google creator profile (`/users`) and shared recording links (`/recordings`) with zero-trust Firestore security rules.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-start gap-2.5">
                    <Share2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <div className="font-semibold text-slate-900">
                        Instant Anyone-With-Link Video Sharing
                      </div>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">
                        Uploads WebM or H.264 MP4 recordings straight to your Google Drive (`drive.file`) and copies a shareable link to your clipboard.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 7 Columns: Google Drive Cloud Storage & Sharing Manager */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <FolderSync className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                  <span>Google Drive File Sharing & Cloud Repository</span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Manage recordings stored in your Google Drive, update link permissions, or remove synced files.
                </p>
              </div>

              <button
                type="button"
                onClick={onRefreshDriveFiles}
                className="w-full sm:w-auto min-h-[40px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sync with Google Drive</span>
              </button>
            </div>

            {driveStatusMessage && (
              <div
                role="status"
                className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-medium text-blue-900"
              >
                {driveStatusMessage}
              </div>
            )}

            {/* Storage Quota Bar */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-2">
                <span className="text-slate-700 font-medium">
                  Google Drive Storage ({storageStats.syncedCount} files synced)
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {storageStats.formattedTotal} / 15.00 GB Free Tier
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${Math.max(4, storageStats.quotaPercent)}%` }}
                />
              </div>
            </div>

            {/* Mobile Card List (Visible on < md screens) */}
            <div className="mt-4 md:hidden space-y-3">
              {recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900 leading-snug">
                      {rec.title}
                    </div>
                    <span className="font-mono text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                      {formatFileSize(rec.sizeBytes)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                    <div>
                      {rec.driveSynced ? (
                        <span className="text-emerald-700 font-semibold">
                          Synced · {rec.shareAccess === 'anyoneWithLink' ? 'Public' : 'Private'}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-medium">Local Only</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {rec.driveSynced ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyShareLink(rec)}
                            aria-label={`Copy Drive link for ${rec.title}`}
                            className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors whitespace-nowrap shrink-0"
                          >
                            {copiedId === rec.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Copy URL</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onRequestPermissionUpdate(
                                rec,
                                rec.shareAccess === 'anyoneWithLink'
                                  ? 'restricted'
                                  : 'anyoneWithLink'
                              )
                            }
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors whitespace-nowrap shrink-0"
                          >
                            {rec.shareAccess === 'anyoneWithLink'
                              ? 'Restrict'
                              : 'Share'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSyncRecordingToDrive(rec)}
                          className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 text-xs transition-colors whitespace-nowrap shrink-0"
                        >
                          <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Sync to Drive</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onRequestDeleteRecording(rec)}
                        aria-label={`Delete ${rec.title}`}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Drive File Table (Visible on >= md screens) */}
            <div className="mt-4 hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="w-[36%] py-2.5 pr-2">Recording Title</th>
                    <th className="w-[14%] py-2.5 px-2 text-right">Size</th>
                    <th className="w-[20%] py-2.5 px-2">Drive Status</th>
                    <th className="w-[30%] py-2.5 pl-2 text-right">Sharing & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {recordings.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-2 font-medium text-slate-900 truncate">
                        {rec.title}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {formatFileSize(rec.sizeBytes)}
                      </td>
                      <td className="py-3 px-2 text-slate-700 truncate whitespace-nowrap">
                        {rec.driveSynced ? (
                          <span className="text-emerald-700 font-medium">
                            Synced · {rec.shareAccess === 'anyoneWithLink' ? 'Public' : 'Private'}
                          </span>
                        ) : (
                          <span className="text-slate-600">Local Only</span>
                        )}
                      </td>
                      <td className="py-3 pl-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {rec.driveSynced ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopyShareLink(rec)}
                                aria-label={`Copy Drive link for ${rec.title}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition-colors whitespace-nowrap shrink-0"
                              >
                                {copiedId === rec.id ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" aria-hidden="true" />
                                    <span>Copy URL</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onRequestPermissionUpdate(
                                    rec,
                                    rec.shareAccess === 'anyoneWithLink'
                                      ? 'restricted'
                                      : 'anyoneWithLink'
                                  )
                                }
                                className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition-colors whitespace-nowrap shrink-0"
                              >
                                {rec.shareAccess === 'anyoneWithLink'
                                  ? 'Restrict'
                                  : 'Share'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSyncRecordingToDrive(rec)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 text-[11px] transition-colors whitespace-nowrap shrink-0"
                            >
                              <UploadCloud className="h-3 w-3" aria-hidden="true" />
                              <span>Sync to Drive</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onRequestDeleteRecording(rec)}
                            aria-label={`Delete ${rec.title}`}
                            className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
