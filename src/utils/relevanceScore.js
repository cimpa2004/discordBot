/**
 * Vector-based relevance scoring using TF-weighted unigram + bigram + character
 * trigram cosine similarity. Robust to typos and multi-word phrases.
 */

/**
 * Normalises a string into a token array of:
 *   - word unigrams         ("divine")
 *   - word bigrams          ("bad\0guy")
 *   - character trigrams    ("div", "ivi", "vin", "ine") per word
 *
 * Character trigrams make scoring robust to typos: "devine" and "divine"
 * share trigrams "vin" and "ine" even though they differ at the word level.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const tokens = [...words];

  // Word bigrams
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}\x00${words[i + 1]}`);
  }

  // Character trigrams per word (prefixed to avoid collisions with word tokens)
  for (const word of words) {
    if (word.length < 3) {
      tokens.push(`\x01${word}`); // treat short words as a single char-token
    } else {
      for (let i = 0; i <= word.length - 3; i++) {
        tokens.push(`\x01${word.slice(i, i + 3)}`);
      }
    }
  }

  return tokens;
}

/**
 * Builds a term-frequency vector (Map<term, count>) from a token array.
 * @param {string[]} tokens
 * @returns {Map<string, number>}
 */
function buildTFVector(tokens) {
  const vec = new Map();
  for (const t of tokens) vec.set(t, (vec.get(t) ?? 0) + 1);
  return vec;
}

/**
 * Computes cosine similarity between two TF vectors.
 * Returns a value in [0, 1] — higher means more similar.
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, count] of a) {
    dot += count * (b.get(term) ?? 0);
    normA += count * count;
  }
  for (const count of b.values()) normB += count * count;
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Scores how well a track title matches the search query using TF-weighted
 * unigram + bigram + character trigram cosine similarity.
 * Returns a value in [0, 1].
 * @param {string} query
 * @param {string} title
 * @returns {number}
 */
function relevanceScore(query, title) {
  const qVec = buildTFVector(tokenize(query));
  const tVec = buildTFVector(tokenize(title));
  return cosineSimilarity(qVec, tVec);
}

module.exports = { relevanceScore };
