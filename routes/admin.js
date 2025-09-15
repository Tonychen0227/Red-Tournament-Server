const express = require('express');
const router = express.Router();

const ensureAdmin = require('../middleware/ensureAdmin');

const Race = require('../models/Race');
const User = require('../models/User');

router.post('/add-user', ensureAdmin, async (req, res) => {
  const { discordUsername, displayName, role, isAdmin, country } = req.body;

  try {
    // Validate country code if provided
    if (country && country !== '' && (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country))) {
      return res.status(400).json({
        message: 'Country must be a valid ISO 3166-1 alpha-2 country code (e.g., US, CA, GB) or empty',
        error: 'Invalid country code format'
      });
    }

    const user = await User.findOneAndUpdate(
      { discordUsername }, // Find user by Discord username
      { 
        displayName,
        role, 
        isAdmin: isAdmin === 'on',
        country: country === '' ? null : country
      },
      { new: true, upsert: true }
    );
    
    res.status(200).json({
      message: `User ${user.discordUsername} is now a ${user.role}`,
      user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Internal Server Error',
      error: err.message
    });
  }
});

module.exports = router;
