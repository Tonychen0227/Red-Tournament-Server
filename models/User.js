const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordUsername: { type: String, required: true, unique: true },
    displayName: { type: String },
    role: { type: String, enum: ['runner', 'commentator'], required: true },
    isAdmin: { type: Boolean, default: false },
    pronouns: { type: String, default: null },
    country: { type: String, default: null }, // ISO 3166-1 alpha-2 country code (e.g., 'US', 'CA', 'GB') or 3-letter codes for UK nations
    currentBracket: { type: String, enum: ['Playoffs', 'Exhibition', 'Ascension', 'Normal'], default: 'Normal' },
    points: { type: Number, default: 0 },
    bestTournamentTimeMilliseconds: { type: Number, default: 9000000 },
    currentGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    photos: [{ 
        value: { type: String }, // Discord avatar URL
        type: { type: String, default: 'image' }
    }],
});

const User = mongoose.model('User', userSchema);

module.exports = User;