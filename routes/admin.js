const express = require('express');
const router = express.Router();
const ensureAdmin = require('../middleware/ensureAdmin');

const Race = require('../models/Race');

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
      const timeA = a.finishTime.hours * 3600 + a.finishTime.minutes * 60 + a.finishTime.seconds;
      const timeB = b.finishTime.hours * 3600 + b.finishTime.minutes * 60 + b.finishTime.seconds;
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

// Add user
router.get('/add-user', ensureAdmin, (req, res) => {
  res.render('add-user', { 
    title: 'Add User',
    successMessage: req.flash('success'),
    errorMessage: req.flash('error')
  });
});

router.post('/add-user', ensureAdmin, async (req, res) => {
  const { discordUsername, displayName, role, isAdmin } = req.body;

  try {
      const user = await User.findOneAndUpdate(
          { discordUsername },
          { 
            displayName,
            role, 
            isAdmin: isAdmin === 'on'
          },
          { new: true, upsert: true }
      );
      
      req.flash('success', `User ${user.discordUsername} is now a ${user.role}`);
      res.redirect('/admin/add-user');
  } catch (err) {
      console.error(err);
      req.flash('error', 'Internal Server Error');
      res.redirect('/admin/add-user');
  }
});

module.exports = router;
