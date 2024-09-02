const express = require('express');
const router = express.Router();
const Race = require('../models/Race');
const User = require('../models/User');
const ensureRunner = require('../middleware/ensureRunner');

router.get('/', async (req, res) => {
    try {
      // Fetch all upcoming races from the database, populating the racer details
      const races = await Race.find({})
        .populate('racer1', 'discordUsername displayName')
        .populate('racer2', 'discordUsername displayName')
        .populate('racer3', 'discordUsername displayName')
        .sort({ datetime: 1 });  
  
      res.render('races', { 
        title: 'Upcoming Races', 
        races: races 
      });
    } catch (err) {
      console.error('Error fetching races:', err);
      res.status(500).send('Error fetching races');
    }
  });

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

router.post('/submit', ensureRunner, async (req, res) => {
    try {
      const { date, time, racer2, racer3 } = req.body;
  
      // Combine date and time into a single Date object
      const raceDateTime = new Date(`${date}T${time}:00Z`); // The 'Z' ensures it's treated as UTC
  
      // Convert the Date object to a Unix timestamp (in seconds)
      const unixTimestamp = Math.floor(raceDateTime.getTime() / 1000);
  
      // Prepare the race object
      const raceData = {
        racer1: req.user._id, // The current user's ObjectID
        racer2: racer2, // Racer 2 ObjectID from the form
        racer3: null,
        datetime: unixTimestamp // The race time as a Unix timestamp
      };
  
      // Only include racer3 if one is provided
      if (racer3 && racer3 !== '') {
        raceData.racer3 = racer3;
      }
  
      // Create a new race entry in the database
      await Race.create(raceData);
  
      // Redirect to the races page after successful submission
      res.redirect('/races');
    } catch (err) {
      console.error('Error submitting race:', err);
      res.status(500).send('Error submitting race');
    }
  });

  router.get('/past', async (req, res) => {
    try {
      // Fetch all completed races from the database, populating the racer details
      const races = await Race.find({ completed: true })
        .populate('racer1', 'discordUsername displayName')
        .populate('racer2', 'discordUsername displayName')
        .populate('racer3', 'discordUsername displayName')
        .populate('winner', 'discordUsername displayName')
        .populate('results.racer', 'discordUsername displayName')
        .sort({ datetime: -1 }); // Sort by datetime descending
  
      res.render('past-races', { 
        title: 'Past Races', 
        races: races 
      });
    } catch (err) {
      console.error('Error fetching past races:', err);
      res.status(500).send('Error fetching past races');
    }
  });

module.exports = router;
