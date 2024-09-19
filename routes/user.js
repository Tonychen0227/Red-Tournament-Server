const express = require('express');
const router = express.Router();

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


module.exports = router;