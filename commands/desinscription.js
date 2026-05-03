const { SlashCommandBuilder, ChannelType } = require('discord.js');
const {
  getTournoiByPostId,
  getTeamByCaptain,
  deleteTeam,
  promoteFirstWaiting,
} = require('../database/db');
const { buildTournoiEmbed } = require('../utils/embed');
const { dmDesinscription, dmPromotion } = require('../utils/dm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('desinscription')
    .setDescription('Retirer ta team du tournoi (Capitaine uniquement)'),

  async execute(interaction) {
    if (interaction.channel.type !== ChannelType.PublicThread) {
      return interaction.reply({ content: '❌ Utilise cette commande dans le **post du tournoi** !', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const tournoi = getTournoiByPostId(interaction.channel.id);
    if (!tournoi) return interaction.editReply({ content: '❌ Aucun tournoi trouvé pour ce post.' });
    if (tournoi.status === 'closed') return interaction.editReply({ content: '❌ Ce tournoi est **clôturé**.' });

    const team = getTeamByCaptain(tournoi.id, interaction.user.id);
    if (!team) return interaction.editReply({ content: '❌ Tu n\'es pas **capitaine** d\'une team dans ce tournoi !' });

    const guild = interaction.guild;
    const participantRole = guild.roles.cache.get(process.env.PARTICIPANT_ROLE_ID);
    const waitingRole = guild.roles.cache.get(process.env.WAITING_ROLE_ID);
    const wasParticipant = team.status === 'participant';

    // Retirer les rôles
    for (const memberId of team.members) {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (member) {
        if (participantRole) await member.roles.remove(participantRole).catch(() => {});
        if (waitingRole) await member.roles.remove(waitingRole).catch(() => {});
      }
    }

    deleteTeam(team.id);
    await dmDesinscription(interaction.user, tournoi);

    // Promotion liste d'attente
    if (wasParticipant) {
      const promoted = promoteFirstWaiting(tournoi.id);
      if (promoted) {
        if (participantRole) {
          for (const memberId of promoted.members) {
            const member = await guild.members.fetch(memberId).catch(() => null);
            if (member) {
              await member.roles.add(participantRole).catch(() => {});
              if (waitingRole) await member.roles.remove(waitingRole).catch(() => {});
            }
          }
        }
        const promotedCaptain = await guild.members.fetch(promoted.captainId).catch(() => null);
        if (promotedCaptain) await dmPromotion(promotedCaptain.user, tournoi);
      }
    }

    await updateEmbed(interaction, tournoi);
    await interaction.editReply({ content: `✅ Ta team a été **retirée** du tournoi **${tournoi.name}**.` });
  },
};

async function updateEmbed(interaction, tournoi) {
  try {
    const messages = await interaction.channel.messages.fetch({ limit: 20 });
    const embedMsg = messages.find(m => m.author.bot && m.embeds.length > 0);
    if (embedMsg) await embedMsg.edit({ embeds: [buildTournoiEmbed(tournoi)] });
  } catch (e) {
    console.warn('⚠️ Impossible de mettre à jour l\'embed:', e.message);
  }
}
