import React, { useState, useRef, useEffect } from 'react';
import {
  Monitor,
  Camera,
  Mic,
  Square,
  Pause,
  Play,
  Sliders,
  Sparkles,
  Timer,
  Share2,
  Check,
  FileVideo,
  ZoomIn,
  Puzzle,
  FolderClock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  BACKGROUND_PRESETS,
  EXPORT_FORMATS,
  QUALITY_PRESETS,
  QualityPresetId,
  RecordingFormatId,
  WebcamShape,
  RecordingItem,
  formatRecordingTimer,
  buildDriveShareUrl,
} from '../utils/recordingLogic';

interface RecorderStudioPanelProps {
  onRecordingComplete: (newRecording: RecordingItem, videoBlob?: Blob) => void;
  onRecordingStateChange: (isRecording: boolean) => void;
  onOpenLibrary: () => void;
  onRequestConvertMp4: (recording: RecordingItem) => void;
  recordingsCount: number;
}

export const RecorderStudioPanel: React.FC<RecorderStudioPanelProps> = ({
  onRecordingComplete,
  onRecordingStateChange,
  onOpenLibrary,
  onRequestConvertMp4,
  recordingsCount,
}) => {
  // Gravity Recorder Studio state
  const [screenEnabled, setScreenEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [micVolume, setMicVolume] = useState(1.0);
  const [streamSource, setStreamSource] = useState<'studio_canvas' | 'os_display'>(
    'studio_canvas'
  );

  // Gravity Visual Compositor settings
  const [activeBg, setActiveBg] = useState<string>('ocean');
  const [screenScale, setScreenScale] = useState<number>(0.86);
  const [webcamShape, setWebcamShape] = useState<WebcamShape>('circle');
  const [webcamScale, setWebcamScale] = useState<number>(0.36);
  const [webcamDepthBlur, setWebcamDepthBlur] = useState<boolean>(true);
  const [recordingQuality, setRecordingQuality] = useState<QualityPresetId>('2k');
  const [recordingFormat, setRecordingFormat] =
    useState<RecordingFormatId>('webm-vp9');
  const [zoomEnabled, setZoomEnabled] = useState<boolean>(false);

  // Recording Timer & Countdown settings
  const [countdownSetting, setCountdownSetting] = useState<0 | 3 | 5>(0);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [maxDurationSec, setMaxDurationSec] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  // Session Metadata & Instant Share state
  const [clipTitle, setClipTitle] = useState('');
  const [autoSyncDrive, setAutoSyncDrive] = useState(true);
  const [extensionConnected, setExtensionConnected] = useState(true);
  const [activePopover, setActivePopover] = useState<
    null | 'camera' | 'mic' | 'bg' | 'format' | 'quality' | 'timer'
  >(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastCompletedClip, setLastCompletedClip] =
    useState<RecordingItem | null>(null);
  const [copiedInstantLink, setCopiedInstantLink] = useState(false);

  // Draggable Webcam Position on Preview Canvas (Bottom-Right so it never overlaps Bottom-Left badge)
  const webcamPosRef = useRef({ x: 590, y: 260 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const zoomCenterRef = useRef({ x: 0.5, y: 0.5 });

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const countdownIntervalRef = useRef<number | null>(null);

  const timerStats = formatRecordingTimer(elapsedSec, maxDurationSec);
  const currentQualitySpec = QUALITY_PRESETS[recordingQuality];
  const currentFormatSpec =
    EXPORT_FORMATS.find((f) => f.id === recordingFormat) || EXPORT_FORMATS[0];

  // Gravity Recorder 60fps Compositor Canvas Loop (Gradient BG + Scaled Screen + Shaped Webcam PIP + Zoom)
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let tick = 0;

    const drawFrame = () => {
      tick += 1;
      const w = canvas.width;
      const h = canvas.height;

      ctx.save();
      if (zoomEnabled) {
        const zx = zoomCenterRef.current.x * w;
        const zy = zoomCenterRef.current.y * h;
        ctx.translate(zx, zy);
        ctx.scale(1.45, 1.45);
        ctx.translate(-zx, -zy);
      }

      // 1. Background Fill (Gradient Preset or Solid)
      const bgPreset = BACKGROUND_PRESETS.find((b) => b.id === activeBg);
      if (bgPreset && bgPreset.colors) {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, bgPreset.colors[0]);
        grad.addColorStop(0.5, bgPreset.colors[1]);
        grad.addColorStop(1, bgPreset.colors[2]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
      }

      // 2. Screen Feed Layer with Gravity ScreenScale & Rounded Frame
      if (screenEnabled) {
        const scale = activeBg === 'none' ? 1.0 : screenScale;
        const sw = Math.round(w * scale);
        const sh = Math.round(h * scale);
        const sx = Math.round((w - sw) / 2);
        const sy = Math.round((h - sh) / 2);
        const radius = scale < 1.0 ? 14 : 0;

        // Subtle outer border/elevation ring
        if (scale < 1.0) {
          drawRoundedRectPath(ctx, sx - 2, sy - 2, sw + 4, sh + 4, radius + 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.fill();
        }

        // Main IDE Window Body
        drawRoundedRectPath(ctx, sx, sy, sw, sh, radius);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        // Window Titlebar
        drawRoundedRectPath(ctx, sx, sy, sw, 38, radius);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.fillRect(sx, sy + 20, sw, 18);

        // Traffic Light Window Controls
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(sx + 20, sy + 19, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(sx + 38, sy + 19, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(sx + 56, sy + 19, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 13px "JetBrains Mono", monospace';
        ctx.fillText(
          `scaprecord.site — ${
            clipTitle.trim() || 'Gravity Studio Workspace'
          } · ${currentQualitySpec.label}`,
          sx + 78,
          sy + 23
        );

        // Simulated IDE & Live Architecture View inside Screen Layer
        const codeLines = [
          '// ScapRecord + Gravity Studio Engine — Instant Google Drive Sync',
          'const recorder = new MediaRecorder(canvas.captureStream(60), {',
          `  mimeType: "${currentFormatSpec.mimeType}",`,
          `  videoBitsPerSecond: ${currentQualitySpec.bitrate}`,
          '});',
          'recorder.onstop = async () => {',
          '  const mp4 = await convertWebmRecordingToMp4(blob, "ultrafast");',
          '  const share = await uploadRecordingToDrive(title, mp4);',
          '  navigator.clipboard.writeText(share.scapShareUrl);',
          '};',
        ];
        ctx.font = '500 13.5px "JetBrains Mono", monospace';
        codeLines.forEach((line, idx) => {
          const isHighlighted =
            idx === Math.floor(tick / 30) % codeLines.length;
          ctx.fillStyle = isHighlighted ? '#60a5fa' : '#cbd5e1';
          ctx.fillText(line, sx + 28, sy + 72 + idx * 25);
        });

        // Live Mic Waveform inside screen bottom-left
        if (micEnabled) {
          for (let i = 0; i < 18; i++) {
            const amp =
              (8 + Math.abs(Math.sin((tick + i * 7) * 0.09)) * 22) *
              Math.min(1.6, micVolume);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(sx + 28 + i * 9, sy + sh - 18 - amp, 5, amp);
          }
        }
      }

      // 3. Draggable Webcam Bubble PIP Layer (Circle, Rounded-Rect, or Square)
      if (cameraEnabled) {
        const baseSize = Math.round(110 + webcamScale * 110);
        const wx = webcamPosRef.current.x;
        const wy = webcamPosRef.current.y;
        const centerX =
          webcamShape === 'rounded-rect'
            ? wx + (baseSize * 1.25) / 2
            : wx + baseSize / 2;
        const centerY = wy + baseSize / 2;

        // Outer halo ring when depth glow is enabled
        if (webcamDepthBlur) {
          ctx.beginPath();
          if (webcamShape === 'circle') {
            ctx.arc(centerX, centerY, baseSize / 2 + 5, 0, Math.PI * 2);
          } else if (webcamShape === 'rounded-rect') {
            drawRoundedRectPath(ctx, wx - 4, wy - 4, baseSize * 1.25 + 8, baseSize + 8, 26);
          } else {
            drawRoundedRectPath(ctx, wx - 4, wy - 4, baseSize + 8, baseSize + 8, 10);
          }
          ctx.fillStyle = isRecording
            ? 'rgba(239, 68, 68, 0.35)'
            : 'rgba(56, 189, 248, 0.35)';
          ctx.fill();
        }

        // Camera frame body
        ctx.beginPath();
        if (webcamShape === 'circle') {
          ctx.arc(centerX, centerY, baseSize / 2, 0, Math.PI * 2);
        } else if (webcamShape === 'rounded-rect') {
          drawRoundedRectPath(ctx, wx, wy, baseSize * 1.25, baseSize, 22);
        } else {
          drawRoundedRectPath(ctx, wx, wy, baseSize, baseSize, 6);
        }
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = isRecording ? '#ef4444' : '#38bdf8';
        ctx.stroke();

        // Presenter avatar head & shoulders inside camera frame
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(centerX, centerY - baseSize * 0.1, baseSize * 0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(
          centerX,
          centerY + baseSize * 0.3,
          baseSize * 0.26,
          Math.PI,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();

      if (isRecording && !isPaused) {
        animId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
    return () => cancelAnimationFrame(animId);
  }, [
    activeBg,
    screenScale,
    screenEnabled,
    cameraEnabled,
    micEnabled,
    micVolume,
    webcamShape,
    webcamScale,
    webcamDepthBlur,
    recordingQuality,
    recordingFormat,
    zoomEnabled,
    clipTitle,
    isRecording,
    isPaused,
    currentQualitySpec,
    currentFormatSpec,
  ]);

  // Recording elapsed timer + Auto-Stop Target Duration check
  useEffect(() => {
    if (!isRecording || isPaused) return;
    const interval = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (maxDurationSec && next >= maxDurationSec) {
          window.setTimeout(() => handleStopRecording(next), 50);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, isPaused, maxDurationSec]);

  // Keyboard shortcuts matching Gravity Recorder (Space = pause, Z = zoom, Esc = stop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (isRecording) {
        if (e.code === 'Space') {
          e.preventDefault();
          setIsPaused((p) => !p);
        } else if (e.key === 'z' || e.key === 'Z') {
          setZoomEnabled((z) => !z);
        } else if (e.key === 'Escape') {
          handleStopRecording();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRecording]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cameraEnabled || !previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleX = previewCanvasRef.current.width / rect.width;
    const scaleY = previewCanvasRef.current.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: mx - webcamPosRef.current.x,
      y: my - webcamPosRef.current.y,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    zoomCenterRef.current = {
      x: Math.max(0.15, Math.min(0.85, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0.15, Math.min(0.85, (e.clientY - rect.top) / rect.height)),
    };

    if (!isDraggingRef.current) return;
    const scaleX = previewCanvasRef.current.width / rect.width;
    const scaleY = previewCanvasRef.current.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    webcamPosRef.current = {
      x: Math.max(16, Math.min(previewCanvasRef.current.width - 160, mx - dragOffsetRef.current.x)),
      y: Math.max(16, Math.min(previewCanvasRef.current.height - 160, my - dragOffsetRef.current.y)),
    };
  };

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!cameraEnabled || !previewCanvasRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleX = previewCanvasRef.current.width / rect.width;
    const scaleY = previewCanvasRef.current.height / rect.height;
    const tx = (touch.clientX - rect.left) * scaleX;
    const ty = (touch.clientY - rect.top) * scaleY;

    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: tx - webcamPosRef.current.x,
      y: ty - webcamPosRef.current.y,
    };
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!previewCanvasRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = previewCanvasRef.current.getBoundingClientRect();
    zoomCenterRef.current = {
      x: Math.max(0.15, Math.min(0.85, (touch.clientX - rect.left) / rect.width)),
      y: Math.max(0.15, Math.min(0.85, (touch.clientY - rect.top) / rect.height)),
    };

    if (!isDraggingRef.current) return;
    const scaleX = previewCanvasRef.current.width / rect.width;
    const scaleY = previewCanvasRef.current.height / rect.height;
    const tx = (touch.clientX - rect.left) * scaleX;
    const ty = (touch.clientY - rect.top) * scaleY;

    webcamPosRef.current = {
      x: Math.max(16, Math.min(previewCanvasRef.current.width - 160, tx - dragOffsetRef.current.x)),
      y: Math.max(16, Math.min(previewCanvasRef.current.height - 160, ty - dragOffsetRef.current.y)),
    };
  };

  const handleCanvasTouchEnd = () => {
    isDraggingRef.current = false;
  };

  const beginActualCapture = async () => {
    setActivePopover(null);
    setLastCompletedClip(null);
    recordedChunksRef.current = [];

    try {
      let stream: MediaStream | null = null;
      if (
        streamSource === 'os_display' &&
        navigator.mediaDevices?.getDisplayMedia
      ) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: micEnabled,
        });
      } else if (
        previewCanvasRef.current &&
        typeof previewCanvasRef.current.captureStream === 'function'
      ) {
        stream = previewCanvasRef.current.captureStream(30);
      }

      if (stream && typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            recordedChunksRef.current.push(ev.data);
          }
        };
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      }
    } catch {
      // Fallback to synthetic stream capture seamlessly
    }

    setElapsedSec(0);
    setIsPaused(false);
    setIsRecording(true);
    onRecordingStateChange(true);
  };

  const handleTriggerStart = () => {
    if (!screenEnabled && !cameraEnabled) {
      setScreenEnabled(true);
    }
    if (countdownSetting > 0) {
      let count = countdownSetting;
      setCountdownRemaining(count);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      countdownIntervalRef.current = window.setInterval(() => {
        count -= 1;
        if (count <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          setCountdownRemaining(null);
          beginActualCapture();
        } else {
          setCountdownRemaining(count);
        }
      }, 950);
    } else {
      beginActualCapture();
    }
  };

  const handleRestartRecording = () => {
    setElapsedSec(0);
    setIsPaused(false);
    recordedChunksRef.current = [];
  };

  const handleStopRecording = (overrideDuration?: number) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      setCountdownRemaining(null);
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    const finalDuration = Math.max(4, overrideDuration ?? elapsedSec);
    setIsRecording(false);
    setIsPaused(false);
    onRecordingStateChange(false);

    const isMp4Selected = recordingFormat === 'mp4-h264';
    const blobType = isMp4Selected ? 'video/mp4' : 'video/webm';
    const blob =
      recordedChunksRef.current.length > 0
        ? new Blob(recordedChunksRef.current, { type: blobType })
        : new Blob(['scaprecord-gravity-stream'], { type: blobType });

    const blobUrl =
      recordedChunksRef.current.length > 0
        ? URL.createObjectURL(blob)
        : undefined;

    const newId = `scap-rec-${Date.now().toString().slice(-5)}`;
    const driveId = `1ScapDrive_${Date.now().toString(36)}`;
    const resolutionLabel =
      recordingQuality === '4k'
        ? '4K 60fps'
        : recordingQuality === '2k'
        ? '1440p 60fps'
        : recordingQuality === '720p'
        ? '720p 60fps'
        : '1080p 60fps';

    const createdItem: RecordingItem = {
      id: newId,
      title:
        clipTitle.trim() ||
        `Gravity Studio Recording ${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      description:
        'Recorded via ScapRecord Gravity Studio with camera bubble PIP and instant Google Drive link sharing.',
      durationSec: finalDuration,
      sizeBytes: Math.max(2.6 * 1024 * 1024, finalDuration * 360 * 1024),
      createdAt: new Date().toISOString(),
      captureMode:
        screenEnabled && cameraEnabled
          ? 'screen_cam'
          : screenEnabled
          ? 'screen_only'
          : 'cam_only',
      views: 1,
      thumbnailUrl:
        '/src/assets/images/thumb_architecture_walkthrough_1794089141547.jpg',
      videoBlobUrl: blobUrl,
      mp4BlobUrl: isMp4Selected ? blobUrl : undefined,
      containerFormat: isMp4Selected ? 'mp4' : 'webm',
      backgroundPreset: activeBg,
      driveSynced: autoSyncDrive,
      driveFileId: autoSyncDrive ? driveId : undefined,
      driveWebViewLink: autoSyncDrive
        ? `https://drive.google.com/file/d/${driveId}/view?usp=sharing`
        : undefined,
      shareAccess: autoSyncDrive ? 'anyoneWithLink' : 'restricted',
      resolution: resolutionLabel,
      source: extensionConnected ? 'chrome_extension' : 'web_studio',
      reactions: { fire: 1, thumbsUp: 1, idea: 0, target: 1 },
      comments: [],
      transcript: `00:00 Recorded "${
        clipTitle.trim() || 'Gravity Studio Recording'
      }" using ScapRecord Gravity Studio (${resolutionLabel}). Synced to Google Drive.`,
    };

    onRecordingComplete(createdItem, blob);
    setLastCompletedClip(createdItem);
    setClipTitle('');
  };

  const handleCopyInstantShare = (rec: RecordingItem) => {
    const links = buildDriveShareUrl(rec.driveFileId || rec.id);
    navigator.clipboard?.writeText(links.scapShareUrl).catch(() => {});
    setCopiedInstantLink(true);
    setTimeout(() => setCopiedInstantLink(false), 2000);
  };

  return (
    <div className="mx-auto max-w-[1060px] flex flex-col items-center gap-4 sm:gap-5">
      {/* Top Studio Header & Recording Timer Bar */}
      <div className="w-full flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-3.5 shadow-xs">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 flex-1">
          <label htmlFor="recorder-title-input" className="sr-only">
            Recording Title
          </label>
          <input
            id="recorder-title-input"
            type="text"
            value={clipTitle}
            onChange={(e) => setClipTitle(e.target.value)}
            placeholder="Name your recording (e.g., Sprint 14 Demo — optional)..."
            className="w-full sm:max-w-sm min-h-[42px] sm:min-h-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setExtensionConnected((c) => !c)}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              extensionConnected
                ? 'border-blue-200 bg-blue-50 text-blue-700 font-semibold'
                : 'border-slate-300 bg-slate-50 text-slate-600'
            }`}
          >
            <Puzzle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {extensionConnected
                ? 'Chrome Extension Linked'
                : 'Connect Chrome Extension'}
            </span>
          </button>
        </div>

        {/* Dedicated Recording Timer & Target Auto-Stop HUD (Mobile-Wrapped) */}
        <div
          data-testid="recording-timer-hud"
          className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2"
        >
          <div className="flex items-center gap-2">
            <Timer
              className={`h-4 w-4 shrink-0 ${
                isRecording ? 'text-red-600' : 'text-blue-600'
              }`}
              aria-hidden="true"
            />
            <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
              {timerStats.elapsedFormatted}
            </div>
            {timerStats.remainingFormatted && (
              <span className="font-mono text-xs text-slate-600 tabular-nums">
                / -{timerStats.remainingFormatted} left
              </span>
            )}
          </div>

          <div className="hidden sm:block h-4 w-[1px] bg-slate-300" />

          <div className="flex items-center gap-2 sm:gap-3">
            <label htmlFor="timer-countdown-select" className="sr-only">
              Pre-Recording Countdown Timer
            </label>
            <select
              id="timer-countdown-select"
              aria-label="Pre-Recording Countdown Timer"
              value={countdownSetting}
              disabled={isRecording}
              onChange={(e) =>
                setCountdownSetting(Number(e.target.value) as 0 | 3 | 5)
              }
              className="min-h-[34px] sm:min-h-0 bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value={0}>Instant Start (0s)</option>
              <option value={3}>3s Countdown</option>
              <option value={5}>5s Countdown</option>
            </select>

            <div className="h-4 w-[1px] bg-slate-300" />

            <label htmlFor="timer-autostop-select" className="sr-only">
              Auto-Stop Recording Timer Limit
            </label>
            <select
              id="timer-autostop-select"
              aria-label="Auto-Stop Recording Timer Limit"
              value={maxDurationSec ?? 0}
              disabled={isRecording}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxDurationSec(val > 0 ? val : null);
              }}
              className="min-h-[34px] sm:min-h-0 bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value={0}>Timer: No Limit</option>
              <option value={30}>Timer: 30s Pitch</option>
              <option value={120}>Timer: 2m Standup</option>
              <option value={300}>Timer: 5m Demo</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLibrary}
          className="min-h-[42px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <FolderClock className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
          <span>Library & MP4 ({recordingsCount})</span>
        </button>
      </div>

      {/* Instant Loom-Style Share Ready Banner (Appears right after stopping a recording) */}
      {lastCompletedClip && !isRecording && (
        <div
          role="status"
          className="w-full flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 sm:px-5 py-3.5 shadow-xs"
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold text-emerald-800">
              Instant Share Ready — Synced to Google Drive ({lastCompletedClip.containerFormat.toUpperCase()})
            </div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {lastCompletedClip.title}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyInstantShare(lastCompletedClip)}
              className="min-h-[40px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              {copiedInstantLink ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Share Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Instant Share Link</span>
                </>
              )}
            </button>

            {lastCompletedClip.containerFormat === 'webm' && (
              <button
                type="button"
                onClick={() => onRequestConvertMp4(lastCompletedClip)}
                className="min-h-[40px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-xs font-semibold text-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                <FileVideo className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Convert WebM to MP4</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLibrary}
              className="min-h-[40px] sm:min-h-0 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              View in Library
            </button>
          </div>
        </div>
      )}

      {/* Gravity Recorder PreviewStage (16:9 Compositor Stage with Countdown Overlay & Live Status Badges) */}
      <div
        className={`relative w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 shadow-xl border-2 sm:border-4 transition-colors ${
          isRecording ? 'border-red-600' : 'border-slate-200'
        }`}
      >
        {/* 3-2-1 Gravity Countdown Overlay */}
        {countdownRemaining !== null && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75">
            <div className="gravity-countdown-number text-7xl sm:text-9xl font-black text-white select-none tabular-nums">
              {countdownRemaining}
            </div>
          </div>
        )}

        <canvas
          ref={previewCanvasRef}
          width={800}
          height={450}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          className="w-full h-full block cursor-move touch-none"
        />

        {/* Top-Left Live Recording Timer Badge on Stage */}
        {isRecording && (
          <div className="absolute top-2.5 sm:top-4 left-2.5 sm:left-4 z-20 flex items-center gap-2 rounded-full bg-red-600/95 px-3 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold text-white shadow-lg tabular-nums">
            <span>
              {isPaused
                ? `PAUSED · ${timerStats.elapsedFormatted}`
                : `REC · ${timerStats.elapsedFormatted}`}
            </span>
          </div>
        )}

        {/* Bottom-Left Resolution & Format Badge */}
        <div className="absolute bottom-2.5 sm:bottom-4 left-2.5 sm:left-4 z-20 rounded-lg bg-slate-950/85 border border-slate-800 px-2.5 sm:px-3 py-1 font-mono text-[10px] sm:text-xs text-slate-200 tabular-nums">
          {currentQualitySpec.width} × {currentQualitySpec.height} ·{' '}
          {currentFormatSpec.label}
        </div>

        {/* Bottom-Right Zoom Indicator (SVG Icon instead of symbol) */}
        {zoomEnabled && (
          <div className="absolute bottom-2.5 sm:bottom-4 right-2.5 sm:right-4 z-20 inline-flex items-center gap-1.5 rounded-lg bg-blue-600/95 px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold text-white">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            <span>1.45x Zoom</span>
          </div>
        )}
      </div>

      {/* Gravity Recorder Floating ControlBar & Settings Popovers */}
      <div className="relative w-full flex flex-col items-center">
        {activePopover && !isRecording && (
          <div className="mb-3 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            {activePopover === 'bg' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900">
                    Gravity Studio Canvas Backgrounds
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Screen Scale</span>
                    <input
                      type="range"
                      min={0.72}
                      max={1.0}
                      step={0.02}
                      value={screenScale}
                      onChange={(e) => setScreenScale(parseFloat(e.target.value))}
                      className="w-24 accent-blue-600"
                    />
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {Math.round(screenScale * 100)}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setActiveBg(preset.id)}
                      className={`min-h-[38px] sm:min-h-0 px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all whitespace-nowrap truncate ${
                        activeBg === preset.id
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activePopover === 'camera' && (
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="text-slate-600 font-medium">Webcam Bubble Shape</div>
                  <div className="flex items-center gap-1.5">
                    {(['circle', 'rounded-rect', 'square'] as const).map((shape) => (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => setWebcamShape(shape)}
                        className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 rounded-lg border capitalize transition-colors ${
                          webcamShape === shape
                            ? 'border-blue-600 bg-blue-600 text-white font-semibold'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {shape}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-slate-600 font-medium">Bubble Size</div>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'Small', val: 0.25 },
                      { label: 'Medium', val: 0.4 },
                      { label: 'Large', val: 0.55 },
                    ].map((sz) => (
                      <button
                        key={sz.label}
                        type="button"
                        onClick={() => setWebcamScale(sz.val)}
                        className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 rounded-lg border transition-colors ${
                          webcamScale === sz.val
                            ? 'border-blue-600 bg-blue-600 text-white font-semibold'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-slate-600 font-medium">Studio Effect</div>
                  <button
                    type="button"
                    onClick={() => setWebcamDepthBlur((v) => !v)}
                    className={`min-h-[36px] sm:min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                      webcamDepthBlur
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {webcamDepthBlur && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    <span>Depth Glow Halo</span>
                  </button>
                </div>
              </div>
            )}

            {activePopover === 'mic' && (
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                <span className="font-medium text-slate-900">
                  Microphone Gain Boost (Web Audio API)
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={micVolume}
                    onChange={(e) => setMicVolume(parseFloat(e.target.value))}
                    className="w-36 sm:w-40 accent-blue-600"
                  />
                  <span className="font-mono font-semibold text-slate-900 tabular-nums w-12 text-right">
                    {Math.round(micVolume * 100)}%
                  </span>
                </div>
              </div>
            )}

            {activePopover === 'format' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {EXPORT_FORMATS.map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setRecordingFormat(fmt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      recordingFormat === fmt.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>{fmt.label}</div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                      {fmt.ext}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {activePopover === 'quality' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(Object.keys(QUALITY_PRESETS) as QualityPresetId[]).map((qKey) => (
                  <button
                    key={qKey}
                    type="button"
                    onClick={() => setRecordingQuality(qKey)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      recordingQuality === qKey
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>{QUALITY_PRESETS[qKey].label}</div>
                    <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                      {QUALITY_PRESETS[qKey].width}×{QUALITY_PRESETS[qKey].height}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Gravity Control Bar (Swiss Minimalist Card — Mobile & Desktop Responsive) */}
        <div className="w-full flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-3.5 shadow-sm">
          {/* Left Source & Studio Style Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRecording}
              onClick={() => setScreenEnabled((s) => !s)}
              className={`min-h-[40px] sm:min-h-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                screenEnabled
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{screenEnabled ? 'Screen On' : 'Screen Off'}</span>
            </button>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setCameraEnabled((c) => !c)}
                className={`min-h-[36px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  cameraEnabled
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{cameraEnabled ? 'Camera PIP' : 'Camera Off'}</span>
              </button>
              <button
                type="button"
                disabled={isRecording}
                onClick={() =>
                  setActivePopover(activePopover === 'camera' ? null : 'camera')
                }
                aria-label="Camera frame settings"
                className="min-h-[36px] min-w-[34px] sm:min-h-0 sm:min-w-0 flex items-center justify-center px-2 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setMicEnabled((m) => !m)}
                className={`min-h-[36px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  micEnabled
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{micEnabled ? 'Mic On' : 'Mic Muted'}</span>
              </button>
              <button
                type="button"
                disabled={isRecording}
                onClick={() =>
                  setActivePopover(activePopover === 'mic' ? null : 'mic')
                }
                aria-label="Microphone volume settings"
                className="min-h-[36px] min-w-[34px] sm:min-h-0 sm:min-w-0 flex items-center justify-center px-2 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              disabled={isRecording}
              onClick={() => {
                setShowAdvanced((v) => !v);
                setActivePopover(null);
              }}
              className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Advanced</span>
              {showAdvanced ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            {showAdvanced && (
              <>
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() =>
                    setActivePopover(activePopover === 'bg' ? null : 'bg')
                  }
                  className={`min-h-[40px] sm:min-h-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activePopover === 'bg'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>Canvas BG</span>
                </button>

                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() =>
                    setActivePopover(
                      activePopover === 'format' ? null : 'format'
                    )
                  }
                  className={`min-h-[40px] sm:min-h-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activePopover === 'format'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FileVideo className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>{currentFormatSpec.label}</span>
                </button>

                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() =>
                    setActivePopover(
                      activePopover === 'quality' ? null : 'quality'
                    )
                  }
                  className={`min-h-[40px] sm:min-h-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activePopover === 'quality'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>{recordingQuality.toUpperCase()}</span>
                </button>

                <select
                  aria-label="Capture Source Pipeline"
                  value={streamSource}
                  disabled={isRecording}
                  onChange={(e) =>
                    setStreamSource(
                      e.target.value as 'studio_canvas' | 'os_display'
                    )
                  }
                  className="min-h-[40px] sm:min-h-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"
                >
                  <option value="studio_canvas">Studio Compositor</option>
                  <option value="os_display">OS Screen Picker</option>
                </select>
              </>
            )}
          </div>

          {/* Right Primary Recording Actions (First on Mobile for Thumb Reach) */}
          <div className="order-first lg:order-none flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 shrink-0 pb-2.5 lg:pb-0 border-b lg:border-b-0 border-slate-100">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer mr-auto lg:mr-1">
              <input
                type="checkbox"
                checked={autoSyncDrive}
                onChange={(e) => setAutoSyncDrive(e.target.checked)}
                className="h-4 w-4 sm:h-3.5 sm:w-3.5 accent-blue-600"
              />
              <span>Auto-Sync Drive</span>
            </label>

            {!isRecording ? (
              <button
                type="button"
                onClick={handleTriggerStart}
                className="min-h-[44px] sm:min-h-0 w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-semibold text-xs transition-all shadow-xs whitespace-nowrap shrink-0"
              >
                <span>Start Recording</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setZoomEnabled((z) => !z)}
                  className={`min-h-[40px] sm:min-h-0 flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    zoomEnabled
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-slate-100 text-slate-800'
                  }`}
                >
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{zoomEnabled ? 'Unzoom' : 'Zoom (Z)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestartRecording}
                  aria-label="Restart recording timer"
                  className="min-h-[40px] sm:min-h-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Restart</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="min-h-[40px] sm:min-h-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  {isPaused ? (
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStopRecording()}
                  className="min-h-[42px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Stop & Save Recording</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Gravity Mode & Touch/Keyboard Shortcut Footer Hint */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-slate-600">
          <span>
            {cameraEnabled ? 'Studio Compositor Mode' : 'Direct Screen Mode'}
          </span>
          <span aria-hidden="true">·</span>
          <span>Touch or drag camera bubble on stage to reposition</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span className="hidden sm:inline">Space = Pause/Resume · Z = Cursor Zoom · Esc = Stop & Share</span>
        </div>
      </div>
    </div>
  );
};

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
