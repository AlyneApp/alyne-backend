// Free text moderation using Hugging Face Inference API (free tier)
// Alternative: Can use TensorFlow.js toxicity classifier for completely local processing

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_API_TOKEN; // Optional - free tier works without token but has rate limits

// Model options (all free):
// - 'unitary/toxic-bert' - Toxicity detection
// - 'martin-ha/toxic-comment-classifier' - Toxic comment classification
// - 'facebook/roberta-hate-speech-dynabench-r4-target' - Hate speech detection

const DEFAULT_MODEL = 'unitary/toxic-bert';

/**
 * Moderate text using Hugging Face Inference API (free tier)
 */
export async function moderateTextWithHuggingFace(
  text: string
): Promise<{
  flagged: boolean;
  scores: Record<string, number>;
  categories: string[];
}> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      flagged: false,
      scores: {},
      categories: [],
    };
  }

  try {
    const response = await fetch(`${HUGGINGFACE_API_URL}/${DEFAULT_MODEL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HUGGINGFACE_TOKEN && { Authorization: `Bearer ${HUGGINGFACE_TOKEN}` }),
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      // If API is down or rate limited, fail open (don't block content)
      console.warn('Hugging Face API error:', response.status, response.statusText);
      return {
        flagged: false,
        scores: {},
        categories: [],
      };
    }

    const data = await response.json();

    // Handle different response formats
    let scores: Record<string, number> = {};
    let categories: string[] = [];

    if (Array.isArray(data) && data[0]) {
      // Response format: [{label: 'toxic', score: 0.9}, ...]
      for (const item of data[0]) {
        scores[item.label] = item.score;
        if (item.score > 0.5) {
          // Threshold: 50% confidence
          categories.push(item.label);
        }
      }
    } else if (data.scores) {
      // Alternative response format
      scores = data.scores;
      for (const [label, score] of Object.entries(scores)) {
        if (typeof score === 'number' && score > 0.5) {
          categories.push(label);
        }
      }
    }

    return {
      flagged: categories.length > 0,
      scores,
      categories,
    };
  } catch (error) {
    console.error('Error calling Hugging Face API:', error);
    // Fail open - don't block content if moderation service is down
    return {
      flagged: false,
      scores: {},
      categories: [],
    };
  }
}

/**
 * Simple text moderation (fallback if Hugging Face is unavailable)
 * Uses basic heuristics and keyword matching
 */
export function moderateTextSimple(text: string): {
  flagged: boolean;
  reason?: string;
} {
  if (!text || typeof text !== 'string') {
    return { flagged: false };
  }

  // Check for excessive caps (potential spam)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.7 && text.length > 10) {
    return { flagged: true, reason: 'excessive_caps' };
  }

  // Check for excessive repetition (spam)
  const repeatedChars = text.match(/(.)\1{4,}/g);
  if (repeatedChars) {
    return { flagged: true, reason: 'repetitive_text' };
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /(http|www\.|\.com|\.net|\.org)/gi, // URLs (might be spam)
    /\d{10,}/g, // Long number sequences (phone numbers, etc.)
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text) && text.length < 50) {
      // Short text with URLs/numbers is suspicious
      return { flagged: true, reason: 'suspicious_pattern' };
    }
  }

  return { flagged: false };
}

/**
 * Combined text moderation (tries Hugging Face first, falls back to simple)
 */
export async function moderateText(
  text: string,
  useHuggingFace: boolean = true
): Promise<{
  flagged: boolean;
  scores?: Record<string, number>;
  categories?: string[];
  reason?: string;
}> {
  if (useHuggingFace && HUGGINGFACE_TOKEN) {
    try {
      const result = await moderateTextWithHuggingFace(text);
      if (result.flagged) {
        return result;
      }
    } catch (error) {
      console.warn('Hugging Face moderation failed, falling back to simple:', error);
    }
  }

  // Fallback to simple moderation
  const simpleResult = moderateTextSimple(text);
  return simpleResult;
}

