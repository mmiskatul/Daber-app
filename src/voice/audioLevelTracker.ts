export type AudioLevelSnapshot = {
  inputLevel: number;
  outputLevel: number;
  updatedAt: string;
};

export function createSilentAudioLevelSnapshot(): AudioLevelSnapshot {
  return {
    inputLevel: 0,
    outputLevel: 0,
    updatedAt: new Date().toISOString()
  };
}

export function createAvatarAudioLevelSnapshot(inputLevel: number, outputLevel: number): AudioLevelSnapshot {
  return {
    inputLevel: Math.max(0, Math.min(1, inputLevel)),
    outputLevel: Math.max(0, Math.min(1, outputLevel)),
    updatedAt: new Date().toISOString()
  };
}
