const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Race = require('../models/Race');
const Group = require('../models/Group');
const Tournament = require('../models/Tournament');
const Pickems = require('../models/Pickems');

const ensureRunner = require('../middleware/ensureRunner');
const ensureAdmin = require('../middleware/ensureAdmin');
const ensureAuthenticated = require('../middleware/ensureAuthenticated');

const POINTS_PER_CORRECT_PICK = 5;

router.get('/', async (req, res) => {
    try {
        const races = await Race.find({ completed: false })
        .populate('racer1', 'discordUsername displayName currentBracket')
        .populate('racer2', 'discordUsername displayName currentBracket')
        .populate('racer3', 'discordUsername displayName currentBracket')
        .populate('commentators', 'discordUsername displayName')
        .populate('restreamer', 'discordUsername displayName')
        .sort({ raceDateTime: 1 });
  
        res.status(200).json(races);
    } catch (err) {
        console.error('Error fetching races:', err);
        res.status(500).send('Error fetching races');
    }
});

router.get('/ready-to-complete', async (req, res) => {
    try {
        const now = Math.floor(Date.now() / 1000);

        const races = await Race.find({ 
            completed: false, 
            raceDateTime: { $lt: now }
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
            .populate('restreamer', 'discordUsername displayName')
            .sort({ raceDateTime: 1 }); // Sort by raceDateTime ascending
        
        const rankedRaces = races.map(race => {
            race.results = race.results
                .filter(result => result.status === 'Finished')
                .sort((a, b) => {
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

            return race.toObject();
        });

        res.status(200).json(rankedRaces);
    } catch (err) {
        console.error('Error fetching completed races:', err);
        res.status(500).send('Error fetching completed races');
    }
});

router.post('/submit', ensureRunner, async (req, res) => {
    try {
        const { raceDateTime, racer2, racer3 } = req.body;

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
        const tournament = await Tournament.findOne({ name: 'red2025' });

        if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
        }

        raceData.round = tournament.currentRound;

        // If the round is not 'Seeding', pull the bracket from racer1
        let racer1 = await User.findById(req.user._id).select('currentBracket');

        if (!racer1 || !racer1.currentBracket) {
            return res.status(400).json({ error: 'Unable to get bracket' });
        }
        raceData.bracket = racer1.currentBracket;

        // Create a new race entry in the database
        const newRace = await Race.create(raceData);

         // Add the race start time to the group
        racer1 = await User.findById(req.user._id).select('currentGroup');

        if (!racer1 || !racer1.currentGroup) {
            return res.status(400).json({ error: 'Racer1 does not belong to any group' });
        }

        const groupId = racer1.currentGroup;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(400).json({ error: 'Associated group not found for the racers' });
        }

        group.raceStartTime = raceDateTime;
        group.currentRace = newRace._id;
        await group.save();

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

        const finishedResults = results.filter(result => result.status === 'Finished');

        if (finishedResults.length > 0) {
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

            const winnerResult = finishedResults[0];
            race.winner = winnerResult.racer;

        } else {
            race.winner = null;
        }

        const tournament = await Tournament.findOne({ name: 'red2025' });

        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        race.round = tournament.currentRound;

        if (race.round !== 'Semifinals' && race.round !== 'Final') {
            const winner = await User.findById(race.winner);
            
            if (winner) {
                winner.points = (winner.points || 0) + 4;
                await winner.save();
            } else {
                return res.status(404).json({ error: 'Winner not found' });
            }
        }

        // Pickems points assignment
        if (race.winner) {
            const round = race.round;

            const validRoundsMap = {
                'Round 1': 'round1Picks',
                'Round 2': 'round2Picks',
                'Round 3': 'round3Picks',
                'Quarterfinals': 'quarterFinalsPicks',
                'Semifinals': 'semiFinalsPicks',
            };

            const pickField = validRoundsMap[round];

            if (pickField) {
                // Find all Pickems that have the correct pick for this round and haven't already been scored for this race
                const matchingPickems = await Pickems.find({
                    [pickField]: race.winner,
                }).populate('userId');

                if (matchingPickems.length > 0) {
                    console.log(`✅ Race ${race._id} (${round}): Winner is ${race.winner}. ${matchingPickems.length} user(s) picked correctly.`);

                    // Update points for each matching Pickems
                    const updatePromises = matchingPickems.map(async (pickem) => {
                        pickem.points += POINTS_PER_CORRECT_PICK;
                        await pickem.save();

                        console.log(`   - User ID: ${pickem.userId._id}, Username: ${pickem.userId.displayName}, New Points: ${pickem.points}`);
                    });

                    await Promise.all(updatePromises);

                    console.log(`🔄 Processed race ${race._id}. Awarded ${matchingPickems.length} user(s) with ${POINTS_PER_CORRECT_PICK} point(s) each.`);
                } else {
                    console.log(`No users correctly picked the winner for race ${race._id} (${round}).`);
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

        const race = await Race.findById(raceId);
  
        if (!race) {
            return res.status(404).json({ message: 'Race not found' });
        }

        const isAlreadyCommentator = race.commentators.some(commentatorId => commentatorId.equals(userId));
  
        if (isAlreadyCommentator) {
            return res.status(400).json({ message: 'You are already a commentator for this race' });
        }
  
        const swissRounds = ['Round 1', 'Round 2', 'Round 3', 'Quarterfinals'];
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
  
        await race.save();
  
        res.status(200).json({ message: 'You have been added as a commentator' });
    } catch (err) {
        console.error('Error adding commentator:', err);
        res.status(500).json({ message: 'Error adding commentator' });
    }
});

router.post('/:id/remove-commentator', ensureAuthenticated, async (req, res) => {
    try {
        const raceId = req.params.id;
        const userId = req.user._id;

        const race = await Race.findById(raceId);

        if (!race) {
            return res.status(404).json({ message: 'Race not found' });
        }

        const isCommentator = race.commentators.some(commentatorId => commentatorId.equals(userId));

        if (!isCommentator) {
            return res.status(400).json({ message: 'You are not a commentator for this race' });
        }

        race.commentators = race.commentators.filter(commentatorId => !commentatorId.equals(userId));

        await race.save();

        res.status(200).json({ message: 'You have been removed as a commentator' });
    } catch (err) {
        console.error('Error removing commentator:', err);
        res.status(500).json({ message: 'Error removing commentator' });
    }
});

router.post('/:id/cancel', ensureAdmin, async (req, res) => {
    try {
        const raceId = req.params.id;

        const race = await Race.findById(raceId);

        if (!race) {
            return res.status(404).json({ error: 'Race not found' });
        }

        race.cancelled = true;

        await race.save();

        return res.status(200).json({ message: 'Race cancelled successfully' });
    } catch (err) {
        console.error('Error cancelling race:', err);
        return res.status(500).json({ error: 'Error cancelling race' });
    }
});

router.post('/:id/uncancel', ensureAdmin, async (req, res) => {
    try {
        const raceId = req.params.id;

        const race = await Race.findById(raceId);

        if (!race) {
            return res.status(404).json({ error: 'Race not found' });
        }

        race.cancelled = false;

        await race.save();

        return res.status(200).json({ message: 'Race uncancelled successfully' });
    } catch (err) {
        console.error('Error uncancelling race:', err);
        return res.status(500).json({ error: 'Error uncancelling race' });
    }
});

router.get('/user', async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all races where the user is a racer (racer1, racer2, or racer3)
    const racesParticipatedIn = await Race.find({
      $or: [
        { racer1: userId },
        { racer2: userId },
        { racer3: userId }
      ]
    })
      .populate('racer1', 'discordUsername displayName')
      .populate('racer2', 'discordUsername displayName')
      .populate('racer3', 'discordUsername displayName')
      .populate('commentators', 'discordUsername displayName')
      .sort({ raceDateTime: 1 });

    // Find all races where the user is a commentator
    const racesCommentated = await Race.find({
      commentators: userId
    })
      .populate('racer1', 'discordUsername displayName')
      .populate('racer2', 'discordUsername displayName')
      .populate('racer3', 'discordUsername displayName')
      .populate('commentators', 'discordUsername displayName')
      .sort({ raceDateTime: 1 });

    res.status(200).json({
      racesParticipatedIn,
      racesCommentated
    });
  } catch (err) {
    console.error('Error fetching user races:', err);
    res.status(500).json({ error: 'Error fetching user races' });
  }
});

router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
  
    try {
      const racesParticipatedIn = await Race.find({
        $or: [
          { racer1: userId },
          { racer2: userId },
          { racer3: userId }
        ]
      })
        .populate('racer1', 'discordUsername displayName')
        .populate('racer2', 'discordUsername displayName')
        .populate('racer3', 'discordUsername displayName')
        .populate('commentators', 'discordUsername displayName')
        .sort({ raceDateTime: 1 });
  
      const racesCommentated = await Race.find({
        commentators: userId
      })
        .populate('racer1', 'discordUsername displayName')
        .populate('racer2', 'discordUsername displayName')
        .populate('racer3', 'discordUsername displayName')
        .populate('commentators', 'discordUsername displayName')
        .sort({ raceDateTime: 1 });
  
      res.status(200).json({
        racesParticipatedIn,
        racesCommentated
      });
    } catch (err) {
      console.error('Error fetching user races:', err);
      res.status(500).json({ error: 'Error fetching user races' });
    }
  });
  

router.get('/:id', async (req, res) => {
    try {
        const raceId = req.params.id;

        const race = await Race.findById(raceId)
            .populate('racer1', 'discordUsername displayName')
            .populate('racer2', 'discordUsername displayName')
            .populate('racer3', 'discordUsername displayName')
            .populate('results.racer', 'discordUsername displayName')
            .populate('commentators', 'discordUsername displayName')
            .populate('restreamer', 'discordUsername displayName');

        if (!race) {
            return res.status(404).json({ error: 'Race not found' });
        }

        res.status(200).json(race);
    } catch (err) {
        console.error('Error fetching race:', err);
        res.status(500).json({ error: 'Error fetching race' });
    }
});

// Restreaming
router.post('/:id/restream', ensureAdmin, async (req, res) => {
    try {
        const raceId = req.params.id;
        const { restreamChannel } = req.body;

        if (!restreamChannel) {
            return res.status(400).json({ error: 'Restream channel is required' });
        }

        const race = await Race.findById(raceId);
        if (!race) {
            return res.status(404).json({ error: 'Race not found' });
        }

        race.restreamPlanned = true;
        race.restreamChannel = restreamChannel;
        race.restreamer = req.user._id;

        await race.save();

        res.status(200).json({ message: 'Restream planned successfully', race });
    } catch (err) {
        console.error('Error planning restream:', err);
        res.status(500).json({ error: 'Error planning restream' });
    }
});

router.post('/:id/cancel-restream', ensureAdmin, async (req, res) => {
    try {
        const raceId = req.params.id;

        const race = await Race.findById(raceId);
        if (!race) {
            return res.status(404).json({ error: 'Race not found' });
        }

        race.restreamPlanned = false;
        race.restreamChannel = 'RedRaceTV';
        race.restreamer = null;

        await race.save();

        res.status(200).json({ message: 'Restream canceled successfully', race });
    } catch (err) {
        console.error('Error canceling restream:', err);
        res.status(500).json({ error: 'Error canceling restream' });
    }
});

module.exports = router;