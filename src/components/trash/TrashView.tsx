import React, { useState } from 'react';
import { FileText, Folder, RotateCcw, Trash2 } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { formatBytes, formatShortDate } from '../../utils/fileHelpers';
import { ConfirmModal } from '../modals/ConfirmModal';

export function TrashView() {
  const {
    folders,
    files,
    restoreFolder,
    permanentlyDeleteFolder,
    restoreFile,
    permanentlyDeleteFile,
    emptyTrash,
  } = useLibrary();

  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);

  const trashedFolders = folders.filter((f) => f.isTrash);
  const trashedFiles = files.filter((f) => f.isTrash);
  const totalTrashed = trashedFolders.length + trashedFiles.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Recycle Bin
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Restore accidentally deleted study folders and documents or remove them permanently
          </p>
        </div>

        {totalTrashed > 0 && (
          <button
            type="button"
            onClick={() =>
              setConfirmState({
                title: 'Empty Recycle Bin?',
                description: `This will permanently delete ${totalTrashed} item(s) and free up storage space. This action cannot be undone.`,
                confirmLabel: 'Empty Recycle Bin',
                action: emptyTrash,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Empty Recycle Bin
          </button>
        )}
      </div>

      {totalTrashed === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <Trash2 className="mx-auto h-9 w-9 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
            Recycle Bin is clean
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Items moved to trash will appear here so you can restore them anytime.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {trashedFolders.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Trashed Folders ({trashedFolders.length})
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {trashedFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Folder className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {folder.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void restoreFolder(folder.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmState({
                            title: `Delete "${folder.name}" permanently?`,
                            description:
                              'This folder and any files inside it will be permanently deleted.',
                            confirmLabel: 'Delete Permanently',
                            action: () => permanentlyDeleteFolder(folder.id),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-3 py-1.5 font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {trashedFiles.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Trashed Documents ({trashedFiles.length})
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {trashedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {formatBytes(file.size)} · {formatShortDate(file.updatedAtMs)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void restoreFile(file.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmState({
                            title: `Delete "${file.name}" permanently?`,
                            description: 'This document will be permanently removed from storage.',
                            confirmLabel: 'Delete Permanently',
                            action: () => permanentlyDeleteFile(file.id),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-3 py-1.5 font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Confirm'}
        onClose={() => setConfirmState(null)}
        onConfirm={async () => {
          if (confirmState) await confirmState.action();
        }}
      />
    </div>
  );
}
