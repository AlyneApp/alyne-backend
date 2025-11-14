// Free image moderation using NSFW.js
// Note: NSFW.js requires @tensorflow/tfjs-node for server-side use
// This file should only be imported in API routes (server-side)

import * as nsfwjs from 'nsfwjs';
import sharp from 'sharp';

// Dynamic import for tfjs-node to avoid bundling issues
let tf: typeof import('@tensorflow/tfjs-node') | null = null;

async function getTensorFlow() {
  if (!tf) {
    tf = await import('@tensorflow/tfjs-node');
  }
  return tf;
}

let model: nsfwjs.NSFWJS | null = null;

/**
 * Load the NSFW.js model (lazy loading)
 */
async function loadModel(): Promise<nsfwjs.NSFWJS> {
  if (!model) {
    console.log('Loading NSFW.js model...');
    // Ensure TensorFlow.js Node backend is loaded
    await getTensorFlow();
    // Load model with TensorFlow.js Node backend
    // NSFW.js will automatically use the Node backend when tfjs-node is imported
    model = await nsfwjs.load('https://nsfwjs.com/model/', { size: 299 });
    console.log('NSFW.js model loaded successfully');
  }
  return model;
}

/**
 * Moderate an image buffer
 * Returns moderation results with scores for different categories
 */
export async function moderateImage(
  imageBuffer: Buffer
): Promise<{
  isNSFW: boolean;
  scores: {
    porn: number;
    sexy: number;
    hentai: number;
    drawing: number;
    neutral: number;
  };
  flagged: boolean;
  reason?: string;
}> {
  try {
    // Load model if not already loaded
    const nsfwModel = await loadModel();

    // Resize image to 299x299 (required by NSFW.js model)
    const resizedImage = await sharp(imageBuffer)
      .resize(299, 299, { fit: 'cover' })
      .jpeg()
      .toBuffer();

    // Get TensorFlow.js Node backend
    const tfNode = await getTensorFlow();
    
    // Convert buffer to tensor
    const image = tfNode.node.decodeImage(resizedImage, 3) as any;

    // Classify image
    const predictions = await nsfwModel.classify(image);

    // Dispose tensor to free memory
    image.dispose();

    // Extract scores
    const scores = {
      porn: 0,
      sexy: 0,
      hentai: 0,
      drawing: 0,
      neutral: 0,
    };

    for (const prediction of predictions) {
      scores[prediction.className as keyof typeof scores] = prediction.probability;
    }

    // Flag if porn, sexy, or hentai scores are above threshold
    const threshold = 0.5; // Adjust as needed (0.5 = 50% confidence)
    const isNSFW = scores.porn > threshold || scores.sexy > threshold || scores.hentai > threshold;

    let reason: string | undefined;
    if (scores.porn > threshold) {
      reason = 'porn';
    } else if (scores.sexy > threshold) {
      reason = 'sexually_suggestive';
    } else if (scores.hentai > threshold) {
      reason = 'hentai';
    }

    return {
      isNSFW,
      scores,
      flagged: isNSFW,
      reason,
    };
  } catch (error) {
    console.error('Error moderating image:', error);
    // On error, don't block the image (fail open)
    // You might want to change this to fail closed depending on your needs
    return {
      isNSFW: false,
      scores: {
        porn: 0,
        sexy: 0,
        hentai: 0,
        drawing: 0,
        neutral: 1,
      },
      flagged: false,
    };
  }
}

/**
 * Moderate multiple images
 */
export async function moderateImages(
  imageBuffers: Buffer[]
): Promise<Array<{
  isNSFW: boolean;
  scores: any;
  flagged: boolean;
  reason?: string;
}>> {
  const results = await Promise.all(
    imageBuffers.map((buffer) => moderateImage(buffer))
  );
  return results;
}

