const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  name: "sounds",
  description: "Lists all available sounds with buttons.",
  async execute(message, args) {
    const { getAllSounds } = require("../consts/sounds.js");
    const sounds = await getAllSounds();
    if (!sounds) {
      return message.reply("Sound database is currently unavailable.");
    }

    // Pagination setup
    const soundNames = Object.keys(sounds);
    const pageSize = 5;
    let page = 0;

    function getPage(page) {
      const start = page * pageSize;
      const end = start + pageSize;
      return soundNames.slice(start, end);
    }

    function createEmbed(page) {
      const pageSounds = getPage(page);
      return new EmbedBuilder()
        .setTitle("Available Sounds")
        .setDescription(
          pageSounds.map((name) => `**${name}**: ${sounds[name]}`).join("\n") ||
            "No sounds on this page.",
        )
        .setFooter({
          text: `Page ${page + 1} of ${Math.ceil(soundNames.length / pageSize)}`,
        });
    }

    function createButtons(page) {
      const pageSounds = getPage(page);
      const soundButtons = pageSounds.map((name) =>
        new ButtonBuilder()
          .setCustomId(`play_sound_${name}`)
          .setLabel(name)
          .setStyle(ButtonStyle.Primary),
      );
      const navButtons = [
        new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("Next")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= Math.ceil(soundNames.length / pageSize) - 1),
      ];
      return [
        new ActionRowBuilder().addComponents(...soundButtons),
        new ActionRowBuilder().addComponents(...navButtons),
      ];
    }

    // Send initial embed with buttons
    const sent = await message.reply({
      embeds: [createEmbed(page)],
      components: createButtons(page),
    });

    // Collector for button interactions
    const collector = sent.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 60_000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "prev_page") {
        page = Math.max(page - 1, 0);
        await interaction.update({
          embeds: [createEmbed(page)],
          components: createButtons(page),
        });
      } else if (interaction.customId === "next_page") {
        page = Math.min(page + 1, Math.ceil(soundNames.length / pageSize) - 1);
        await interaction.update({
          embeds: [createEmbed(page)],
          components: createButtons(page),
        });
      } else if (interaction.customId.startsWith("play_sound_")) {
        const soundName = interaction.customId.replace("play_sound_", "");
        // Use the new playSound utility
        const { playSound } = require("../utils/playSound");
        await playSound(message, soundName, (opts) => interaction.reply(opts));
      }
    });

    collector.on("end", () => {
      sent.edit({ components: [] });
    });
  },
};
