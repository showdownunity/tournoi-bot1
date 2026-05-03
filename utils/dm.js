async function sendDM(user, content) {
  try {
    await user.send(content);
  } catch (e) {
    console.warn(`⚠️ Impossible d'envoyer un DM à ${user.tag || user.id}`);
  }
}

async function dmInscriptionConfirmee(captain, tournoi, members) {
  const membersText = members.map(m => `<@${m}>`).join(', ');
  await sendDM(captain, {
    content: `✅ **Inscription confirmée !**\n\nTa team a été inscrite pour le tournoi **${tournoi.name}**.\n📅 Date : ${tournoi.date} à ${tournoi.time}\n👥 Ton équipe : ${membersText}\n\nBonne chance ! 🎮`,
  });
}

async function dmNouveauJoueur(newUser, captain, tournoi, members) {
  const membersText = members.map(m => `<@${m}>`).join(', ');
  await sendDM(newUser, {
    content: `🎮 **Tu as rejoint une team !**\n\n<@${captain.id}> t'a ajouté à sa team pour le tournoi **${tournoi.name}**.\n📅 Date : ${tournoi.date} à ${tournoi.time}\n👥 Ton équipe : ${membersText}\n\nPrépare-toi ! 💪`,
  });
}

async function dmPromotion(captain, tournoi) {
  await sendDM(captain, {
    content: `🎉 **Bonne nouvelle !**\n\nUne place s'est libérée ! Ta team est maintenant officiellement inscrite au tournoi **${tournoi.name}**.\n\nPréparez-vous pour le ${tournoi.date} à ${tournoi.time} ! 🏆`,
  });
}

async function dmDesinscription(captain, tournoi) {
  await sendDM(captain, {
    content: `👋 **Désinscription confirmée**\n\nTa team a été retirée du tournoi **${tournoi.name}**.\nÀ bientôt pour un prochain événement !`,
  });
}

module.exports = {
  sendDM,
  dmInscriptionConfirmee,
  dmNouveauJoueur,
  dmPromotion,
  dmDesinscription,
};
