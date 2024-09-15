const express = require('express');
const router = express.Router();

const User = require('../models/User');

const ensureAuthenticated = require('../middleware/ensureAuthenticated');

router.post('/timezone', ensureAuthenticated, async (req, res) => {
  const { timezone } = req.body;

  console.log(timezone);
  

  if (!timezone && timezone !== 0) {
    return res.status(400).json({ error: 'Timezone is required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { timezone },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    console.error('Error updating timezone:', err);
    res.status(500).json({ error: 'Error updating timezone' });
  }
});

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

module.exports = router;