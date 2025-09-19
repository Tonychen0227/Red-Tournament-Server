const express = require('express');
const router = express.Router();

const PastResults = require('../models/PastResults');

// GET all past results
router.get('/', async (req, res) => {
    try {
        const pastResults = await PastResults.find()
            .populate('gold.userId', 'discordUsername displayName')
            .populate('silver.userId', 'discordUsername displayName')
            .populate('bronze.userId', 'discordUsername displayName')
            .sort({ tournamentYear: -1 });

        res.status(200).json(pastResults);
    } catch (err) {
        console.error('Error fetching past results:', err);
        res.status(500).json({ error: 'Error fetching past results' });
    }
});

module.exports = router;