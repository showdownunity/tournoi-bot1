const { SlashCommandBuilder, ChannelType } = require('discord.js');
const {
  getTournoiByPostId,
  getTeamByCaptain,
  getTeamByMember,
  updateTeamMembers,
} = require('../database/db');
const { buildTournoiEmbed } = require('../utils/embed');
const { dmNouveauJoueur } = require('../utils/dm');
const { isDeadlinePassed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modifier-inscription')
    .setDescription('Remplacer un joueur dans ta team (Capitaine uniquement)')
    .addUserOption(opt =>
      opt.setName('ancien_joueur').setDescription('Le joueur à remplacer').setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('nouveau_joueur').setDescription('Le nouveau joueur').setRequired(true)
    ),

  async execute(interaction) {
    if (interaction.channel.type !== ChannelType.PublicThread) {
      return interaction.reply({ content: '❌ Utilise cette commande dans le **post du tournoi** !', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const tournoi = getTournoiByPostId(interaction.channel.id);
    if (!tournoi) return interaction.editReply({ content: '❌ Aucun tournoi trouvé pour ce post.' });
    if (tournoi.status === 'closed') return interaction.editReply({ content: '❌ Ce tournoi est **clôturé**.' });
    if (isDeadlinePassed(tournoi.deadline)) return interaction.editReply({ content: '❌ La **deadline** est passée !' });

    const team = getTeamByCaptain(tournoi.id, interaction.user.id);
    if (!team) return interaction.editReply({ content: '❌ Tu n\'es pas **capitaine** d\'une team dans ce tournoi !' });

    const ancienJoueur = interaction.options.getUser('ancien_joueur');
    const nouveauJoueur = interaction.options.getUser('nouveau_joueur');

    if (!team.members.includes(ancienJoueur.id)) {
      return interaction.editReply({ content: `❌ <@${ancienJoueur.id}> ne fait pas partie de ta team !` });
    }
    if (team.members.includes(nouveauJoueur.id)) {
      return interaction.editReply({ content: `❌ <@${nouveauJoueur.id}> est **déjà** dans ta team !` });
    }
    if (getTeamByMember(tournoi.id, nouveauJoueur.id)) {
      return interaction.editReply({ content: `❌ <@${nouveauJoueur.id}> est déjà inscrit(e) à ce tournoi !` });
    }
    if (nouveauJoueur.bot) return interaction.editReply({ content: '❌ Impossible d\'ajouter un bot !' });

    const newMembers = team.members.map(id => id === ancienJoueur.id ? nouveauJoueur.id : id);
    updateTeamMembers(team.id, newMembers);

    // Gestion des rôles via ID
    const guild = interaction.guild;
    const participantRole = guild.roles.cache.get(process.env.PARTICIPANT_ROLE_ID);
    if (participantRole && team.status === 'participant') {
      const ancienMember = await guild.members.fetch(ancienJoueur.id).catch(() => null);
      if (ancienMember) await ancienMember.roles.remove(participantRole).catch(() => {});
      const nouveauMember = await guild.members.fetch(nouveauJoueur.id).catch(() => null);
      if (nouveauMember) await nouveauMember.roles.add(participantRole).catch(() => {});
    }

    await updateEmbed(interaction, tournoi);
    await dmNouveauJoueur(nouveauJoueur, interaction.user, tournoi, newMembers);

    await interaction.editReply({
      content: `✅ <@${ancienJoueur.id}> a été remplacé par <@${nouveauJoueur.id}> dans ta team !`,
    });
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
