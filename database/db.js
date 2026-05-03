const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'tournois.db'));

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tournois (
      id TEXT PRIMARY KEY,
      forumPostId TEXT,
      forumChannelId TEXT,
      guildId TEXT,
      name TEXT NOT NULL,
      game TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      maxTeams INTEGER NOT NULL,
      playersPerTeam INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      maps TEXT DEFAULT '[]',
      rotationsPerMap INTEGER DEFAULT 0,
      embedMessageId TEXT,
      lobbyChannelId TEXT,
      discussionChannelId TEXT,
      status TEXT DEFAULT 'open',
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      tournoisId TEXT NOT NULL,
      captainId TEXT NOT NULL,
      members TEXT NOT NULL,
      position INTEGER NOT NULL,
      status TEXT DEFAULT 'participant',
      FOREIGN KEY (tournoisId) REFERENCES tournois(id)
    );
  `);
  console.log('✅ Base de données initialisée');
}

// ─── TOURNOIS ────────────────────────────────────────────

function createTournoi(data) {
  const stmt = db.prepare(`
    INSERT INTO tournois (id, forumPostId, forumChannelId, guildId, name, game, date, time, maxTeams, playersPerTeam, deadline, maps, rotationsPerMap, embedMessageId, status)
    VALUES (@id, @forumPostId, @forumChannelId, @guildId, @name, @game, @date, @time, @maxTeams, @playersPerTeam, @deadline, @maps, @rotationsPerMap, @embedMessageId, 'open')
  `);
  return stmt.run({
    ...data,
    maps: JSON.stringify(data.maps || []),
    rotationsPerMap: data.rotationsPerMap || 0,
  });
}

function getTournoiByPostId(forumPostId) {
  return db.prepare('SELECT * FROM tournois WHERE forumPostId = ?').get(forumPostId);
}

function getTournoiById(id) {
  return db.prepare('SELECT * FROM tournois WHERE id = ?').get(id);
}

function updateTournoiEmbed(id, embedMessageId) {
  db.prepare('UPDATE tournois SET embedMessageId = ? WHERE id = ?').run(embedMessageId, id);
}

function updateTournoiChannels(id, lobbyChannelId, discussionChannelId) {
  db.prepare('UPDATE tournois SET lobbyChannelId = ?, discussionChannelId = ? WHERE id = ?')
    .run(lobbyChannelId, discussionChannelId, id);
}

function closeTournoi(id) {
  db.prepare("UPDATE tournois SET status = 'closed' WHERE id = ?").run(id);
}

// ─── TEAMS ───────────────────────────────────────────────

function createTeam(data) {
  const stmt = db.prepare(`
    INSERT INTO teams (id, tournoisId, captainId, members, position, status)
    VALUES (@id, @tournoisId, @captainId, @members, @position, @status)
  `);
  return stmt.run({
    ...data,
    members: JSON.stringify(data.members),
  });
}

function getTeamsByTournoi(tournoisId) {
  const teams = db.prepare('SELECT * FROM teams WHERE tournoisId = ? ORDER BY position ASC').all(tournoisId);
  return teams.map(t => ({ ...t, members: JSON.parse(t.members) }));
}

function getTeamByCaptain(tournoisId, captainId) {
  const team = db.prepare('SELECT * FROM teams WHERE tournoisId = ? AND captainId = ?').get(tournoisId, captainId);
  if (team) team.members = JSON.parse(team.members);
  return team;
}

function getTeamByMember(tournoisId, userId) {
  const teams = getTeamsByTournoi(tournoisId);
  return teams.find(t => t.members.includes(userId)) || null;
}

function updateTeamMembers(teamId, members) {
  db.prepare('UPDATE teams SET members = ? WHERE id = ?').run(JSON.stringify(members), teamId);
}

function deleteTeam(teamId) {
  db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
}

function getNextPosition(tournoisId) {
  const result = db.prepare('SELECT MAX(position) as maxPos FROM teams WHERE tournoisId = ?').get(tournoisId);
  return (result.maxPos || 0) + 1;
}

function promoteFirstWaiting(tournoisId) {
  const waiting = db.prepare("SELECT * FROM teams WHERE tournoisId = ? AND status = 'waiting' ORDER BY position ASC LIMIT 1").get(tournoisId);
  if (waiting) {
    db.prepare("UPDATE teams SET status = 'participant' WHERE id = ?").run(waiting.id);
    waiting.members = JSON.parse(waiting.members);
    return waiting;
  }
  return null;
}

function getParticipantTeams(tournoisId) {
  const teams = db.prepare("SELECT * FROM teams WHERE tournoisId = ? AND status = 'participant' ORDER BY position ASC").all(tournoisId);
  return teams.map(t => ({ ...t, members: JSON.parse(t.members) }));
}

function getWaitingTeams(tournoisId) {
  const teams = db.prepare("SELECT * FROM teams WHERE tournoisId = ? AND status = 'waiting' ORDER BY position ASC").all(tournoisId);
  return teams.map(t => ({ ...t, members: JSON.parse(t.members) }));
}

module.exports = {
  initDatabase,
  createTournoi, getTournoiByPostId, getTournoiById,
  updateTournoiEmbed, updateTournoiChannels, closeTournoi,
  createTeam, getTeamsByTournoi, getTeamByCaptain, getTeamByMember,
  updateTeamMembers, deleteTeam, getNextPosition,
  promoteFirstWaiting, getParticipantTeams, getWaitingTeams,
};
