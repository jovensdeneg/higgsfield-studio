/**
 * Parser for batch text with ##imageN and ##sceneN markers.
 *
 * Format:
 *   ##image1
 *   Detailed prompt for start frame of scene 1...
 *
 *   ##image2
 *   Detailed prompt for end frame of scene 1...
 *
 *   ##scene1
 *   Movement/action description for video generation of scene 1...
 *
 *   ##image3
 *   Detailed prompt for start frame of scene 2...
 *
 *   ##image4
 *   Detailed prompt for end frame of scene 2...
 *
 *   ##scene2
 *   Movement/action description for video generation of scene 2...
 *
 * Rules:
 *   - Images are paired sequentially: ##image1 + ##image2 = scene 1, ##image3 + ##image4 = scene 2
 *   - ##sceneN provides the movement/video prompt for scene N (optional but recommended)
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
  /** Movement/video prompt from ##sceneN (null if not provided) */
  movementPrompt: string | null;
}

export interface ParseResult {
  /** All individual images found */
  images: ParsedImage[];
  /** Images grouped into scene pairs with optional movement prompt */
  scenes: ParsedScene[];
  /** Parse errors or warnings */
  errors: string[];
}

export function parseBatchText(text: string): ParseResult {
  const images: ParsedImage[] = [];
  const scenePrompts: Map<number, string> = new Map();
  const errors: string[] = [];

  if (!text.trim()) {
    return { images: [], scenes: [], errors: [] };
  }

  // Split text into blocks by any ## marker (image or scene)
  const regex = /##(image|scene)(\d+)\s*\n?([\s\S]*?)(?=##(?:image|scene)\d+|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const type = match[1].toLowerCase(); // "image" or "scene"
    const index = parseInt(match[2], 10);
    const prompt = match[3].trim();

    if (type === "image") {
      if (!prompt) {
        errors.push(`##image${index} está sem descrição`);
        continue;
      }
      images.push({ index, prompt });
    } else if (type === "scene") {
      if (!prompt) {
        errors.push(`##scene${index} está sem descrição`);
        continue;
      }
      scenePrompts.set(index, prompt);
    }
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
    const sceneIndex = Math.floor(i / 2);
    const sceneNumber = sceneIndex + 1; // ##scene1 = scene index 0

    scenes.push({
      sceneIndex,
      startFrame: images[i],
      endFrame: i + 1 < images.length ? images[i + 1] : null,
      movementPrompt: scenePrompts.get(sceneNumber) ?? null,
    });
  }

  return { images, scenes, errors };
}
