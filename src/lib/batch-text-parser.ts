/**
 * Parser for batch text with ##imageN markers.
 *
 * Format:
 *   ##image1
 *   Detailed prompt for image one...
 *
 *   ##image2
 *   Detailed prompt for image two...
 *
 * Rules:
 *   - Images are paired sequentially: ##image1 + ##image2 = scene 1, ##image3 + ##image4 = scene 2
 *   - If the total image count is odd, the last image becomes a start-frame-only scene
 *   - Empty prompts after a marker are flagged as errors
 */

export interface ParsedImage {
  /** The N from ##imageN (1-based) */
  index: number;
  /** The extracted prompt text (trimmed) */
  prompt: string;
}

export interface ParsedScene {
  /** 0-based scene index */
  sceneIndex: number;
  /** Start frame (always present) */
  startFrame: ParsedImage;
  /** End frame (null if odd last image) */
  endFrame: ParsedImage | null;
}

export interface ParseResult {
  /** All individual images found */
  images: ParsedImage[];
  /** Images grouped into scene pairs */
  scenes: ParsedScene[];
  /** Parse errors or warnings */
  errors: string[];
}

export function parseBatchText(text: string): ParseResult {
  const images: ParsedImage[] = [];
  const errors: string[] = [];

  if (!text.trim()) {
    return { images: [], scenes: [], errors: [] };
  }

  // Match ##imageN (case-insensitive) followed by content until next ##imageN or end
  const regex = /##image(\d+)\s*\n?([\s\S]*?)(?=##image\d+|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const index = parseInt(match[1], 10);
    const prompt = match[2].trim();

    if (!prompt) {
      errors.push(`##image${index} está sem descrição`);
      continue;
    }

    images.push({ index, prompt });
  }

  if (images.length === 0 && text.trim().length > 0) {
    errors.push(
      'Nenhum marcador ##imageN encontrado. Use o formato: ##image1 seguido da descrição.'
    );
  }

  // Sort by index to ensure correct pairing even if out of order
  images.sort((a, b) => a.index - b.index);

  // Group into scene pairs: [1,2] → scene 0, [3,4] → scene 1, etc.
  const scenes: ParsedScene[] = [];
  for (let i = 0; i < images.length; i += 2) {
    scenes.push({
      sceneIndex: Math.floor(i / 2),
      startFrame: images[i],
      endFrame: i + 1 < images.length ? images[i + 1] : null,
    });
  }

  return { images, scenes, errors };
}
