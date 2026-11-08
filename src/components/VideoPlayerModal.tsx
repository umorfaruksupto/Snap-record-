import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  Share2,
  Copy,
  Check,
  MessageSquare,
  Cloud,
  Trash2,
  ExternalLink,
  FileVideo,
  Download,
  Scissors,
  RotateCcw,
  Search,
  Flame,
  ThumbsUp,
  Lightbulb,
  Target,
} from 'lucide-react';
import {
  RecordingItem,
  formatDuration,
  parseTimestampInput,
  validateTrimRange,
  searchTranscriptSegments,
  formatFileSize,
  buildDriveShareUrl,
  toMp4Filename,
} from '../utils/recordingLogic';
import { triggerMp4Download } from '../services/mp4Converter';

interface VideoPlayerModalProps {
  recording: RecordingItem | null;
  onClose: () => void;
  onAddComment: (recordingId: string, text: string, timestampSec: number) => void;
  onReact: (recordingId: string, reactionKey: keyof RecordingItem['reactions']) => void;
  onSyncToDrive: (recording: RecordingItem) => void;
  onTrimRecording: (
    recordingId: string,
    startSec: number,
    endSec: number,
    andSyncToDrive?: boolean
  ) => void;
  onRequestDelete: (recording: RecordingItem) => void;
  onRequestConvertMp4: (recording: RecordingItem) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  recording,
  onClose,
  onAddComment,
  onReact,
  onSyncToDrive,
  onTrimRecording,
  onRequestDelete,
  onRequestConvertMp4,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [copiedLinkType, setCopiedLinkType] = useState<'drive' | 'scap' | 'trim_share' | null>(
    null
  );

  // Transcript Search & Timestamp Jump state
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const [onlyMatchedSegments, setOnlyMatchedSegments] = useState(false);
  const [jumpedSegmentNotice, setJumpedSegmentNotice] = useState<string | null>(null);

