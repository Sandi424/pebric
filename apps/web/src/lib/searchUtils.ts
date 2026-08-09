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

// Function to calculate relevance score for a product based on query
export function calculateRelevanceScore(query: string, product: any): number {
  if (!query || !product) return 0;
  
  const queryLower = query.toLowerCase().trim();
  let score = 0;

  // Exact matches
  const nameExact = product.name.toLowerCase();
  if (nameExact === queryLower) score += 100;
  else if (nameExact.includes(queryLower)) score += 50;

  // Extract query words
  const queryWords = queryLower.split(/[- ]+/).filter((w: string) => w.length > 2);
  if (queryWords.length === 0) {
     // For very short queries (1-2 chars), do simple includes check on name
     if (nameExact.includes(queryLower)) return 20;
     return 0;
  }

  // Build searchable text fields
  const searchFields = [
    { text: product.name, weight: 10 },
    { text: product.category?.name || '', weight: 5 },
    { text: product.collection?.name || '', weight: 4 },
    { text: product.description || '', weight: 2 },
  ];
  
  // Add tags / features / sizes
  if (product.features) {
    searchFields.push({ text: product.features.join(' '), weight: 3 });
  }
  if (product.pet_sizes) {
    searchFields.push({ text: product.pet_sizes.join(' '), weight: 3 });
  }

  // Word-by-word fuzzy match
  queryWords.forEach((qWord: string) => {
    let wordScore = 0;
    searchFields.forEach(field => {
      if (!field.text) return;
      const textWords = field.text.toLowerCase().split(/[- ]+/);
      
      for (const tWord of textWords) {
        if (tWord === qWord) {
          wordScore = Math.max(wordScore, field.weight * 2);
        } else if (tWord.startsWith(qWord)) {
          wordScore = Math.max(wordScore, field.weight * 1.5);
        } else if (qWord.length >= 3 && tWord.length >= 3) {
          // Check typo tolerance for words
          const distance = levenshteinDistance(qWord, tWord);
          const threshold = qWord.length <= 4 ? 1 : 2;
          if (distance <= threshold) {
             wordScore = Math.max(wordScore, field.weight * (1 - distance * 0.3));
          }
        }
      }
    });
    score += wordScore;
  });

  return score;
}
