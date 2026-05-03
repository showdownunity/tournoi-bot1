const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { getTournoiByPostId, getParticipantTeams, updateTournoiChannels } = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-lobby')
    .setDescription('Créer les channels lobby et discussion pour ce tournoi (Admin uniquement)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (interaction.channel.type !== ChannelType.PublicThread) {
      return interaction.reply({ content: '❌ Utilise cette commande dans le **post du tournoi** !', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const tournoi = getTournoiByPostId(interaction.channel.id);
    if (!tournoi) return interaction.editReply({ content: '❌ Aucun tournoi trouvé pour ce post.' });
    if (tournoi.status === 'closed') return interaction.editReply({ content: '❌ Ce tournoi est **clôturé**.' });
    if (tournoi.lobbyChannelId || tournoi.discussionChannelId) {
      return interaction.editReply({ content: '❌ Les channels de ce tournoi ont **déjà été créés** !' });
    }

    const guild = interaction.guild;
    const everyone = guild.roles.everyone;
    const participantRole = guild.roles.cache.find(r => r.name === 'Participant');
    const nameSafe = tournoi.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    if (!participantRole) {
      return interaction.editReply({ content: '❌ Le rôle **@Participant** est introuvable ! Crée-le d\'abord sur ton serveur.' });
    }

    // Créer la catégorie (optionnel, on met dans la catégorie existante)
    // Channel 🔒-lobby
    const lobbyChannel = await guild.channels.create({
      name: `🔒-lobby-${nameSafe}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: participantRole.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
        },
      ],
    });

    // Channel 💬-discussion
    const discussionChannel = await guild.channels.create({
      name: `💬-discussion-${nameSafe}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: participantRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          deny: [
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.UseExternalEmojis,
          ],
        },
      ],
    });

    // Sauvegarder en BDD
    updateTournoiChannels(tournoi.id, lobbyChannel.id, discussionChannel.id);

    // Messages d'accueil
    await lobbyChannel.send({
      content: `🔒 **Lobby — ${tournoi.name}**\n\nBienvenue dans le channel lobby du tournoi **${tournoi.name}** !\nLes codes et informations sensibles seront partagés ici par les admins.\n\n📅 **Date :** ${tournoi.date} à ${tournoi.time}`,
    });

    // Ping des participants dans discussion
    const participants = getParticipantTeams(tournoi.id);
    const allParticipantIds = participants.flatMap(t => t.members);
    const pingText = allParticipantIds.map(id => `<@${id}>`).join(' ');

    await discussionChannel.send({
      content: `💬 **Discussion — ${tournoi.name}**\n\nBienvenue dans le channel de discussion du tournoi **${tournoi.name}** !\nUtilisez ce channel pour poser vos questions et signaler des problèmes.\n\n⚠️ Texte uniquement — pas de GIFs, images ou liens.\n\n${pingText ? `👋 Participants : ${pingText}` : ''}`,
    });

    await interaction.editReply({
      content: `✅ Channels créés !\n• ${lobbyChannel}\n• ${discussionChannel}`,
    });
  },
};
