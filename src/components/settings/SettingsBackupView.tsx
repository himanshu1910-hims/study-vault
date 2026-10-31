import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Database,
  Download,
  Globe,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BackupArchivePayload, useLibrary } from '../../context/LibraryContext';
import { FIREBASE_PROJECT_ID } from '../../lib/firebase';
import { formatBytes, getFileCategory } from '../../utils/fileHelpers';

export function SettingsBackupView() {
  const { user, signInWithGoogle, isSigningIn } = useAuth();
  const {
    files,
    folders,
    briefings,
    totalStorageUsedBytes,
    isCloudSynced,
    hasUnsyncedLocalData,
    isSyncingLocalToCloud,
    syncLocalDataToCloud,
    exportLibraryBackup,
    restoreLibraryBackup,
    notify,
  } = useLibrary();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const breakdown = useMemo(() => {
    const map: Record<string, { label: string; bytes: number; count: number }> = {
      pdf: { label: 'PDF Documents', bytes: 0, count: 0 },
      doc: { label: 'Word & Text Notes', bytes: 0, count: 0 },
      slide: { label: 'Presentations & Sheets', bytes: 0, count: 0 },
      audio: { label: 'Commute WAV Summaries', bytes: 0, count: 0 },
      image: { label: 'Images & Diagrams', bytes: 0, count: 0 },
    };

    for (const fl of files.filter((x) => !x.isTrash)) {
      const cat = getFileCategory(fl.mimeType, fl.extension);
      if (cat === 'pdf') {
        map.pdf.bytes += fl.size;
        map.pdf.count += 1;
      } else if (cat === 'audio') {
        map.audio.bytes += fl.size;
        map.audio.count += 1;
      } else if (cat === 'image') {
        map.image.bytes += fl.size;
        map.image.count += 1;
      } else if (cat === 'slide' || cat === 'sheet') {
        map.slide.bytes += fl.size;
        map.slide.count += 1;
      } else {
        map.doc.bytes += fl.size;
        map.doc.count += 1;
      }
    }

    return Object.values(map);
  }, [files]);

  const handleDownloadBackup = () => {
    const archive = exportLibraryBackup();
    const json = JSON.stringify(archive, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studyvault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    notify('JSON backup downloaded.', 'success');
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupArchivePayload;
      await restoreLibraryBackup(parsed);
    } catch {
      notify('Invalid JSON backup file.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
          Cloud Storage, JSON Backup &amp; Online Hosting
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Manage your Firebase Firestore database sync, catalog snapshots, and GitHub Pages / Cloud Run deployment
        </p>
      </div>

      {/* Firebase Database Status */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Firebase Cloud Database ({FIREBASE_PROJECT_ID})
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {isCloudSynced
                  ? `Signed in as ${user?.email}. Folders, chunked files, and commute audio summaries sync automatically.`
                  : 'Currently running in fast local IndexedDB mode. Sign in with Google to enable real-time Firebase Cloud sync across devices.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsyncedLocalData && isCloudSynced && (
              <button
                type="button"
                disabled={isSyncingLocalToCloud}
                onClick={() => void syncLocalDataToCloud()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingLocalToCloud ? 'animate-spin' : ''}`} />
                Sync Local Items
              </button>
            )}
            {!user && (
              <button
                type="button"
                disabled={isSigningIn}
                onClick={() => void signInWithGoogle()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Categorized Quota Breakdown */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Storage Breakdown
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
            {formatBytes(totalStorageUsedBytes)} used ({folders.filter((f) => !f.isTrash).length}{' '}
            folders · {files.filter((f) => !f.isTrash).length} files · {briefings.length} briefings)
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
          {breakdown.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-slate-700 dark:text-slate-300">{row.label}</span>
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {row.count} files · {formatBytes(row.bytes)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* One-Click JSON Backup & Restore */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            One-Click JSON Catalog Backup &amp; Restore
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Export a local snapshot of all folder hierarchies, note excerpts, and commute scripts, or restore from an existing backup file.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON Backup
          </button>

          <button
            type="button"
            disabled={isRestoring}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            {isRestoring ? 'Restoring...' : 'Restore from JSON'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleRestoreFileChange(e)}
          />
        </div>
      </section>

      {/* GitHub Pages & Online Deployment Readiness */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            GitHub Pages &amp; Cloud Deployment Ready
          </h3>
        </div>
        <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Relative Asset Paths Configured (<code>base: './'</code>):</strong>{' '}
              <code>npm run build</code> compiles clean relative bundles inside <code>dist/index.html</code> so subpath URLs like <code>username.github.io/repo-name/</code> load without blank screens.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Automatic GitHub Actions Workflow Included:</strong>{' '}
              <code>.github/workflows/deploy.yml</code> automatically builds TypeScript + Vite and publishes <code>dist/</code> to GitHub Pages whenever you push to <code>main</code> (set GitHub Repository Settings → Pages → Source to <em>GitHub Actions</em>).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Full-Stack AI Audio Server:</strong> For Gemini 3.8 TTS audio generation online, deploy via AI Studio Publish / Cloud Run (<code>npm start</code>) so server-side <code>/api/audio-summary</code> runs with your secret key.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
