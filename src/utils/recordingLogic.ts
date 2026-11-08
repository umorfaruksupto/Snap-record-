export type CaptureMode = 'screen_cam' | 'screen_only' | 'cam_only';
export type WebcamShape = 'circle' | 'rounded-rect' | 'square';
export type RecordingFormatId = 'webm-vp9' | 'webm-vp8' | 'mp4-h264' | 'mkv-vp9';
export type QualityPresetId = '720p' | '1080p' | '2k' | '4k';

export interface BackgroundPreset {
  id: string;
  name: string;
  colors: [string, string, string] | null;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'none', name: 'None (Edge-to-Edge)', colors: null },
  { id: 'midnight', name: 'Midnight Dream', colors: ['#0f172a', '#1e1b4b', '#312e81'] },
  { id: 'aurora', name: 'Aurora Flare', colors: ['#064e3b', '#065f46', '#0891b2'] },
  { id: 'sunset', name: 'Sunset Vibe', colors: ['#7c2d12', '#991b1b', '#f59e0b'] },
  { id: 'cyber', name: 'Cyber Glow', colors: ['#4c1d95', '#701a75', '#2563eb'] },
  { id: 'rose', name: 'Dusty Rose', colors: ['#881337', '#9f1239', '#fb7185'] },
  { id: 'ocean', name: 'Deep Ocean', colors: ['#1e3a8a', '#1d4ed8', '#0ea5e9'] },
  { id: 'mesh', name: 'Mesh Palette', colors: ['#4338ca', '#db2777', '#f59e0b'] },
];

export interface ExportFormatSpec {
  id: RecordingFormatId;
  label: string;
  description: string;
  mimeType: string;
  ext: '.webm' | '.mp4' | '.mkv';
}

export const EXPORT_FORMATS: ExportFormatSpec[] = [
  {
    id: 'webm-vp9',
    label: 'WebM VP9',
    description: 'VP9 — high compression, ideal for Chrome & FFmpeg MP4 conversion',
    mimeType: 'video/webm;codecs=vp9,opus',
    ext: '.webm',
  },
  {
    id: 'webm-vp8',
    label: 'WebM VP8',
    description: 'VP8 — fast real-time encoding, low CPU usage',
    mimeType: 'video/webm;codecs=vp8,opus',
    ext: '.webm',
  },
  {
    id: 'mp4-h264',
    label: 'MP4 H.264',
    description: 'H.264 — hardware accelerated, universal compatibility',
    mimeType: 'video/mp4',
    ext: '.mp4',
  },
  {
    id: 'mkv-vp9',
    label: 'MKV',
    description: 'Matroska VP9 — open container format',
    mimeType: 'video/x-matroska',
    ext: '.mkv',
  },
];

export const QUALITY_PRESETS: Record<
  QualityPresetId,
  { label: string; width: number; height: number; bitrate: number }
> = {
  '720p': { label: '720p HD', width: 1280, height: 720, bitrate: 4_000_000 },
  '1080p': { label: '1080p Full HD', width: 1920, height: 1080, bitrate: 8_000_000 },
  '2k': { label: '2K QHD (1440p)', width: 2560, height: 1440, bitrate: 16_000_000 },
  '4k': { label: '4K Ultra HD', width: 3840, height: 2160, bitrate: 28_000_000 },
};

export interface RecordingComment {
  id: string;
  author: string;
  timestampSec: number;
  text: string;
  createdAt: string;
}

export interface RecordingItem {
  id: string;
  title: string;
  description: string;
  durationSec: number;
  sizeBytes: number;
  createdAt: string;
  captureMode: CaptureMode;
  views: number;
  thumbnailUrl: string;
  videoBlobUrl?: string;
  mp4BlobUrl?: string;
  containerFormat: 'webm' | 'mp4';
  mp4ConvertedAt?: string;
  driveSynced: boolean;
  driveFileId?: string;
  driveWebViewLink?: string;
  shareAccess: 'anyoneWithLink' | 'restricted' | 'workspace';
  resolution: '720p 60fps' | '1080p 60fps' | '1440p 60fps' | '4K 60fps';
  source: 'chrome_extension' | 'web_studio';
  backgroundPreset?: string;
  trimStartSec?: number;
  trimEndSec?: number;
  reactions: {
    fire: number;
    thumbsUp: number;
    idea: number;
    target: number;
  };
  comments: RecordingComment[];
  transcript: string;
}

export function formatDuration(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function parseTimestampInput(input: string): number | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }
  const parts = raw.split(':');
  if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);
    if (secs >= 60) return null;
    return mins * 60 + secs;
  }
  return null;
}

