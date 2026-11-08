import { RecordingItem } from '../utils/recordingLogic';

export const INITIAL_RECORDINGS: RecordingItem[] = [
  {
    id: 'scap-rec-101',
    title: 'Cloud-Native Microservices & OAuth2 Drive Sync Walkthrough',
    description:
      'End-to-end architecture review showing how ScapRecord streams 60fps WebM chunks directly from the Chrome Extension to Google Drive with instant link permissions.',
    durationSec: 214,
    sizeBytes: 48.4 * 1024 * 1024,
    createdAt: '2026-11-07T11:20:00Z',
    captureMode: 'screen_cam',
    views: 342,
    thumbnailUrl: '/src/assets/images/thumb_architecture_walkthrough_1794089141547.jpg',
    containerFormat: 'webm',
    backgroundPreset: 'midnight',
    driveSynced: true,
    driveFileId: '1ScapDrive99281AxMicroservices',
    driveWebViewLink:
      'https://drive.google.com/file/d/1ScapDrive99281AxMicroservices/view?usp=sharing',
    shareAccess: 'anyoneWithLink',
    resolution: '1440p 60fps',
    source: 'chrome_extension',
    reactions: {
      fire: 28,
      thumbsUp: 19,
      idea: 7,
      target: 14,
    },
    comments: [
      {
        id: 'cmt-1',
        author: 'Elena Vance',
        timestampSec: 42,
        text: 'Zero-egress multipart upload straight to the user Google Drive folder saves so much storage overhead.',
        createdAt: '2h ago',
      },
      {
        id: 'cmt-2',
        author: 'Marcus Chen',
        timestampSec: 128,
        text: 'The Chrome Extension offscreen document pipeline handles tab audio + mic mixing cleanly.',
        createdAt: '1h ago',
      },
    ],
    transcript:
      '00:00 Welcome to the ScapRecord architecture walkthrough. 00:42 Here we inspect how the Chrome Extension captures tab and desktop streams at 60fps. 01:18 Next we configure OAuth2 permissions for personal Google Drive folders. 02:05 Streaming WebM chunks directly to Google Drive with zero server storage overhead. 02:58 Copying the instant shareable link and testing viewer playback.',
  },
  {
    id: 'scap-rec-102',
    title: 'ScapRecord v2.4 Design System & Token Contrast Audit',
    description:
      'Walkthrough of our minimal studio interface, camera bubble PIP frames, and instant WebM-to-MP4 conversion.',
    durationSec: 146,
    sizeBytes: 31.2 * 1024 * 1024,
    createdAt: '2026-11-06T16:45:00Z',
    captureMode: 'screen_cam',
    views: 189,
    thumbnailUrl: '/src/assets/images/thumb_design_system_review_1794089142580.jpg',
    containerFormat: 'webm',
    backgroundPreset: 'aurora',
    driveSynced: true,
    driveFileId: '1ScapDrive77412BxDesignTokens',
    driveWebViewLink:
      'https://drive.google.com/file/d/1ScapDrive77412BxDesignTokens/view?usp=sharing',
    shareAccess: 'anyoneWithLink',
    resolution: '4K 60fps',
    source: 'chrome_extension',
    reactions: {
      fire: 16,
      thumbsUp: 24,
      idea: 11,
      target: 9,
    },
    comments: [
      {
        id: 'cmt-3',
        author: 'Sora Takahashi',
        timestampSec: 64,
        text: 'Love how the camera bubble stays pinned without occluding the primary inspector controls.',
        createdAt: '5h ago',
      },
    ],
    transcript:
      '00:00 Reviewing the ScapRecord minimal UI component library and typography scale. 00:38 Auditing surface contrast ratios across obsidian cards and hairline borders. 01:04 Notice how the camera PIP overlay smoothly docks to any corner during live capture. 01:48 Exporting the final recording to MP4 using FFmpeg in the browser.',
  },
  {
    id: 'scap-rec-103',
    title: 'Q4 Production Latency Telemetry & Release Pipeline Demo',
    description:
      'Recorded sprint verification showing P99 query latency dropping to 24ms and automated staging checks passing.',
    durationSec: 118,
    sizeBytes: 24.8 * 1024 * 1024,
    createdAt: '2026-11-05T09:15:00Z',
    captureMode: 'screen_only',
    views: 112,
    thumbnailUrl: '/src/assets/images/thumb_sprint_demo_recording_1794089143448.jpg',
    containerFormat: 'webm',
    backgroundPreset: 'cyber',
    driveSynced: false,
    shareAccess: 'restricted',
    resolution: '1080p 60fps',
    source: 'web_studio',
    reactions: {
      fire: 9,
      thumbsUp: 14,
      idea: 3,
      target: 8,
    },
    comments: [],
    transcript:
      '00:00 Quick screen-only capture of our Q4 deployment pipeline telemetry. 00:32 Comparing P99 API response times before and after cache indexing. 01:05 Running automated staging regression suites in headless Chromium. 01:36 Ready to trim timestamps, convert to MP4, or sync to Google Drive.',
  },
];
