const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordUsername: { type: String, required: true, unique: true },
    displayName: { type: String },
    role: { type: String, enum: ['runner', 'commentator'], required: true },
    isAdmin: { type: Boolean, default: false },
    pronouns: { type: String, default: null },
    initialPot: { type: String, enum: ['1', '2', '3'] },
    currentBracket: { type: String, enum: ['High', 'Middle', 'Low'] },
    points: { type: Number, default: 0 },
    tieBreakerValue: { type: Number, default: 0 },
    hasDNF: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

module.exports = User;