import { loadAudioSermonBlob } from './offlineStorage';
import { spiritualSpeech } from './speechPlayer';
import type { SpiritualResource } from '../types/fellowship';

export interface AudioSermonPlayerState {
  activeResourceId: string | null;
  audioCloudId: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  errorMessage: string | null;
}

type StateListener = (state: AudioSermonPlayerState) => void;

const INITIAL_STATE: AudioSermonPlayerState = {
  activeResourceId: null,
  audioCloudId: null,
  isPlaying: false,
  isPaused: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0,
  errorMessage: null,
};

class AudioSermonPlayerController {
  private audioEl: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private listeners = new Set<StateListener>();
  private state: AudioSermonPlayerState = { ...INITIAL_STATE };
  private sessionSeq = 0;

  public getState(): AudioSermonPlayerState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(partial: Partial<AudioSermonPlayerState>) {
    this.state = { ...this.state, ...partial };
    const snapshot = this.getState();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  private revokeObjectUrl() {
    if (this.activeObjectUrl) {
      try {
        URL.revokeObjectURL(this.activeObjectUrl);
      } catch {
        // ignore
      }
      this.activeObjectUrl = null;
    }
  }

  private ensureAudioElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null;
    }
    if (this.audioEl) return this.audioEl;

    const el = new Audio();
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;

    el.addEventListener('loadedmetadata', () => {
      const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
      this.emit({
        duration: dur || this.state.duration,
      });
    });

    el.addEventListener('timeupdate', () => {
      const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : this.state.duration;
      this.emit({
        currentTime: Number.isFinite(el.currentTime) ? el.currentTime : 0,
        duration: dur,
      });
    });

    el.addEventListener('playing', () => {
      this.emit({
        isPlaying: true,
        isPaused: false,
        isBuffering: false,
        errorMessage: null,
      });
      this.updateMediaSessionPlayback('playing');
    });

    el.addEventListener('waiting', () => {
      if (this.state.activeResourceId && !this.state.isPaused) {
        this.emit({ isBuffering: true });
      }
    });

    el.addEventListener('canplay', () => {
      if (this.state.isBuffering) {
        this.emit({ isBuffering: false });
      }
    });

    el.addEventListener('pause', () => {
      if (!el.ended && this.state.activeResourceId) {
        this.emit({
          isPlaying: false,
          isPaused: true,
          isBuffering: false,
        });
        this.updateMediaSessionPlayback('paused');
      }
    });

    el.addEventListener('ended', () => {
      this.emit({
        isPlaying: false,
        isPaused: false,
        isBuffering: false,
        currentTime: this.state.duration,
      });
      this.updateMediaSessionPlayback('none');
    });

    el.addEventListener('error', () => {
      this.emit({
        isPlaying: false,
        isPaused: false,
        isBuffering: false,
        errorMessage: 'Unable to play this audio file on this device. Please try again or re-upload an MP3/M4A recording.',
      });
      this.updateMediaSessionPlayback('none');
    });

