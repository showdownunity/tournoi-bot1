require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('./database/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

// Chargement des commandes
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Commande chargée : /${command.data.name}`);
  }
}

// Initialisation de la base de données
initDatabase();

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot connecté en tant que ${client.user.tag}`);
  console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
});

// Gestion des interactions (commandes slash)
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Erreur commande /${interaction.commandName}:`, error);
    const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
