const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const {
  getTournoiByPostId,
  getParticipantTeams,
  getWaitingTeams,
  closeTournoi,
} = require('../database/db');
const { buildTournoiEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close-lobby')
    .setDescription('Clôturer le tournoi et nettoyer les channels (Admin uniquement)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (interaction.channel.type !== ChannelType.PublicThread) {
      return interaction.reply({ content: '❌ Utilise cette commande dans le **post du tournoi** !', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const tournoi = getTournoiByPostId(interaction.channel.id);
    if (!tournoi) return interaction.editReply({ content: '❌ Aucun tournoi trouvé pour ce post.' });
    if (tournoi.status === 'closed') return interaction.editReply({ content: '❌ Ce tournoi est **déjà clôturé**.' });

    const guild = interaction.guild;
    const participantRole = guild.roles.cache.get(process.env.PARTICIPANT_ROLE_ID);
    const waitingRole = guild.roles.cache.get(process.env.WAITING_ROLE_ID);

    const allTeams = [...getParticipantTeams(tournoi.id), ...getWaitingTeams(tournoi.id)];
    const allMemberIds = allTeams.flatMap(t => t.members);

    let participantsCount = 0;
    let waitingCount = 0;

    for (const memberId of allMemberIds) {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (member) {
        if (participantRole && member.roles.cache.has(participantRole.id)) {
          await member.roles.remove(participantRole).catch(() => {});
          participantsCount++;
        }
        if (waitingRole && member.roles.cache.has(waitingRole.id)) {
          await member.roles.remove(waitingRole).catch(() => {});
          waitingCount++;
        }
      }
    }

    let channelsDeleted = 0;
    if (tournoi.lobbyChannelId) {
      const lobby = guild.channels.cache.get(tournoi.lobbyChannelId);
      if (lobby) { await lobby.delete().catch(() => {}); channelsDeleted++; }
    }
    if (tournoi.discussionChannelId) {
      const discussion = guild.channels.cache.get(tournoi.discussionChannelId);
      if (discussion) { await discussion.delete().catch(() => {}); channelsDeleted++; }
    }

    closeTournoi(tournoi.id);

    // Mettre à jour l'embed avec statut clôturé
    try {
      const messages = await interaction.channel.messages.fetch({ limit: 20 });
      const embedMsg = messages.find(m => m.author.bot && m.embeds.length > 0);
      if (embedMsg) {
        await embedMsg.edit({ embeds: [buildTournoiEmbed({ ...tournoi, status: 'closed' })] });
      }
    } catch (e) {
      console.warn('⚠️ Impossible de mettre à jour l\'embed final:', e.message);
    }

    await interaction.editReply({
      content: `✅ Tournoi **${tournoi.name}** clôturé !\n\n• 🗑️ ${channelsDeleted} channel(s) supprimé(s)\n• 👥 Rôle @Participant retiré à ${participantsCount} membre(s)\n• ⏳ Rôle @Liste d'attente retiré à ${waitingCount} membre(s)\n\nPrêt pour le prochain tournoi ! 🏆`,
    });
  },
};
