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

// // Get user details by userId
// router.get('/:userId', async (req, res) => {
//   const { userId } = req.params;

//   try {
//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ message: 'Invalid userId format' });
//     }

//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     res.status(200).json(user);
//   } catch (error) {
//     console.error('Error fetching user details:', error);
//     res.status(500).json({ message: 'Error fetching user details', error });
//   }
// });

// Get user details by discordUsername
router.get('/:discordUsername', async (req, res) => {
  const { discordUsername } = req.params;

  try {
    // Validate discordUsername format if necessary
    if (!discordUsername || typeof discordUsername !== 'string') {
      return res.status(400).json({ message: 'Invalid discordUsername format' });
    }

    // Find user by discordUsername (case-insensitive)
    // const user = await User.findOne({ 
    //   discordUsername: { $regex: new RegExp(`^${discordUsername}$`, 'i') } 
    // });

    // If "anuj._." doesn't work
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