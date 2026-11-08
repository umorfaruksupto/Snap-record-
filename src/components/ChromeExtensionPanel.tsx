import React, { useState, useEffect } from 'react';
import {
  Download,
  Copy,
  Check,
  Puzzle,
  Play,
  Square,
  FileCode,
  Cloud,
  Timer,
  Share2,
} from 'lucide-react';
import { CHROME_EXTENSION_FILES } from '../data/extensionSource';
import { downloadExtensionBundleFile } from '../utils/extensionPackager';
import {
  CaptureMode,
  RecordingItem,
  formatRecordingTimer,
  buildDriveShareUrl,
} from '../utils/recordingLogic';

interface ChromeExtensionPanelProps {
  onExtensionSimulatedCapture: (recording: RecordingItem) => void;
}

export const ChromeExtensionPanel: React.FC<ChromeExtensionPanelProps> = ({
  onExtensionSimulatedCapture,
}) => {
  const [selectedFile, setSelectedFile] = useState(CHROME_EXTENSION_FILES[0].filename);
  const [copiedFile, setCopiedFile] = useState(false);
  const [downloadedNotice, setDownloadedNotice] = useState<string | null>(null);

  // Interactive Chrome Extension Popup Simulator state
  const [extensionConnected, setExtensionConnected] = useState(true);
  const [simMode, setSimMode] = useState<CaptureMode>('screen_cam');
  const [simDriveSync, setSimDriveSync] = useState(true);
  const [simTabTitle, setSimTabTitle] = useState('GitHub PR #418 — Auth Service Review');
  const [simRecording, setSimRecording] = useState(false);
  const [simElapsedSec, setSimElapsedSec] = useState(0);
  const [simFeedback, setSimFeedback] = useState<string | null>(null);
  const [lastInstantLink, setLastInstantLink] = useState<string | null>(null);
  const [copiedInstantLink, setCopiedInstantLink] = useState(false);

  const activeSource =
    CHROME_EXTENSION_FILES.find((f) => f.filename === selectedFile) ||
    CHROME_EXTENSION_FILES[0];

  useEffect(() => {
    if (!simRecording) return;
    const interval = window.setInterval(() => {
      setSimElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [simRecording]);

  const handleCopySource = () => {
    navigator.clipboard?.writeText(activeSource.content).catch(() => {});
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 1800);
  };

  const handleDownloadBundle = (specificFile?: string) => {
    const outName = downloadExtensionBundleFile(specificFile);
    setDownloadedNotice(`Downloaded ${outName}`);
    setTimeout(() => setDownloadedNotice(null), 3500);
  };

  const handleToggleExtensionSim = () => {
    if (!simRecording) {
      setSimElapsedSec(0);
      setLastInstantLink(null);
      setSimRecording(true);
      setSimFeedback(
        'Extension badge set to REC — recording active Chrome tab with live timer...'
      );
    } else {
      setSimRecording(false);
      const id = `scap-ext-${Date.now().toString().slice(-4)}`;
      const driveId = `1ScapExtDrive_${Date.now().toString(36)}`;
      const shareUrls = buildDriveShareUrl(driveId);
      const finalDuration = Math.max(12, simElapsedSec);
      const newClip: RecordingItem = {
        id,
        title: `Chrome Extension: ${simTabTitle.trim() || 'Active Tab Capture'}`,
        description:
          'Captured directly from the ScapRecord Manifest V3 Chrome Extension and synced to Google Drive for instant sharing.',
        durationSec: finalDuration,
        sizeBytes: Math.max(4.8, finalDuration * 0.28) * 1024 * 1024,
        createdAt: new Date().toISOString(),
        captureMode: simMode,
        views: 1,
        thumbnailUrl: '/src/assets/images/thumb_design_system_review_1794089142580.jpg',
        driveSynced: simDriveSync,
        driveFileId: simDriveSync ? driveId : undefined,
        driveWebViewLink: simDriveSync ? shareUrls.driveUrl : undefined,
        shareAccess: simDriveSync ? 'anyoneWithLink' : 'restricted',
        resolution: '1440p 60fps',
        containerFormat: 'webm',
        backgroundPreset: 'Midnight Indigo',
        source: 'chrome_extension',
        reactions: { fire: 2, thumbsUp: 1, idea: 1, target: 1 },
        comments: [],
        transcript: `00:00 Captured via ScapRecord Chrome Extension on tab "${simTabTitle}". Uploaded to Google Drive.`,
      };
      onExtensionSimulatedCapture(newClip);
      setLastInstantLink(shareUrls.scapShareUrl);
      navigator.clipboard?.writeText(shareUrls.scapShareUrl).catch(() => {});
      setSimFeedback(
        simDriveSync
          ? `Saved "${newClip.title}" to Google Drive & copied instant share link!`
          : `Saved "${newClip.title}" to Library!`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Split: Interactive Extension Popup Simulator + Unpacked Install Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left 5 cols: Interactive Extension Popup Simulator */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Puzzle className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Chrome Extension Instant Recorder
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setExtensionConnected((prev) => !prev)}
                className={`min-h-[34px] sm:min-h-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  extensionConnected
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {extensionConnected ? 'Extension Connected' : 'Connect Extension'}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Live Extension Timer Display */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <Timer className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                  <span>Extension Recording Timer</span>
                </span>
                <span
                  className={`font-mono text-sm font-bold tabular-nums ${
                    simRecording ? 'text-red-600' : 'text-slate-900'
                  }`}
                >
                  {formatRecordingTimer(simElapsedSec, 0).elapsedFormatted}
                </span>
              </div>

              <div>
                <label
                  htmlFor="ext-sim-tab-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Target Chrome Tab Title
                </label>
                <input
                  id="ext-sim-tab-input"
                  type="text"
                  value={simTabTitle}
                  onChange={(e) => setSimTabTitle(e.target.value)}
                  className="w-full min-h-[40px] sm:min-h-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="ext-sim-mode-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Extension Capture Mode
                </label>
                <select
                  id="ext-sim-mode-select"
                  value={simMode}
                  onChange={(e) => setSimMode(e.target.value as CaptureMode)}
                  className="w-full min-h-[40px] sm:min-h-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="screen_cam">Desktop / Tab + Draggable Camera Bubble</option>
                  <option value="screen_only">Full Tab / Window Only (60fps)</option>
                  <option value="cam_only">Floating Camera Bubble Only</option>
                </select>
              </div>

              <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs cursor-pointer">
                <span className="text-slate-800 font-medium flex items-center gap-2">
                  <Cloud className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                  <span>Auto-Upload to Google Drive & Copy Link on Stop</span>
                </span>
                <input
                  type="checkbox"
                  checked={simDriveSync}
                  onChange={(e) => setSimDriveSync(e.target.checked)}
                  className="h-4 w-4 accent-blue-600 shrink-0"
                />
              </label>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 space-y-3">
            <button
              type="button"
              onClick={handleToggleExtensionSim}
              className={`w-full min-h-[42px] sm:min-h-0 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                simRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {simRecording ? (
                <>
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Stop Extension Capture & Share Instantly</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Start Chrome Extension Capture</span>
                </>
              )}
            </button>

            {simFeedback && (
              <p role="status" className="text-xs font-semibold text-emerald-700 text-center">
                {simFeedback}
              </p>
            )}

            {lastInstantLink && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
                <span className="font-mono text-blue-900 truncate">{lastInstantLink}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(lastInstantLink).catch(() => {});
                    setCopiedInstantLink(true);
                    setTimeout(() => setCopiedInstantLink(false), 1800);
                  }}
                  className="min-h-[34px] sm:min-h-0 flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold whitespace-nowrap shrink-0"
                >
                  {copiedInstantLink ? (
                    <>
                      <Check className="h-3 w-3" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3 w-3" aria-hidden="true" />
                      <span>Copy Share Link</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right 7 cols: Download & Chrome Installation Steps */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Install ScapRecord Chrome Extension (v2.4.0)
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Complete Manifest V3 extension with offscreen MediaRecorder, draggable webcam PIP, and Google Drive OAuth2.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadBundle()}
                className="w-full sm:w-auto min-h-[42px] sm:min-h-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Extension Bundle</span>
              </button>
            </div>

            {downloadedNotice && (
              <div
                role="status"
                className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"
              >
                {downloadedNotice}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="font-semibold text-slate-900">01. Download `/public/chrome-extension`</div>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  Download the extension bundle above or use the pre-built unpacked files in `/public/chrome-extension/`.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="font-semibold text-slate-900">02. Open `chrome://extensions`</div>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  Toggle on Developer Mode in the top-right corner of Chrome and click Load Unpacked.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="font-semibold text-slate-900">03. Pin ScapRecord & Press `Alt+Shift+R`</div>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  Launch recordings on any tab with the draggable Loom-style camera bubble injected via `content.js`.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="font-semibold text-slate-900">04. Instant Google Drive Share Link</div>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  `background.js` uploads the recording to Google Drive and copies your `scaprecord.site/v/...` link.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Extension Source Code Inspector */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200 px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {CHROME_EXTENSION_FILES.map((file) => (
              <button
                key={file.filename}
                type="button"
                onClick={() => setSelectedFile(file.filename)}
                className={`min-h-[36px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                  selectedFile === file.filename
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{file.filename}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySource}
              className="min-h-[36px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedFile ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copied {activeSource.filename}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy {activeSource.filename}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleDownloadBundle(activeSource.filename)}
              className="min-h-[36px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Download {activeSource.filename}</span>
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
          {activeSource.role}
        </div>

        <pre className="p-4 sm:p-6 text-xs font-mono text-slate-100 bg-slate-950 overflow-x-auto max-h-96 leading-relaxed">
          <code>{activeSource.content}</code>
        </pre>
      </div>
    </div>
  );
};
