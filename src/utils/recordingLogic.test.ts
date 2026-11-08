import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  parseTimestampInput,
  validateTrimRange,
  applyTrimToRecording,
  parseTranscriptSegments,
  searchTranscriptSegments,
  formatRecordingTimer,
  toMp4Filename,
  buildFfmpegMp4Args,
  formatFileSize,
  validateWorkspaceCredentials,
  filterAndSortRecordings,
  buildDriveShareUrl,
  calculateStorageUsage,
  RecordingItem,
} from './recordingLogic';

const sampleRecordings: RecordingItem[] = [
  {
    id: 'rec-1',
    title: 'Microservices Auth Gateway Walkthrough',
    description: 'Explaining OAuth token forwarding and Google Drive multipart upload.',
    durationSec: 200,
    sizeBytes: 40 * 1024 * 1024,
    createdAt: '2026-11-07T10:00:00Z',
    captureMode: 'screen_cam',
    views: 128,
    thumbnailUrl: '/thumb1.jpg',
    containerFormat: 'webm',
    driveSynced: true,
    driveFileId: '1DriveFileIdAlpha99',
    shareAccess: 'anyoneWithLink',
    resolution: '1440p 60fps',
    source: 'chrome_extension',
    reactions: { fire: 12, thumbsUp: 8, idea: 4, target: 5 },
    comments: [],
    transcript: 'Today we walk through the ScapRecord Chrome extension architecture.',
  },
  {
    id: 'rec-2',
    title: 'Design System Token Audit',
    description: 'Reviewing contrast ratios and typography scale.',
    durationSec: 85,
    sizeBytes: 18 * 1024 * 1024,
    createdAt: '2026-11-07T12:30:00Z',
    captureMode: 'screen_only',
    views: 45,
    thumbnailUrl: '/thumb2.jpg',
    containerFormat: 'mp4',
    driveSynced: false,
    shareAccess: 'restricted',
    resolution: '1080p 60fps',
    source: 'web_studio',
    reactions: { fire: 3, thumbsUp: 5, idea: 1, target: 2 },
    comments: [],
    transcript: 'Checking the dark slate surface contrast and tabular numerals.',
  },
];

test('formatDuration formats seconds into MM:SS with zero padding', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(65), '01:05');
  assert.equal(formatDuration(194), '03:14');
});

test('parseTimestampInput parses MM:SS and integer seconds strings', () => {
  assert.equal(parseTimestampInput('01:30'), 90);
  assert.equal(parseTimestampInput('45'), 45);
  assert.equal(parseTimestampInput('02:75'), null);
  assert.equal(parseTimestampInput('invalid'), null);
});

test('validateTrimRange validates start and end bounds and calculates trimmed duration', () => {
  const valid = validateTrimRange(20, 120, 200);
  assert.equal(valid.valid, true);
  assert.equal(valid.trimmedDurationSec, 100);
  assert.equal(valid.ratio, 0.5);

  const inverted = validateTrimRange(150, 100, 200);
  assert.equal(inverted.valid, false);
  assert.ok(inverted.error?.includes('earlier'));

  const overflow = validateTrimRange(10, 250, 200);
  assert.equal(overflow.valid, false);
  assert.ok(overflow.error?.includes('exceed'));
});

test('applyTrimToRecording updates durationSec, sizeBytes, trimStartSec, and trimEndSec', () => {
  const trimmed = applyTrimToRecording(sampleRecordings[0], 50, 150);
  assert.equal(trimmed.durationSec, 100);
  assert.equal(trimmed.sizeBytes, 20 * 1024 * 1024);
  assert.equal(trimmed.trimStartSec, 50);
  assert.equal(trimmed.trimEndSec, 150);
});

test('parseTranscriptSegments extracts timestamped segments and searchTranscriptSegments highlights matches', () => {
  const raw =
    '00:00 Welcome to the ScapRecord walkthrough. 00:42 Here we inspect how the Chrome Extension captures streams. 01:28 Uploading to Google Drive with instant share permissions.';
  const segments = parseTranscriptSegments(raw);
  assert.equal(segments.length, 3);
  assert.equal(segments[1].timestampSec, 42);
  assert.equal(segments[2].timestampSec, 88);

  const searchResult = searchTranscriptSegments(raw, 'Google Drive');
  assert.equal(searchResult.totalMatches, 1);
  assert.equal(searchResult.matchedSegmentsCount, 1);
  assert.equal(searchResult.segments[2].matchesQuery, true);
  assert.equal(
    searchResult.segments[2].tokens.some((t) => t.isMatch && t.text === 'Google Drive'),
    true
  );
});

