const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    groupNumber: { type: Number, required: true},
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    round: { type: String, enum: ['Seeding', 'Round 1', 'Round 2', 'Round 3', 'Semifinals', 'Final'], required: true },

    raceStartTime: { type: Number, default: null }, // Unix timestamp
});

groupSchema.index({ round: 1, groupNumber: 1 }, { unique: true });

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;