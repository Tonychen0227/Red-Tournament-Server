const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');

const User = require('../models/User');

const ensureAuthenticated = require('../middleware/ensureAuthenticated');

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
  if (country !== null && country !== '' && (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country))) {
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

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Error fetching user details', error });
  }
});


module.exports = router;