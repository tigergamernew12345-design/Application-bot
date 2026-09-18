const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { analyzeText } = require("../detector");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("detect")
    .setDescription("Estimate how likely a piece of text is to be AI-generated (heuristic, not definitive).")
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("The text to analyze (min ~20 words for a meaningful result)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const text = interaction.options.getString("text", true);
    const result = analyzeText(text);

    if (result.score === null) {
      await interaction.reply({
        content: `Not enough text to analyze — I need at least ~20 words (got ${result.signals.wordCount}).`,
        ephemeral: true,
      });
      return;
    }

    const color =
      result.score >= 75 ? 0xed4245 : result.score >= 50 ? 0xf5a623 : result.score >= 25 ? 0x57f287 : 0x3ba55d;

    const embed = new EmbedBuilder()
      .setTitle("AI Text Detector")
      .setColor(color)
      .setDescription(`**Score: ${result.score}/100** — ${result.verdict}`)
      .addFields(
        { name: "Words analyzed", value: String(result.signals.wordCount), inline: true },
        { name: "Sentences", value: String(result.signals.sentenceCount), inline: true },
        { name: "Avg sentence length", value: String(result.signals.avgSentenceLength), inline: true },
        { name: "Sentence length variance", value: String(result.signals.sentenceLengthVariance), inline: true },
        { name: "Lexical diversity", value: String(result.signals.lexicalDiversity), inline: true },
        { name: "Repeated 3-word phrases", value: String(result.signals.repeatedPhrasesRatio), inline: true },
        { name: "Common AI stock phrases found", value: String(result.signals.stockPhraseHits), inline: true }
      )
      .setFooter({
        text: "Heuristic estimate only — not proof. False positives/negatives are common.",
      });

    await interaction.reply({ embeds: [embed] });
  },
};
