/**
 * Heuristic AI-text detector.
 *
 * IMPORTANT CAVEAT: There is no reliable way to detect AI-generated text
 * with certainty — not even the commercial "AI detector" products get this
 * right consistently, and they routinely produce false positives on human
 * writing (especially from non-native English speakers) and false negatives
 * on lightly-edited AI text. This module uses well-known stylistic signals
 * (sentence-length variance, repetition, lexical diversity, common LLM
 * stock phrases, punctuation patterns) to produce a rough *signal score*,
 * not a verdict of fact. Always present the output as a probabilistic
 * indicator, never as proof.
 */

const AI_STOCK_PHRASES = [
  "as an ai language model",
  "i cannot provide",
  "it's important to note that",
  "it is important to note that",
  "in conclusion,",
  "in summary,",
  "furthermore,",
  "moreover,",
  "delve into",
  "let's dive into",
  "in today's fast-paced world",
  "in the realm of",
  "navigating the",
  "unlock the potential",
  "unleash the power",
  "plays a crucial role",
  "plays a vital role",
  "it is worth noting",
  "on the other hand,",
  "overall,",
  "in the ever-evolving",
  "landscape of",
  "tapestry of",
  "testament to",
  "i hope this helps",
  "feel free to",
];

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
}

function splitWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
}

function stddev(arr) {
  const m = mean(arr);
  const variance = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(variance);
}

function ngramRepetitionScore(words, n) {
  if (words.length < n + 1) return 0;
  const grams = new Map();
  let total = 0;
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(" ");
    grams.set(gram, (grams.get(gram) || 0) + 1);
    total++;
  }
  const repeats = [...grams.values()].filter((c) => c > 1).length;
  return total > 0 ? repeats / total : 0;
}

/**
 * Analyze a block of text and return a heuristic AI-likelihood score.
 * @param {string} text
 * @returns {{score: number, verdict: string, signals: Record<string, number|string>}}
 */
function analyzeText(text) {
  const cleaned = text.trim();
  const sentences = splitSentences(cleaned);
  const words = splitWords(cleaned);

  if (words.length < 20) {
    return {
      score: null,
      verdict: "Too short to analyze reliably",
      signals: { wordCount: words.length },
    };
  }

  // 1. Sentence length uniformity (low variance -> more "AI-like")
  const sentenceLengths = sentences.map((s) => splitWords(s).length).filter((n) => n > 0);
  const avgLen = mean(sentenceLengths);
  const lenStd = stddev(sentenceLengths);
  // Burstiness: humans tend to mix short/long sentences; a low std relative
  // to mean suggests uniform, "smoothed" phrasing.
  const burstiness = avgLen > 0 ? lenStd / avgLen : 0;
  const burstinessScore = Math.max(0, 1 - burstiness / 0.6); // 0 = human-like variety, 1 = very uniform

  // 2. Lexical diversity (type-token ratio) — AI text often reuses a
  // narrower vocabulary over longer passages.
  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / words.length;
  const diversityScore = Math.max(0, 1 - ttr / 0.55); // lower ttr -> higher score

  // 3. Repetition of 3-grams
  const repetitionScore = ngramRepetitionScore(words, 3);

  // 4. Stock phrase hits
  const lowerText = cleaned.toLowerCase();
  const phraseHits = AI_STOCK_PHRASES.filter((p) => lowerText.includes(p));
  const phraseScore = Math.min(1, phraseHits.length / 4);

  // 5. Punctuation regularity — heavy, consistent use of em-dashes/semicolons
  // and near-total absence of contractions can be a mild signal.
  const emDashes = (cleaned.match(/—/g) || []).length;
  const contractions = (cleaned.match(/\b\w+'(t|re|ve|ll|s|d|m)\b/gi) || []).length;
  const emDashRate = emDashes / (sentences.length || 1);
  const contractionRate = contractions / (words.length || 1);
  const punctScore =
    Math.min(1, emDashRate / 1.5) * 0.5 + Math.max(0, 1 - contractionRate / 0.01) * 0.5;

  // Weighted combination -> 0-100
  const weighted =
    burstinessScore * 0.30 +
    diversityScore * 0.25 +
    repetitionScore * 0.15 +
    phraseScore * 0.20 +
    punctScore * 0.10;

  const score = Math.round(Math.max(0, Math.min(1, weighted)) * 100);

  let verdict;
  if (score >= 75) verdict = "Strong AI-writing signals";
  else if (score >= 50) verdict = "Some AI-writing signals";
  else if (score >= 25) verdict = "Mostly human-like signals";
  else verdict = "Strong human-writing signals";

  return {
    score,
    verdict,
    signals: {
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgSentenceLength: Number(avgLen.toFixed(1)),
      sentenceLengthVariance: Number(burstiness.toFixed(2)),
      lexicalDiversity: Number(ttr.toFixed(2)),
      repeatedPhrasesRatio: Number(repetitionScore.toFixed(2)),
      stockPhraseHits: phraseHits.length,
    },
  };
}

module.exports = { analyzeText };
