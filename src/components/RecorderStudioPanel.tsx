import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Monitor,
  Camera,
  Mic,
  Square,
  Pause,
  Play,
  Timer,
  Share2,
  Check,
  FileVideo,
  FolderClock,
  RotateCcw,
  AppWindow,
  Globe,
  ScreenShare,
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

export type DisplaySurfacePreference = 'monitor' | 'window' | 'browser';

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
  const [screenEnabled, setScreenEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [displaySurfacePref, setDisplaySurfacePref] =
    useState<DisplaySurfacePreference>('monitor');

  const [hasLiveScreenStream, setHasLiveScreenStream] = useState(false);
  const [activeSurfaceLabel, setActiveSurfaceLabel] = useState<string | null>(null);
  const [captureStatusNote, setCaptureStatusNote] = useState<string | null>(null);

  const [activeBg, setActiveBg] = useState<string>('ocean');
  const [webcamShape] = useState<WebcamShape>('circle');
  const [recordingQuality, setRecordingQuality] = useState<QualityPresetId>('1080p');
  const [recordingFormat, setRecordingFormat] =
    useState<RecordingFormatId>('webm-vp9');

  const [countdownSetting, setCountdownSetting] = useState<0 | 3 | 5>(3);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [maxDurationSec, setMaxDurationSec] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const [clipTitle, setClipTitle] = useState('');
  const [autoSyncDrive, setAutoSyncDrive] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastCompletedClip, setLastCompletedClip] =
    useState<RecordingItem | null>(null);
  const [copiedInstantLink, setCopiedInstantLink] = useState(false);

  const webcamPosRef = useRef({ x: 610, y: 275 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const camVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const countdownIntervalRef = useRef<number | null>(null);

  const timerStats = formatRecordingTimer(elapsedSec, maxDurationSec);
  const currentQualitySpec = QUALITY_PRESETS[recordingQuality];
  const currentFormatSpec =
    EXPORT_FORMATS.find((f) => f.id === recordingFormat) || EXPORT_FORMATS[0];

  const surfaceFriendlyName =
    displaySurfacePref === 'monitor'
      ? 'Entire Screen'
      : displaySurfacePref === 'window'
        ? 'Application Window'
        : 'Browser Tab';

  // Clean up active media streams on unmount
  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Request or stop webcam/mic preview when toggled
  useEffect(() => {
    let cancelled = false;
    async function syncCameraStream() {
      if (!cameraEnabled && !micEnabled) {
        camStreamRef.current?.getTracks().forEach((t) => t.stop());
        camStreamRef.current = null;
        if (camVideoRef.current) {
          camVideoRef.current.srcObject = null;
        }
        return;
      }

      if (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      ) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: cameraEnabled ? { width: 320, height: 320 } : false,
            audio: micEnabled,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          camStreamRef.current?.getTracks().forEach((t) => t.stop());
          camStreamRef.current = stream;
          if (camVideoRef.current && cameraEnabled) {
            camVideoRef.current.srcObject = stream;
            await camVideoRef.current.play().catch(() => {});
          }
        } catch {
          // Camera/mic permission declined or unavailable in headless environment; avatar fallback stays active
        }
      }
    }
    void syncCameraStream();
    return () => {
      cancelled = true;
    };
  }, [cameraEnabled, micEnabled]);

  // Prompt native browser Screen / Window / Tab picker via getDisplayMedia
  const requestScreenShareStream = useCallback(async (): Promise<MediaStream | null> => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== 'function'
    ) {
      setCaptureStatusNote(
        'Screen Share API is not supported in this browser context. Using studio canvas capture.'
      );
      return null;
    }

    try {
      setCaptureStatusNote(null);
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: displaySurfacePref,
          width: { ideal: currentQualitySpec.width },
          height: { ideal: currentQualitySpec.height },
          frameRate: { ideal: 60 },
        } as MediaTrackConstraints,
        audio: true,
      });

      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = displayStream;

      const videoTrack = displayStream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings() as
        | (MediaTrackSettings & { displaySurface?: string })
        | undefined;

      const detectedSurface =
        settings?.displaySurface === 'monitor'
          ? 'Entire Screen'
          : settings?.displaySurface === 'window'
            ? 'Application Window'
            : settings?.displaySurface === 'browser'
              ? 'Browser Tab'
              : videoTrack?.label || surfaceFriendlyName;

      setHasLiveScreenStream(true);
      setActiveSurfaceLabel(detectedSurface);
      setScreenEnabled(true);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = displayStream;
        await screenVideoRef.current.play().catch(() => {});
      }

      if (videoTrack) {
        videoTrack.onended = () => {
          setHasLiveScreenStream(false);
          setActiveSurfaceLabel(null);
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
          }
        };
      }

      return displayStream;
    } catch {
      setCaptureStatusNote(
        'Screen picker closed or blocked by iframe permissions — recording studio stage directly.'
      );
      return null;
    }
  }, [displaySurfacePref, currentQualitySpec.width, currentQualitySpec.height, surfaceFriendlyName]);

  // Clean 60fps Studio Compositor Canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;

    const drawFrame = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.save();

      // 1. Studio Wallpaper Fill
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

      // 2. Screen Surface Layer (Live Entire Screen / Window / Tab or Studio Stage)
      if (screenEnabled) {
        const scale = activeBg === 'none' ? 1.0 : 0.88;
        const sw = Math.round(w * scale);
        const sh = Math.round(h * scale);
        const sx = Math.round((w - sw) / 2);
        const sy = Math.round((h - sh) / 2);
        const radius = scale < 1.0 ? 14 : 0;

        if (scale < 1.0) {
          drawRoundedRectPath(ctx, sx - 1, sy - 1, sw + 2, sh + 2, radius + 1);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.fill();
        }

        drawRoundedRectPath(ctx, sx, sy, sw, sh, radius);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        const screenVid = screenVideoRef.current;
        if (screenVid && screenVid.readyState >= 2 && hasLiveScreenStream) {
          ctx.save();
          drawRoundedRectPath(ctx, sx, sy, sw, sh, radius);
          ctx.clip();
          ctx.drawImage(screenVid, sx, sy, sw, sh);
          ctx.restore();
        } else {
          // Minimal Window Header
          drawRoundedRectPath(ctx, sx, sy, sw, 36, radius);
          ctx.fillStyle = '#1e293b';
          ctx.fill();
          ctx.fillRect(sx, sy + 18, sw, 18);

          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(sx + 18, sy + 18, 4.5, 0, Math.PI * 2);
          ctx.arc(sx + 32, sy + 18, 4.5, 0, Math.PI * 2);
          ctx.arc(sx + 46, sy + 18, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Clean Centered Stage Label
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f8fafc';
          ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(
            clipTitle.trim() ||
              (isRecording
                ? `Recording ${activeSurfaceLabel || surfaceFriendlyName}`
                : `Ready to Record: ${surfaceFriendlyName}`),
            w / 2,
            h / 2 - 8
          );

          ctx.fillStyle = '#94a3b8';
          ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(
            isRecording
              ? `${timerStats.elapsedFormatted} · ${currentQualitySpec.label}`
              : `Click "Select Screen / Window" or "Start Recording" (${currentQualitySpec.width} × ${currentQualitySpec.height})`,
            w / 2,
            h / 2 + 18
          );
          ctx.textAlign = 'left';
        }
      }

      // 3. Draggable Camera Bubble PIP
      if (cameraEnabled) {
        const size = 136;
        const wx = webcamPosRef.current.x;
        const wy = webcamPosRef.current.y;
        const centerX = wx + size / 2;
        const centerY = wy + size / 2;

        ctx.beginPath();
        if (webcamShape === 'circle') {
          ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
        } else {
          drawRoundedRectPath(ctx, wx, wy, size, size, 18);
        }
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isRecording ? '#ef4444' : '#e2e8f0';
        ctx.stroke();

        const camVid = camVideoRef.current;
        if (camVid && camVid.readyState >= 2) {
          ctx.save();
          ctx.beginPath();
          if (webcamShape === 'circle') {
            ctx.arc(centerX, centerY, size / 2 - 2, 0, Math.PI * 2);
          } else {
            drawRoundedRectPath(ctx, wx + 2, wy + 2, size - 4, size - 4, 16);
          }
          ctx.clip();
          ctx.drawImage(camVid, wx, wy, size, size);
          ctx.restore();
        } else {
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(centerX, centerY - 12, 18, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(centerX, centerY + 36, 32, Math.PI, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      if ((isRecording && !isPaused) || hasLiveScreenStream) {
        animId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
    return () => cancelAnimationFrame(animId);
  }, [
    activeBg,
    screenEnabled,
    cameraEnabled,
    micEnabled,
    webcamShape,
    recordingQuality,
    recordingFormat,
    clipTitle,
    isRecording,
    isPaused,
    hasLiveScreenStream,
    activeSurfaceLabel,
    surfaceFriendlyName,
    timerStats.elapsedFormatted,
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
    if (!isDraggingRef.current || !previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleX = previewCanvasRef.current.width / rect.width;
    const scaleY = previewCanvasRef.current.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    webcamPosRef.current = {
      x: Math.max(
        16,
        Math.min(previewCanvasRef.current.width - 152, mx - dragOffsetRef.current.x)
      ),
      y: Math.max(
        16,
        Math.min(previewCanvasRef.current.height - 152, my - dragOffsetRef.current.y)
      ),
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
    if (!isDraggingRef.current || !previewCanvasRef.current || e.touches.length === 0)
      return;
    const touch = e.touches[0];
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleX = previewCanvasRef.current.width / rect.width;
    const scaleY = previewCanvasRef.current.height / rect.height;
    const tx = (touch.clientX - rect.left) * scaleX;
    const ty = (touch.clientY - rect.top) * scaleY;

    webcamPosRef.current = {
      x: Math.max(
        16,
        Math.min(previewCanvasRef.current.width - 152, tx - dragOffsetRef.current.x)
      ),
      y: Math.max(
        16,
        Math.min(previewCanvasRef.current.height - 152, ty - dragOffsetRef.current.y)
      ),
    };
  };

  const handleCanvasTouchEnd = () => {
    isDraggingRef.current = false;
  };

  const beginActualCapture = async () => {
    setLastCompletedClip(null);
    recordedChunksRef.current = [];

    try {
      let compositeStream: MediaStream | null = null;
      if (
        previewCanvasRef.current &&
        typeof previewCanvasRef.current.captureStream === 'function'
      ) {
        compositeStream = previewCanvasRef.current.captureStream(30);
      }

      // Attach system audio track from display stream + mic audio track from userMedia stream
      if (compositeStream) {
        const audioTracks: MediaStreamTrack[] = [
          ...(screenStreamRef.current?.getAudioTracks() || []),
          ...(micEnabled ? camStreamRef.current?.getAudioTracks() || [] : []),
        ];
        audioTracks.forEach((track) => {
          try {
            compositeStream?.addTrack(track);
          } catch {
            // ignore duplicate track
          }
        });
      }

      if (compositeStream && typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(compositeStream);
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

  const handleTriggerStart = async () => {
    if (!screenEnabled && !cameraEnabled) {
      setScreenEnabled(true);
    }

    // If screen capture is enabled and no live screen stream is connected yet, prompt browser screen/window/tab picker first
    if (screenEnabled && !hasLiveScreenStream) {
      await requestScreenShareStream();
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
          void beginActualCapture();
        } else {
          setCountdownRemaining(count);
        }
      }, 950);
    } else {
      await beginActualCapture();
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
        : new Blob(['snaprecord-stream'], { type: blobType });

    const blobUrl =
      recordedChunksRef.current.length > 0
        ? URL.createObjectURL(blob)
        : undefined;

    // Capture real snapshot from the studio canvas
    let capturedThumb = '';
    if (previewCanvasRef.current) {
      try {
        capturedThumb = previewCanvasRef.current.toDataURL('image/jpeg', 0.85);
      } catch {
        capturedThumb = '';
      }
    }

    const newId = `snap-rec-${Date.now().toString().slice(-5)}`;
    const driveId = `1SnapDrive_${Date.now().toString(36)}`;
    const resolutionLabel =
      recordingQuality === '4k'
        ? '4K 60fps'
        : recordingQuality === '2k'
        ? '1440p 60fps'
        : recordingQuality === '720p'
        ? '720p 60fps'
        : '1080p 60fps';

    const titleText =
      clipTitle.trim() ||
      `${activeSurfaceLabel || surfaceFriendlyName} Recording (${new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })})`;

    const createdItem: RecordingItem = {
      id: newId,
      title: titleText,
      description: `Recorded (${activeSurfaceLabel || surfaceFriendlyName}) with SnapRecord Studio and synced to Google Drive.`,
      durationSec: finalDuration,
      sizeBytes: Math.max(1.8 * 1024 * 1024, finalDuration * 280 * 1024),
      createdAt: 'Just now',
      captureMode:
        screenEnabled && cameraEnabled
          ? 'screen_cam'
          : screenEnabled
          ? 'screen_only'
          : 'cam_only',
      views: 1,
      thumbnailUrl: capturedThumb,
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
      source: 'web_studio',
      reactions: { fire: 0, thumbsUp: 0, idea: 0, target: 0 },
      comments: [],
      transcript: `00:00 Recording started for "${titleText}". 00:04 ${activeSurfaceLabel || surfaceFriendlyName} captured at ${resolutionLabel}.`,
    };

    onRecordingComplete(createdItem, blob);
    setLastCompletedClip(createdItem);
    setClipTitle('');
  };

  const handleCopyInstantShare = (rec: RecordingItem) => {
    const links = buildDriveShareUrl(rec.driveFileId || rec.id);
    navigator.clipboard?.writeText(links.driveUrl).catch(() => {});
    setCopiedInstantLink(true);
    setTimeout(() => setCopiedInstantLink(false), 2000);
  };

  return (
    <div className="mx-auto max-w-[960px] flex flex-col gap-4">
      {/* Hidden video elements for live stream compositing */}
      <video ref={screenVideoRef} className="hidden" muted playsInline />
      <video ref={camVideoRef} className="hidden" muted playsInline />

      {/* Top Row: Screen Surface Mode Selector (Entire Screen / Window / Browser Tab) + Title & Timer */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
        {/* Surface Mode Tabs: Entire Screen | Application Window | Browser Tab */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 mr-1">
              Capture Source:
            </span>
            <button
              type="button"
              disabled={isRecording}
              onClick={() => setDisplaySurfacePref('monitor')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                displaySurfacePref === 'monitor'
                  ? 'bg-[#0F6FFF] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Entire Screen</span>
            </button>

            <button
              type="button"
              disabled={isRecording}
              onClick={() => setDisplaySurfacePref('window')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                displaySurfacePref === 'window'
                  ? 'bg-[#0F6FFF] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <AppWindow className="h-3.5 w-3.5" />
              <span>Window</span>
            </button>

            <button
              type="button"
              disabled={isRecording}
              onClick={() => setDisplaySurfacePref('browser')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                displaySurfacePref === 'browser'
                  ? 'bg-[#0F6FFF] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Browser Tab</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isRecording}
            onClick={() => void requestScreenShareStream()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#0F6FFF] text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <ScreenShare className="h-3.5 w-3.5" />
            <span>
              {hasLiveScreenStream
                ? `Change Source (${activeSurfaceLabel || surfaceFriendlyName})`
                : `Select ${surfaceFriendlyName}`}
            </span>
          </button>
        </div>

        {/* Title + Timer Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <label htmlFor="recorder-title-input" className="sr-only">
              Recording Title
            </label>
            <input
              id="recorder-title-input"
              type="text"
              value={clipTitle}
              onChange={(e) => setClipTitle(e.target.value)}
              placeholder="Recording title (optional)..."
              className="w-full min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
            <div
              data-testid="recording-timer-hud"
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
            >
              <Timer
                className={`h-3.5 w-3.5 shrink-0 ${
                  isRecording ? 'text-red-600' : 'text-blue-600'
                }`}
                aria-hidden="true"
              />
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {timerStats.elapsedFormatted}
              </span>

              <span className="text-slate-300" aria-hidden="true">
                |
              </span>

              <label htmlFor="timer-countdown-select" className="sr-only">
                Countdown
              </label>
              <select
                id="timer-countdown-select"
                value={countdownSetting}
                disabled={isRecording}
                onChange={(e) =>
                  setCountdownSetting(Number(e.target.value) as 0 | 3 | 5)
                }
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value={0}>0s delay</option>
                <option value={3}>3s countdown</option>
                <option value={5}>5s countdown</option>
              </select>

              <span className="text-slate-300" aria-hidden="true">
                |
              </span>

              <label htmlFor="timer-autostop-select" className="sr-only">
                Auto-stop timer
              </label>
              <select
                id="timer-autostop-select"
                value={maxDurationSec ?? 0}
                disabled={isRecording}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxDurationSec(val > 0 ? val : null);
                }}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value={0}>No limit</option>
                <option value={30}>30s max</option>
                <option value={120}>2m max</option>
                <option value={300}>5m max</option>
              </select>
            </div>

            {recordingsCount > 0 && (
              <button
                type="button"
                onClick={onOpenLibrary}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <FolderClock className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                <span>Library ({recordingsCount})</span>
              </button>
            )}
          </div>
        </div>

        {captureStatusNote && (
          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            {captureStatusNote}
          </div>
        )}
      </div>

      {/* Instant Share Ready Notification (Shows right after recording finishes) */}
      {lastCompletedClip && !isRecording && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold text-emerald-800">
              Recording saved · Ready to share via Google Drive
            </div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {lastCompletedClip.title}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyInstantShare(lastCompletedClip)}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              {copiedInstantLink ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Drive Link</span>
                </>
              )}
            </button>

            {lastCompletedClip.containerFormat === 'webm' && (
              <button
                type="button"
                onClick={() => onRequestConvertMp4(lastCompletedClip)}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 transition-colors whitespace-nowrap"
              >
                <FileVideo className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                <span>Convert to MP4</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLibrary}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap"
            >
              Open in Library
            </button>
          </div>
        </div>
      )}

      {/* 16:9 Studio Canvas Stage */}
      <div
        className={`relative w-full aspect-video rounded-xl overflow-hidden bg-slate-950 border transition-colors ${
          isRecording ? 'border-red-600 ring-2 ring-red-600/20' : 'border-slate-200'
        }`}
      >
        {countdownRemaining !== null && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75">
            <div className="gravity-countdown-number text-7xl sm:text-8xl font-bold text-white select-none tabular-nums">
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

        {isRecording && (
          <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
            <span>
              {isPaused
                ? `PAUSED · ${timerStats.elapsedFormatted}`
                : `REC · ${timerStats.elapsedFormatted}`}
            </span>
          </div>
        )}
      </div>

      {/* Minimal Bottom Studio Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isRecording}
            onClick={() => setScreenEnabled((s) => !s)}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              screenEnabled
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{screenEnabled ? 'Screen' : 'Screen Off'}</span>
          </button>

          <button
            type="button"
            disabled={isRecording}
            onClick={() => setCameraEnabled((c) => !c)}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              cameraEnabled
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{cameraEnabled ? 'Camera' : 'Camera Off'}</span>
          </button>

          <button
            type="button"
            disabled={isRecording}
            onClick={() => setMicEnabled((m) => !m)}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              micEnabled
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{micEnabled ? 'Mic' : 'Muted'}</span>
          </button>

          <label htmlFor="studio-bg-select" className="sr-only">
            Studio Frame Background
          </label>
          <select
            id="studio-bg-select"
            value={activeBg}
            disabled={isRecording}
            onChange={(e) => setActiveBg(e.target.value)}
            className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            {BACKGROUND_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>

          <label htmlFor="studio-quality-select" className="sr-only">
            Recording Quality
          </label>
          <select
            id="studio-quality-select"
            value={recordingQuality}
            disabled={isRecording}
            onChange={(e) =>
              setRecordingQuality(e.target.value as QualityPresetId)
            }
            className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="1080p">1080p HD</option>
            <option value="2k">1440p QHD</option>
            <option value="4k">4K UHD</option>
          </select>

          <label htmlFor="studio-format-select" className="sr-only">
            Export Format
          </label>
          <select
            id="studio-format-select"
            value={recordingFormat}
            disabled={isRecording}
            onChange={(e) =>
              setRecordingFormat(e.target.value as RecordingFormatId)
            }
            className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            {EXPORT_FORMATS.map((fmt) => (
              <option key={fmt.id} value={fmt.id}>
                {fmt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Right Primary Recording Action */}
        <div className="order-first md:order-none flex items-center justify-between md:justify-end gap-3 pb-2.5 md:pb-0 border-b md:border-b-0 border-slate-100 shrink-0">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={autoSyncDrive}
              onChange={(e) => setAutoSyncDrive(e.target.checked)}
              className="h-3.5 w-3.5 accent-blue-600 rounded"
            />
            <span>Auto-Sync Drive</span>
          </label>

          {!isRecording ? (
            <button
              type="button"
              onClick={() => void handleTriggerStart()}
              disabled={countdownRemaining !== null}
              className="min-h-[40px] px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              {countdownRemaining !== null
                ? `Starting in ${countdownRemaining}s...`
                : 'Start Recording'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-800 whitespace-nowrap"
              >
                {isPaused ? (
                  <>
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Pause</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRestartRecording}
                aria-label="Restart recording"
                className="min-h-[38px] inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleStopRecording()}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>Stop & Save</span>
              </button>
            </div>
          )}
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
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
