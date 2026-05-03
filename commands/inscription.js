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
    if (!tournoi) {
      return interaction.editReply({ content: '❌ Aucun tournoi trouvé pour ce post.' });
    }
    if (tournoi.status === 'closed') {
      return interaction.editReply({ content: '❌ Ce tournoi est **clôturé**.' });
    }
    if (isDeadlinePassed(tournoi.deadline)) {
      return interaction.editReply({ content: '❌ La **deadline d\'inscription** est passée !' });
    }

    // Collecter les membres mentionnés
    const captain = interaction.user;
    const mentionedUsers = [];
    for (let i = 2; i <= 10; i++) {
      const u = interaction.options.getUser(`joueur${i}`);
      if (u) mentionedUsers.push(u);
    }

    const allMembers = [captain, ...mentionedUsers];
    const expectedCount = tournoi.playersPerTeam;

    // Vérifier le nombre de joueurs
    if (allMembers.length !== expectedCount) {
      return interaction.editReply({
        content: `❌ Ce tournoi est en **${expectedCount} joueur(s)** par team.\nTu as mentionné ${allMembers.length} joueur(s) (toi inclus).\n\nExemple : \`/inscription${expectedCount > 1 ? ' @joueur2' : ''}${expectedCount > 2 ? ' @joueur3' : ''}\``,
      });
    }

    // Vérifier les bots
    for (const u of allMembers) {
      if (u.bot) return interaction.editReply({ content: '❌ Tu ne peux pas inscrire un bot !' });
    }

    // Vérifier les doublons dans la mention
    const ids = allMembers.map(u => u.id);
    if (new Set(ids).size !== ids.length) {
      return interaction.editReply({ content: '❌ Tu as mentionné le même joueur plusieurs fois !' });
    }

    // Vérifier que personne n'est déjà inscrit
    for (const u of allMembers) {
      const existing = getTeamByMember(tournoi.id, u.id);
      if (existing) {
        return interaction.editReply({ content: `❌ <@${u.id}> est **déjà inscrit(e)** à ce tournoi !` });
      }
    }

    // Déterminer le statut (participant ou liste d'attente)
    const participants = getParticipantTeams(tournoi.id);
    const isFull = participants.length >= tournoi.maxTeams;
    const status = isFull ? 'waiting' : 'participant';
    const position = getNextPosition(tournoi.id);

    // Créer la team
    const teamId = generateId();
    createTeam({
      id: teamId,
      tournoisId: tournoi.id,
      captainId: captain.id,
      members: ids,
      position,
      status,
    });

    // Attribuer les rôles
    const guild = interaction.guild;
    const roleName = status === 'participant' ? 'Participant' : 'Liste d\'attente';
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      for (const u of allMembers) {
        const member = await guild.members.fetch(u.id).catch(() => null);
        if (member) await member.roles.add(role).catch(() => {});
      }
    }

    // Mettre à jour l'embed
    await updateEmbed(interaction, tournoi);

    // DM au capitaine
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
    const thread = interaction.channel;
    const messages = await thread.messages.fetch({ limit: 20 });
    const embedMsg = messages.find(m => m.author.bot && m.embeds.length > 0);
    if (embedMsg) {
      const newEmbed = buildTournoiEmbed(tournoi);
      await embedMsg.edit({ embeds: [newEmbed] });
    }
  } catch (e) {
    console.warn('⚠️ Impossible de mettre à jour l\'embed:', e.message);
  }
}
