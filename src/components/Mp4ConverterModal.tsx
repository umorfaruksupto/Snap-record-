import React, { useState, useEffect } from 'react';
import {
  FileVideo,
  Download,
  CloudUpload,
  CheckCircle2,
  X,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import {
  RecordingItem,
  formatFileSize,
  formatDuration,
  toMp4Filename,
} from '../utils/recordingLogic';
import {
  convertWebmRecordingToMp4,
  Mp4ConversionProgress,
  triggerMp4Download,
} from '../services/mp4Converter';

interface Mp4ConverterModalProps {
  recording: RecordingItem | null;
  onClose: () => void;
  onConversionSuccess: (
    recordingId: string,
    mp4BlobUrl: string,
    mp4Blob: Blob,
    outputSizeBytes: number
  ) => void;
  onSyncMp4ToDrive: (recording: RecordingItem, mp4Blob?: Blob) => void;
}

export const Mp4ConverterModal: React.FC<Mp4ConverterModalProps> = ({
  recording,
  onClose,
  onConversionSuccess,
  onSyncMp4ToDrive,
}) => {
  const [preset, setPreset] = useState<'ultrafast' | 'fast' | 'medium'>('ultrafast');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<Mp4ConversionProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [convertedSize, setConvertedSize] = useState<number | null>(null);

  useEffect(() => {
    if (!recording) return;
    setIsConverting(false);
    setProgress(null);
    setLogs([
      `[ffmpeg.wasm] Ready to transcode "${recording.title}" (${formatFileSize(
        recording.sizeBytes
      )}, ${recording.resolution})`,
    ]);
    setConvertedUrl(recording.mp4BlobUrl || null);
    setConvertedBlob(null);
    setConvertedSize(
      recording.containerFormat === 'mp4' ? recording.sizeBytes : null
    );
  }, [recording]);

  if (!recording) return null;

  const targetMp4Name = toMp4Filename(recording.title);

  const handleRunConversion = async () => {
    setIsConverting(true);
    setLogs((prev) => [
      ...prev,
      `[ffmpeg.wasm] Starting H.264/AAC MP4 transcode with preset="${preset}"...`,
    ]);

    const result = await convertWebmRecordingToMp4(
      recording,
      preset,
      (prog) => {
        setProgress(prog);
        setLogs((prev) => [...prev.slice(-8), prog.logLine]);
      }
    );

    setIsConverting(false);
    setConvertedUrl(result.mp4BlobUrl);
    setConvertedBlob(result.mp4Blob);
    setConvertedSize(result.outputSizeBytes);
    onConversionSuccess(
      recording.id,
      result.mp4BlobUrl,
      result.mp4Blob,
      result.outputSizeBytes
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mp4-converter-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-start justify-between gap-3 sm:gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <FileVideo className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="mp4-converter-title"
                className="text-base font-semibold text-slate-900"
              >
                Convert WebM to MP4 (ffmpeg.wasm)
              </h2>
              <p className="text-xs text-slate-600">
                In-browser H.264 + AAC transcoding with zero server upload required
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close MP4 converter modal"
            className="min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Source & Target File Metadata */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-slate-600">Source Recording</div>
            <div className="mt-1 font-semibold text-slate-900 truncate">
              {recording.title}
            </div>
            <div className="mt-1 font-mono text-slate-600 tabular-nums">
              WebM VP9 · {formatDuration(recording.durationSec)} ·{' '}
              {formatFileSize(recording.sizeBytes)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-slate-600">Target MP4 Output</div>
            <div className="mt-1 font-mono font-semibold text-blue-600 truncate">
              {targetMp4Name}
            </div>
            <div className="mt-1 font-mono text-slate-600 tabular-nums">
              MP4 (H.264 + AAC) ·{' '}
              {convertedSize
                ? formatFileSize(convertedSize)
                : `~${formatFileSize(recording.sizeBytes * 0.88)}`}
            </div>
          </div>
        </div>

        {/* Encoder Preset Selection */}
        <div className="mt-4">
          <label
            htmlFor="ffmpeg-preset-select"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            FFmpeg H.264 Encoding Preset
          </label>
          <select
            id="ffmpeg-preset-select"
            value={preset}
            disabled={isConverting}
            onChange={(e) =>
              setPreset(e.target.value as 'ultrafast' | 'fast' | 'medium')
            }
            className="w-full min-h-[42px] sm:min-h-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900"
          >
            <option value="ultrafast">
              Ultrafast (-preset ultrafast -crf 23 +faststart) — Fastest In-Browser Conversion
            </option>
            <option value="fast">
              Fast (-preset fast -crf 22 +faststart) — Balanced Quality & Speed
            </option>
            <option value="medium">
              High Compression (-preset medium -crf 20 +faststart) — Smallest File Size
            </option>
          </select>
        </div>

        {/* Progress Bar */}
        {(isConverting || progress) && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 font-medium">
                {progress?.stage || 'Preparing WebAssembly transcoder...'}
              </span>
              <span className="font-mono font-semibold text-blue-600 tabular-nums">
                {progress?.percent ?? 0}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-150"
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Live FFmpeg Console Log */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-950 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mb-1.5">
            <Cpu className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
            <span>@ffmpeg/ffmpeg WebAssembly Log</span>
          </div>
          <pre className="text-[11px] font-mono text-slate-200 overflow-x-auto max-h-28 leading-relaxed whitespace-pre-wrap">
            {logs.join('\n')}
          </pre>
        </div>

        {/* Success Banner */}
        {convertedUrl && !isConverting && (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Converted to <strong>{targetMp4Name}</strong> (MP4 H.264)
              </span>
            </div>
            <span className="font-mono font-semibold tabular-nums text-emerald-700">
              {convertedSize ? formatFileSize(convertedSize) : 'Ready'}
            </span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] sm:min-h-0 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            Close
          </button>

          {!convertedUrl ? (
            <button
              type="button"
              disabled={isConverting}
              onClick={handleRunConversion}
              className="min-h-[42px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isConverting ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {isConverting ? 'Converting WebM to MP4...' : 'Start MP4 Conversion'}
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => triggerMp4Download(convertedUrl, recording.title)}
                className="min-h-[42px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Download .MP4</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onSyncMp4ToDrive(recording, convertedBlob || undefined)
                }
                className="min-h-[42px] sm:min-h-0 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sync MP4 to Google Drive</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
