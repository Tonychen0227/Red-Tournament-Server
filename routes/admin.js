const express = require('express');
const router = express.Router();

const ensureAdmin = require('../middleware/ensureAdmin');

const Race = require('../models/Race');
const User = require('../models/User');

router.post('/add-user', ensureAdmin, async (req, res) => {
  const { discordUsername, displayName, role, isAdmin } = req.body;

  try {
    const user = await User.findOneAndUpdate(
      { discordUsername }, // Find user by Discord username
      { 
        displayName,
        role, 
        isAdmin: isAdmin === 'on'
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
