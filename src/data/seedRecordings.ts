import { RecordingItem } from '../utils/recordingLogic';

const svgThumb = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;

export const INITIAL_RECORDINGS: RecordingItem[] = [
  {
    id: 'snap-clip-1',
    title: 'Feedback on the layout for the client',
    description: 'Walkthrough of the updated hero grid, spacing hierarchy, and responsive typography for client sign-off.',
    durationSec: 197, // 03:17
    sizeBytes: 24_800_000,
    createdAt: '05.21.25 · 3 days',
    captureMode: 'screen_cam',
    views: 4,
    thumbnailUrl: svgThumb(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="sky1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#dbeafe"/>
            <stop offset="55%" stop-color="#fef3c7"/>
            <stop offset="100%" stop-color="#bae6fd"/>
          </linearGradient>
          <linearGradient id="cliff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#64748b"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#sky1)"/>
        <polygon points="320,30 480,360 180,360" fill="url(#cliff)"/>
        <polygon points="430,75 640,360 300,360" fill="#334155"/>
        <polygon points="0,120 230,360 0,360" fill="#14532d"/>
        <polygon points="80,150 310,360 20,360" fill="#166534"/>
        <rect y="300" width="640" height="60" fill="#0f172a" opacity="0.35"/>
      </svg>
    `),
    containerFormat: 'mp4',
    driveSynced: true,
    driveFileId: '1SnapDrive_LayoutFeedback01',
    driveWebViewLink: 'https://drive.google.com/file/d/1SnapDrive_LayoutFeedback01/view?usp=sharing',
    shareAccess: 'anyoneWithLink',
    resolution: '1080p 60fps',
    source: 'web_studio',
    folderId: 'fld-1',
    workspaceId: 'work',
    isFavorite: true,
    watchedAt: 'Today, 10:15 AM',
    reactions: { fire: 1, thumbsUp: 0, idea: 0, target: 0 },
    comments: [],
    transcript:
      '00:00 Welcome to the layout review for the client homepage. 00:45 Here we refined the hero section and spacing. 01:50 Let me know your feedback in the comments.',
  },
  {
    id: 'snap-clip-2',
    title: 'Master class in Cinema 4D',
    description: 'Architectural city grid lighting, dark-mode shaders, and procedural material passes.',
    durationSec: 1497, // 24:57
    sizeBytes: 142_600_000,
    createdAt: '05.14.25 · 10 days',
    captureMode: 'screen_cam',
    views: 28,
    thumbnailUrl: svgThumb(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="c4d" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#090d16"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#c4d)"/>
        <g fill="#334155" stroke="#475569" stroke-width="1">
          <rect x="60" y="70" width="90" height="120" rx="4"/>
          <rect x="170" y="40" width="110" height="150" rx="4"/>
          <rect x="300" y="85" width="95" height="105" rx="4"/>
          <rect x="415" y="50" width="140" height="140" rx="4"/>
          <rect x="80" y="210" width="130" height="110" rx="4"/>
          <rect x="230" y="210" width="150" height="110" rx="4"/>
          <rect x="400" y="210" width="160" height="110" rx="4"/>
        </g>
        <circle cx="310" cy="180" r="90" fill="#f59e0b" opacity="0.18"/>
        <circle cx="200" cy="130" r="4" fill="#fbbf24"/>
        <circle cx="350" cy="160" r="4" fill="#38bdf8"/>
        <circle cx="460" cy="120" r="4" fill="#fbbf24"/>
      </svg>
    `),
    containerFormat: 'mp4',
    driveSynced: true,
    driveFileId: '1SnapDrive_Cinema4D02',
    driveWebViewLink: 'https://drive.google.com/file/d/1SnapDrive_Cinema4D02/view?usp=sharing',
    shareAccess: 'anyoneWithLink',
    resolution: '1440p 60fps',
    source: 'web_studio',
    folderId: 'fld-1',
    workspaceId: 'dsgn_studio',
    isWatchLater: true,
    watchedAt: 'Yesterday, 4:30 PM',
    reactions: { fire: 3, thumbsUp: 2, idea: 1, target: 0 },
    comments: [
      {
        id: 'cmt-c4d-1',
        author: 'Alex Rivera',
        timestampSec: 125,
        text: 'The ambient occlusion pass at 02:05 looks super crisp.',
        createdAt: '2 days ago',
      },
    ],
    transcript:
      '00:00 In this session we set up our Cinema 4D scene lighting. 02:05 Adjusting global illumination and metallic roughness. 08:30 Exporting multipass renders to Google Drive.',
  },
  {
    id: 'snap-clip-3',
    title: 'Recording the process of analysis and evaluation of UX',
    description: 'Deep-dive heuristic evaluation and user journey flow analysis with live annotations.',
    durationSec: 863, // 14:23
    sizeBytes: 86_400_000,
    createdAt: '05.08.25 · 16 days',
    captureMode: 'screen_cam',
    views: 52,
    thumbnailUrl: svgThumb(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="arch" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="50%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#arch)"/>
        <path d="M0,360 Q180,40 320,240 T640,80 L640,360 Z" fill="#e0f2fe" opacity="0.25"/>
        <path d="M0,360 Q240,100 420,280 T640,150 L640,360 Z" fill="#0369a1" opacity="0.65"/>
        <ellipse cx="320" cy="60" rx="180" ry="70" fill="#f8fafc" opacity="0.85"/>
      </svg>
    `),
    containerFormat: 'webm',
    driveSynced: true,
    driveFileId: '1SnapDrive_UXEval03',
    driveWebViewLink: 'https://drive.google.com/file/d/1SnapDrive_UXEval03/view?usp=sharing',
    shareAccess: 'anyoneWithLink',
    resolution: '1080p 60fps',
    source: 'web_studio',
    folderId: 'fld-1',
    workspaceId: 'work',
    isWatchLater: true,
    reactions: { fire: 4, thumbsUp: 3, idea: 2, target: 0 },
    comments: [],
    transcript:
      '00:00 Starting the UX evaluation of the onboarding flow. 03:15 Reviewing drop-off metrics and navigation clarity. 09:40 Final recommendations for the product sprint.',
  },
  {
    id: 'snap-clip-4',
    title: 'How to make abstract glossy wavy shapes',
    description: 'Creating 3D glossy ribbon splines with custom refraction and studio HDRI reflections.',
    durationSec: 5097, // 01:24:57
    sizeBytes: 312_000_000,
    createdAt: '05.05.25 · 19 days',
    captureMode: 'screen_cam',
    views: 112,
    thumbnailUrl: svgThumb(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="glossBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#fee2e2"/>
          </linearGradient>
          <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ef4444"/>
            <stop offset="50%" stop-color="#dc2626"/>
            <stop offset="100%" stop-color="#7f1d1d"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#glossBg)"/>
        <path d="M-40,280 C120,20 260,380 420,80 C520,-40 600,240 680,120 L680,360 L-40,360 Z" fill="url(#ribbon)"/>
        <path d="M40,360 C180,90 340,310 520,30 C600,-30 640,180 680,60" fill="none" stroke="#fca5a5" stroke-width="28" stroke-linecap="round" opacity="0.65"/>
      </svg>
    `),
    containerFormat: 'mp4',
    driveSynced: true,
    driveFileId: '1SnapDrive_GlossyShapes04',
    driveWebViewLink: 'https://drive.google.com/file/d/1SnapDrive_GlossyShapes04/view?usp=sharing',
    shareAccess: 'anyoneWithLink',
    resolution: '4K 60fps',
    source: 'web_studio',
    folderId: 'fld-1',
    workspaceId: 'dsgn_studio',
    isFavorite: true,
    reactions: { fire: 20, thumbsUp: 15, idea: 6, target: 0 },
    comments: [],
    transcript:
      '00:00 Today we are building glossy abstract wavy shapes. 04:10 Setting up Subdivision Surface and shader clearcoat. 18:45 Rendering the final hero composition.',
  },
  {
    id: 'snap-clip-5',
    title: 'All about the life of leopards',
    description: 'Documentary rough-cut review covering wildlife color grading and narrative pacing.',
    durationSec: 2763, // 46:03
    sizeBytes: 198_400_000,
    createdAt: '04.15.25 · 1 month',
    captureMode: 'screen_only',
    views: 42,
    thumbnailUrl: svgThumb(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="forest" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#14532d"/>
            <stop offset="55%" stop-color="#166534"/>
            <stop offset="100%" stop-color="#052e16"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#forest)"/>
        <path d="M0,250 Q220,210 450,240 T640,220 L640,310 Q400,280 0,320 Z" fill="#78350f"/>
        <ellipse cx="320" cy="215" rx="135" ry="48" fill="#fbbf24"/>
        <circle cx="210" cy="195" r="34" fill="#f59e0b"/>
        <g fill="#451a03" opacity="0.75">
          <circle cx="260" cy="205" r="7"/>
          <circle cx="290" cy="220" r="8"/>
          <circle cx="325" cy="200" r="7"/>
          <circle cx="360" cy="222" r="8"/>
          <circle cx="395" cy="208" r="7"/>
          <circle cx="420" cy="225" r="6"/>
        </g>
      </svg>
    `),
    containerFormat: 'mp4',
    driveSynced: true,
    driveFileId: '1SnapDrive_Leopards05',
    driveWebViewLink: 'https://drive.google.com/file/d/1SnapDrive_Leopards05/view?usp=sharing',
    shareAccess: 'anyoneWithLink',
    resolution: '1080p 60fps',
    source: 'web_studio',
    folderId: 'fld-1',
    workspaceId: 'dsgn_studio',
    reactions: { fire: 2, thumbsUp: 1, idea: 0, target: 0 },
    comments: [],
    transcript:
      '00:00 Reviewing the color grade on the wildlife sequence. 06:20 Balancing foliage greens and warm highlights. 15:00 Ready for sound mix export.',
  },
  {
    id: 'snap-clip-6',
    title: 'Product card in online furniture store',
    description: 'Interactive e-commerce product card micro-interactions and responsive layout breakdown.',
    durationSec: 2079, // 34:39
    sizeBytes: 156_000_000,
    createdAt: '03.04.25 · 2 months',
    captureMode: 'screen_cam',
    views: 98,
    thumbnailUrl: svgThumb(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="60%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#064e3b"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#dusk)"/>
        <polygon points="80,360 290,130 500,360" fill="#065f46"/>
        <polygon points="240,360 440,110 620,360" fill="#047857"/>
        <polygon points="440,110 485,170 395,170" fill="#cbd5e1" opacity="0.35"/>
      </svg>
    `),
    containerFormat: 'mp4',
    driveSynced: true,
    driveFileId: '1SnapDrive_FurnitureCard06',
    driveWebViewLink: 'https://drive.google.com/file/d/1SnapDrive_FurnitureCard06/view?usp=sharing',
    shareAccess: 'anyoneWithLink',
    resolution: '1080p 60fps',
    source: 'web_studio',
    folderId: 'fld-1',
    workspaceId: 'work',
    reactions: { fire: 0, thumbsUp: 0, idea: 0, target: 0 },
    comments: [],
    transcript:
      '00:00 Walking through the online furniture store product card component. 02:30 Hover states, quick-add transitions, and mobile tap targets.',
  },
];
