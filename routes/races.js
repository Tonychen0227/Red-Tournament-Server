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
const TOURNAMENT_NAME = 'red2025';

// Bracket points configuration for different rounds
const BRACKET_POINTS = {
    round1: {
        High: 10,
        Middle: 9,
        Low: 6,
    },
    round2Ascension: {
        High: 1000,
        Middle: 10,
        Low: 6,
    },
    round2Normal: {
        High: 10,
        Middle: 6,
        Low: 3,
    },
    round3Ascension: {
        High: 100,
        Middle: 10,
        Low: 6,
    },
    round3Normal: {
        High: 10,
        Middle: 6,
        Low: 1,
    },
};

// Helper function to convert finish time to milliseconds
function getMillisecondsFromFinishTime(finishTime) {
    return (finishTime.hours || 0) * 3600000 + (finishTime.minutes || 0) * 60000 + (finishTime.seconds || 0) * 1000 + (finishTime.milliseconds || 0);
}

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
        const tournament = await Tournament.findOne({ name: TOURNAMENT_NAME });

        if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
        }

        raceData.round = tournament.currentRound;

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

        const tournament = await Tournament.findOne({ name: TOURNAMENT_NAME });

        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        race.round = tournament.currentRound;

        if (race.round !== 'Quarterfinals' && race.round !== 'Semifinals' && race.round !== 'Final') {
            const racers = [race.racer1, race.racer2, race.racer3].filter(racer => racer);

            const racerResultsMap = {};
            for (const result of race.results) {
                racerResultsMap[result.racer.toString()] = result;
            }

            const racerResultPairs = racers.map(racer => ({
                racer,
                result: racerResultsMap[racer._id.toString()],
            }));

            const statusOrder = { 'Finished': 0, 'DNF': 1, 'DNS': 2, 'DQ': 3 };

            racerResultPairs.sort((a, b) => {
                const aStatusOrder = statusOrder[a.result.status] ?? 4; // Default to 4 if status not recognized
                const bStatusOrder = statusOrder[b.result.status] ?? 4;

                if (aStatusOrder !== bStatusOrder) {
                    return aStatusOrder - bStatusOrder;
                } else {
                    if (a.result.status === 'Finished') {
                        const aTime = getMillisecondsFromFinishTime(a.result.finishTime);
                        const bTime = getMillisecondsFromFinishTime(b.result.finishTime);

                        return aTime - bTime;
                    } else if (a.result.status === 'DNF' && b.result.status === 'DNF') {

                        // Compare dnfOrder (lower dnfOrder means earlier DNF, thus worse placement)
                        const aDnfOrder = a.result.dnfOrder || Number.MAX_SAFE_INTEGER;
                        const bDnfOrder = b.result.dnfOrder || Number.MAX_SAFE_INTEGER;

                        return aDnfOrder - bDnfOrder; // Higher dnfOrder ranks higher
                    } else {
                        // For other statuses or equal statuses without specific ordering
                        return 0;
                    }
                }
            });

            for (const pair of racerResultPairs) {
                const pairRacer = pair.racer;
                const pairResult = pair.result;
                
                if (pairResult.status === "Finished") {
                    const pairActualRacer = await User.findById(pairRacer);
                    const pairResultMillis = getMillisecondsFromFinishTime(pairResult.finishTime);
                    if (pairResultMillis < pairActualRacer.bestTournamentTimeMilliseconds || pairActualRacer.bestTournamentTimeMilliseconds === 0) {
                        pairActualRacer.bestTournamentTimeMilliseconds = pairResultMillis;
                        await pairActualRacer.save();
                    }
                }
            }

            const winnerPair = racerResultPairs[0];
            const winner = await User.findById(winnerPair.racer);

            const lastPair = racerResultPairs[racerResultPairs.length - 1];
            const last = await User.findById(lastPair.racer);

            let middlePair = undefined;
            let middle = undefined;

            if (racerResultPairs.length > 2) {
                middlePair = racerResultPairs[1];
                middle = await User.findById(middlePair.racer);
            }

            const currentBracket = winner.currentBracket;

            console.log(`Processing race with ${racers.length} racers for round: ${race.round} and bracket: ${currentBracket}`);

            if (currentBracket === 'Normal') {
                let gain;
                
                if (race.round === "Round 1") {
                    gain = BRACKET_POINTS.round1;
                } else if (race.round === "Round 2") {
                    gain = BRACKET_POINTS.round2Normal;
                } else if (race.round === "Round 3") {
                    gain = BRACKET_POINTS.round3Normal;
                } else {
                    throw new Error(`Something went wrong processing race, invalid round combination`);
                }

                winner.points = (winner.points || 0) + gain['High'];

                last.points = (last.points || 0) + gain['Low'];

                if (middle) {
                    middle.points = (middle.points || 0) + gain['Middle'];
                }
            } else if (currentBracket === 'Ascension') {
                let gain;
                
                if (race.round === "Round 2") {
                    gain = BRACKET_POINTS.round2Ascension;
                } else if (race.round === "Round 3") {
                    gain = BRACKET_POINTS.round3Ascension;
                } else {
                    throw new Error(`Something went wrong processing race, invalid round combination`);
                }
                winner.points = (winner.points || 0) + gain['High'];
                last.points = (last.points || 0) + gain['Low'];
                if (middle) {
                    middle.points = (middle.points || 0) + gain['Middle'];
                }
            }

            await winner.save();
            await last.save();

            if (middle) {
                await middle.save();
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
  
        const swissRounds = ['Round 1', 'Round 2', 'Round 3'];
        const bracketRounds = ['Quarterfinals', 'Semifinals', 'Final'];

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