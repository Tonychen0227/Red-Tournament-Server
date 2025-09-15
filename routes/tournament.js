const express = require('express');
const router = express.Router();

const Tournament = require('../models/Tournament');
const Race = require('../models/Race');
const User = require('../models/User');

const ensureAdmin = require('../middleware/ensureAdmin');

router.get('/standings', async (req, res) => {
  try {
    const runners = await User.find({ role: 'runner' })
      .select('discordUsername displayName points bestTournamentTimeMilliseconds currentBracket country')
      .lean();

    const sortedRunners = runners
      .map(runner => ({
        discordUsername: runner.discordUsername,
        country: runner.country,
        displayName: runner.displayName || runner.discordUsername,
        points: runner.points || 0,
        bestTournamentTimeMilliseconds: runner.bestTournamentTimeMilliseconds || 9000000,
        currentBracket: runner.currentBracket || 'Normal'
      }))
      .sort((a, b) => b.points - a.points || a.bestTournamentTimeMilliseconds - b.bestTournamentTimeMilliseconds);

    return res.status(200).json(sortedRunners);
  } catch (err) {
    console.error('Error fetching standings:', err);
    return res.status(500).json({ error: 'Error fetching standings' });
  }
});

router.get('/round', async (req, res) => {
  try {
      const tournament = await Tournament.findOne({ name: 'red2025' });

      if (!tournament) {
          return res.status(404).json({ error: 'Tournament not found' });
      }

      const currentRound = tournament.currentRound;

      const races = await Race.find({ round: currentRound });

      const now = Math.floor(Date.now() / 1000); // Current time in Unix timestamp

      const upcomingRaces = races.filter(race => !race.completed && race.raceDateTime > now).length;

      const awaitingResults = races.filter(race => !race.completed && race.raceDateTime <= now).length;

      const completedRaces = races.filter(race => race.completed).length;

      return res.status(200).json({
          currentRound: tournament.currentRound,
          upcomingRaces,
          awaitingResults,
          completedRaces
      });
  } catch (err) {
      console.error('Error fetching current round:', err);
      return res.status(500).json({ error: 'Error fetching current round' });
  }
});

router.post('/end-round', ensureAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ name: 'red2025' });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const currentRound = tournament.currentRound;

    // Find all races for the current round
    const races = await Race.find({ round: currentRound })
      .populate('racer1')
      .populate('racer2')
      .populate('racer3')
      .populate('winner');

    // Check if all races are completed
    const incompleteRaces = races.filter(race => !race.completed);
    if (incompleteRaces.length > 0) {
      return res.status(400).json({ error: 'Not all races are completed for the current round' });
    }

    if (currentRound === 'Round 3') {
      const { topTwentySeven, tiedRacers } = await selectTopTwentySeven();

      tournament.currentRound = 'Quarterfinals';
      await tournament.save();

      return res.status(200).json({
        message: 'Round 3 ended successfully. Transitioned to Quarterfinals.',
        nextRound: 'Quarterfinals',
        topTwentySeven,
        tiedRacers,
      });

    } else if (currentRound === 'Quarterfinals') {

      tournament.currentRound = 'Semifinals';
      await tournament.save();

      return res.status(200).json({
        message: 'Quarterfinals ended successfully. Transitioned to Semifinals.',
        nextRound: 'Semifinals'
      });
    } else if (currentRound === 'Semifinals') {

      tournament.currentRound = 'Final';
      await tournament.save();

      return res.status(200).json({
        message: 'Semifinals ended successfully. Transitioned to Final.',
        nextRound: 'Final'
      });
    } else {
      await processRaceResults(races, currentRound);
    }

    const nextRound = getNextRound(currentRound);
    tournament.currentRound = nextRound;

    await tournament.save();

    return res.status(200).json({ message: 'Round ended successfully', nextRound });
  } catch (err) {
    console.error('Error ending round:', err);
    return res.status(500).json({ error: 'Error ending round' });
  }
});

function getNextRound(currentRound) {
  const rounds = ['Round 1', 'Round 2', 'Round 3', 'Quarterfinals', 'Semifinals', 'Final'];
  const currentIndex = rounds.indexOf(currentRound);
  return rounds[currentIndex + 1] || 'Completed';
}

function getMillisecondsFromFinishTime(finishTime) {
  return (finishTime.hours || 0) * 3600000 + (finishTime.minutes || 0) * 60000 + (finishTime.seconds || 0) * 1000 + (finishTime.milliseconds || 0);
}

async function processRaceResults(races, currentRound) {
  const usersToUpdate = {};

  for (const race of races) {
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

    const winnerPair = racerResultPairs[0];
    const winner = winnerPair.racer;

    const lastPair = racerResultPairs[racerResultPairs.length - 1];
    const last = lastPair.racer;

    let middlePair = undefined;
    let middle = undefined;

    if (racerResultPairs.length > 2) {
      middlePair = racerResultPairs[1];
      middle = middlePair.racer;
    }

    console.log(`Processing race with ${racers.length} racers for round: ${currentRound}`);

    const currentBracket = winner.currentBracket;

    if (currentBracket === 'Exhibition') {
      // do nothing as exhibition has no effects on bracket
      winner.currentBracket = 'Playoffs';
      last.currentBracket = 'Playoffs'

      if (middle) {
        middle.currentBracket = 'Playoffs'
      }
    } else if (currentBracket === 'Normal') {
      winner.currentBracket = 'Ascension';
    } else if (currentBracket === 'Ascension') {
      winner.currentBracket = currentRound === "Round 2" ? 'Exhibition' : 'Playoffs';
      last.currentBracket = 'Normal';
    }

    usersToUpdate[winner._id.toString()] = winner;
    usersToUpdate[last._id.toString()] = last;

    if (middle) {
      usersToUpdate[middle._id.toString()] = middle;
    }
  }

  // Now save all users, ensuring we only save each one once
  const userUpdates = [];
  for (const userId in usersToUpdate) {
    const user = usersToUpdate[userId];
    userUpdates.push(user.save());
  }

  // Wait for all updates to complete
  await Promise.all(userUpdates);
}

// Helper Function to Select Top Nine Racers
async function selectTopTwentySeven() {
  // Fetch all users with the role 'runner'
  const racers = await User.find({ role: 'runner' }).sort({ points: -1, bestTournamentTimeMilliseconds: 1 });

  if (racers.length === 0) {
    throw new Error('No racers found in the tournament.');
  }

  // Select the top 27 racers
  let topTwentySeven = racers.slice(0, 27);
  const bubblePoints = topNine[26]?.points;

  // Identify racers tied at the 9th position
  const tiedRacers = racers.filter(racer => racer.points === bubblePoints);

  // If there are more than 9 racers due to ties, include all tied racers
  if (tiedRacers.length > 1) {
    // Exclude racers already in topTwentySeven to avoid duplication
    const additionalTiedRacers = tiedRacers.filter(racer => !topTwentySeven.some(r => r._id.equals(racer._id)));

    // Include all tied racers
    topTwentySeven = racers.filter(racer => racer.points > bubblePoints).concat(tiedRacers);
  }

  // Determine the list of tied racers at 27th position
  const finalTiedRacers = topTwentySeven.filter(racer => racer.points === bubblePoints);

  return { topTwentySeven, tiedRacers: finalTiedRacers };
}

module.exports = router;