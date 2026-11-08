export interface ExtensionSourceFile {
  filename: string;
  language: 'json' | 'javascript' | 'html';
  role: string;
  content: string;
}

export const CHROME_EXTENSION_FILES: ExtensionSourceFile[] = [
  {
    filename: 'manifest.json',
    language: 'json',
    role: 'Manifest V3 configuration with tabCapture, desktopCapture, offscreen, and Google Drive OAuth2 scopes',
    content: `{
  "manifest_version": 3,
  "name": "ScapRecord — Free Screen & Camera Recorder for Google Drive",
  "short_name": "ScapRecord",
  "version": "2.4.0",
  "description": "Record your screen, tab, and webcam bubble in 60fps and instantly share via Google Drive on scaprecord.site.",
  "homepage_url": "https://scaprecord.site",
  "permissions": [
    "tabCapture",
    "desktopCapture",
    "offscreen",
    "storage",
    "activeTab",
    "scripting",
    "identity",
    "notifications"
  ],
  "host_permissions": [
    "https://www.googleapis.com/*",
    "https://scaprecord.site/*"
  ],
  "oauth2": {
    "client_id": "635180461858-1n6agaf5vp74puks4um70sl36dlaqg75.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file"
    ]
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "ScapRecord — Start Recording"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "commands": {
    "toggle-recording": {
      "suggested_key": {
        "default": "Alt+Shift+R",
        "mac": "Alt+Shift+R"
      },
      "description": "Start or Stop ScapRecord Capture"
    }
  }
}`,
  },
  {
    filename: 'background.js',
    language: 'javascript',
    role: 'Service worker orchestrating desktopCapture, offscreen MediaRecorder, and Google Drive multipart upload',
    content: `// ScapRecord Chrome Extension — Manifest V3 Service Worker (scaprecord.site)
let recordingState = {
  isRecording: false,
  startedAt: null,
  captureMode: 'screen_cam',
  autoUploadDrive: true
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAP_GET_STATE') {
    sendResponse(recordingState);
    return true;
  }

  if (message.type === 'SCAP_START_CAPTURE') {
    startExtensionCapture(message.payload)
      .then((res) => sendResponse({ ok: true, ...res }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'SCAP_STOP_CAPTURE') {
    stopExtensionCapture()
      .then((res) => sendResponse({ ok: true, ...res }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'SCAP_UPLOAD_TO_DRIVE') {
    uploadWebmToGoogleDrive(message.payload)
      .then((driveResult) => sendResponse({ ok: true, driveResult }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA', 'DISPLAY_MEDIA'],
    justification: 'Record screen, tab audio, and microphone into WebM container'
  });
}

async function startExtensionCapture(options) {
  await ensureOffscreenDocument();
  recordingState = {
    isRecording: true,
    startedAt: Date.now(),
    captureMode: options.captureMode || 'screen_cam',
    autoUploadDrive: options.autoUploadDrive !== false
  };

  // Notify active tab to mount the draggable Loom-style camera bubble
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    chrome.tabs.sendMessage(activeTab.id, {
      type: 'SCAP_MOUNT_CAMERA_BUBBLE',
      captureMode: recordingState.captureMode
    }).catch(() => {});
  }

  await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_START_RECORDER',
    options: recordingState
  });

  chrome.action.setBadgeText({ text: 'REC' });
  chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
  return recordingState;
}

async function stopExtensionCapture() {
  recordingState.isRecording = false;
  chrome.action.setBadgeText({ text: '' });

  const response = await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_STOP_RECORDER'
  });

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    chrome.tabs.sendMessage(activeTab.id, { type: 'SCAP_UNMOUNT_CAMERA_BUBBLE' }).catch(() => {});
  }

  return response;
}

async function uploadWebmToGoogleDrive({ base64Data, title }) {
  const tokenResult = await chrome.identity.getAuthToken({ interactive: true });
  const token = tokenResult.token;
  if (!token) throw new Error('Google Drive authorization token unavailable.');

  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'video/webm' });

  const metadata = {
    name: (title || 'ScapRecord-Clip') + '.webm',
    description: 'Recorded via ScapRecord Chrome Extension (https://scaprecord.site)',
    mimeType: 'video/webm'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: form
    }
  );
  const fileData = await res.json();

  // Make link shareable with anyone who has the link
  await fetch(\`https://www.googleapis.com/drive/v3/files/\${fileData.id}/permissions\`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });

  return {
    driveFileId: fileData.id,
    driveUrl: fileData.webViewLink || \`https://drive.google.com/file/d/\${fileData.id}/view?usp=sharing\`,
    scapShareUrl: \`https://scaprecord.site/v/\${fileData.id}\`
  };
}`,
  },
  {
    filename: 'content.js',
    language: 'javascript',
    role: 'Injects the draggable Loom-style webcam PIP bubble and floating recording dock into any web page',
    content: `// ScapRecord Content Script — Draggable Camera Bubble & Recording HUD
(() => {
  let bubbleContainer = null;
  let mediaStream = null;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SCAP_MOUNT_CAMERA_BUBBLE') {
      mountScapBubble(msg.captureMode);
    } else if (msg.type === 'SCAP_UNMOUNT_CAMERA_BUBBLE') {
      unmountScapBubble();
    }
  });

  async function mountScapBubble(captureMode) {
    if (bubbleContainer) return;

    bubbleContainer = document.createElement('div');
    bubbleContainer.id = 'scaprecord-floating-hud';
    Object.assign(bubbleContainer.style, {
      position: 'fixed',
      bottom: '28px',
      left: '28px',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      userSelect: 'none',
      fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    });

    if (captureMode !== 'screen_only') {
      const videoWrap = document.createElement('div');
      Object.assign(videoWrap.style, {
        width: '136px',
        height: '136px',
        borderRadius: '9999px',
        overflow: 'hidden',
        border: '3px solid #F59E0B',
        boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
        backgroundColor: '#0F172A'
      });

      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      Object.assign(video.style, {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: 'scaleX(-1)'
      });

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = mediaStream;
      } catch (e) {
        console.warn('ScapRecord camera fallback active:', e);
      }

      videoWrap.appendChild(video);
      bubbleContainer.appendChild(videoWrap);
    }

    const controlsPill = document.createElement('div');
    Object.assign(controlsPill.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 16px',
      borderRadius: '9999px',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(255,255,255,0.14)',
      color: '#F8FAFC',
      fontSize: '13px',
      fontWeight: '600',
      boxShadow: '0 10px 25px rgba(0,0,0,0.4)'
    });

    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop & Save to Drive';
    Object.assign(stopBtn.style, {
      backgroundColor: '#EF4444',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '6px',
      padding: '6px 12px',
      cursor: 'pointer',
      fontWeight: '600'
    });
    stopBtn.onclick = () => {
      chrome.runtime.sendMessage({ type: 'SCAP_STOP_CAPTURE' });
    };

    controlsPill.appendChild(stopBtn);
    bubbleContainer.appendChild(controlsPill);
    document.body.appendChild(bubbleContainer);
  }

  function unmountScapBubble() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (bubbleContainer) {
      bubbleContainer.remove();
      bubbleContainer = null;
    }
  }
})();`,
  },
  {
    filename: 'popup.js',
    language: 'javascript',
    role: 'Extension popup UI controller for choosing capture mode, audio devices, and Google Drive target folder',
    content: `// ScapRecord Extension Popup Controller (scaprecord.site)
document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('scap-start-btn');
  const stopBtn = document.getElementById('scap-stop-btn');
  const modeSelect = document.getElementById('scap-mode-select');
  const driveToggle = document.getElementById('scap-drive-toggle');
  const statusLabel = document.getElementById('scap-status-label');

  const state = await chrome.runtime.sendMessage({ type: 'SCAP_GET_STATE' });
  updatePopupUI(state?.isRecording);

  startBtn?.addEventListener('click', async () => {
    statusLabel.textContent = 'Initializing 60fps stream...';
    const res = await chrome.runtime.sendMessage({
      type: 'SCAP_START_CAPTURE',
      payload: {
        captureMode: modeSelect.value,
        autoUploadDrive: driveToggle.checked
      }
    });
    if (res?.ok) {
      updatePopupUI(true);
    } else {
      statusLabel.textContent = res?.error || 'Failed to start capture';
    }
  });

  stopBtn?.addEventListener('click', async () => {
    statusLabel.textContent = 'Uploading WebM to Google Drive...';
    const res = await chrome.runtime.sendMessage({ type: 'SCAP_STOP_CAPTURE' });
    updatePopupUI(false);
    if (res?.ok) {
      statusLabel.textContent = 'Saved to Google Drive! Share link copied.';
    }
  });

  function updatePopupUI(isRecording) {
    if (startBtn) startBtn.style.display = isRecording ? 'none' : 'block';
    if (stopBtn) stopBtn.style.display = isRecording ? 'block' : 'none';
    if (statusLabel) {
      statusLabel.textContent = isRecording
        ? 'Recording in progress...'
        : 'Ready to record to Google Drive';
    }
  }
});`,
  },
];
