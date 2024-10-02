const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');

const Pickems = require('../models/Pickems');
const Tournament = require('../models/Tournament');

const ensureAuthenticated = require('../middleware/ensureAuthenticated');

// Submit one-off picks
router.post('/submit-one-off', ensureAuthenticated, async (req, res) => {
  
  const { selectedRunners, selectedWinner, selectedBestTimeRunner, bestTime } = req.body;

  const userId = req.user._id;

  // Calculate the closestTime in milliseconds from the bestTime object
  const closestTime =
    (bestTime.hours * 3600000) +
    (bestTime.minutes * 60000) +
    (bestTime.seconds * 1000) +
    bestTime.milliseconds;


  try {
    const pickems = await Pickems.findOne({ userId });

    if (pickems) {
      return res.status(400).json({ message: 'You have already submitted your one-off picks.' });
    }

    const newPickems = new Pickems({
      userId,
      top9: selectedRunners.map(runner => runner._id),
      overallWinner: selectedWinner._id,
      bestTimeWho: selectedBestTimeRunner._id,
      closestTime
    });

    await newPickems.save();

    res.status(201).json({ message: 'Pickems saved successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error saving pickems', error });
  }
});

// Submit round picks
router.post('/submit-round-picks', ensureAuthenticated, async (req, res) => {
  const { selectedWinners } = req.body;
  const userId = req.user._id;

  try {
    // Fetch the active tournament
    const tournament = await Tournament.findOne().sort({ _id: -1 }); // Adjust query if needed

    if (!tournament) {
      return res.status(404).json({ message: 'No active tournament found.' });
    }

    const currentRound = tournament.currentRound;

    // Validate currentRound against the schema's enum
    const validRoundsMap = {
      'Round 1': 'round1Picks',
      'Round 2': 'round2Picks',
      'Round 3': 'round3Picks',
      'Semifinals': 'semiFinalsPicks',
    };

    if (!validRoundsMap[currentRound]) {
      return res.status(400).json({ message: `Invalid current round: ${currentRound}.` });
    }

    const roundField = validRoundsMap[currentRound];

    const pickems = await Pickems.findOne({ userId });

    if (!pickems) {
      return res.status(404).json({ message: 'Pickems not found for this user.' });
    }

    // Check if picks for the current round have already been submitted
    if (pickems[roundField] && pickems[roundField].length > 0) {
      return res.status(400).json({ message: `You have already submitted picks for ${currentRound}.` });
    }

    // Validate selectedRunners array
    if (!Array.isArray(selectedWinners) || selectedWinners.length === 0) {
      return res.status(400).json({ message: 'Selected runners must be a non-empty array.' });
    }

    pickems[roundField] = selectedWinners;

    await pickems.save();

    res.status(200).json({ message: `${currentRound} picks submitted successfully.` });
  } catch (error) {
    console.error('Error submitting round picks:', error);
    res.status(500).json({ message: 'Error submitting round picks.', error });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.user._id; // Assuming the user ID comes from authentication
    
    // Find the pickems and populate all user-related fields
    const pickems = await Pickems.findOne({ userId })
    .populate('top9', 'displayName') // Populate top9 with displayName field
    .populate('overallWinner', 'displayName')
    .populate('bestTimeWho', 'displayName')
    .populate('round1Picks', 'displayName')
    .populate('round2Picks', 'displayName')
    .populate('round3Picks', 'displayName')
    .populate('semiFinalsPicks', 'displayName');

    // Return the pickems object if it exists, otherwise null
    res.status(200).json(pickems || null);
  } catch (error) {
    console.error('Error fetching Pickems:', error);
    res.status(500).json({ message: 'Error fetching Pickems', error });
  }
});

// Get points for all Pickems players, ordered by points (descending)
router.get('/leaderboard', async (req, res) => {
  try {
    // Find all Pickems entries, sort by points in descending order, and populate the userId with username
    const pickemsList = await Pickems.find()
      .populate('userId', 'displayName') // Populate userId to get the displayName
      .select('userId points') // Select only the points and userId fields
      .sort({ points: -1 }); // Sort by points in descending order

    // If no Pickems entries found, return an empty array
    if (!pickemsList) {
      return res.status(404).json({ message: 'No Pickems entries found' });
    }

    // Respond with the sorted array of Pickems entries
    res.status(200).json(pickemsList);
  } catch (error) {
    console.error('Error retrieving Pickems points:', error);
    res.status(500).json({ message: 'Error retrieving Pickems points', error });
  }
});


// Get the user's Pickems
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const pickems = await Pickems.findOne({ userId }).populate('userId', 'username');
        
        if (!pickems) {
        return res.status(404).json({ message: 'Pickems not found for this user' });
        }

        res.status(200).json(pickems);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving pickems', error });
    }
});


module.exports = router;