const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { createTournoi, updateTournoiEmbed } = require('../database/db');
const { buildTournoiEmbed } = require('../utils/embed');
const { generateId } = require('../utils/helpers');

const GAMES = ['Apex Legends', 'Valorant', 'FIFA', 'CS2', 'Fortnite', 'Rocket League', 'League of Legends', 'Autre'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('open-event')
    .setDescription('Créer un nouveau tournoi (Admin uniquement)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('jeu')
        .setDescription('Le jeu du tournoi')
        .setRequired(true)
        .addChoices(...GAMES.map(g => ({ name: g, value: g })))
    )
    .addStringOption(opt =>
      opt.setName('nom')
        .setDescription('Nom du tournoi')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('date')
        .setDescription('Date de l\'événement (ex: 15/05/2026)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('heure')
        .setDescription('Heure de début (ex: 20h00)')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('teams_max')
        .setDescription('Nombre maximum de teams')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(100)
    )
    .addIntegerOption(opt =>
      opt.setName('joueurs_par_team')
        .setDescription('Nombre de joueurs par team')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10)
    )
    .addStringOption(opt =>
      opt.setName('deadline')
        .setDescription('Date/heure limite d\'inscription (ex: 14/05/2026 à 23h59)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('maps')
        .setDescription('Maps (optionnel, séparées par des virgules)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('rotations')
        .setDescription('Parties par map (optionnel)')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    // Vérifier qu'on est dans un channel forum
    if (interaction.channel.type !== ChannelType.GuildForum) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée dans un **channel Forum** !',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const jeu = interaction.options.getString('jeu');
    const nom = interaction.options.getString('nom');
    const date = interaction.options.getString('date');
    const heure = interaction.options.getString('heure');
    const teamsMax = interaction.options.getInteger('teams_max');
    const joueursParTeam = interaction.options.getInteger('joueurs_par_team');
    const deadline = interaction.options.getString('deadline');
    const mapsRaw = interaction.options.getString('maps') || '';
    const rotations = interaction.options.getInteger('rotations') || 0;

    const maps = mapsRaw ? mapsRaw.split(',').map(m => m.trim()).filter(Boolean) : [];

    // Chercher le tag correspondant au jeu dans le forum
    const forumChannel = interaction.channel;
    const availableTags = forumChannel.availableTags || [];
    const matchingTag = availableTags.find(t => t.name.toLowerCase() === jeu.toLowerCase());

    // Créer le post dans le forum
    const tournoiId = generateId();

    // Données du tournoi temporaires pour l'embed initial
    const tournoiData = {
      id: tournoiId,
      forumPostId: null,
      forumChannelId: forumChannel.id,
      guildId: interaction.guildId,
      name: nom,
      game: jeu,
      date,
      time: heure,
      maxTeams: teamsMax,
      playersPerTeam: joueursParTeam,
      deadline,
      maps,
      rotationsPerMap: rotations,
      embedMessageId: null,
      status: 'open',
    };

    // Créer le post forum
    const threadOptions = {
      name: nom,
      message: { content: '⏳ Chargement du tournoi...' },
    };
    if (matchingTag) {
      threadOptions.appliedTags = [matchingTag.id];
    }

    const thread = await forumChannel.threads.create(threadOptions);

    // Sauvegarder en BDD
    tournoiData.forumPostId = thread.id;
    createTournoi(tournoiData);

    // Construire et envoyer l'embed
    const embed = buildTournoiEmbed(tournoiData);
    const embedMsg = await thread.send({ embeds: [embed] });

    // Supprimer le message initial "Chargement..."
    const starterMessage = await thread.fetchStarterMessage().catch(() => null);
    if (starterMessage) await starterMessage.delete().catch(() => {});

    // Mettre à jour l'embedMessageId en BDD
    updateTournoiEmbed(tournoiId, embedMsg.id);

    await interaction.editReply({
      content: `✅ Tournoi **${nom}** créé avec succès dans <#${thread.id}> !`,
    });
  },
};
