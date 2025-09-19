const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
}, { _id: false });

const pastResultsSchema = new mongoose.Schema({
    tournamentYear: { type: Number, required: true, unique: true },
    gold: { type: winnerSchema, required: true },
    silver: { type: winnerSchema, required: true },
    bronze: { type: winnerSchema, required: true },
    spotlightVideos: { type: [String], required: true }
}, {
    timestamps: true
});

const PastResults = mongoose.model('PastResults', pastResultsSchema);

module.exports = PastResults;