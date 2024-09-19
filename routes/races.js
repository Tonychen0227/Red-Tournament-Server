const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Race = require('../models/Race');
const Tournament = require('../models/Tournament');

const ensureRunner = require('../middleware/ensureRunner');
const ensureAdmin = require('../middleware/ensureAdmin');

router.get('/', async (req, res) => {
    try {
        // Fetch all upcoming races (not completed) from the database, populating the racer details
        const races = await Race.find({ completed: false }) // Filter to only get races that are not completed
        .populate('racer1', 'discordUsername displayName currentBracket')
        .populate('racer2', 'discordUsername displayName currentBracket')
        .populate('racer3', 'discordUsername displayName currentBracket')
        .populate('commentators', 'discordUsername displayName')
        .sort({ raceDateTime: 1 }); // Sorting by raceDateTime ascending (upcoming races first)
  
        res.status(200).json(races);
    } catch (err) {
        console.error('Error fetching races:', err);
        res.status(500).send('Error fetching races');
    }
});

router.get('/ready-to-complete', async (req, res) => {
    try {
        // Fetch all races that are ready to be completed (date is past but not marked as completed)
        const now = Math.floor(Date.now() / 1000); // Get current time as a Unix timestamp
        const races = await Race.find({ 
            completed: false, 
            raceDateTime: { $lt: now } // Races that have passed but are not completed
        })
            .populate('racer1', 'discordUsername displayName')
            .populate('racer2', 'discordUsername displayName')
            .populate('racer3', 'discordUsername displayName')
            .populate('commentators', 'discordUsername displayName')
            .sort({ raceDateTime: 1 });
    
            res.status(200).json(races);
    } catch (err) {
        console.error('Error fetching races ready to complete:', err);
        res.status(500).send('Error fetching races ready to complete');
    }
});

router.get('/completed', async (req, res) => {
    try {
        const races = await Race.find({ completed: true })
            .populate('racer1', 'discordUsername displayName currentBracket')
            .populate('racer2', 'discordUsername displayName currentBracket')
            .populate('racer3', 'discordUsername displayName currentBracket')
            .populate('commentators', 'discordUsername displayName')
            .populate('results.racer', 'discordUsername displayName')
            .sort({ raceDateTime: 1 }); // Sort by raceDateTime ascending
        
        const rankedRaces = races.map(race => {
            // Sort the race results directly in the results array
            race.results = race.results
                .filter(result => result.status === 'Finished')
                .sort((a, b) => {
                    // Sort by hours, then minutes, then seconds, then milliseconds
                    if (a.finishTime.hours !== b.finishTime.hours) {
                        return a.finishTime.hours - b.finishTime.hours;
                    } else if (a.finishTime.minutes !== b.finishTime.minutes) {
                        return a.finishTime.minutes - b.finishTime.minutes;
                    } else if (a.finishTime.seconds !== b.finishTime.seconds) {
                        return a.finishTime.seconds - b.finishTime.seconds;
                    } else {
                        return a.finishTime.milliseconds - b.finishTime.milliseconds;
                    }
                })
                // Append non-finished results (DNF, DNS, DQ) after the finished ones
                .concat(race.results.filter(result => result.status !== 'Finished'));

            return race.toObject(); // Convert the race object back to a plain JavaScript object
        });

        res.status(200).json(rankedRaces);
    } catch (err) {
        console.error('Error fetching completed races:', err);
        res.status(500).send('Error fetching completed races');
    }
});

router.get('/:id', async (req, res) => {
    try {
        const raceId = req.params.id;

        // Fetch the race by its ObjectID, populating the racer details
        const race = await Race.findById(raceId)
            .populate('racer1', 'discordUsername displayName')
            .populate('racer2', 'discordUsername displayName')
            .populate('racer3', 'discordUsername displayName')
            .populate('results.racer', 'discordUsername displayName')
            .populate('commentators', 'discordUsername displayName'); 

        if (!race) {
            return res.status(404).json({ error: 'Race not found' });
        }

        // Send the race data back to the frontend
        res.status(200).json(race);
    } catch (err) {
        console.error('Error fetching race:', err);
        res.status(500).json({ error: 'Error fetching race' });
    }
});

router.post('/submit', ensureRunner, async (req, res) => {
    try {
        const { raceDateTime, racer2, racer3 } = req.body;  // dateTime is expected to be a Unix timestamp

        const raceSubmitted = Math.floor(Date.now() / 1000);

        const raceData = {
            racer1: req.user._id,
            racer2: racer2,
            racer3: racer3 || null, // Racer 3 can be null, for 2-man races
            raceDateTime: raceDateTime, // Unix timestamp
            raceSubmitted: raceSubmitted, // Unix timestamp
            completed: false
        };

        // Fetch the tournament
        const tournament = await Tournament.findOne({ name: 'red2024' });

        if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
        }

        raceData.round = tournament.currentRound;

        // If the round is not 'Seeding', pull the bracket from racer1
        if (tournament.currentRound !== 'Seeding') {
            const racer1 = await User.findById(req.user._id).select('currentBracket');

            if (!racer1 || !racer1.currentBracket) {
                return res.status(400).json({ error: 'Unable to get bracket' });
            }
            raceData.bracket = racer1.currentBracket;
        } else {
            raceData.bracket = 'Seeding';
        }

        // Create a new race entry in the database
        const newRace = await Race.create(raceData);

        res.status(200).json({
            message: 'Race submitted successfully',
            id: newRace._id
        });
    } catch (err) {
        console.error('Error submitting race:', err);
        res.status(500).json({ error: 'Error submitting race' });
    }
});

