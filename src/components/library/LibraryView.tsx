import React, { useMemo, useState } from 'react';
import {
  ArrowUpLeft,
  CheckSquare,
  ChevronRight,
  Download,
  Eye,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  Grid,
  Headphones,
  List,
  Pencil,
  Play,
  Square,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { FileItem, FolderItem } from '../../types';
import {
  FOLDER_COLOR_CLASSES,
  formatBytes,
  formatDuration,
  formatShortDate,
  getBreadcrumbTrail,
  getFileCategory,
  normalizeFolderId,
} from '../../utils/fileHelpers';

interface LibraryViewProps {
  favoritesOnly?: boolean;
  onOpenCreateFolder: () => void;
  onEditFolder: (folder: FolderItem) => void;
  onOpenUpload: () => void;
  onOpenFile: (file: FileItem) => void;
  onRenameFileRequest: (file: FileItem) => void;
  onMoveFolderRequest: (folder: FolderItem) => void;
  onMoveFilesRequest: (fileIds: string[]) => void;
  onSummarizeFile: (file: FileItem) => void;
}

export function LibraryView({
  favoritesOnly = false,
  onOpenCreateFolder,
  onEditFolder,
  onOpenUpload,
  onOpenFile,
  onRenameFileRequest,
  onMoveFolderRequest,
  onMoveFilesRequest,
  onSummarizeFile,
}: LibraryViewProps) {
  const {
    folders,
    files,
    briefings,
    currentFolderId,
    openFolder,
    toggleFolderFavorite,
    trashFolder,
    toggleFileFavorite,
    trashFiles,
    downloadFile,
    uploadFiles,
    uploadTasks,
    dismissUploadTasks,
    toggleBriefingFavorite,
  } = useLibrary();
  const { playBriefing } = useAudioPlayer();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const normalizedCurrent = normalizeFolderId(currentFolderId);

  const breadcrumbs = useMemo(
    () => getBreadcrumbTrail(folders, normalizedCurrent),
    [folders, normalizedCurrent]
  );

  const currentFolderObj = useMemo(
    () => folders.find((f) => f.id === normalizedCurrent && !f.isTrash) || null,
    [folders, normalizedCurrent]
  );

  const visibleFolders = useMemo(() => {
    if (favoritesOnly) {
      return folders.filter((f) => !f.isTrash && f.isFavorite);
    }
    return folders.filter(
      (f) => !f.isTrash && normalizeFolderId(f.parentId) === normalizedCurrent
    );
  }, [folders, favoritesOnly, normalizedCurrent]);

  const visibleFiles = useMemo(() => {
    if (favoritesOnly) {
      return files.filter((f) => !f.isTrash && f.isFavorite);
    }
    return files.filter(
      (f) => !f.isTrash && normalizeFolderId(f.folderId) === normalizedCurrent
    );
  }, [files, favoritesOnly, normalizedCurrent]);

  const starredBriefings = useMemo(() => {
    if (!favoritesOnly) return [];
    return briefings.filter((b) => b.isFavorite);
  }, [briefings, favoritesOnly]);

  const toggleSelectFile = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    if (selectedFileIds.length === visibleFiles.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(visibleFiles.map((f) => f.id));
    }
  };

  const handleBulkStar = async () => {
    await Promise.all(selectedFileIds.map((id) => toggleFileFavorite(id)));
    setSelectedFileIds([]);
  };

  const handleBulkTrash = async () => {
    await trashFiles(selectedFileIds);
    setSelectedFileIds([]);
  };

  const renderFileIcon = (file: FileItem) => {
    const cat = getFileCategory(file.mimeType, file.extension);
    if (cat === 'pdf') return <FileText className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />;
    if (cat === 'image') return <FileImage className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    if (cat === 'sheet') return <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    if (cat === 'audio') return <FileAudio className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />;
    return <FileText className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />;
  };

  return (
    <div
      onDragOver={(e) => {
        if (favoritesOnly) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (favoritesOnly) return;
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files?.length) {
          void uploadFiles(e.dataTransfer.files, normalizedCurrent);
        }
      }}
      className={`mx-auto max-w-7xl min-h-[calc(100vh-4rem)] space-y-6 p-4 sm:p-6 lg:p-8 transition-colors ${
        isDragOver ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
      }`}
    >
      {/* Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1 min-w-0">
          {favoritesOnly ? (
            <>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                Starred Notes, Folders &amp; Audio
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quick access to your pinned exam units and commute briefings
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                {breadcrumbs.map((crumb, i) => (
                  <React.Fragment key={crumb.id || 'root'}>
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFileIds([]);
                        openFolder(crumb.id);
                      }}
                      className={`hover:text-slate-900 dark:hover:text-slate-100 ${
                        i === breadcrumbs.length - 1
                          ? 'font-semibold text-slate-900 dark:text-slate-100'
                          : ''
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center gap-2.5">
                {currentFolderObj && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFileIds([]);
                      openFolder(currentFolderObj.parentId);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Up one folder"
                  >
                    <ArrowUpLeft className="h-3.5 w-3.5" />
                    Up
                  </button>
                )}
                <h2 className="truncate font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                  {currentFolderObj ? currentFolderObj.name : 'My Library (Root Index)'}
                </h2>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!favoritesOnly && (
            <>
              <button
                type="button"
                onClick={onOpenCreateFolder}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                New Folder
              </button>

              <button
                type="button"
                onClick={onOpenUpload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Files
              </button>
            </>
          )}

          {/* View Mode Segmented Control */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Compact Table View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <Grid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Upload Progress Banner */}
      {uploadTasks.length > 0 && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              File Upload Queue ({uploadTasks.filter((t) => t.status === 'completed').length}/
              {uploadTasks.length} completed)
            </span>
            <button
              type="button"
              onClick={dismissUploadTasks}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Clear Completed
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {uploadTasks.slice(0, 6).map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                    {task.fileName}
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      task.status === 'error'
                        ? 'text-rose-600'
                        : task.status === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {task.status === 'error' ? 'Error' : `${task.progress}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full transition-all duration-150 ${
                      task.status === 'error'
                        ? 'bg-rose-600'
                        : task.status === 'completed'
                          ? 'bg-emerald-600'
                          : 'bg-blue-600'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Selection Action Bar */}
      {selectedFileIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 px-4 py-2.5">
          <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 font-mono tabular-nums">
            {selectedFileIds.length} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onMoveFilesRequest(selectedFileIds)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <FolderInput className="h-3.5 w-3.5" />
              Move
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStar()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Star className="h-3.5 w-3.5" />
              Toggle Star
            </button>
            <button
              type="button"
              onClick={() => void handleBulkTrash()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Move to Trash
            </button>
            <button
              type="button"
              onClick={() => setSelectedFileIds([])}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white dark:hover:bg-slate-800"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Subfolders Section */}
      {visibleFolders.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Folders ({visibleFolders.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleFolders.map((folder) => {
              const colorCls =
                FOLDER_COLOR_CLASSES[folder.color || 'blue']?.icon || 'text-blue-600';
              const childFoldersCount = folders.filter(
                (f) => !f.isTrash && normalizeFolderId(f.parentId) === folder.id
              ).length;
              const childFilesCount = files.filter(
                (fl) => !fl.isTrash && normalizeFolderId(fl.folderId) === folder.id
              ).length;

              return (
                <div
                  key={folder.id}
                  onClick={() => {
                    setSelectedFileIds([]);
                    openFolder(folder.id);
                  }}
                  className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Folder className={`h-6 w-6 shrink-0 ${colorCls}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {folder.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {childFoldersCount} folders · {childFilesCount} files
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => void toggleFolderFavorite(folder.id)}
                      className={`rounded p-1.5 ${
                        folder.isFavorite
                          ? 'text-amber-500'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      title="Star folder"
                    >
                      <Star className={`h-3.5 w-3.5 ${folder.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditFolder(folder)}
                      className="rounded p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      title="Edit folder"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveFolderRequest(folder)}
                      className="rounded p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      title="Move folder"
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void trashFolder(folder.id)}
                      className="rounded p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      title="Move folder to Trash"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Starred Commute Briefings (in Favorites view) */}
      {favoritesOnly && starredBriefings.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Starred Commute Audio Summaries ({starredBriefings.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {starredBriefings.map((ep) => (
              <div
                key={ep.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {ep.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {ep.language} · {formatDuration(ep.durationSeconds)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void toggleBriefingFavorite(ep.id)}
                    className="rounded p-1.5 text-amber-500"
                    title="Unstar"
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void playBriefing(ep)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Play className="h-3 w-3" />
                    Play
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Files Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Documents &amp; Files ({visibleFiles.length})
          </h3>
          {visibleFiles.length > 0 && (
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            >
              {selectedFileIds.length === visibleFiles.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {visibleFiles.length === 0 && visibleFolders.length === 0 && starredBriefings.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-400" />
            <h4 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {favoritesOnly
                ? 'No starred items yet'
                : 'This folder is empty — drag & drop files anywhere'}
            </h4>
            <p className="mt-1 mx-auto max-w-md text-xs text-slate-500 dark:text-slate-400">
              {favoritesOnly
                ? 'Click the star icon on any folder, PDF, study note, or commute audio summary to pin it here.'
                : 'Create subject subfolders or upload PDFs, DOCX, PPTX, TXT notes, and articles directly into this folder.'}
            </p>
            {!favoritesOnly && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenCreateFolder}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Create Subfolder
                </button>
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Documents
                </button>
              </div>
            )}
          </div>
        ) : visibleFiles.length > 0 && viewMode === 'list' ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      aria-label="Toggle select all"
                    >
                      {selectedFileIds.length === visibleFiles.length ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Format</th>
                  <th className="px-3 py-3 font-medium text-right">Size</th>
                  <th className="px-3 py-3 font-medium text-right">Modified</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleFiles.map((file) => {
                  const isSelected = selectedFileIds.includes(file.id);
                  return (
                    <tr
                      key={file.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSelectFile(file.id)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          aria-label="Select file"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => onOpenFile(file)}
                          className="flex items-center gap-2.5 font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                        >
                          {renderFileIcon(file)}
                          <span className="truncate max-w-xs sm:max-w-md">{file.name}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                        {(file.extension || 'file').toUpperCase()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatBytes(file.size)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {formatShortDate(file.updatedAtMs)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenFile(file)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                            title="Preview / Read"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {file.textExcerpt && (
                            <button
                              type="button"
                              onClick={() => onSummarizeFile(file)}
                              className="rounded p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                              title="Create Personalized Commute Audio Summary"
                            >
                              <Headphones className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void toggleFileFavorite(file.id)}
                            className={`rounded p-1.5 ${
                              file.isFavorite
                                ? 'text-amber-500'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                            title="Star file"
                          >
                            <Star className={`h-3.5 w-3.5 ${file.isFavorite ? 'fill-current' : ''}`} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onRenameFileRequest(file)}
                            className="rounded p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onMoveFilesRequest([file.id])}
                            className="rounded p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Move to folder"
                          >
                            <FolderInput className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void downloadFile(file)}
                            className="rounded p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Download original file"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void trashFiles([file.id])}
                            className="rounded p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Move to Trash"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : visibleFiles.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleFiles.map((file) => (
              <div
                key={file.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenFile(file)}
                      className="flex min-w-0 items-center gap-2 text-left"
                    >
                      {renderFileIcon(file)}
                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                        {file.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleFileFavorite(file.id)}
                      className={`shrink-0 rounded p-1 ${
                        file.isFavorite ? 'text-amber-500' : 'text-slate-400'
                      }`}
                    >
                      <Star className={`h-3.5 w-3.5 ${file.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>{(file.extension || 'FILE').toUpperCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(file.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatShortDate(file.updatedAtMs)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenFile(file)}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:underline"
                  >
                    Open Reader
                  </button>
                  <div className="flex items-center gap-1.5">
                    {file.textExcerpt && (
                      <button
                        type="button"
                        onClick={() => onSummarizeFile(file)}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                      >
                        <Headphones className="h-3 w-3" />
                        Audio
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void downloadFile(file)}
                      className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