    this.audioEl = el;
    return el;
  }

  private setupMediaSession(resource: Pick<SpiritualResource, 'title' | 'speaker'>) {
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
          title: resource.title || 'Fellowship Audio Sermon',
          artist: resource.speaker || 'The Gideonites Fellowship',
          album: 'The Gideonites Spiritual Library',
        });
      }
      navigator.mediaSession.setActionHandler('play', () => {
        void this.resume();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        this.stop();
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        this.skipBy(-15);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        this.skipBy(15);
      });
    } catch {
      // ignore unsupported MediaSession handlers
    }
  }

  private updateMediaSessionPlayback(playbackState: 'playing' | 'paused' | 'none') {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playbackState;
    } catch {
      // ignore
    }
  }

  public clearError() {
    if (this.state.errorMessage) {
      this.emit({ errorMessage: null });
    }
  }

  public async playOrToggle(params: {
    resource: SpiritualResource;
    fetchBlobFn: (resource: SpiritualResource) => Promise<Blob>;
  }): Promise<void> {
    const { resource, fetchBlobFn } = params;
    const cloudId = resource.audioCloudId?.trim() || '';
    if (!cloudId) {
      this.emit({ errorMessage: 'No audio recording is attached to this sermon.' });
      return;
    }

    const el = this.ensureAudioElement();
    if (!el) {
      this.emit({ errorMessage: 'HTML5 audio playback is unavailable in this browser.' });
      return;
    }

    // Toggle existing loaded audio sermon immediately (preserves iOS user gesture)
    if (
      this.state.activeResourceId === resource.id &&
      this.state.audioCloudId === cloudId &&
      this.activeObjectUrl &&
      el.src
    ) {
      if (!el.paused && !el.ended) {
        this.pause();
        return;
      }
      if (el.ended) {
        el.currentTime = 0;
      }
      await this.resume();
      return;
    }

    spiritualSpeech.stopSync();
    this.sessionSeq += 1;
    const mySeq = this.sessionSeq;

    try {
      el.pause();
      el.removeAttribute('src');
      el.load();
    } catch {
      // ignore
    }
    this.revokeObjectUrl();

    const fallbackDurationSec = (resource.audioDurationMinutes || 0) * 60;
    this.emit({
      activeResourceId: resource.id,
      audioCloudId: cloudId,
      isPlaying: false,
      isPaused: false,
      isBuffering: true,
      currentTime: 0,
      duration: fallbackDurationSec,
      errorMessage: null,
    });

    try {
      let blob = await loadAudioSermonBlob(cloudId);
      if (mySeq !== this.sessionSeq) return;

      if (!blob || blob.size === 0) {
        blob = await fetchBlobFn(resource);
      }
      if (mySeq !== this.sessionSeq) return;

      if (!blob || blob.size === 0) {
        throw new Error('Audio sermon chunks could not be loaded.');
      }

      const objectUrl = URL.createObjectURL(blob);
      this.activeObjectUrl = objectUrl;
      el.src = objectUrl;
      el.currentTime = 0;
      this.setupMediaSession(resource);

      await el.play();
      if (mySeq !== this.sessionSeq) return;

      this.emit({
        isPlaying: true,
        isPaused: false,
        isBuffering: false,
        errorMessage: null,
      });
    } catch (err) {
      if (mySeq !== this.sessionSeq) return;
      const errName = (err as { name?: string })?.name || '';
      if (errName === 'NotAllowedError') {
        this.emit({
          isPlaying: false,
          isPaused: true,
          isBuffering: false,
          errorMessage: 'Audio downloaded — tap Play again to start playback on this device.',
        });
        return;
      }
      this.revokeObjectUrl();
      this.emit({
        activeResourceId: null,
        audioCloudId: null,
        isPlaying: false,
        isPaused: false,
        isBuffering: false,
        currentTime: 0,
        duration: 0,
        errorMessage:
          err instanceof Error
            ? err.message
            : 'Unable to load audio sermon. Check your connection and try again.',
      });
    }
  }

  public pause(): void {
    const el = this.audioEl;
    if (!el) return;
    try {
      el.pause();
    } catch {
      // ignore
    }
    this.emit({
      isPlaying: false,
      isPaused: true,
      isBuffering: false,
    });
    this.updateMediaSessionPlayback('paused');
  }

  public async resume(): Promise<void> {
    const el = this.audioEl;
    if (!el || !this.activeObjectUrl) return;
    spiritualSpeech.stopSync();
    this.emit({ isBuffering: true, errorMessage: null });
    try {
      await el.play();
      this.emit({
        isPlaying: true,
        isPaused: false,
        isBuffering: false,
        errorMessage: null,
      });
    } catch (err) {
      const errName = (err as { name?: string })?.name || '';
      this.emit({
        isPlaying: false,
        isPaused: true,
        isBuffering: false,
        errorMessage:
          errName === 'NotAllowedError'
            ? 'Tap Play again to allow audio playback on this browser.'
            : 'Unable to resume audio playback.',
      });
    }
  }

  public seek(seconds: number): void {
    const el = this.audioEl;
    if (!el || !this.state.activeResourceId) return;
    const maxDur =
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration : this.state.duration;
    const clamped = Math.max(0, maxDur > 0 ? Math.min(seconds, maxDur) : seconds);
    try {
      el.currentTime = clamped;
      this.emit({ currentTime: clamped });
    } catch {
      // ignore seek failure before metadata ready
    }
  }

  public skipBy(deltaSeconds: number): void {
    const el = this.audioEl;
    const base = el && Number.isFinite(el.currentTime) ? el.currentTime : this.state.currentTime;
    this.seek(base + deltaSeconds);
  }

  public stop(): void {
    this.sessionSeq += 1;
    const el = this.audioEl;
    if (el) {
      try {
        el.pause();
        el.removeAttribute('src');
        el.load();
      } catch {
        // ignore
      }
    }
    this.revokeObjectUrl();
    this.updateMediaSessionPlayback('none');
    this.emit({ ...INITIAL_STATE });
  }

  public stopIfResource(resourceId?: string | null): void {
    if (!resourceId) return;
    if (this.state.activeResourceId === resourceId) {
      this.stop();
    }
  }

  public stopIfNotCloudId(activeCloudId: string | null): void {
    if (!this.state.activeResourceId || !this.state.audioCloudId) return;
    if (!activeCloudId || this.state.audioCloudId !== activeCloudId) {
      this.stop();
    }
  }
}

export const audioSermonPlayer = new AudioSermonPlayerController();
