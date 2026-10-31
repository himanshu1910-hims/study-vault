import React from 'react';
import {
  ArrowRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Headphones,
  Play,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { FileItem } from '../../types';
import {
  FOLDER_COLOR_CLASSES,
  formatBytes,
  formatDuration,
  formatShortDate,
  normalizeFolderId,
} from '../../utils/fileHelpers';

interface DashboardViewProps {
  onOpenCreateFolder: () => void;
  onOpenUpload: () => void;
  onOpenFile: (file: FileItem) => void;
  onSummarizeFile: (file: FileItem) => void;
}

export function DashboardView({
  onOpenCreateFolder,
  onOpenUpload,
  onOpenFile,
  onSummarizeFile,
}: DashboardViewProps) {
  const { user, signInWithGoogle, isSigningIn } = useAuth();
  const {
    folders,
    files,
    briefings,
    openFolder,
    setActiveSection,
    totalStorageUsedBytes,
    isCloudSynced,
  } = useLibrary();
  const { playBriefing, playBriefingQueue } = useAudioPlayer();

  const activeFolders = folders.filter((f) => !f.isTrash);
  const activeFiles = files.filter((f) => !f.isTrash);
  const rootFolders = activeFolders
    .filter((f) => normalizeFolderId(f.parentId) === '')
    .slice(0, 6);
  const recentFiles = [...activeFiles]
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, 6);
  const recentBriefings = briefings.slice(0, 3);

  const greetingName = user?.displayName
    ? user.displayName.split(' ')[0]
    : 'Scholar';

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Hero Workspace Header */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isCloudSynced
                ? `Connected to Firebase Cloud · ${user?.email}`
                : 'Instant Local Mode · Sign in with Google anytime for cross-device Firebase sync'}
            </p>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
              style={{ textWrap: 'balance' }}
            >
              Welcome back, {greetingName}. Organize notes and listen on your commute.
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Manage unlimited subject folders, read PDFs directly in your browser, and turn news
              articles or study notes into personalized Gemini 3.8 TTS audio summaries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('commute')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Headphones className="h-4 w-4" />
              New Commute Audio
            </button>

            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="h-4 w-4" />
              Upload PDF / Notes
            </button>

            <button
              type="button"
              onClick={onOpenCreateFolder}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>

            {!user && (
              <button
                type="button"
                disabled={isSigningIn}
                onClick={() => void signInWithGoogle()}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 px-4 py-2.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap shrink-0"
              >
                {isSigningIn ? 'Connecting...' : 'Connect Google Cloud'}
              </button>
            )}
          </div>
        </div>

        {/* 4-Column Quantitative KPI Strip */}
        <div className="mt-7 grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800 pt-6 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Subject Folders</p>
            <p className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {activeFolders.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Stored Documents</p>
            <p className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {activeFiles.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Commute Briefings</p>
            <p className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {briefings.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Library Size</p>
            <p className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatBytes(totalStorageUsedBytes)}
            </p>
          </div>
        </div>
      </section>

      {/* Commute Audio Spotlight */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Commute Audio Queue
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personalized news &amp; study summaries ready for hands-free listening
            </p>
          </div>
          <div className="flex items-center gap-3">
            {briefings.length > 0 && (
              <button
                type="button"
                onClick={() => void playBriefingQueue(briefings, 0)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Play All ({briefings.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveSection('commute')}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
            >
              Open Studio
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {recentBriefings.length === 0 ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Create your first personalized commute audio summary
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paste news articles, enter a web URL, or select uploaded PDFs to synthesize a two-host podcast or news anchor briefing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('commute')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Headphones className="h-3.5 w-3.5" />
              Create Audio Summary
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {recentBriefings.map((ep) => (
              <div
                key={ep.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                    {ep.title}
                  </h4>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{ep.mode === 'podcast' ? 'Podcast' : 'Anchor'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ep.language}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatDuration(ep.durationSeconds)}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {ep.summaryText}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {formatShortDate(ep.createdAtMs)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void playBriefing(ep)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3 w-3" />
                    Listen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Root Index Folders & Quick Access */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              My Library Folders
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Jump directly into your root index folder or top-level subjects
            </p>
          </div>
          <button
            type="button"
            onClick={() => openFolder('')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            Open Root Index Folder
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Always show Root Index Folder card so opening index is 1 click */}
          <button
            type="button"
            onClick={() => openFolder('')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
          >
            <FolderOpen className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                My Library (Index)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {activeFolders.length} folders · {activeFiles.length} files
              </p>
            </div>
          </button>

          {rootFolders.map((folder) => {
            const colorCls = FOLDER_COLOR_CLASSES[folder.color || 'blue']?.icon || 'text-blue-600';
            const subCount = activeFolders.filter(
              (sub) => normalizeFolderId(sub.parentId) === folder.id
            ).length;
            const docCount = activeFiles.filter(
              (fl) => normalizeFolderId(fl.folderId) === folder.id
            ).length;

            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => openFolder(folder.id)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <Folder className={`h-6 w-6 shrink-0 ${colorCls}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {folder.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {subCount} subfolders · {docCount} files
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent Study Documents Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Recent Documents &amp; Notes
          </h3>
          <button
            type="button"
            onClick={() => openFolder('')}
            className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
          >
            View All Files
          </button>
        </div>

        {recentFiles.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              No study documents uploaded yet
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Upload PDFs, Word notes, slides, or text articles to store and summarize them anytime.
            </p>
            <button
              type="button"
              onClick={onOpenUpload}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload First Document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Document Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium text-right">Size</th>
                  <th className="px-4 py-3 font-medium text-right">Updated</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpenFile(file)}
                        className="flex items-center gap-2.5 font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate max-w-xs">{file.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      {(file.extension || 'file').toUpperCase()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {formatBytes(file.size)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {formatShortDate(file.updatedAtMs)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {file.textExcerpt && (
                          <button
                            type="button"
                            onClick={() => onSummarizeFile(file)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap"
                          >
                            Audio Summary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenFile(file)}
                          className="text-slate-700 dark:text-slate-300 hover:underline font-medium whitespace-nowrap"
                        >
                          Open
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
