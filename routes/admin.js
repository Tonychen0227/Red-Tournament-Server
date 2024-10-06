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

router.post('/set-pots', ensureAdmin, async (req, res) => {


  const { userPots } = req.body; // Expecting an array of { userId, pot }

  if (!Array.isArray(userPots) || userPots.length === 0) {
    return res.status(400).json({ message: 'Invalid input data' });
  }

  try {
    const bulkOps = userPots.map(({ userId, pot }) => ({
      updateOne: {
        filter: { _id: userId },
        update: { initialPot: pot },
      },
    }));

    const bulkWriteResult = await User.bulkWrite(bulkOps);

    res.status(200).json({
      message: 'Pots updated successfully',
      result: bulkWriteResult,
    });
  } catch (err) {
    console.error('Error updating pots:', err);
    res.status(500).json({ message: 'Error updating pots', error: err.message });
  }
});

module.exports = router;
