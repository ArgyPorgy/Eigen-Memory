let audioRef: HTMLAudioElement | null = null;

function ensureAudio(): HTMLAudioElement {
  if (!audioRef) {
    const audio = new Audio('/gamemusic.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.35;
    audioRef = audio;
  }
  return audioRef;
}

export async function playMusic(): Promise<void> {
  const audio = ensureAudio();
  try {
    await audio.play();
  } catch {
    // Autoplay may be blocked; will start on next user interaction
    const onInteract = () => {
      audio.play().catch(() => {});
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
    };
    window.addEventListener('pointerdown', onInteract, { once: true });
    window.addEventListener('keydown', onInteract, { once: true });
  }
}

export function stopMusic(): void {
  if (audioRef) {
    audioRef.pause();
    audioRef.currentTime = 0;
  }
}

export function pauseMusic(): void {
  if (audioRef) audioRef.pause();
}

export function setMusicVolume(volume: number): void {
  const audio = ensureAudio();
  audio.volume = Math.max(0, Math.min(1, volume));
}

export function isMusicPlaying(): boolean {
  return !!(audioRef && !audioRef.paused);
}


