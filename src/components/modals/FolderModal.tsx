import React, { useEffect, useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import { FolderColor, FolderItem } from '../../types';
import { FOLDER_COLOR_CLASSES, normalizeFolderId } from '../../utils/fileHelpers';

interface FolderModalProps {
  isOpen: boolean;
  initialParentId: string;
  editFolder?: FolderItem | null;
  folders: FolderItem[];
  onClose: () => void;
  onSubmit: (name: string, parentId: string, color: FolderColor) => Promise<void>;
}

const COLORS: FolderColor[] = ['blue', 'emerald', 'amber', 'rose', 'violet', 'slate'];

export function FolderModal({
  isOpen,
  initialParentId,
  editFolder,
  folders,
  onClose,
  onSubmit,
}: FolderModalProps) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [color, setColor] = useState<FolderColor>('blue');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editFolder) {
      setName(editFolder.name);
      setParentId(normalizeFolderId(editFolder.parentId));
      setColor(editFolder.color || 'blue');
    } else {
      setName('');
      setParentId(normalizeFolderId(initialParentId));
      setColor('blue');
    }
  }, [isOpen, initialParentId, editFolder]);

  if (!isOpen) return null;

  const activeFolders = folders.filter(
    (f) => !f.isTrash && (!editFolder || f.id !== editFolder.id)
  );

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a folder name.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed, normalizeFolderId(parentId), color);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save folder.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {editFolder ? 'Edit Folder' : 'Create New Folder'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Folder or Subject Name
            </label>
            <input
              type="text"
              autoFocus
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. M.Pharm, Pharmaceutics, Daily Tech News"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {!editFolder && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Parent Location
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
              >
                <option value="">My Library (Root Index)</option>
                {activeFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Folder Accent Color
            </label>
            <div className="flex items-center gap-3">
              {COLORS.map((c) => {
                const cfg = FOLDER_COLOR_CLASSES[c];
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    title={cfg.label}
                    className={`h-7 w-7 rounded-full ${cfg.swatch} transition-transform ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-blue-600 dark:ring-offset-slate-900 scale-110'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {isSubmitting ? 'Saving...' : editFolder ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
