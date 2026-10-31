import React, { useState } from 'react';
import { FolderInput, FolderOpen, X } from 'lucide-react';
import { FolderItem } from '../../types';
import { isDescendantOrSelf, normalizeFolderId } from '../../utils/fileHelpers';

interface MoveModalProps {
  isOpen: boolean;
  title: string;
  movingFolderId?: string | null;
  currentParentId: string;
  folders: FolderItem[];
  onClose: () => void;
  onConfirmMove: (destinationFolderId: string) => Promise<void>;
}

export function MoveModal({
  isOpen,
  title,
  movingFolderId,
  currentParentId,
  folders,
  onClose,
  onConfirmMove,
}: MoveModalProps) {
  const [selectedId, setSelectedId] = useState<string>(normalizeFolderId(currentParentId));
  const [isMoving, setIsMoving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedId(normalizeFolderId(currentParentId));
    }
  }, [isOpen, currentParentId]);

  if (!isOpen) return null;

  const validDestinations = folders.filter((f) => {
    if (f.isTrash) return false;
    if (movingFolderId && isDescendantOrSelf(folders, movingFolderId, f.id)) {
      return false;
    }
    return true;
  });

  const handleConfirm = async () => {
    setIsMoving(true);
    try {
      await onConfirmMove(normalizeFolderId(selectedId));
      onClose();
    } finally {
      setIsMoving(false);
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
            <FolderInput className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          <button
            type="button"
            onClick={() => setSelectedId('')}
            className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
              selectedId === ''
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="truncate">My Library (Root Index)</span>
          </button>

          {validDestinations.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
                selectedId === f.id
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isMoving}
            onClick={handleConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {isMoving ? 'Moving...' : 'Move Here'}
          </button>
        </div>
      </div>
    </div>
  );
}
