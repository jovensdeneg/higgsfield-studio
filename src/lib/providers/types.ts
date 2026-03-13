/**
 * Tipos compartilhados por todos os providers de geração.
 */

export interface ImageGenerationResult {
  url: string;
  seed?: number;
  raw?: Record<string, unknown>;
}

export interface VideoSubmissionResult {
  requestId: string;
  statusUrl?: string;
  cancelUrl?: string;
}

export interface GenerationStatus {
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  resultUrl?: string;
  error?: string;
}

/**
 * Interface comum que todo provider de imagem implementa.
 */
export interface ImageProvider {
  generateImage(
    prompt: string,
    opts?: {
      seed?: number;
      referenceImages?: string[];
      aspectRatio?: string;
    }
  ): Promise<ImageGenerationResult>;
}

/**
 * Interface comum que todo provider de vídeo implementa.
 */
export interface VideoProvider {
  submitVideo(opts: {
    prompt: string;
    startImageUrl: string;
    endImageUrl?: string;
    duration?: number;
    seed?: number;
  }): Promise<VideoSubmissionResult>;

  checkStatus(requestId: string): Promise<GenerationStatus>;
}
