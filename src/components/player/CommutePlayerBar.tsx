import React from 'react';
import {
  Download,
  FileText,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { formatDuration } from '../../utils/fileHelpers';

export function CommutePlayerBar() {
  const {
    currentTrack,
    queue,
    isPlaying,
    isLoadingAudio,
    currentTime,
    duration,
    playbackRate,
    showTranscript,
    setShowTranscript,
    togglePlayPause,
    seekTo,
    skipBy,
    cyclePlaybackRate,
    playNextInQueue,
    playPrevInQueue,
    closePlayer,
    downloadCurrentTrackWav,
  } = useAudioPlayer();

  if (!currentTrack) return null;

  const safeDuration = Math.max(duration, currentTime, 1);

  return (
    <>
      {/* Expandable Spoken Script Drawer */}
      {showTranscript && (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-4xl px-4">
          <div className="max-h-72 overflow-y-auto rounded-t-xl border border-b-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {currentTrack.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Spoken Commute Transcript
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTranscript(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {currentTrack.scriptText || currentTrack.summaryText}
            </p>
          </div>
        </div>
      )}

      {/* Docked Commute Audio Bar */}
      <div className="sticky bottom-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          {/* Track Info */}
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <p className="truncate text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
              {currentTrack.title}
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {currentTrack.subtitle}
            </p>
          </div>

          {/* Transport + Scrubber */}
          <div className="flex flex-1 flex-col items-center gap-1 min-w-[240px] max-w-xl">
            <div className="flex items-center gap-2">
              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={playPrevInQueue}
                  className="rounded-lg p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Previous Briefing"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => skipBy(-15)}
                className="rounded-lg p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Rewind 15s"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                disabled={isLoadingAudio}
                onClick={togglePlayPause}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoadingAudio ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => skipBy(15)}
                className="rounded-lg p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Forward 15s"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={playNextInQueue}
                  className="rounded-lg p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Next Briefing"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex w-full items-center gap-2.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span className="w-10 text-right">{formatDuration(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={safeDuration}
                step={0.5}
                value={Math.min(currentTime, safeDuration)}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-blue-600"
              />
              <span className="w-10">{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Commute Controls (Speed, Transcript, Download, Close) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              title="Playback Speed"
            >
              {playbackRate}x
            </button>

            <button
              type="button"
              onClick={() => setShowTranscript(!showTranscript)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                showTranscript
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Toggle Script"
            >
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                Script
              </span>
            </button>

            <button
              type="button"
              onClick={downloadCurrentTrackWav}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Download WAV Audio"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={closePlayer}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              title="Close Player"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
