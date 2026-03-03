export type SoundCue =
  | "click"
  | "notification"
  | "session_started"
  | "session_waiting_input"
  | "session_completed"
  | "session_failed"
  | "session_cancelled";

export function primeSoundCueEngine(): void {}

export function queueSoundCue(_cue: SoundCue): void {}
