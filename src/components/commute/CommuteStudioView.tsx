import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Globe,
  Headphones,
  ListMusic,
  Loader2,
  Mic,
  Play,
  Radio,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { FileItem } from '../../types';
import {
  formatDuration,
  formatShortDate,
  normalizeFolderId,
} from '../../utils/fileHelpers';

interface CommuteStudioViewProps {
  preselectedFile?: FileItem | null;
  onClearPreselectedFile: () => void;
}

const VOICES = [
  { id: 'Kore', label: 'Kore — Clear & Balanced' },
  { id: 'Puck', label: 'Puck — Warm & Conversational' },
  { id: 'Charon', label: 'Charon — Deep Broadcast' },
  { id: 'Zephyr', label: 'Zephyr — Crisp & Energetic' },
  { id: 'Fenrir', label: 'Fenrir — Authoritative' },
];

const SAMPLE_NEWS_ARTICLES = [
  {
    title: 'Global Clean Energy & Grid Battery Breakthroughs',
    body: `Utility-scale battery storage installations surged by 62 percent over the past twelve months as sodium-ion and high-density lithium-iron-phosphate packs entered mass commercial grid deployment across Asia, Europe, and North America. Grid operators report that pairing four-hour and eight-hour storage banks directly with solar parks has cut evening peak gas-peaker dispatch in several regional markets by nearly a third.\n\nMeanwhile, major transit agencies are rolling out inductive fast-charging corridors for electric commuter buses, allowing fleets to top up during ninety-second passenger stops without oversized depot transformers.`,
  },
  {
    title: 'Next-Gen mRNA & Targeted Nanoparticle Drug Delivery',
    body: `Pharmaceutical researchers published multi-center Phase II findings demonstrating tissue-selective lipid nanoparticles capable of delivering therapeutic mRNA payloads directly to pulmonary and hepatic targets while reducing off-target systemic inflammation by over 45 percent. Formulation scientists highlighted lyophilized thermostable vials that remain stable at standard refrigerator temperatures (2–8 °C) for six months, dramatically simplifying cold-chain distribution for regional clinics.`,
  },
];

