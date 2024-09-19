const express = require('express');
const router = express.Router();

const ensureAdmin = require('../middleware/ensureAdmin');

const Race = require('../models/Race');
const User = require('../models/User');

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
