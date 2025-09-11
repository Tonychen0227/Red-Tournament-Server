const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordUsername: { type: String, required: true, unique: true },
    displayName: { type: String },
    role: { type: String, enum: ['runner', 'commentator'], required: true },
    isAdmin: { type: Boolean, default: false },
    pronouns: { type: String, default: null },
    currentBracket: { type: String, enum: ['Playoffs', 'Exhibition', 'Ascension', 'Normal'] },
    points: { type: Number, default: 0 },
    bestTournamentTimeMilliseconds: { type: Number, default: 9000000 },
    currentGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
});

const User = mongoose.model('User', userSchema);

module.exports = User;