export function validateTrimRange(
  startSec: number,
  endSec: number,
  maxDurationSec: number
): {
  valid: boolean;
  error?: string;
  trimmedDurationSec: number;
  ratio: number;
} {
  const safeMax = Math.max(1, Math.floor(maxDurationSec));
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    return {
      valid: false,
      error: 'Start and end timestamps must be valid numbers.',
      trimmedDurationSec: 0,
      ratio: 0,
    };
  }
  const s = Math.floor(startSec);
  const e = Math.floor(endSec);
  if (s < 0) {
    return {
      valid: false,
      error: 'Start timestamp cannot be negative.',
      trimmedDurationSec: 0,
      ratio: 0,
    };
  }
  if (e > safeMax) {
    return {
      valid: false,
      error: `End timestamp cannot exceed recording duration (${formatDuration(safeMax)}).`,
      trimmedDurationSec: 0,
      ratio: 0,
    };
  }
  if (s >= e) {
    return {
      valid: false,
      error: 'Start timestamp must be earlier than end timestamp.',
      trimmedDurationSec: 0,
      ratio: 0,
    };
  }
  const trimmedDurationSec = e - s;
  return {
    valid: true,
    trimmedDurationSec,
    ratio: Number((trimmedDurationSec / safeMax).toFixed(4)),
  };
}

export interface TranscriptSegment {
  id: string;
  timestampSec: number;
  timestampFormatted: string;
  text: string;
}

export interface HighlightToken {
  text: string;
  isMatch: boolean;
}

export interface EvaluatedTranscriptSegment extends TranscriptSegment {
  matchesQuery: boolean;
  matchCount: number;
  tokens: HighlightToken[];
}

export function parseTranscriptSegments(transcript: string): TranscriptSegment[] {
  const raw = (transcript || '').trim();
  if (!raw) return [];

  const regex = /(\d{2}:\d{2})\s+([\s\S]*?)(?=(?:\s+\d{2}:\d{2}\s+)|$)/g;
  const segments: TranscriptSegment[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(raw)) !== null) {
    const timeStr = match[1];
    const bodyText = match[2].trim();
    const parsedSec = parseTimestampInput(timeStr) ?? 0;
    segments.push({
      id: `seg-${index}-${parsedSec}`,
      timestampSec: parsedSec,
      timestampFormatted: formatDuration(parsedSec),
      text: bodyText,
    });
    index += 1;
  }

  if (segments.length === 0) {
    return [
      {
        id: 'seg-0-0',
        timestampSec: 0,
        timestampFormatted: '00:00',
        text: raw,
      },
    ];
  }

  return segments;
}

export function tokenizeHighlightText(
  text: string,
  query: string
): { tokens: HighlightToken[]; matchCount: number } {
  const trimmedQuery = (query || '').trim();
  if (!trimmedQuery) {
    return { tokens: [{ text, isMatch: false }], matchCount: 0 };
  }

  const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const splitRegex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(splitRegex);
  const tokens: HighlightToken[] = [];
  let matchCount = 0;

  for (const part of parts) {
    if (!part) continue;
    const isMatch = part.toLowerCase() === trimmedQuery.toLowerCase();
    if (isMatch) matchCount += 1;
    tokens.push({ text: part, isMatch });
  }

  return { tokens, matchCount };
}

export function searchTranscriptSegments(
  transcript: string,
  query: string
): {
  segments: EvaluatedTranscriptSegment[];
  totalMatches: number;
  matchedSegmentsCount: number;
} {
  const baseSegments = parseTranscriptSegments(transcript);
  let totalMatches = 0;
  let matchedSegmentsCount = 0;

  const evaluated = baseSegments.map((seg) => {
    const { tokens, matchCount } = tokenizeHighlightText(seg.text, query);
    const matchesQuery = matchCount > 0;
    if (matchesQuery) {
      totalMatches += matchCount;
      matchedSegmentsCount += 1;
    }
    return {
      ...seg,
      matchesQuery,
      matchCount,
      tokens,
    };
  });

  return {
    segments: evaluated,
    totalMatches,
    matchedSegmentsCount,
  };
}

export function applyTrimToRecording(
  item: RecordingItem,
  startSec: number,
  endSec: number
): RecordingItem {
  const check = validateTrimRange(startSec, endSec, item.durationSec);
  if (!check.valid) {
    return item;
  }
  const nextSizeBytes = Math.max(
    1024 * 100,
    Math.round(item.sizeBytes * check.ratio)
  );
  return {
    ...item,
    durationSec: check.trimmedDurationSec,
    sizeBytes: nextSizeBytes,
    trimStartSec: Math.floor(startSec),
    trimEndSec: Math.floor(endSec),
  };
}

