import { CHROME_EXTENSION_FILES } from '../data/extensionSource';

export function downloadExtensionBundleFile(filename?: string): string {
  if (filename) {
    const target = CHROME_EXTENSION_FILES.find((f) => f.filename === filename);
    if (!target) return '';
    const blob = new Blob([target.content], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, target.filename);
    return target.filename;
  }

  // Package all Manifest V3 extension files + installation script into a self-contained bundle
  const bundleManifest = {
    package: 'scaprecord-chrome-extension-v2.4.0',
    domain: 'https://scaprecord.site',
    generatedAt: new Date().toISOString(),
    instructions: [
      '1. Extract these files into a folder named scaprecord-extension/',
      '2. Open Google Chrome and navigate to chrome://extensions',
      '3. Enable Developer Mode in the top-right corner',
      '4. Click Load Unpacked and select the scaprecord-extension/ folder',
    ],
    files: Object.fromEntries(CHROME_EXTENSION_FILES.map((f) => [f.filename, f.content])),
  };

  const blob = new Blob([JSON.stringify(bundleManifest, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const bundleName = 'scaprecord-chrome-extension-v2.4.0.bundle.json';
  triggerDownload(blob, bundleName);
  return bundleName;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