test('formatRecordingTimer computes elapsed, remaining, and near-limit warning accurately', () => {
  const unlimited = formatRecordingTimer(125, null);
  assert.equal(unlimited.elapsedFormatted, '02:05');
  assert.equal(unlimited.remainingFormatted, null);
  assert.equal(unlimited.isNearLimit, false);

  const limited = formatRecordingTimer(55, 60);
  assert.equal(limited.elapsedFormatted, '00:55');
  assert.equal(limited.remainingFormatted, '00:05');
  assert.equal(limited.progressPercent, 92);
  assert.equal(limited.isNearLimit, true);
});

test('toMp4Filename converts WebM or raw titles into clean .mp4 filenames', () => {
  assert.equal(toMp4Filename('Sprint Demo.webm'), 'Sprint-Demo.mp4');
  assert.equal(toMp4Filename('Cloud Architecture Walkthrough!'), 'Cloud-Architecture-Walkthrough.mp4');
});

test('buildFfmpegMp4Args generates valid H.264/AAC faststart CLI arguments', () => {
  const args = buildFfmpegMp4Args('input.webm', 'output.mp4', 'ultrafast', 23);
  assert.equal(args[0], '-i');
  assert.equal(args[1], 'input.webm');
  assert.equal(args.includes('libx264'), true);
  assert.equal(args.includes('+faststart'), true);
  assert.equal(args[args.length - 1], 'output.mp4');
});

test('formatFileSize formats bytes into MB and GB accurately', () => {
  assert.equal(formatFileSize(0), '0.0 MB');
  assert.equal(formatFileSize(40 * 1024 * 1024), '40.0 MB');
  assert.equal(formatFileSize(1.5 * 1024 * 1024 * 1024), '1.50 GB');
});

test('validateWorkspaceCredentials rejects empty or malformed inputs', () => {
  assert.equal(validateWorkspaceCredentials('', 'secret123').valid, false);
  assert.equal(validateWorkspaceCredentials('not-an-email', 'secret123').valid, false);
  assert.equal(validateWorkspaceCredentials('user@scaprecord.site', '123').valid, false);
  assert.equal(
    validateWorkspaceCredentials('user@scaprecord.site', 'secret123', true, '').valid,
    false
  );
  assert.equal(
    validateWorkspaceCredentials('user@scaprecord.site', 'secret123', true, 'Alex Rivera').valid,
    true
  );
});

test('filterAndSortRecordings filters by container format, mode, and query', () => {
  const mp4Only = filterAndSortRecordings(sampleRecordings, '', 'mp4_only', 'newest');
  assert.equal(mp4Only.length, 1);
  assert.equal(mp4Only[0].id, 'rec-2');

  const webmOnly = filterAndSortRecordings(sampleRecordings, '', 'webm_only', 'newest');
  assert.equal(webmOnly.length, 1);
  assert.equal(webmOnly[0].id, 'rec-1');

  const syncedOnly = filterAndSortRecordings(sampleRecordings, '', 'drive_synced', 'newest');
  assert.equal(syncedOnly.length, 1);
  assert.equal(syncedOnly[0].id, 'rec-1');
});

test('buildDriveShareUrl constructs valid Google Drive and scaprecord.site share links', () => {
  const urls = buildDriveShareUrl('1AbcDriveId');
  assert.equal(urls.driveUrl, 'https://drive.google.com/file/d/1AbcDriveId/view?usp=sharing');
  assert.equal(urls.scapShareUrl, 'https://scaprecord.site/v/1AbcDriveId');
});

test('calculateStorageUsage totals synced recordings only', () => {
  const stats = calculateStorageUsage(sampleRecordings);
  assert.equal(stats.syncedCount, 1);
  assert.equal(stats.formattedTotal, '40.0 MB');
});
