const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');

const User = require('../models/User');
const PastResults = require('../models/PastResults');

const ensureAuthenticated = require('../middleware/ensureAuthenticated');

// Helper function to get user's tournament trophies
async function getUserTrophies(userId) {
  try {
    const pastResults = await PastResults.find({
      $or: [
        { 'gold.userId': userId },
        { 'silver.userId': userId },
        { 'bronze.userId': userId }
      ]
    }).sort({ tournamentYear: -1 });

    const trophies = [];
    
    pastResults.forEach(result => {
      if (result.gold.userId && result.gold.userId.toString() === userId.toString()) {
        trophies.push({ year: result.tournamentYear, position: '1st', emoji: '🥇' });
      }
      if (result.silver.userId && result.silver.userId.toString() === userId.toString()) {
        trophies.push({ year: result.tournamentYear, position: '2nd', emoji: '🥈' });
      }
      if (result.bronze.userId && result.bronze.userId.toString() === userId.toString()) {
        trophies.push({ year: result.tournamentYear, position: '3rd', emoji: '🥉' });
      }
    });

    return trophies;
  } catch (error) {
    console.error('Error fetching user trophies:', error);
    return [];
  }
}

router.post('/displayName', ensureAuthenticated, async (req, res) => {
  const { displayName } = req.body;
  if (!displayName) {
    return res.status(400).json({ error: 'Display name is required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { displayName },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    console.error('Error updating display name:', err);
    res.status(500).json({ error: 'Error updating display name' });
  }
});

router.post('/pronouns', ensureAuthenticated, async (req, res) => {
  const { pronouns } = req.body;

  if (pronouns == null) {
    return res.status(400).json({ error: 'Pronouns are required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { pronouns },
      // { new: true }
    );
    res.json(user);
  } catch (err) {
    console.error('Error updating pronouns:', err);
    res.status(500).json({ error: 'Error updating pronouns' });
  }
});

router.post('/country', ensureAuthenticated, async (req, res) => {
  const { country } = req.body;

  // Validate country code format (ISO 3166-1 alpha-2)
  if (country !== null && country !== '' && (!/^[A-Z]{2}$/.test(country) && ['ENG', 'SCO', 'WAL', 'NIR'].indexOf(country) === -1)) {
    return res.status(400).json({ error: 'Country must be a valid ISO 3166-1 alpha-2 country code (e.g., US, CA, GB) or null' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { country: country === '' ? null : country },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    console.error('Error updating country:', err);
    res.status(500).json({ error: 'Error updating country' });
  }
});

// Get user details by discordUsername
router.get('/:discordUsername', async (req, res) => {
  const { discordUsername } = req.params;

  try {
    if (!discordUsername || typeof discordUsername !== 'string') {
      return res.status(400).json({ message: 'Invalid discordUsername format' });
    }

    const user = await User.findOne({ 
      discordUsername: { $regex: new RegExp(`^${discordUsername.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } 
    });    

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's tournament trophies
    const trophies = await getUserTrophies(user._id);

    // Add trophies to user object
    const userWithTrophies = {
      ...user.toObject(),
      trophies: trophies
    };

    res.status(200).json(userWithTrophies);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Error fetching user details', error });
  }
});

// Get current user's profile with trophy information
router.get('/profile/me', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's tournament trophies
    const trophies = await getUserTrophies(user._id);

    // Add trophies to user object
    const userWithTrophies = {
      ...user.toObject(),
      trophies: trophies
    };

    res.status(200).json(userWithTrophies);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile', error });
  }
});


module.exports = router;