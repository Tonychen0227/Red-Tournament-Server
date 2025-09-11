const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    groupNumber: { type: Number, required: true},
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    round: { type: String, enum: ['Round 1', 'Round 2', 'Round 3', 'Quarterfinals', 'Semifinals', 'Final'], required: true },
    bracket: { type: String, enum: ['Normal', 'Ascension', 'Exhibition', 'Playoffs'], required: true },
    raceStartTime: { type: Number, default: null }, // Unix timestamp
});

groupSchema.index({ round: 1, groupNumber: 1 }, { unique: true });

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;