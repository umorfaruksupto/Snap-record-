import React, { useState } from 'react';
import { Download, Copy, Check, Puzzle, FileCode, ChevronDown, ChevronUp } from 'lucide-react';
import { CHROME_EXTENSION_FILES } from '../data/extensionSource';
import { downloadExtensionBundleFile } from '../utils/extensionPackager';

export const ChromeExtensionPanel: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState(CHROME_EXTENSION_FILES[0].filename);
  const [copiedFile, setCopiedFile] = useState(false);
  const [downloadedNotice, setDownloadedNotice] = useState<string | null>(null);
  const [showSourceCode, setShowSourceCode] = useState(false);

  const activeSource =
    CHROME_EXTENSION_FILES.find((f) => f.filename === selectedFile) ||
    CHROME_EXTENSION_FILES[0];

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

  return (
    <div className="mx-auto max-w-[960px] space-y-5">
      {/* Main Extension Download & Setup Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                ScapRecord Chrome Extension (Manifest V3)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Record any browser tab or desktop window with a draggable camera bubble and automatic Google Drive upload.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleDownloadBundle()}
            className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Extension Bundle</span>
          </button>
        </div>

        {downloadedNotice && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800"
          >
            {downloadedNotice}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="font-mono font-semibold text-blue-600">Step 1</div>
            <div className="mt-1 font-semibold text-slate-900">Download Extension</div>
            <p className="mt-1 text-slate-600 leading-relaxed">
              Download the unpacked extension files or use `/public/chrome-extension/`.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="font-mono font-semibold text-blue-600">Step 2</div>
            <div className="mt-1 font-semibold text-slate-900">Load in Chrome</div>
            <p className="mt-1 text-slate-600 leading-relaxed">
              Open `chrome://extensions`, enable Developer Mode, and click Load Unpacked.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="font-mono font-semibold text-blue-600">Step 3</div>
            <div className="mt-1 font-semibold text-slate-900">Record & Share</div>
            <p className="mt-1 text-slate-600 leading-relaxed">
              Click the ScapRecord icon or press `Alt+Shift+R` to record and copy a Google Drive share link.
            </p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowSourceCode((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <FileCode className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            <span>{showSourceCode ? 'Hide Extension Source Files' : 'Inspect Extension Source Files'}</span>
            {showSourceCode ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Optional Collapsible Source Inspector */}
      {showSourceCode && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {CHROME_EXTENSION_FILES.map((file) => (
                <button
                  key={file.filename}
                  type="button"
                  onClick={() => setSelectedFile(file.filename)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                    selectedFile === file.filename
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {file.filename}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopySource}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0"
            >
              {copiedFile ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy File</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 text-xs font-mono text-slate-100 bg-slate-950 overflow-x-auto max-h-80 leading-relaxed">
            <code>{activeSource.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
