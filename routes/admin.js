const express = require('express');
const router = express.Router();
const ensureAdmin = require('../middleware/ensureAdmin');

const Race = require('../models/Race');
const User = require('../models/User');

// Mark race as complete
router.get('/complete-race/:raceId', ensureAdmin, async (req, res) => {
  const { raceId } = req.params;

  try {
    const race = await Race.findById(raceId)
      .populate('racer1', 'discordUsername displayName')
      .populate('racer2', 'discordUsername displayName')
      .populate('racer3', 'discordUsername displayName');

    if (!race) {
      return res.status(404).render('error', { 
        title: 'Race Not Found',
        message: 'The race you are trying to access does not exist.',
        username: req.user ? req.user.username : null
      });
    }

    res.render('complete-race', { 
      title: 'Complete Race',
      race: race,
      scripts: ''
    });

  } catch (err) {
    console.error('Error fetching race:', err);
    res.status(500).send('Error fetching race');
  }
});

router.post('/complete-race/:raceId', ensureAdmin, async (req, res) => {
  const { raceId } = req.params;
  const { results } = req.body;

  try {
    const race = await Race.findById(raceId);

    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    race.results = results.map((result, index) => ({
      racer: race[`racer${index + 1}`]._id,
      status: result.status,
      finishTime: {
        hours: result.finishTime.hours,
        minutes: result.finishTime.minutes,
        seconds: result.finishTime.seconds
      }
    }));

    // Determine the winner based on the finish times
    const finishedRacers = race.results.filter(r => r.status === 'Finished');
    finishedRacers.sort((a, b) => {
      const timeA = a.finishTime.hours * 3600 + a.finishTime.minutes * 60 + a.finishTime.seconds + a.finishTime.milliseconds;
      const timeB = b.finishTime.hours * 3600 + b.finishTime.minutes * 60 + b.finishTime.seconds + b.finishTime.milliseconds;
      return timeA - timeB;
    });

    if (finishedRacers.length > 0) {
      race.winner = finishedRacers[0].racer;
    }

    race.completed = true;
    await race.save();

    res.redirect('/past-races');

  } catch (err) {
    console.error('Error completing race:', err);
    res.status(500).json({ message: 'Error completing race' });
  }
});

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

router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find().populate('user', 'displayName');
    res.json(logs);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Error fetching audit logs' });
  }
});


module.exports = router;
