import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AudioBriefing } from '../types';
import { useLibrary } from './LibraryContext';

export interface PlayableTrack {
  id: string;
  title: string;
  subtitle: string;
  scriptText: string;
  summaryText: string;
  audioFileId?: string;
  directBlob?: Blob;
  durationHint?: number;
}

interface AudioPlayerContextValue {
  currentTrack: PlayableTrack | null;
  queue: PlayableTrack[];
  isPlaying: boolean;
  isLoadingAudio: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  showTranscript: boolean;
  setShowTranscript: (show: boolean) => void;
  playBriefing: (briefing: AudioBriefing, directBlob?: Blob) => Promise<void>;
  playBriefingQueue: (list: AudioBriefing[], startIndex?: number) => Promise<void>;
  playDirectTrack: (track: PlayableTrack) => Promise<void>;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => void;
  skipBy: (deltaSeconds: number) => void;
  cyclePlaybackRate: () => void;
  playNextInQueue: () => void;
  playPrevInQueue: () => void;
  closePlayer: () => void;
  downloadCurrentTrackWav: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);

const RATES = [1, 1.25, 1.5, 1.75, 2];

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const { files, resolveFileBlob, notify } = useLibrary();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const currentBlobRef = useRef<Blob | null>(null);

  const [currentTrack, setCurrentTrack] = useState<PlayableTrack | null>(null);
  const [queue, setQueue] = useState<PlayableTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const loadAndStartTrack = useCallback(
    async (track: PlayableTrack) => {
      const audio = audioRef.current;
      if (!audio) return;

      setIsLoadingAudio(true);
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(track.durationHint || 0);

      try {
        let blob: Blob | undefined = track.directBlob;
        if (!blob && track.audioFileId) {
          const matchingFile = files.find((f) => f.id === track.audioFileId);
          if (matchingFile) {
            blob = await resolveFileBlob(matchingFile);
          } else {
            // Construct minimal FileItem descriptor to fetch from cache/Firestore
            blob = await resolveFileBlob({
              id: track.audioFileId,
              userId: '',
              folderId: '',
              name: `${track.title}.wav`,
              originalName: `${track.title}.wav`,
              size: 0,
              mimeType: 'audio/wav',
              extension: 'wav',
              chunkCount: 1,
              textExcerpt: '',
              isFavorite: false,
              isTrash: false,
              createdAtMs: Date.now(),
              updatedAtMs: Date.now(),
            });
          }
        }

        if (!blob) {
          throw new Error('Audio stream is unavailable for this briefing.');
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        currentBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        audio.src = url;
        audio.playbackRate = playbackRate;
        await audio.play();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to play audio';
        notify(msg, 'error');
        setIsPlaying(false);
      } finally {
        setIsLoadingAudio(false);
      }
    },
    [files, resolveFileBlob, playbackRate, notify]
  );

  // Auto-advance commute queue when an episode finishes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setIsPlaying(false);
      if (queue.length > 1 && queueIndex + 1 < queue.length) {
        const nextIdx = queueIndex + 1;
        setQueueIndex(nextIdx);
        void loadAndStartTrack(queue[nextIdx]);
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [queue, queueIndex, loadAndStartTrack]);

  const briefingToTrack = (b: AudioBriefing, directBlob?: Blob): PlayableTrack => ({
    id: b.id,
    title: b.title,
    subtitle: `${b.mode === 'podcast' ? 'Podcast' : 'Briefing'} · ${b.voiceInfo} · ${b.language}`,
    scriptText: b.scriptText,
    summaryText: b.summaryText,
    audioFileId: b.audioFileId,
    directBlob,
    durationHint: b.durationSeconds,
  });

  const playBriefing = useCallback(
    async (briefing: AudioBriefing, directBlob?: Blob) => {
      const track = briefingToTrack(briefing, directBlob);
      setQueue([track]);
      setQueueIndex(0);
      await loadAndStartTrack(track);
    },
    [loadAndStartTrack]
  );

  const playBriefingQueue = useCallback(
    async (list: AudioBriefing[], startIndex = 0) => {
      if (list.length === 0) return;
      const tracks = list.map((b) => briefingToTrack(b));
      const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));
      setQueue(tracks);
      setQueueIndex(idx);
      await loadAndStartTrack(tracks[idx]);
    },
    [loadAndStartTrack]
  );

  const playDirectTrack = useCallback(
    async (track: PlayableTrack) => {
      setQueue([track]);
      setQueueIndex(0);
      await loadAndStartTrack(track);
    },
    [loadAndStartTrack]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, [currentTrack]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration || seconds));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seekTo((audio.currentTime || 0) + deltaSeconds);
    },
    [seekTo]
  );

  const cyclePlaybackRate = useCallback(() => {
    const currentIdx = RATES.indexOf(playbackRate);
    const nextRate = RATES[(currentIdx + 1) % RATES.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  }, [playbackRate]);

  const playNextInQueue = useCallback(() => {
    if (queueIndex + 1 < queue.length) {
      const nextIdx = queueIndex + 1;
      setQueueIndex(nextIdx);
      void loadAndStartTrack(queue[nextIdx]);
    }
  }, [queue, queueIndex, loadAndStartTrack]);

  const playPrevInQueue = useCallback(() => {
    if (queueIndex - 1 >= 0) {
      const prevIdx = queueIndex - 1;
      setQueueIndex(prevIdx);
      void loadAndStartTrack(queue[prevIdx]);
    } else {
      seekTo(0);
    }
  }, [queue, queueIndex, loadAndStartTrack, seekTo]);

  const closePlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    setCurrentTrack(null);
    setShowTranscript(false);
    setIsPlaying(false);
  }, []);

  const downloadCurrentTrackWav = useCallback(() => {
    if (!currentBlobRef.current || !currentTrack) return;
    const url = URL.createObjectURL(currentBlobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTrack.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Commute_Audio'}.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, [currentTrack]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        isLoadingAudio,
        currentTime,
        duration,
        playbackRate,
        showTranscript,
        setShowTranscript,
        playBriefing,
        playBriefingQueue,
        playDirectTrack,
        togglePlayPause,
        seekTo,
        skipBy,
        cyclePlaybackRate,
        playNextInQueue,
        playPrevInQueue,
        closePlayer,
        downloadCurrentTrackWav,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  return ctx;
}
