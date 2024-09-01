const express = require('express');
const router = express.Router();
const Race = require('../models/Race');
const User = require('../models/User');
const ensureRunner = require('../middleware/ensureRunner');

router.get('/submit', ensureRunner, async (req, res) => {
  try {
    const runners = await User.find({ 
      role: 'runner', 
      discordUsername: { $ne: req.user.username }
    });

    res.render('submit-race', { 
      title: 'Submit a New Race', 
      runners: runners, 
      userTimezone: req.user.timezone || 'UTC'
    });
  } catch (err) {
    console.error('Error fetching runners', err);
    res.status(500).send('Error fetching runners');
  }
});

module.exports = router;
