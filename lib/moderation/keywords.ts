// Free keyword-based content filtering
// This is a basic list - you can expand it based on your needs

export const objectionableKeywords = [
  // Profanity (common words - expand as needed)
  'fuck', 'fucking', 'fucked', 'fucks',
  'shit', 'shitting', 'shits',
  'damn', 'damned', 'damnit',
  'bitch', 'bitches', 'bitching',
  'asshole', 'assholes',
  'bastard', 'bastards',
  'crap', 'crappy',
  'hell', 'damn',
  // Hate speech indicators
  'kill yourself', 'kys', 'die', 'hate', 'stupid', 'idiot',
  // Spam indicators
  'click here', 'free money', 'get rich', 'guaranteed',
  // Add more as needed
];

// Common bypass patterns (leetspeak, etc.)
export const bypassPatterns = [
  /\b(f\*ck|f\*\*k|f@ck|phuck)\b/gi,
  /\b(s\*it|sh\*t|sh@t)\b/gi,
  /\b(b\*tch|b!tch|b@tch)\b/gi,
  // Add more patterns
];

/**
 * Check if text contains objectionable keywords
 */
export function checkKeywords(text: string): { flagged: boolean; matchedKeywords: string[] } {
  if (!text || typeof text !== 'string') {
    return { flagged: false, matchedKeywords: [] };
  }

  const lowerText = text.toLowerCase();
  const matched: string[] = [];

  // Check direct keywords
  for (const keyword of objectionableKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matched.push(keyword);
    }
  }

  // Check bypass patterns
  for (const pattern of bypassPatterns) {
    if (pattern.test(text)) {
      matched.push('bypass_pattern');
    }
  }

  return {
    flagged: matched.length > 0,
    matchedKeywords: matched,
  };
}

/**
 * Check multiple text fields (for activity posts)
 */
export function checkActivityContent(activityData: {
  activity_name?: string;
  class_name?: string;
  how_it_went?: string;
  instructor_name?: string;
  studio_name?: string;
}): { flagged: boolean; matchedKeywords: string[]; flaggedFields: string[] } {
  const allMatched: string[] = [];
  const flaggedFields: string[] = [];

  const fields = [
    { key: 'activity_name', value: activityData.activity_name },
    { key: 'class_name', value: activityData.class_name },
    { key: 'how_it_went', value: activityData.how_it_went },
    { key: 'instructor_name', value: activityData.instructor_name },
    { key: 'studio_name', value: activityData.studio_name },
  ];

  for (const field of fields) {
    if (field.value) {
      const result = checkKeywords(field.value);
      if (result.flagged) {
        flaggedFields.push(field.key);
        allMatched.push(...result.matchedKeywords);
      }
    }
  }

  return {
    flagged: flaggedFields.length > 0,
    matchedKeywords: [...new Set(allMatched)], // Remove duplicates
    flaggedFields,
  };
}

