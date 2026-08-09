// Levenshtein distance function for typo-tolerant fuzzy matching
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Function to perform typo-tolerant search matching
export function fuzzyMatch(query: string, text: string, maxDistance: number = 2): boolean {
  if (!query || !text) return false;
  
  const queryLower = query.toLowerCase().replace(/[- ]/g, '');
  const textLower = text.toLowerCase().replace(/[- ]/g, '');
  
  // Exact substring match (fast path)
  if (textLower.includes(queryLower)) return true;

  // Split query into words to check for partial fuzzy matches
  const queryWords = query.toLowerCase().split(/[- ]+/).filter(w => w.length > 2);
  const textWords = text.toLowerCase().split(/[- ]+/).filter(w => w.length > 2);
  
  if (queryWords.length === 0 || textWords.length === 0) return false;

  // Every word in the query must match at least one word in the text fuzzily
  return queryWords.every(qWord => {
    return textWords.some(tWord => {
      // If the query word is just a prefix of the text word, that's a match
      if (tWord.startsWith(qWord)) return true;
      
      // Otherwise use Levenshtein distance, allowing 1 typo for short words, 2 for longer ones
      const threshold = qWord.length <= 4 ? 1 : maxDistance;
      return levenshteinDistance(qWord, tWord) <= threshold;
    });
  });
}
