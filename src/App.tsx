/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { CommuteStudioView } from './components/commute/CommuteStudioView';
import { DashboardView } from './components/dashboard/DashboardView';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { LibraryView } from './components/library/LibraryView';
import { FolderModal } from './components/modals/FolderModal';
import { MoveModal } from './components/modals/MoveModal';
import { RenameModal } from './components/modals/RenameModal';
import { UploadModal } from './components/modals/UploadModal';
import { CommutePlayerBar } from './components/player/CommutePlayerBar';
import { SettingsBackupView } from './components/settings/SettingsBackupView';
import { TrashView } from './components/trash/TrashView';
import { DocPreviewModal } from './components/viewer/DocPreviewModal';
import { PdfViewerModal } from './components/viewer/PdfViewerModal';
import { AudioPlayerProvider, useAudioPlayer } from './context/AudioPlayerContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { FileItem, FolderColor, FolderItem } from './types';
import { base64ToBlob, getFileCategory } from './utils/fileHelpers';

function StudyVaultWorkspace() {
  const { authError, clearAuthError } = useAuth();
  const {
    folders,
    activeSection,
    setActiveSection,
    currentFolderId,
    isLoadingLibrary,
    uploadTasks,
    toastMessage,
    notify,
    createFolder,
    renameFolder,
    moveFolder,
    uploadFiles,
    renameFile,
    moveFiles,
    resolveFileBlob,
    downloadFile,
  } = useLibrary();
  const { playDirectTrack } = useAudioPlayer();

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('studyvault_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('studyvault_theme', isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage quota errors
    }
  }, [isDark]);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Modal states
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null);
  const [moveTargetState, setMoveTargetState] = useState<{
    title: string;
    movingFolderId?: string | null;
    fileIds?: string[];
    currentParentId: string;
  } | null>(null);

  // Viewer states
  const [activePdfFile, setActivePdfFile] = useState<FileItem | null>(null);
  const [activeDocFile, setActiveDocFile] = useState<FileItem | null>(null);
  const [preselectedCommuteFile, setPreselectedCommuteFile] = useState<FileItem | null>(null);

  const handleOpenFile = useCallback((file: FileItem) => {
    const category = getFileCategory(file.mimeType, file.extension);
    if (category === 'pdf') {
      setActivePdfFile(file);
    } else {
      setActiveDocFile(file);
    }
  }, []);

  const handleSummarizeFileToAudio = useCallback(
    (file: FileItem) => {
      setPreselectedCommuteFile(file);
      setActiveSection('commute');
    },
    [setActiveSection]
  );

  const handleReadAloudDirect = useCallback(
    async (title: string, text: string) => {
      try {
        const resp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voiceName: 'Kore' }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || 'Speech generation failed');
        }
        const wavBlob = base64ToBlob(data.audioBase64, 'audio/wav');
        await playDirectTrack({
          id: `tts_${Date.now()}`,
          title,
          subtitle: 'Direct Note Reader · Gemini 3.8 Flash TTS',
          scriptText: text,
          summaryText: text.slice(0, 400),
          directBlob: wavBlob,
          durationHint: data.durationSeconds,
        });
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Unable to synthesize speech.', 'error');
      }
    },
    [playDirectTrack, notify]
  );

  const handleFolderModalSubmit = async (
    name: string,
    parentId: string,
    color: FolderColor
  ) => {
    if (editingFolder) {
      await renameFolder(editingFolder.id, name, color);
    } else {
      await createFolder(name, parentId, color);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenUploadModal={() => setUploadModalOpen(true)}
          onOpenFile={handleOpenFile}
        />

        {/* Auth Diagnostic Banner */}
        {authError && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{authError}</span>
            </div>
            <button
              type="button"
              onClick={clearAuthError}
              className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Main Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto">
          {isLoadingLibrary ? (
            <div className="mx-auto max-w-7xl space-y-4 p-6 lg:p-8">
              <div className="h-28 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
              </div>
              <div className="h-64 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
            </div>
          ) : activeSection === 'dashboard' ? (
            <DashboardView
              onOpenCreateFolder={() => {
                setEditingFolder(null);
                setFolderModalOpen(true);
              }}
              onOpenUpload={() => setUploadModalOpen(true)}
              onOpenFile={handleOpenFile}
              onSummarizeFile={handleSummarizeFileToAudio}
            />
          ) : activeSection === 'commute' ? (
            <CommuteStudioView
              preselectedFile={preselectedCommuteFile}
              onClearPreselectedFile={() => setPreselectedCommuteFile(null)}
            />
          ) : activeSection === 'library' || activeSection === 'favorites' ? (
            <LibraryView
              favoritesOnly={activeSection === 'favorites'}
              onOpenCreateFolder={() => {
                setEditingFolder(null);
                setFolderModalOpen(true);
              }}
              onEditFolder={(fld) => {
                setEditingFolder(fld);
                setFolderModalOpen(true);
              }}
              onOpenUpload={() => setUploadModalOpen(true)}
              onOpenFile={handleOpenFile}
              onRenameFileRequest={(file) => setRenamingFile(file)}
              onMoveFolderRequest={(folder) =>
                setMoveTargetState({
                  title: `Move "${folder.name}"`,
                  movingFolderId: folder.id,
                  currentParentId: folder.parentId,
                })
              }
              onMoveFilesRequest={(fileIds) =>
                setMoveTargetState({
                  title:
                    fileIds.length === 1
                      ? 'Move Document'
                      : `Move ${fileIds.length} Documents`,
                  fileIds,
                  currentParentId: currentFolderId,
                })
              }
              onSummarizeFile={handleSummarizeFileToAudio}
            />
          ) : activeSection === 'trash' ? (
            <TrashView />
          ) : (
            <SettingsBackupView />
          )}
        </main>

        {/* Docked Commute Audio Bar */}
        <CommutePlayerBar />
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed right-4 top-18 z-50 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-medium shadow-lg">
          {toastMessage.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : toastMessage.tone === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
          ) : (
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          )}
          <span className="text-slate-800 dark:text-slate-100">{toastMessage.text}</span>
        </div>
      )}

      {/* Modals */}
      <FolderModal
        isOpen={folderModalOpen}
        initialParentId={currentFolderId}
        editFolder={editingFolder}
        folders={folders}
        onClose={() => {
          setFolderModalOpen(false);
          setEditingFolder(null);
        }}
        onSubmit={handleFolderModalSubmit}
      />

      <UploadModal
        isOpen={uploadModalOpen}
        initialFolderId={currentFolderId}
        folders={folders}
        uploadTasks={uploadTasks}
        onClose={() => setUploadModalOpen(false)}
        onUpload={async (selected, folderId) => {
          await uploadFiles(selected, folderId);
        }}
      />

      <RenameModal
        isOpen={Boolean(renamingFile)}
        initialName={renamingFile?.name || ''}
        itemLabel="Document"
        onClose={() => setRenamingFile(null)}
        onRename={async (newName) => {
          if (renamingFile) {
            await renameFile(renamingFile.id, newName);
          }
        }}
      />

      <MoveModal
        isOpen={Boolean(moveTargetState)}
        title={moveTargetState?.title || 'Move'}
        movingFolderId={moveTargetState?.movingFolderId}
        currentParentId={moveTargetState?.currentParentId || ''}
        folders={folders}
        onClose={() => setMoveTargetState(null)}
        onConfirmMove={async (destId) => {
          if (!moveTargetState) return;
          if (moveTargetState.movingFolderId) {
            await moveFolder(moveTargetState.movingFolderId, destId);
          } else if (moveTargetState.fileIds?.length) {
            await moveFiles(moveTargetState.fileIds, destId);
          }
        }}
      />

      {/* Integrated Document & PDF Viewers */}
      <PdfViewerModal
        file={activePdfFile}
        resolveBlob={resolveFileBlob}
        onDownload={downloadFile}
        onSummarizeToAudio={handleSummarizeFileToAudio}
        onClose={() => setActivePdfFile(null)}
      />

      <DocPreviewModal
        file={activeDocFile}
        resolveBlob={resolveFileBlob}
        onDownload={downloadFile}
        onSummarizeToAudio={handleSummarizeFileToAudio}
        onReadAloudDirect={handleReadAloudDirect}
        onClose={() => setActiveDocFile(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LibraryProvider>
        <AudioPlayerProvider>
          <StudyVaultWorkspace />
        </AudioPlayerProvider>
      </LibraryProvider>
    </AuthProvider>
  );
}
