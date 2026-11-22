import { useCallback, useEffect, useRef, useState } from 'react';
import { chunkSpeechText } from '../utils/spiritualLogic';
import type { LanguageCode } from '../types/fellowship';

export interface SpeechNarrationItem {
  id: string;
  title: string;
  speaker: string;
  scriptureRef: string;
  summary?: string;
  body: string;
}

const LANG_PREFIX_MAP: Record<LanguageCode, string[]> = {
  EN: ['en-NG', 'en-GB', 'en-US', 'en'],
  YO: ['yo', 'en-NG', 'en'],
  HA: ['ha', 'en-NG', 'en'],
  IG: ['ig', 'en-NG', 'en'],
};

function selectVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  language: LanguageCode
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const prefs = LANG_PREFIX_MAP[language] || ['en'];
  for (const prefix of prefs) {
    const lower = prefix.toLowerCase();
    const exact = voices.find((v) => v.lang.toLowerCase() === lower);
    if (exact) return exact;
    const partial = voices.find((v) => v.lang.toLowerCase().startsWith(lower));
    if (partial) return partial;
  }
  return voices.find((v) => v.default) || voices[0] || null;
}

export function useSpeechNarration(language: LanguageCode) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const activeItemRef = useRef<SpeechNarrationItem | null>(null);
  const sessionTokenRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;

    const loadVoices = () => {
      try {
        voicesRef.current = synth.getVoices();
      } catch {
        voicesRef.current = [];
      }
    };

    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      synth.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  const clearMediaSession = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch {
      // ignore unsupported Safari MediaSession APIs
    }
  }, []);

  const stop = useCallback(() => {
    sessionTokenRef.current += 1;
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    activeItemRef.current = null;
    setPlayingId(null);
    setIsPaused(false);
    setProgress(0);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    clearMediaSession();
  }, [clearMediaSession]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const speakChunkAtIndex = useCallback(
    (index: number, token: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      if (token !== sessionTokenRef.current) return;

      const chunks = chunksRef.current;
      if (index >= chunks.length) {
        setPlayingId(null);
        setIsPaused(false);
        setProgress(0);
        activeItemRef.current = null;
        clearMediaSession();
        return;
      }

      chunkIndexRef.current = index;
      const utter = new SpeechSynthesisUtterance(chunks[index]);
      const voice = selectVoiceForLanguage(voicesRef.current, language);
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else {
        utter.lang = language === 'YO' ? 'yo-NG' : language === 'HA' ? 'ha-NG' : language === 'IG' ? 'ig-NG' : 'en-NG';
      }
      utter.rate = 0.96;

      utter.onstart = () => {
        if (token !== sessionTokenRef.current) return;
        setProgress(Math.min(0.95, Math.max(0.08, (index + 0.35) / chunks.length)));
      };

      utter.onend = () => {
        if (token !== sessionTokenRef.current) return;
        setProgress(Math.min(1, (index + 1) / chunks.length));
        speakChunkAtIndex(index + 1, token);
      };

      utter.onerror = (ev) => {
        if (token !== sessionTokenRef.current) return;
        const errCode = (ev as SpeechSynthesisErrorEvent)?.error;
        if (errCode === 'canceled' || errCode === 'interrupted') {
          return;
        }
        setAudioError(
          'Audio playback was blocked or muted by the device. Ensure Silent Mode is off and tap Listen Aloud again.'
        );
        setPlayingId(null);
        setIsPaused(false);
        setProgress(0);
        clearMediaSession();
      };

      window.speechSynthesis.speak(utter);
    },
    [language, clearMediaSession]
  );

  const pause = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.pause();
      setIsPaused(true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    } catch {
      stop();
    }
  }, [stop]);

  const resume = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.resume();
      setIsPaused(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    } catch {
      if (activeItemRef.current) {
        speakChunkAtIndex(chunkIndexRef.current, sessionTokenRef.current);
      }
    }
  }, [speakChunkAtIndex]);

  /**
   * MUST be called directly inside user tap `onClick` with zero `await` beforehand
   * so iOS Safari grants Web Speech playback permission.
   */
  const playSynchronously = useCallback(
    (item: SpeechNarrationItem) => {
      setAudioError(null);
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setAudioError('Audio narration (Listen Aloud) is not supported in this browser.');
        return;
      }

      const synth = window.speechSynthesis;

      // Toggle pause/resume if tapping same item
      if (playingId === item.id) {
        if (isPaused) {
          resume();
        } else {
          pause();
        }
        return;
      }

      const fullSpeech = [
        item.title,
        `Scripture: ${item.scriptureRef}`,
        item.speaker ? `By ${item.speaker}` : '',
        item.summary || '',
        item.body,
      ]
        .filter(Boolean)
        .join('. ');

      const chunks = chunkSpeechText(fullSpeech, 210);
      if (chunks.length === 0) {
        setAudioError('No readable content available for audio narration.');
        return;
      }

      sessionTokenRef.current += 1;
      const nextToken = sessionTokenRef.current;

      if (synth.speaking || synth.pending) {
        synth.cancel();
      }

      chunksRef.current = chunks;
      chunkIndexRef.current = 0;
      activeItemRef.current = item;
      setPlayingId(item.id);
      setIsPaused(false);
      setProgress(Math.max(0.06, 1 / (chunks.length * 2)));

      // Update Lock Screen / Control Center MediaSession metadata
      try {
        if ('mediaSession' in navigator) {
          if (typeof MediaMetadata !== 'undefined') {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: item.title,
              artist: item.speaker || 'Youth Leadership',
              album: 'The Gideonites Spiritual Library',
            });
          }
          navigator.mediaSession.playbackState = 'playing';
          navigator.mediaSession.setActionHandler('play', () => resume());
          navigator.mediaSession.setActionHandler('pause', () => pause());
          navigator.mediaSession.setActionHandler('stop', () => stop());
        }
      } catch {
        // ignore MediaSession errors on older Safari versions
      }

      speakChunkAtIndex(0, nextToken);
    },
    [playingId, isPaused, pause, resume, stop, speakChunkAtIndex]
  );

  return {
    playingId,
    isPaused,
    progress,
    audioError,
    clearAudioError: () => setAudioError(null),
    playSynchronously,
    pause,
    resume,
    stop,
  };
}
