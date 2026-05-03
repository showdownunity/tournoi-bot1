const { SlashCommandBuilder, ChannelType } = require('discord.js');
const {
  getTournoiByPostId,
  createTeam,
  getTeamByMember,
  getParticipantTeams,
  getNextPosition,
} = require('../database/db');
const { buildTournoiEmbed } = require('../utils/embed');
const { dmInscriptionConfirmee } = require('../utils/dm');
const { isDeadlinePassed, generateId } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inscription')
    .setDescription('S\'inscrire à ce tournoi avec ta team')
    .addUserOption(opt => opt.setName('joueur2').setDescription('2ème joueur').setRequired(false))
    .addUserOption(opt => opt.setName('joueur3').setDescription('3ème joueur').setRequired(false))
    .addUserOption(opt => opt.setName('joueur4').setDescription('4ème joueur').setRequired(false))
    .addUserOption(opt => opt.setName('joueur5').setDescription('5ème joueur').setRequired(false))
    .addUserOption(opt => opt.setName('joueur6').setDescription('6ème joueur').setRequired(false))
    .addUserOption(opt => opt.setName('joueur7').setDescription('7ème joueur').setRequired(false))
    .addUserOption(opt => opt.setName('joueur8').setDescription('8ème joueur').setRequired(false))
    .addUserOption(opt => opt.setName('joueur9').setDescription('9ème joueur').setRequired(false))
    .addUserOption(opt => opt.setName('joueur10').setDescription('10ème joueur').setRequired(false)),

  async execute(interaction) {
    if (interaction.channel.type !== ChannelType.PublicThread) {
      return interaction.reply({ content: '❌ Utilise cette commande dans le **post du tournoi** !', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const tournoi = getTournoiByPostId(interaction.channel.id);
    if (!tournoi) return interaction.editReply({ content: '❌ Aucun tournoi trouvé pour ce post.' });
    if (tournoi.status === 'closed') return interaction.editReply({ content: '❌ Ce tournoi est **clôturé**.' });
    if (isDeadlinePassed(tournoi.deadline)) return interaction.editReply({ content: '❌ La **deadline d\'inscription** est passée !' });

    const captain = interaction.user;
    const mentionedUsers = [];
    for (let i = 2; i <= 10; i++) {
      const u = interaction.options.getUser(`joueur${i}`);
      if (u) mentionedUsers.push(u);
    }

    const allMembers = [captain, ...mentionedUsers];
    const expectedCount = tournoi.playersPerTeam;

    if (allMembers.length !== expectedCount) {
      return interaction.editReply({
        content: `❌ Ce tournoi est en **${expectedCount} joueur(s)** par team.\nTu as mentionné ${allMembers.length} joueur(s) (toi inclus).\n\nExemple : \`/inscription${expectedCount >= 2 ? ' @joueur2' : ''}${expectedCount >= 3 ? ' @joueur3' : ''}\``,
      });
    }

    for (const u of allMembers) {
      if (u.bot) return interaction.editReply({ content: '❌ Tu ne peux pas inscrire un bot !' });
    }

    const ids = allMembers.map(u => u.id);
    if (new Set(ids).size !== ids.length) {
      return interaction.editReply({ content: '❌ Tu as mentionné le même joueur plusieurs fois !' });
    }

    for (const u of allMembers) {
      const existing = getTeamByMember(tournoi.id, u.id);
      if (existing) return interaction.editReply({ content: `❌ <@${u.id}> est **déjà inscrit(e)** à ce tournoi !` });
    }

    const participants = getParticipantTeams(tournoi.id);
    const isFull = participants.length >= tournoi.maxTeams;
    const status = isFull ? 'waiting' : 'participant';
    const position = getNextPosition(tournoi.id);

    const teamId = generateId();
    createTeam({ id: teamId, tournoisId: tournoi.id, captainId: captain.id, members: ids, position, status });

    // Attribution des rôles via ID
    const guild = interaction.guild;
    const roleId = status === 'participant'
      ? process.env.PARTICIPANT_ROLE_ID
      : process.env.WAITING_ROLE_ID;

    if (roleId) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        for (const u of allMembers) {
          const member = await guild.members.fetch(u.id).catch(() => null);
          if (member) await member.roles.add(role).catch(e => console.warn(`⚠️ Impossible d'ajouter le rôle à ${u.id}:`, e.message));
        }
      } else {
        console.warn(`⚠️ Rôle introuvable avec l'ID: ${roleId}`);
      }
    }

    // Mettre à jour l'embed
    await updateEmbed(interaction, tournoi);
    await dmInscriptionConfirmee(captain, tournoi, ids);

    if (status === 'participant') {
      await interaction.editReply({ content: `✅ Ta team a été **inscrite** au tournoi **${tournoi.name}** ! Bonne chance 🎮` });
    } else {
      await interaction.editReply({ content: `⏳ Le tournoi est complet ! Ta team a été ajoutée à la **liste d'attente** pour **${tournoi.name}**.` });
    }
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
