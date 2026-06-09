import { ScenarioTurn } from "../api";
import { VoiceTurnPatch } from "./types";

export function applyVoiceTurnPatch(turns: ScenarioTurn[], patch: VoiceTurnPatch): ScenarioTurn[] {
  switch (patch.type) {
    case "replaceLearnerText":
      return turns.map((turn) =>
        turn.role === "learner" && turn.inputMode === "voice" ? { ...turn, text: patch.text } : turn
      );
    case "setTutorPending":
      return turns;
    case "setTutorTurn":
      return [...turns, patch.tutorTurn];
    case "setPronunciation":
      return turns.map((turn) =>
        turn.role === "learner" && turn.inputMode === "voice"
          ? { ...turn, pronunciation: patch.pronunciation }
          : turn
      );
    default:
      return turns;
  }
}