export function CommuteStudioView({
  preselectedFile,
  onClearPreselectedFile,
}: CommuteStudioViewProps) {
  const {
    folders,
    files,
    briefings,
    currentFolderId,
    saveGeneratedBriefing,
    toggleBriefingFavorite,
    deleteBriefing,
    notify,
  } = useLibrary();
  const { playBriefing, playBriefingQueue, currentTrack, isPlaying } = useAudioPlayer();

  const [inputMode, setInputMode] = useState<'paste' | 'url' | 'library'>('paste');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleText, setArticleText] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'podcast' | 'single'>('podcast');
  const [voiceName, setVoiceName] = useState<string>('Puck');
  const [secondaryVoice, setSecondaryVoice] = useState<string>('Kore');
  const [lengthStyle, setLengthStyle] = useState<'quick' | 'standard' | 'detailed'>('standard');
  const [language, setLanguage] = useState<'English' | 'Hindi' | 'Hinglish'>('English');
  const [focusPrompt, setFocusPrompt] = useState('');
  const [targetFolderId, setTargetFolderId] = useState<string>(normalizeFolderId(currentFolderId));
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const summarizableFiles = useMemo(
    () => files.filter((f) => !f.isTrash && f.textExcerpt.trim().length > 0),
    [files]
  );

  // Pre-fill when user clicks "Audio Summary" on any PDF or note in their library
  useEffect(() => {
    if (!preselectedFile) return;
    if (preselectedFile.textExcerpt.trim()) {
      setInputMode('paste');
      setArticleTitle(preselectedFile.name);
      setArticleText(preselectedFile.textExcerpt);
      setTargetFolderId(normalizeFolderId(preselectedFile.folderId));
    } else {
      setInputMode('library');
    }
    onClearPreselectedFile();
  }, [preselectedFile, onClearPreselectedFile]);

  const handleFetchArticleUrl = async () => {
    if (!articleUrl.trim()) return;
    setIsFetchingUrl(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/fetch-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: articleUrl.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Could not extract article text.');
      }
      setArticleTitle(data.title || '');
      setArticleText(data.content || '');
      setInputMode('paste');
      notify('Article extracted and ready for audio summary.', 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to fetch URL.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const toggleSelectLibraryFile = (id: string) => {
    setSelectedLibraryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGenerateCommuteAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let combinedSourceText = articleText.trim();
    let combinedSourceTitle = articleTitle.trim();

    if (inputMode === 'library') {
      const chosen = summarizableFiles.filter((f) => selectedLibraryIds.includes(f.id));
      if (chosen.length === 0) {
        setErrorMsg('Select at least one PDF or note from your library.');
        return;
      }
      combinedSourceTitle = chosen.map((c) => c.name).join(' + ');
      combinedSourceText = chosen
        .map((c) => `--- Document: ${c.name} ---\n${c.textExcerpt}`)
        .join('\n\n');
    }

    if (combinedSourceText.length < 25) {
      setErrorMsg('Please paste a news article, fetch a URL, or select a study document first.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/audio-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceText: combinedSourceText,
          sourceTitle: combinedSourceTitle,
          mode,
          voiceName,
          secondaryVoice,
          lengthStyle,
          language,
          focusPrompt,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate commute audio summary.');
      }

      const { briefing, audioBlob } = await saveGeneratedBriefing({
        folderId: normalizeFolderId(targetFolderId),
        title: data.title,
        sourceTitle: combinedSourceTitle || data.title,
        mode,
        voiceInfo: data.voiceInfo,
        language,
        durationSeconds: data.durationSeconds,
        summaryText: data.summaryText,
        keyTakeaways: data.keyTakeaways || [],
        scriptText: data.scriptText,
        audioBase64: data.audioBase64,
      });

      await playBriefing(briefing, audioBlob);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const activeFolders = folders.filter((f) => !f.isTrash);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Top Intro & Commute Queue Action */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Personalized Commute Audio Studio
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Turn news articles, web links, or uploaded PDFs and study notes into natural single-anchor
            or dual-host audio briefings powered by Gemini 3.8 Flash TTS.
          </p>
        </div>

        {briefings.length > 0 && (
          <button
            type="button"
            onClick={() => void playBriefingQueue(briefings, 0)}
            className="flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2.5 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0"
          >
            <ListMusic className="h-4 w-4" />
            Play Commute Queue ({briefings.length})
          </button>
        )}
      </div>

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Composer (7 cols) */}
        <form
          onSubmit={handleGenerateCommuteAudio}
          className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          {/* Source Mode Segmented Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  inputMode === 'paste'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Radio className="h-3.5 w-3.5" />
                Paste News / Text
              </button>
              <button
                type="button"
                onClick={() => setInputMode('url')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  inputMode === 'url'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Import Article URL
              </button>
              <button
                type="button"
                onClick={() => setInputMode('library')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  inputMode === 'library'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                From Library ({summarizableFiles.length})
              </button>
            </div>

            {inputMode === 'paste' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Try sample:</span>
                {SAMPLE_NEWS_ARTICLES.map((sample, i) => (
                  <button
                    key={sample.title}
                    type="button"
                    onClick={() => {
                      setArticleTitle(sample.title);
                      setArticleText(sample.body);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap"
                  >
                    Sample {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Source Content Area */}
          {inputMode === 'url' ? (
            <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                News Article Web Link
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  placeholder="https://example.com/news-article"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isFetchingUrl || !articleUrl.trim()}
                  onClick={() => void handleFetchArticleUrl()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {isFetchingUrl ? 'Extracting...' : 'Fetch Text'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extracts the clean article headline and body into the editor so you can review or combine multiple stories.
              </p>
            </div>
          ) : inputMode === 'library' ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Select Uploaded PDFs or Text Notes to Combine into One Commute Episode
              </label>
              {summarizableFiles.length === 0 ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 text-center text-xs text-slate-500">
                  No indexed PDFs or text notes yet. Upload a PDF or TXT file in My Library or paste an article directly.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                  {summarizableFiles.map((file) => {
                    const checked = selectedLibraryIds.includes(file.id);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => toggleSelectLibraryFile(file.id)}
                        className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors ${
                          checked
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <p className="truncate font-medium">{file.name}</p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {file.textExcerpt.slice(0, 90)}...
                          </p>
                        </div>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Headline or Topic Title (Optional)
                </label>
                <input
                  type="text"
                  maxLength={180}
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  placeholder="e.g. Morning Tech & Markets Briefing — Oct 30"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    News Articles or Study Notes Text
                  </label>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    {articleText.length.toLocaleString()} chars
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={articleText}
                  onChange={(e) => setArticleText(e.target.value)}
                  placeholder="Paste one or multiple news articles, research abstracts, or lecture notes here..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3.5 text-sm leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Personalization Controls */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Audio Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('podcast')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === 'podcast'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  2-Host Podcast
                </button>
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === 'single'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" />
                  News Anchor
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Commute Length
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'quick', label: '1m Blitz' },
                    { id: 'standard', label: '2m Brief' },
                    { id: 'detailed', label: '4m Deep' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLengthStyle(opt.id)}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      lengthStyle === opt.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {mode === 'podcast' ? 'Lead Host Voice (Alex)' : 'Anchor Voice'}
              </label>
              <select
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {mode === 'podcast' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Co-Host Voice (Sam)
                </label>
                <select
                  value={secondaryVoice}
                  onChange={(e) => setSecondaryVoice(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
                >
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Spoken Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'English' | 'Hindi' | 'Hinglish')}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Hinglish">Hinglish (Conversational Mix)</option>
                </select>
              </div>
            )}

            {mode === 'podcast' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Spoken Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'English' | 'Hindi' | 'Hinglish')}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Hinglish">Hinglish (Conversational Mix)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Save WAV Audio into Folder
              </label>
              <select
                value={targetFolderId}
                onChange={(e) => setTargetFolderId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
              >
                <option value="">My Library (Root Index)</option>
                {activeFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Personal Focus (Optional)
            </label>
            <input
              type="text"
              maxLength={200}
              value={focusPrompt}
              onChange={(e) => setFocusPrompt(e.target.value)}
              placeholder="e.g. Highlight exam definitions, market impact, or action items"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <p className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Synthesizing Personalized Audio with Gemini 3.8 TTS...
              </>
            ) : (
              <>
                <Headphones className="h-4 w-4" />
                Generate &amp; Play Commute Audio Summary
              </>
            )}
          </button>
        </form>

        {/* Right Column: Saved Commute Episodes Playlist (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Saved Commute Briefings
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {briefings.length} {briefings.length === 1 ? 'episode' : 'episodes'}
            </span>
          </div>

          {briefings.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
              <Headphones className="mx-auto h-9 w-9 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                Your commute playlist is empty
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Paste any news article or pick a study PDF on the left to create your first personalized audio episode.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {briefings.map((ep) => {
                const isThisPlaying = currentTrack?.id === ep.id && isPlaying;
                return (
                  <div
                    key={ep.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {ep.title}
                        </h4>
                        {/* Unboxed clean metadata with typographic separators */}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>{ep.mode === 'podcast' ? 'Podcast' : 'Anchor'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ep.language}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatDuration(ep.durationSeconds)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatShortDate(ep.createdAtMs)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleBriefingFavorite(ep.id)}
                          className={`rounded-lg p-1.5 transition-colors ${
                            ep.isFavorite
                              ? 'text-amber-500'
                              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                          title="Star episode"
                        >
                          <Star className={`h-4 w-4 ${ep.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteBriefing(ep.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          title="Delete episode"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">
                      {ep.summaryText}
                    </p>

                    {ep.keyTakeaways.length > 0 && (
                      <ul className="mt-2.5 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-2.5 text-xs text-slate-600 dark:text-slate-400">
                        {ep.keyTakeaways.slice(0, 3).map((pt, idx) => (
                          <li key={idx} className="truncate">
                            • {pt}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {ep.voiceInfo}
                      </span>
                      <button
                        type="button"
                        onClick={() => void playBriefing(ep)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {isThisPlaying ? 'Playing' : 'Listen Now'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