router.post('/:id/complete', ensureAdmin, async (req, res) => {
    try {
        const raceId = req.params.id;
        const { results, raceTimeId } = req.body;
  
        const race = await Race.findById(raceId);
  
        if (!race) {
            return res.status(404).json({ error: 'Race not found' });
        }

        race.results = results;
        race.raceTimeId = raceTimeId;

        race.completed = true;

        // Compute the winner
        const finishedResults = results.filter(result => result.status === 'Finished');

        if (finishedResults.length > 0) {
        // Sort the finished results by finish time
        finishedResults.sort((a, b) => {
            if (a.finishTime.hours !== b.finishTime.hours) {
            return a.finishTime.hours - b.finishTime.hours;
            } else if (a.finishTime.minutes !== b.finishTime.minutes) {
            return a.finishTime.minutes - b.finishTime.minutes;
            } else if (a.finishTime.seconds !== b.finishTime.seconds) {
            return a.finishTime.seconds - b.finishTime.seconds;
            } else {
            return a.finishTime.milliseconds - b.finishTime.milliseconds;
            }
        });

        // The winner is the racer with the fastest finish time
        const winnerResult = finishedResults[0];
        race.winner = winnerResult.racer;

        } else {
        // If no racers finished, set winner to null
        race.winner = null;
        }

        // Fetch the current round from the Tournament collection
        const tournament = await Tournament.findOne({ name: 'red2024' });
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        race.round = tournament.currentRound;

        // If the round is not "Seeding", update hasDNF for relevant users
        if (race.round !== 'Seeding') {
            const dnfStatuses = ['DNF', 'DNS', 'DQ'];

            for (const result of results) {
                if (dnfStatuses.includes(result.status)) {
                    // Find the user by their racer ID and update hasDNF to true
                    await User.findByIdAndUpdate(result.racer, { hasDNF: true });
                }
            }
        }

        await race.save();
  
        return res.status(200).json({ message: 'Race results recorded successfully' });
    } catch (err) {
        console.error('Error recording race results:', err);
        return res.status(500).json({ error: 'Error recording race results' });
    }
});

router.post('/:id/commentator', async (req, res) => {
    try {
        const raceId = req.params.id;
        const userId = req.user._id;

        // Fetch the race by ID
        const race = await Race.findById(raceId);
  
        if (!race) {
            return res.status(404).json({ message: 'Race not found' });
        }

        // Check if the user is already a commentator
        const isAlreadyCommentator = race.commentators.some(commentatorId => commentatorId.equals(userId));
  
        if (isAlreadyCommentator) {
            return res.status(400).json({ message: 'You are already a commentator for this race' });
        }
  
        // Check the round type
        const swissRounds = ['Seeding', 'Round 1', 'Round 2', 'Round 3'];
        const bracketRounds = ['Semifinals', 'Final'];

        if (swissRounds.includes(race.round)) {
        // If the round is in the Swiss phase, limit to 2 commentators
        if (race.commentators.length >= 2) {
            return res.status(400).json({ message: 'Only two commentators are allowed for Swiss rounds' });
        }
        } else if (bracketRounds.includes(race.round)) {
        // For Semifinals or Final, there is no limit, so just proceed to add the user
        } else {
        return res.status(400).json({ message: 'Invalid race round' });
        }
        
        race.commentators.push(userId);
  
        // Save the updated race
        await race.save();
  
        res.status(200).json({ message: 'You have been added as a commentator' });
    } catch (err) {
        console.error('Error adding commentator:', err);
        res.status(500).json({ message: 'Error adding commentator' });
    }
});

router.post('/:id/remove-commentator', ensureRunner, async (req, res) => {
    try {
        const raceId = req.params.id;
        const userId = req.user._id;

        // Fetch the race by ID
        const race = await Race.findById(raceId);

        if (!race) {
            return res.status(404).json({ message: 'Race not found' });
        }

        // Check if the user is in the commentators list
        const isCommentator = race.commentators.some(commentatorId => commentatorId.equals(userId));

        if (!isCommentator) {
            return res.status(400).json({ message: 'You are not a commentator for this race' });
        }

        // Remove the user from the commentators array
        race.commentators = race.commentators.filter(commentatorId => !commentatorId.equals(userId));

        // Save the updated race
        await race.save();

        res.status(200).json({ message: 'You have been removed as a commentator' });
    } catch (err) {
        console.error('Error removing commentator:', err);
        res.status(500).json({ message: 'Error removing commentator' });
    }
});

  
module.exports = router;