export function formatRecordingTimer(
  elapsedSeconds: number,
  maxDurationSeconds: number | null = null
): {
  elapsedFormatted: string;
  remainingFormatted: string | null;
  progressPercent: number;
  isNearLimit: boolean;
} {
  const safeElapsed = Math.max(0, Math.floor(elapsedSeconds));
  const hrs = Math.floor(safeElapsed / 3600);
  const mins = Math.floor((safeElapsed % 3600) / 60);
  const secs = safeElapsed % 60;

  const elapsedFormatted =
    hrs > 0
      ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (!maxDurationSeconds || maxDurationSeconds <= 0) {
    return {
      elapsedFormatted,
      remainingFormatted: null,
      progressPercent: 0,
      isNearLimit: false,
    };
  }

  const remaining = Math.max(0, maxDurationSeconds - safeElapsed);
  const progressPercent = Math.min(
    100,
    Math.round((safeElapsed / maxDurationSeconds) * 100)
  );
  return {
    elapsedFormatted,
    remainingFormatted: formatDuration(remaining),
    progressPercent,
    isNearLimit: remaining <= 10 && remaining > 0,
  };
}

export function toMp4Filename(titleOrFilename: string): string {
  const clean = (titleOrFilename || 'ScapRecord-Video')
    .trim()
    .replace(/\.(webm|mkv|mp4)$/i, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${clean || 'ScapRecord-Video'}.mp4`;
}

export function buildFfmpegMp4Args(
  inputName: string,
  outputName: string,
  preset: 'ultrafast' | 'fast' | 'medium' = 'ultrafast',
  crf = 23
): string[] {
  return [
    '-i',
    inputName,
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputName,
  ];
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0.0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function validateWorkspaceCredentials(
  email: string,
  password?: string,
  isSignup = false,
  fullName?: string
): { valid: boolean; error?: string } {
  const trimmedEmail = (email || '').trim();
  if (!trimmedEmail) {
    return { valid: false, error: 'Email address is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return {
      valid: false,
      error: 'Please enter a valid email address (e.g. alex@scaprecord.site).',
    };
  }
  if (!password || password.trim().length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }
  if (isSignup && (!fullName || fullName.trim().length < 2)) {
    return {
      valid: false,
      error: 'Full name is required to create a ScapRecord account.',
    };
  }
  return { valid: true };
}

export function filterAndSortRecordings(
  items: RecordingItem[],
  query: string,
  modeFilter: 'all' | CaptureMode | 'drive_synced' | 'mp4_only' | 'webm_only',
  sortBy: 'newest' | 'views' | 'size'
): RecordingItem[] {
  const normalizedQuery = (query || '').trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (modeFilter === 'drive_synced' && !item.driveSynced) return false;
    if (modeFilter === 'mp4_only' && item.containerFormat !== 'mp4') return false;
    if (modeFilter === 'webm_only' && item.containerFormat !== 'webm') return false;
    if (
      modeFilter !== 'all' &&
      modeFilter !== 'drive_synced' &&
      modeFilter !== 'mp4_only' &&
      modeFilter !== 'webm_only' &&
      item.captureMode !== modeFilter
    ) {
      return false;
    }

    if (!normalizedQuery) return true;
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery) ||
      item.transcript.toLowerCase().includes(normalizedQuery)
    );
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'views') return b.views - a.views;
    if (sortBy === 'size') return b.sizeBytes - a.sizeBytes;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function buildDriveShareUrl(
  driveFileId: string,
  domain = 'https://scaprecord.site'
): { driveUrl: string; scapShareUrl: string } {
  const cleanId = (driveFileId || 'scap-default').trim();
  return {
    driveUrl: `https://drive.google.com/file/d/${cleanId}/view?usp=sharing`,
    scapShareUrl: `${domain.replace(/\/$/, '')}/v/${cleanId}`,
  };
}

export function calculateStorageUsage(items: RecordingItem[]): {
  syncedCount: number;
  totalBytes: number;
  formattedTotal: string;
  quotaPercent: number;
} {
  const syncedItems = items.filter((i) => i.driveSynced);
  const totalBytes = syncedItems.reduce((acc, item) => acc + item.sizeBytes, 0);
  const fifteenGb = 15 * 1024 * 1024 * 1024;
  const quotaPercent = Math.min(100, Number(((totalBytes / fifteenGb) * 100).toFixed(2)));
  return {
    syncedCount: syncedItems.length,
    totalBytes,
    formattedTotal: formatFileSize(totalBytes),
    quotaPercent,
  };
}

export function computeExplodedPartOffset(
  basePosition: [number, number, number],
  explodeDirection: [number, number, number],
  explodeFactor: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, explodeFactor));
  return [
    Number((basePosition[0] + explodeDirection[0] * clamped).toFixed(4)),
    Number((basePosition[1] + explodeDirection[1] * clamped).toFixed(4)),
    Number((basePosition[2] + explodeDirection[2] * clamped).toFixed(4)),
  ];
}
