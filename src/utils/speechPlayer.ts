import {
  chunkSpeechText,
  getSpeechLangFallbackTags,
  getSpeechLangTag,
} from './spiritualLogic';
import type { LanguageCode } from '../types/fellowship';

export interface SpeechCallbacks {
  onStart?: (totalChunks: number) => void;
  onProgress?: (progress: number, chunkIndex: number, totalChunks: number) => void;
  onEnd?: () => void;
  onPauseChange?: (isPaused: boolean) => void;
  onError?: (message: string) => void;
}

class SpiritualSpeechController {
  private sessionId = 0;
  private voices: SpeechSynthesisVoice[] = [];
  private activeChunks: string[] = [];
  private currentChunkIdx = 0;
  private activeResourceId: string | null = null;
  private activeCallbacks: SpeechCallbacks | null = null;
  private isPaused = false;
  private activeLang: LanguageCode = 'EN';

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        try {
          this.voices = window.speechSynthesis.getVoices() || [];
        } catch {
          this.voices = [];
        }
      };
      loadVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    }
  }

  private resolveBestVoice(lang: LanguageCode): SpeechSynthesisVoice | null {
    const voices =
      this.voices.length > 0
        ? this.voices
        : typeof window !== 'undefined' && 'speechSynthesis' in window
        ? window.speechSynthesis.getVoices() || []
        : [];
    if (voices.length === 0) return null;

    const tags = getSpeechLangFallbackTags(lang).map((t) => t.toLowerCase());
    for (const tag of tags) {
      const exact = voices.find((v) => v.lang?.toLowerCase() === tag);
      if (exact) return exact;
      const prefix = voices.find((v) =>
        v.lang?.toLowerCase().startsWith(tag.split('-')[0])
      );
      if (prefix) return prefix;
    }
    return voices[0] || null;
  }

  private setupMediaSession(title: string, speakerOrAuthor: string) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const MediaMeta = (
        window as unknown as {
          MediaMetadata?: new (init: {
            title?: string;
            artist?: string;
            album?: string;
          }) => MediaMetadata;
        }
      ).MediaMetadata;
      if (MediaMeta) {
        navigator.mediaSession.metadata = new MediaMeta({
          title,
          artist: speakerOrAuthor || 'The Gideonites Fellowship',
          album: 'The Gideonites Spiritual Library',
        });
      }
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.setActionHandler('play', () => {
        this.resumeSync();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pauseSync();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        this.stopSync();
      });
    } catch {
      // Ignore MediaSession errors on unsupported browsers
    }
  }

  private updateMediaSessionState(state: 'playing' | 'paused' | 'none') {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {
      // ignore
    }
  }

  /**
   * Synchronously starts Web Speech synthesis directly inside a user tap handler
   * so iOS Safari unlocks audio without autoplay blocking.
   */
  public speakSync(params: {
    resourceId: string;
    title: string;
    speakerOrAuthor: string;
    text: string;
    language: LanguageCode;
    callbacks: SpeechCallbacks;
  }): boolean {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof window.SpeechSynthesisUtterance === 'undefined'
    ) {
      params.callbacks.onError?.(
        'Audio narration is not supported in this browser. Try Safari on iOS or Chrome.'
      );
      return false;
    }

    const chunks = chunkSpeechText(params.text, 210);
    if (chunks.length === 0) {
      params.callbacks.onError?.('No readable text available for audio narration.');
      return false;
    }

    const synth = window.speechSynthesis;
    this.sessionId += 1;
    const mySession = this.sessionId;
    this.activeChunks = chunks;
    this.currentChunkIdx = 0;
    this.activeResourceId = params.resourceId;
    this.activeCallbacks = params.callbacks;
    this.activeLang = params.language;
    this.isPaused = false;

    try {
      // Cancel any ongoing utterances cleanly & trigger iOS gesture unlock immediately
      synth.cancel();
      this.setupMediaSession(params.title, params.speakerOrAuthor);
      params.callbacks.onStart?.(chunks.length);
      this.speakChunkSync(mySession, 0);
      return true;
    } catch {
      params.callbacks.onError?.(
        'Audio playback was blocked by browser autoplay settings. Tap Listen Aloud again to allow audio.'
      );
      return false;
    }
  }

  private speakChunkSync(mySession: number, idx: number) {
    if (mySession !== this.sessionId) return;
    if (idx >= this.activeChunks.length) {
      this.activeResourceId = null;
      this.isPaused = false;
      this.updateMediaSessionState('none');
      this.activeCallbacks?.onProgress?.(1, this.activeChunks.length, this.activeChunks.length);
      this.activeCallbacks?.onEnd?.();
      return;
    }

    const synth = window.speechSynthesis;
    const chunk = this.activeChunks[idx];
    const utterance = new window.SpeechSynthesisUtterance(chunk);
    utterance.lang = getSpeechLangTag(this.activeLang);
    utterance.rate = 0.98;
    utterance.pitch = 1.0;

    const voice = this.resolveBestVoice(this.activeLang);
    if (voice) {
      utterance.voice = voice;
    }

    this.currentChunkIdx = idx;
    const total = this.activeChunks.length;
    this.activeCallbacks?.onProgress?.(
      total <= 1 ? 0.15 : idx / total,
      idx,
      total
    );

    utterance.onend = () => {
      if (mySession !== this.sessionId) return;
      this.activeCallbacks?.onProgress?.((idx + 1) / total, idx + 1, total);
      this.speakChunkSync(mySession, idx + 1);
    };

    utterance.onerror = (ev) => {
      if (mySession !== this.sessionId) return;
      const reason = (ev as { error?: string }).error;
      if (reason === 'interrupted' || reason === 'canceled') {
        return;
      }
      this.activeResourceId = null;
      this.isPaused = false;
      this.updateMediaSessionState('none');
      this.activeCallbacks?.onError?.(
        reason === 'not-allowed'
          ? 'iOS Safari blocked speech playback. Tap Listen Aloud directly to start narration.'
          : reason === 'synthesis-unavailable' ||
            reason === 'synthesis-failed' ||
            reason === 'audio-hardware' ||
            reason === 'voice-unavailable'
          ? 'Voice narration audio is unavailable on this browser or device output.'
          : 'Audio narration stopped unexpectedly. Tap Listen Aloud to retry.'
      );
    };

    // Synchronously speak inside tap or sequential utterance completion
    synth.speak(utterance);
  }

  public pauseSync() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.pause();
      this.isPaused = true;
      this.updateMediaSessionState('paused');
      this.activeCallbacks?.onPauseChange?.(true);
    } catch {
      this.stopSync();
    }
  }

  public resumeSync() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.resume();
      this.isPaused = false;
      this.updateMediaSessionState('playing');
      this.activeCallbacks?.onPauseChange?.(false);
    } catch {
      // Fallback for browsers where pause/resume stalls: restart from current chunk synchronously
      if (this.activeChunks.length > 0 && this.activeCallbacks) {
        const mySession = this.sessionId;
        this.isPaused = false;
        this.updateMediaSessionState('playing');
        this.activeCallbacks.onPauseChange?.(false);
        this.speakChunkSync(mySession, this.currentChunkIdx);
      }
    }
  }

  public stopSync() {
    this.sessionId += 1;
    this.activeResourceId = null;
    this.activeChunks = [];
    this.currentChunkIdx = 0;
    this.isPaused = false;
    this.updateMediaSessionState('none');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.activeCallbacks?.onEnd?.();
    this.activeCallbacks = null;
  }

  public getStatus() {
    return {
      activeResourceId: this.activeResourceId,
      isPaused: this.isPaused,
    };
  }
}

export const spiritualSpeech = new SpiritualSpeechController();
