const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  currentRound: { type: String, enum: ['Seeding', 'Round 1', 'Round 2', 'Round 3', 'Semifinals', 'Final'], required: true }
});

const Tournament = mongoose.model('Tournament', tournamentSchema);

module.exports = Tournament;