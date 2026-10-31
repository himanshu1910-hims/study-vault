import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  FileText,
  Folder,
  Headphones,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { FileItem } from '../../types';
import { getBreadcrumbTrail } from '../../utils/fileHelpers';

interface TopBarProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenMobileSidebar: () => void;
  onOpenUploadModal: () => void;
  onOpenFile: (file: FileItem) => void;
}

export function TopBar({
  isDark,
  onToggleTheme,
  onOpenMobileSidebar,
  onOpenUploadModal,
  onOpenFile,
}: TopBarProps) {
  const { user, isSigningIn, signInWithGoogle, signOutUser } = useAuth();
  const {
    folders,
    files,
    briefings,
    activeSection,
    setActiveSection,
    currentFolderId,
    openFolder,
    searchQuery,
    setSearchQuery,
  } = useLibrary();
  const { playBriefing } = useAudioPlayer();

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  const breadcrumbs = useMemo(
    () => getBreadcrumbTrail(folders, currentFolderId),
    [folders, currentFolderId]
  );

  const sectionLabels: Record<string, string> = {
    dashboard: 'Workspace Overview',
    commute: 'Commute Audio Studio',
    favorites: 'Starred Notes & Briefings',
    trash: 'Recycle Bin',
    settings: 'Backup & Online Hosting',
  };

  const liveResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { folders: [], files: [], briefings: [] };
    return {
      folders: folders
        .filter((f) => !f.isTrash && f.name.toLowerCase().includes(q))
        .slice(0, 5),
      files: files
        .filter(
          (fl) =>
            !fl.isTrash &&
            (fl.name.toLowerCase().includes(q) || fl.textExcerpt.toLowerCase().includes(q))
        )
        .slice(0, 6),
      briefings: briefings
        .filter(
          (b) =>
            b.title.toLowerCase().includes(q) ||
            b.summaryText.toLowerCase().includes(q) ||
            b.sourceTitle.toLowerCase().includes(q)
        )
        .slice(0, 4),
    };
  }, [searchQuery, folders, files, briefings]);

  const totalHits =
    liveResults.folders.length + liveResults.files.length + liveResults.briefings.length;

  return (
    <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 lg:px-6">
      {/* Zone 1: Mobile Menu + Contextual Breadcrumb Trail */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {activeSection === 'library' ? (
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1 text-sm font-medium overflow-hidden"
          >
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id || 'root'}>
                  {index > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                  <button
                    type="button"
                    onClick={() => openFolder(crumb.id)}
                    className={`truncate max-w-[160px] rounded px-1.5 py-0.5 transition-colors whitespace-nowrap ${
                      isLast
                        ? 'font-semibold text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <h1 className="truncate font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {sectionLabels[activeSection] || 'StudyVault'}
          </h1>
        )}
      </div>

      {/* Zone 2: Instant Global Live Search */}
      <div className="relative flex-1 max-w-md" ref={searchBoxRef}>
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 180)}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search folders, PDFs, notes, or audio summaries..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-8 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {isSearchFocused && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 max-h-96 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl z-50">
            {totalHits === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">
                No matching folders, documents, or audio briefings found.
              </p>
            ) : (
              <div className="space-y-2">
                {liveResults.folders.length > 0 && (
                  <div>
                    <p className="px-2.5 py-1 text-[11px] font-semibold text-slate-400">Folders</p>
                    {liveResults.folders.map((fd) => (
                      <button
                        key={fd.id}
                        type="button"
                        onMouseDown={() => {
                          openFolder(fd.id);
                          setSearchQuery('');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Folder className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="truncate font-medium">{fd.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {liveResults.files.length > 0 && (
                  <div>
                    <p className="px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                      Documents &amp; Notes
                    </p>
                    {liveResults.files.map((fl) => (
                      <button
                        key={fl.id}
                        type="button"
                        onMouseDown={() => {
                          onOpenFile(fl);
                          setSearchQuery('');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate font-medium">{fl.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {liveResults.briefings.length > 0 && (
                  <div>
                    <p className="px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                      Commute Audio Summaries
                    </p>
                    {liveResults.briefings.map((br) => (
                      <button
                        key={br.id}
                        type="button"
                        onMouseDown={() => {
                          setActiveSection('commute');
                          void playBriefing(br);
                          setSearchQuery('');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Headphones className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="truncate font-medium">{br.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zone 3: Primary Action + Theme + Account */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onOpenUploadModal}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Files
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Toggle color theme"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {user ? (
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User avatar'}
                referrerPolicy="no-referrer"
                className="h-7 w-7 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isSigningIn}
            onClick={() => void signInWithGoogle()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <LogIn className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            {isSigningIn ? 'Signing in...' : 'Sign In'}
          </button>
        )}
      </div>
    </header>
  );
}
