export type TTSModelId = "oute-tts-small" | "oute-tts-large";

export interface TTSModel {
  id: TTSModelId;
  name: string;
  huggingFaceId: string;
  dtype: "q4f16" | "fp32";
  downloadSizeBytes: number;
  description: string;
}

export const TTS_MODELS: TTSModel[] = [
  {
    id: "oute-tts-small",
    name: "Small (Recommended)",
    huggingFaceId: "onnx-community/OuteTTS-0.2-500M",
    dtype: "q4f16",
    downloadSizeBytes: 335_000_000,
    description: "Fast, low memory. Good quality for most use cases.",
  },
  {
    id: "oute-tts-large",
    name: "Large (High Quality)",
    huggingFaceId: "OuteAI/Llama-OuteTTS-1.0-1B-ONNX",
    dtype: "q4f16",
    downloadSizeBytes: 630_000_000,
    description: "Better voice cloning fidelity. Requires more memory.",
  },
];

export const DEFAULT_TTS_MODEL: TTSModelId = "oute-tts-small";
