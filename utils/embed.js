const { EmbedBuilder } = require('discord.js');
const { getParticipantTeams, getWaitingTeams } = require('../database/db');

function buildTournoiEmbed(tournoi) {
  const participants = getParticipantTeams(tournoi.id);
  const waiting = getWaitingTeams(tournoi.id);
  const maps = JSON.parse(tournoi.maps || '[]');

  const formatTeam = (team, index) => {
    return `**${index + 1}.** ${team.members.map(m => `<@${m}>`).join(', ')}`;
  };

  let teamsText = participants.length > 0
    ? participants.map((t, i) => formatTeam(t, i)).join('\n')
    : '*Aucune équipe inscrite*';

  let waitingText = waiting.length > 0
    ? waiting.map((t, i) => formatTeam(t, i)).join('\n')
    : null;

  const statusEmoji = tournoi.status === 'closed' ? '🔴' : '🟢';
  const statusText = tournoi.status === 'closed' ? 'Terminé' : 'Ouvert';

  const embed = new EmbedBuilder()
    .setColor(tournoi.status === 'closed' ? 0xe74c3c : 0x2ecc71)
    .setTitle(`🏆 ${tournoi.name}`)
    .setDescription(`${statusEmoji} **Statut :** ${statusText}`)
    .addFields(
      { name: '🎮 Jeu', value: tournoi.game, inline: true },
      { name: '📅 Date', value: `${tournoi.date} à ${tournoi.time}`, inline: true },
      { name: '👥 Format', value: `${tournoi.playersPerTeam} joueur(s) par team`, inline: true },
      { name: '🎯 Places', value: `${participants.length}/${tournoi.maxTeams} teams`, inline: true },
      { name: '⏰ Deadline', value: tournoi.deadline, inline: true },
    );

  if (maps.length > 0) {
    const mapsText = tournoi.rotationsPerMap > 0
      ? `${maps.join(', ')} (${tournoi.rotationsPerMap} rotations)`
      : maps.join(', ');
    embed.addFields({ name: '🗺️ Maps', value: mapsText, inline: true });
  }

  // Instructions inscription
  if (tournoi.status !== 'closed') {
    const inscriptionCmd = tournoi.playersPerTeam === 1
      ? '`/inscription`'
      : tournoi.playersPerTeam === 2
        ? '`/inscription @joueur2`'
        : tournoi.playersPerTeam === 3
          ? '`/inscription @joueur2 @joueur3`'
          : `\`/inscription @joueur2 ... @joueur${tournoi.playersPerTeam}\``;

    embed.addFields({
      name: '📋 Comment s\'inscrire',
      value: `• S'inscrire : ${inscriptionCmd}\n• Modifier : \`/modifier-inscription @ancien @nouveau\`\n• Se désinscrire : \`/desinscription\``,
    });
  }

  // Liste des teams
  embed.addFields({
    name: `📊 Teams inscrites (${participants.length}/${tournoi.maxTeams})`,
    value: teamsText,
  });

  if (waitingText) {
    embed.addFields({
      name: `⏳ Liste d'attente (${waiting.length})`,
      value: waitingText,
    });
  }

  embed.setFooter({ text: 'TournoiBot • Bonne chance à tous !' });
  embed.setTimestamp();

  return embed;
}

module.exports = { buildTournoiEmbed };
