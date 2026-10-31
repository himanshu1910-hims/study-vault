import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Cloud,
  Folder,
  FolderOpen,
  HardDrive,
  Headphones,
  LayoutDashboard,
  RefreshCw,
  Settings,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { FolderItem, ViewSection } from '../../types';
import {
  FOLDER_COLOR_CLASSES,
  formatBytes,
  normalizeFolderId,
} from '../../utils/fileHelpers';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const SPARK_FREE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GB reference meter

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const {
    folders,
    files,
    briefings,
    activeSection,
    setActiveSection,
    currentFolderId,
    openFolder,
    totalStorageUsedBytes,
    isCloudSynced,
    hasUnsyncedLocalData,
    isSyncingLocalToCloud,
    syncLocalDataToCloud,
  } = useLibrary();

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({ root: true });

  const activeFolders = folders.filter((f) => !f.isTrash);
  const trashedCount =
    folders.filter((f) => f.isTrash).length + files.filter((f) => f.isTrash).length;

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNav = (section: ViewSection) => {
    setActiveSection(section);
    onCloseMobile();
  };

  const handleSelectFolder = (folderId: string) => {
    openFolder(folderId);
    onCloseMobile();
  };

  const renderFolderBranch = (parentId: string, depth = 0): React.ReactNode => {
    const children = activeFolders.filter(
      (f) => normalizeFolderId(f.parentId) === normalizeFolderId(parentId)
    );
    if (children.length === 0 || depth > 8) return null;

    return (
      <div className="space-y-0.5">
        {children.map((folder: FolderItem) => {
          const hasChildren = activeFolders.some(
            (child) => normalizeFolderId(child.parentId) === folder.id
          );
          const isExpanded = Boolean(expandedIds[folder.id]);
          const isSelected = activeSection === 'library' && currentFolderId === folder.id;
          const colorCls = FOLDER_COLOR_CLASSES[folder.color || 'blue']?.icon || 'text-blue-600';

          return (
            <div key={folder.id}>
              <div
                onClick={() => handleSelectFolder(folder.id)}
                style={{ paddingLeft: `${12 + depth * 14}px` }}
                className={`group flex cursor-pointer items-center gap-1.5 rounded-lg py-1.5 pr-2.5 text-xs transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(folder.id, e)}
                    className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                    aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                {isSelected ? (
                  <FolderOpen className={`h-3.5 w-3.5 shrink-0 ${colorCls}`} />
                ) : (
                  <Folder className={`h-3.5 w-3.5 shrink-0 ${colorCls}`} />
                )}
                <span className="truncate">{folder.name}</span>
              </div>
              {hasChildren && isExpanded && renderFolderBranch(folder.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const navItems: {
    id: ViewSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'commute', label: 'Commute Audio', icon: Headphones, count: briefings.length || undefined },
    { id: 'favorites', label: 'Starred Items', icon: Star },
    { id: 'trash', label: 'Recycle Bin', icon: Trash2, count: trashedCount || undefined },
    { id: 'settings', label: 'Backup & Hosting', icon: Settings },
  ];

  const quotaPct = Math.min(100, (totalStorageUsedBytes / SPARK_FREE_QUOTA_BYTES) * 100);

  const sidebarContent = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none">
      {/* Brand Header */}
      <div className="flex h-15 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5">
        <button
          type="button"
          onClick={() => handleNav('dashboard')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0"
        >
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            StudyVault
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Workspace Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <nav className="space-y-1">
          {/* Explicit Root / Index Library Button */}
          <button
            type="button"
            onClick={() => handleSelectFolder('')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeSection === 'library' && currentFolderId === ''
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
            }`}
          >
            <span className="flex items-center gap-2.5 truncate">
              <FolderOpen className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="truncate">My Library (Index)</span>
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {files.filter((f) => !f.isTrash).length}
            </span>
          </button>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Hierarchical Subject & Topic Folder Tree */}
        <div>
          <div className="mb-1.5 flex items-center justify-between px-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Subject Folders
            </span>
            <button
              type="button"
              onClick={() =>
                setExpandedIds((prev) => ({ ...prev, root: !(prev.root ?? true) }))
              }
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              {expandedIds.root ?? true ? 'Hide' : 'Show'}
            </button>
          </div>

          {(expandedIds.root ?? true) && (
            <div className="mt-1">
              {activeFolders.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                  No folders yet. Create subjects or news topics anytime.
                </p>
              ) : (
                renderFolderBranch('', 0)
              )}
            </div>
          )}
        </div>
      </div>

      {/* Storage & Sync Footer */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
        {hasUnsyncedLocalData && isCloudSynced && (
          <button
            type="button"
            disabled={isSyncingLocalToCloud}
            onClick={() => void syncLocalDataToCloud()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncingLocalToCloud ? 'animate-spin' : ''}`} />
            {isSyncingLocalToCloud ? 'Syncing to Cloud...' : 'Sync Local Items to Cloud'}
          </button>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              {isCloudSynced ? (
                <Cloud className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              ) : (
                <HardDrive className="h-3.5 w-3.5 text-slate-400" />
              )}
              {isCloudSynced ? 'Firebase Cloud' : 'Local Cache'}
            </span>
            <span className="font-mono tabular-nums">
              {formatBytes(totalStorageUsedBytes)} / 1 GB
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-blue-600 transition-all duration-200"
              style={{ width: `${Math.max(quotaPct, totalStorageUsedBytes > 0 ? 2 : 0)}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block lg:shrink-0">{sidebarContent}</div>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 flex bg-slate-950/60 backdrop-blur-[1px] lg:hidden"
          onClick={onCloseMobile}
        >
          <div onClick={(e) => e.stopPropagation()}>{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
