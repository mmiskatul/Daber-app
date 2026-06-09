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