  // Trim state (start & end timestamps in seconds + formatted input fields)
  const [trimStartSec, setTrimStartSec] = useState<number>(0);
  const [trimEndSec, setTrimEndSec] = useState<number>(60);
  const [startInputText, setStartInputText] = useState<string>('00:00');
  const [endInputText, setEndInputText] = useState<string>('01:00');
  const [trimError, setTrimError] = useState<string | null>(null);
  const [trimStatusMessage, setTrimStatusMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!recording) return;
    setIsPlaying(false);
    setCurrentTime(0);
    setCommentText('');
    setCommentError('');
    setTranscriptQuery('');
    setOnlyMatchedSegments(false);
    setJumpedSegmentNotice(null);
    setTrimStartSec(0);
    setTrimEndSec(recording.durationSec);
    setStartInputText(formatDuration(0));
    setEndInputText(formatDuration(recording.durationSec));
    setTrimError(null);
    setTrimStatusMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording?.id]);

  useEffect(() => {
    if (!recording || recording.videoBlobUrl || !isPlaying) return;
    const interval = window.setInterval(() => {
      setCurrentTime((prev) => {
        const stopPoint = trimEndSec > trimStartSec ? trimEndSec : recording.durationSec;
        if (prev + playbackRate >= stopPoint) {
          setIsPlaying(false);
          return trimStartSec;
        }
        return prev + playbackRate;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, playbackRate, recording, trimStartSec, trimEndSec]);

  const transcriptSearch = useMemo(() => {
    if (!recording) {
      return { segments: [], totalMatches: 0, matchedSegmentsCount: 0 };
    }
    return searchTranscriptSegments(recording.transcript, transcriptQuery);
  }, [recording, transcriptQuery]);

  if (!recording) return null;

  const shareLinks = buildDriveShareUrl(recording.driveFileId || recording.id);
  const trimValidation = validateTrimRange(
    trimStartSec,
    trimEndSec,
    recording.durationSec
  );
  const estimatedTrimmedBytes = trimValidation.valid
    ? Math.max(1024 * 100, Math.round(recording.sizeBytes * trimValidation.ratio))
    : recording.sizeBytes;

  const visibleTranscriptSegments =
    transcriptQuery.trim() && onlyMatchedSegments
      ? transcriptSearch.segments.filter((s) => s.matchesQuery)
      : transcriptSearch.segments;

  const seekToTimestamp = (targetSec: number, fromTranscript = false) => {
    const clamped = Math.max(0, Math.min(recording.durationSec, targetSec));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    if (fromTranscript) {
      setJumpedSegmentNotice(`Jumped to ${formatDuration(clamped)}`);
      setTimeout(() => setJumpedSegmentNotice(null), 2000);
    }
  };

  const handleCopy = (text: string, type: 'drive' | 'scap' | 'trim_share') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2000);
  };

  const handleStartSliderChange = (nextStart: number) => {
    setTrimStartSec(nextStart);
    setStartInputText(formatDuration(nextStart));
    setTrimError(null);
    setTrimStatusMessage(null);
    if (nextStart < trimEndSec) {
      seekToTimestamp(nextStart);
    }
  };

  const handleEndSliderChange = (nextEnd: number) => {
    setTrimEndSec(nextEnd);
    setEndInputText(formatDuration(nextEnd));
    setTrimError(null);
    setTrimStatusMessage(null);
  };

  const handleStartTextChange = (raw: string) => {
    setStartInputText(raw);
    setTrimStatusMessage(null);
    const parsed = parseTimestampInput(raw);
    if (parsed === null) {
      setTrimError('Use MM:SS (e.g. 00:15) or seconds (e.g. 15).');
      return;
    }
    setTrimStartSec(parsed);
    const check = validateTrimRange(parsed, trimEndSec, recording.durationSec);
    setTrimError(check.valid ? null : check.error || null);
  };

  const handleEndTextChange = (raw: string) => {
    setEndInputText(raw);
    setTrimStatusMessage(null);
    const parsed = parseTimestampInput(raw);
    if (parsed === null) {
      setTrimError('Use MM:SS (e.g. 01:30) or seconds (e.g. 90).');
      return;
    }
    setTrimEndSec(parsed);
    const check = validateTrimRange(trimStartSec, parsed, recording.durationSec);
    setTrimError(check.valid ? null : check.error || null);
  };

  const handleApplyTrim = (andSyncToDrive = false, andCopyShare = false) => {
    const check = validateTrimRange(trimStartSec, trimEndSec, recording.durationSec);
    if (!check.valid) {
      setTrimError(check.error || 'Invalid trim range.');
      return;
    }
    const appliedStart = trimStartSec;
    const appliedEnd = trimEndSec;
    setTrimError(null);
    onTrimRecording(recording.id, appliedStart, appliedEnd, andSyncToDrive);

    setTrimStartSec(0);
    setTrimEndSec(check.trimmedDurationSec);
    setStartInputText(formatDuration(0));
    setEndInputText(formatDuration(check.trimmedDurationSec));
    setCurrentTime(0);

    if (andCopyShare) {
      handleCopy(shareLinks.scapShareUrl, 'trim_share');
      setTrimStatusMessage(
        `Trimmed clip (${formatDuration(appliedStart)} → ${formatDuration(
          appliedEnd
        )}) to ${formatDuration(check.trimmedDurationSec)} and copied share link!`
      );
    } else if (andSyncToDrive) {
      setTrimStatusMessage(
        `Trimmed clip (${formatDuration(appliedStart)} → ${formatDuration(
          appliedEnd
        )}) to ${formatDuration(check.trimmedDurationSec)} (${formatFileSize(
          estimatedTrimmedBytes
        )}) and synced to Google Drive!`
      );
    } else {
      setTrimStatusMessage(
        `Trim applied: ${formatDuration(appliedStart)} → ${formatDuration(
          appliedEnd
        )} (New length: ${formatDuration(check.trimmedDurationSec)})`
      );
    }
  };

  const handleResetTrim = () => {
    setTrimStartSec(0);
    setTrimEndSec(recording.durationSec);
    setStartInputText(formatDuration(0));
    setEndInputText(formatDuration(recording.durationSec));
    setTrimError(null);
    setTrimStatusMessage(null);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) {
      setCommentError('Please enter a comment before posting.');
      return;
    }
    setCommentError('');
    onAddComment(recording.id, commentText.trim(), Math.floor(currentTime));
    setCommentText('');
  };

  const togglePlay = () => {
    if (recording.videoBlobUrl && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        if (
          videoRef.current.currentTime < trimStartSec ||
          videoRef.current.currentTime >= trimEndSec
        ) {
          videoRef.current.currentTime = trimStartSec;
        }
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      if (!isPlaying && (currentTime < trimStartSec || currentTime >= trimEndSec)) {
        setCurrentTime(trimStartSec);
      }
      setIsPlaying((prev) => !prev);
    }
  };

  const startPercent =
    recording.durationSec > 0
      ? Math.min(100, Math.max(0, (trimStartSec / recording.durationSec) * 100))
      : 0;
  const endPercent =
    recording.durationSec > 0
      ? Math.min(100, Math.max(startPercent, (trimEndSec / recording.durationSec) * 100))
      : 100;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-2 sm:p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${recording.title}`}
    >
      <div className="w-full max-w-5xl max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl">
        {/* Sticky Top Bar (Mobile-Stacked & Desktop-Inline) */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 bg-white">
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-semibold text-slate-900 truncate">
                {recording.title}
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 tabular-nums">
                <span className="font-mono font-semibold text-blue-700">
                  {recording.containerFormat.toUpperCase()}
                </span>
                <span aria-hidden="true">·</span>
                <span>{recording.resolution}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDuration(recording.durationSec)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatFileSize(recording.sizeBytes)}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {recording.driveSynced ? 'Synced to Google Drive' : 'Local Draft'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close video player"
              className="sm:hidden min-h-[38px] min-w-[38px] flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {recording.containerFormat === 'mp4' && recording.mp4BlobUrl ? (
              <button
                type="button"
                onClick={() =>
                  triggerMp4Download(recording.mp4BlobUrl!, toMp4Filename(recording.title))
                }
                className="min-h-[38px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Download .MP4</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRequestConvertMp4(recording)}
                className="min-h-[38px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                <FileVideo className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                <span>Convert to MP4</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleCopy(shareLinks.scapShareUrl, 'scap')}
              className="min-h-[38px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedLinkType === 'scap' ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copied URL</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Share Link</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close video player"
              className="hidden sm:inline-flex p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable Main 2-Column Content */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left 7 Columns: Video Viewport + Trim Controls + Reactions */}
          <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col justify-between space-y-4 sm:space-y-5 bg-white">
            {/* Video Viewport */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-200 shadow-xs">
              {recording.videoBlobUrl ? (
                <video
                  ref={videoRef}
                  src={recording.mp4BlobUrl || recording.videoBlobUrl}
                  playsInline
                  className="h-full w-full object-contain"
                  onTimeUpdate={(e) => {
                    const t = e.currentTarget.currentTime;
                    setCurrentTime(t);
                    if (trimEndSec > trimStartSec && t >= trimEndSec) {
                      e.currentTarget.pause();
                      setIsPlaying(false);
                    }
                  }}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                <img
                  src={recording.thumbnailUrl}
                  alt={recording.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent flex flex-col justify-end p-2.5 sm:p-4">
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                    className="min-h-[36px] sm:min-h-0 flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                    ) : (
                      <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play Clip'}</span>
                    <span className="sm:hidden">{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>

                  <div className="flex-1 min-w-[60px]">
                    <input
                      type="range"
                      min={0}
                      max={recording.durationSec}
                      value={currentTime}
                      aria-label="Seek video timeline"
                      onChange={(e) => seekToTimestamp(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <span
                    data-testid="player-current-time"
                    className="font-mono text-[11px] sm:text-xs text-white font-medium tabular-nums whitespace-nowrap shrink-0"
                  >
                    {formatDuration(currentTime)} / {formatDuration(recording.durationSec)}
                  </span>

                  <select
                    aria-label="Playback speed"
                    value={playbackRate}
                    onChange={(e) => {
                      const rate = Number(e.target.value);
                      setPlaybackRate(rate);
                      if (videoRef.current) videoRef.current.playbackRate = rate;
                    }}
                    className="min-h-[32px] sm:min-h-0 bg-slate-900 border border-slate-700 text-white text-[11px] sm:text-xs rounded-md px-1.5 sm:px-2 py-1 font-mono shrink-0"
                  >
                    <option value={1}>1.0x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2.0x</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Simple Recording Trimmer UI */}
            <section
              aria-label="Trim recording timestamps"
              className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 space-y-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                  <h3 className="text-xs font-semibold text-slate-900">
                    Trim Recording Before Uploading or Sharing
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-600 tabular-nums">
                  <span>
                    Range:{' '}
                    <strong className="font-mono text-slate-900">
                      {formatDuration(trimStartSec)}
                    </strong>{' '}
                    →{' '}
                    <strong className="font-mono text-slate-900">
                      {formatDuration(trimEndSec)}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Length:{' '}
                    <strong className="font-mono text-blue-600">
                      {trimValidation.valid
                        ? formatDuration(trimValidation.trimmedDurationSec)
                        : 'Invalid'}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatFileSize(estimatedTrimmedBytes)}</span>
                </div>
              </div>

              {/* Visual Range Highlight Bar */}
              <div className="relative h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-blue-600 rounded-full"
                  style={{
                    left: `${startPercent}%`,
                    width: `${Math.max(2, endPercent - startPercent)}%`,
                  }}
                />
              </div>

              {/* Start & End Timestamp Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Start Timestamp */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="trim-start-input"
                      className="text-xs font-medium text-slate-700"
                    >
                      Start Timestamp
                    </label>
                    <button
                      type="button"
                      onClick={() => handleStartSliderChange(Math.floor(currentTime))}
                      className="text-[11px] font-semibold text-blue-600 hover:underline whitespace-nowrap shrink-0 py-0.5"
                    >
                      Use Current ({formatDuration(currentTime)})
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="trim-start-input"
                      type="text"
                      value={startInputText}
                      onChange={(e) => handleStartTextChange(e.target.value)}
                      placeholder="00:00"
                      className="w-20 min-h-[36px] sm:min-h-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                    />
                    <input
                      id="trim-start-slider"
                      type="range"
                      min={0}
                      max={Math.max(1, recording.durationSec - 1)}
                      value={Math.min(trimStartSec, Math.max(0, recording.durationSec - 1))}
                      aria-label="Trim start slider"
                      onChange={(e) => handleStartSliderChange(Number(e.target.value))}
                      className="flex-1 accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* End Timestamp */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="trim-end-input"
                      className="text-xs font-medium text-slate-700"
                    >
                      End Timestamp
                    </label>
                    <button
                      type="button"
                      onClick={() => handleEndSliderChange(Math.max(1, Math.floor(currentTime)))}
                      className="text-[11px] font-semibold text-blue-600 hover:underline whitespace-nowrap shrink-0 py-0.5"
                    >
                      Use Current ({formatDuration(currentTime)})
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="trim-end-input"
                      type="text"
                      value={endInputText}
                      onChange={(e) => handleEndTextChange(e.target.value)}
                      placeholder={formatDuration(recording.durationSec)}
                      className="w-20 min-h-[36px] sm:min-h-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                    />
                    <input
                      id="trim-end-slider"
                      type="range"
                      min={1}
                      max={recording.durationSec}
                      value={Math.min(trimEndSec, recording.durationSec)}
                      aria-label="Trim end slider"
                      onChange={(e) => handleEndSliderChange(Number(e.target.value))}
                      className="flex-1 accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {trimError && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {trimError}
                </p>
              )}

              {trimStatusMessage && (
                <p role="status" className="text-xs font-semibold text-emerald-700">
                  {trimStatusMessage}
                </p>
              )}

              {/* Trim Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetTrim}
                  className="min-h-[38px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleApplyTrim(false, false)}
                    className="min-h-[38px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-900 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Scissors className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                    <span>Apply Trim</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyTrim(true, false)}
                    className="min-h-[38px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Trim & Upload to Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyTrim(false, true)}
                    className="min-h-[38px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    {copiedLinkType === 'trim_share' ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Trim & Share</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* Reactions (Lucide SVG Icons per ui-ux-pro-max) & Google Drive Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onReact(recording.id, 'fire')}
                  aria-label={`React with fire (${recording.reactions.fire})`}
                  className="min-h-[38px] sm:min-h-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors tabular-nums whitespace-nowrap shrink-0"
                >
                  <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
                  <span>{recording.reactions.fire}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onReact(recording.id, 'thumbsUp')}
                  aria-label={`React with thumbs up (${recording.reactions.thumbsUp})`}
                  className="min-h-[38px] sm:min-h-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors tabular-nums whitespace-nowrap shrink-0"
                >
                  <ThumbsUp className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>{recording.reactions.thumbsUp}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onReact(recording.id, 'idea')}
                  aria-label={`React with lightbulb (${recording.reactions.idea})`}
                  className="min-h-[38px] sm:min-h-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors tabular-nums whitespace-nowrap shrink-0"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                  <span>{recording.reactions.idea}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onReact(recording.id, 'target')}
                  aria-label={`React with target (${recording.reactions.target})`}
                  className="min-h-[38px] sm:min-h-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors tabular-nums whitespace-nowrap shrink-0"
                >
                  <Target className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>{recording.reactions.target}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {recording.driveSynced ? (
                  <button
                    type="button"
                    onClick={() => handleCopy(shareLinks.driveUrl, 'drive')}
                    className="min-h-[38px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    {copiedLinkType === 'drive' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        <span>Drive Link Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copy Drive Link</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSyncToDrive(recording)}
                    className="min-h-[38px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Upload to Drive</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onRequestDelete(recording)}
                  aria-label={`Delete ${recording.title}`}
                  className="min-h-[38px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Interactive Searchable Transcript Viewer + Timecoded Comments + Drive Details */}
          <div className="lg:col-span-5 p-4 sm:p-6 flex flex-col justify-between space-y-4 sm:space-y-5 bg-slate-50/70">
            {/* Interactive Searchable & Highlightable Transcript Viewer */}
            <section aria-label="Interactive transcript viewer" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Interactive Transcript
                  </h3>
                  <p className="text-xs text-slate-600">
                    Search keywords to highlight matches and tap any timestamp to jump.
                  </p>
                </div>
                {jumpedSegmentNotice && (
                  <span
                    role="status"
                    className="font-mono text-xs font-semibold text-emerald-700 tabular-nums whitespace-nowrap shrink-0"
                  >
                    {jumpedSegmentNotice}
                  </span>
                )}
              </div>

              {/* Search Input Bar for Transcript */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search
                    className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <label htmlFor="transcript-search-input" className="sr-only">
                    Search within transcript
                  </label>
                  <input
                    id="transcript-search-input"
                    type="search"
                    value={transcriptQuery}
                    onChange={(e) => setTranscriptQuery(e.target.value)}
                    placeholder="Search transcript (e.g. Google Drive, 60fps, OAuth2)..."
                    className="w-full min-h-[40px] sm:min-h-0 rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {transcriptQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setOnlyMatchedSegments((prev) => !prev)}
                    className={`min-h-[40px] sm:min-h-0 px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      onlyMatchedSegments
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {onlyMatchedSegments ? 'Showing Matches' : 'Filter Matches'}
                  </button>
                )}
              </div>

              {transcriptQuery.trim() && (
                <div
                  role="status"
                  className="flex items-center justify-between text-xs text-slate-600 px-1 tabular-nums"
                >
                  <span>
                    Found{' '}
                    <strong className="text-blue-600 font-semibold">
                      {transcriptSearch.totalMatches}
                    </strong>{' '}
                    {transcriptSearch.totalMatches === 1 ? 'match' : 'matches'} in{' '}
                    <strong className="text-slate-900 font-semibold">
                      {transcriptSearch.matchedSegmentsCount}
                    </strong>{' '}
                    {transcriptSearch.matchedSegmentsCount === 1 ? 'segment' : 'segments'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTranscriptQuery('');
                      setOnlyMatchedSegments(false);
                    }}
                    className="text-blue-600 font-medium hover:underline py-1"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {/* Timestamped Segments List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {visibleTranscriptSegments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-600">
                    No transcript segments match &ldquo;{transcriptQuery}&rdquo;.
                  </div>
                ) : (
                  visibleTranscriptSegments.map((seg, idx) => {
                    const nextSeg = transcriptSearch.segments[idx + 1];
                    const isCurrentSegment =
                      currentTime >= seg.timestampSec &&
                      (!nextSeg || currentTime < nextSeg.timestampSec);

                    return (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => seekToTimestamp(seg.timestampSec, true)}
                        aria-label={`Jump to transcript segment at ${seg.timestampFormatted}`}
                        className={`w-full min-h-[44px] text-left rounded-lg border p-2.5 transition-colors flex items-start gap-2.5 ${
                          seg.matchesQuery
                            ? 'border-blue-400 bg-blue-50/70 hover:bg-blue-100/70'
                            : isCurrentSegment
                              ? 'border-slate-300 bg-slate-100'
                              : 'border-slate-200 bg-white hover:bg-slate-100/70'
                        }`}
                      >
                        <span className="font-mono text-xs font-semibold text-blue-600 tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                          {seg.timestampFormatted}
                        </span>
                        <span className="text-xs text-slate-800 leading-relaxed flex-1">
                          {seg.tokens.map((tok, tokenIdx) =>
                            tok.isMatch ? (
                              <mark
                                key={tokenIdx}
                                className="rounded bg-amber-200 px-1 py-0.5 font-semibold text-slate-900"
                              >
                                {tok.text}
                              </mark>
                            ) : (
                              <React.Fragment key={tokenIdx}>{tok.text}</React.Fragment>
                            )
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            {/* Google Drive Share Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2 text-slate-600">
                <span>Google Drive File</span>
                <span className="font-mono text-slate-900 font-medium truncate max-w-[170px]">
                  {recording.driveFileId || 'Local workspace'}
                </span>
              </div>
              {recording.trimStartSec !== undefined && recording.trimEndSec !== undefined && (
                <div className="flex items-center justify-between gap-2 text-slate-600">
                  <span>Trimmed Segment</span>
                  <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                    {formatDuration(recording.trimStartSec)} →{' '}
                    {formatDuration(recording.trimEndSec)}
                  </span>
                </div>
              )}
              <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-600 truncate max-w-[180px] sm:max-w-[200px]">
                  {shareLinks.driveUrl}
                </span>
                <a
                  href={shareLinks.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap shrink-0 py-1"
                >
                  <span>Open in Drive</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Timestamped Comments */}
            <div className="flex-1 flex flex-col min-h-0 pt-1 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>Comments ({recording.comments.length})</span>
                </h3>
                <span className="font-mono text-xs text-slate-600 tabular-nums">
                  At {formatDuration(currentTime)}
                </span>
              </div>

              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {recording.comments.length === 0 ? (
                  <p className="text-xs text-slate-600 py-3 text-center border border-dashed border-slate-300 bg-white rounded-lg">
                    No comments yet at {formatDuration(currentTime)}.
                  </p>
                ) : (
                  recording.comments.map((cmt) => (
                    <div
                      key={cmt.id}
                      className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-slate-600">
                        <strong className="font-semibold text-slate-900">{cmt.author}</strong>
                        <button
                          type="button"
                          onClick={() => seekToTimestamp(cmt.timestampSec, true)}
                          className="font-mono font-semibold text-blue-600 hover:underline tabular-nums py-0.5"
                        >
                          {formatDuration(cmt.timestampSec)}
                        </button>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{cmt.text}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCommentSubmit} className="mt-3 flex items-center gap-2">
                <label htmlFor="player-comment-input" className="sr-only">
                  Add a timestamped comment
                </label>
                <input
                  id="player-comment-input"
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={`Add comment at ${formatDuration(currentTime)}...`}
                  className="flex-1 min-h-[40px] sm:min-h-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[40px] sm:min-h-0 py-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                >
                  Post
                </button>
              </form>
              {commentError && <p className="mt-1 text-xs font-medium text-red-600">{commentError}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
