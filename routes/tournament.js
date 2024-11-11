const express = require('express');
const router = express.Router();

const Tournament = require('../models/Tournament');
const Race = require('../models/Race');
const User = require('../models/User');

const ensureAdmin = require('../middleware/ensureAdmin');

router.get('/standings', async (req, res) => {
  try {
    const runners = await User.find({ role: 'runner' })
      .select('discordUsername displayName points hasDNF tieBreakerValue secondaryTieBreakerValue currentBracket') // Selecting required fields
      .lean();

    const sortedRunners = runners
      .map(runner => ({
        discordUsername: runner.discordUsername,
        displayName: runner.displayName || runner.discordUsername,
        points: runner.points || 0,
        tieBreakerValue: runner.hasDNF ? -1 : (runner.tieBreakerValue || 0),
        currentBracket: runner.currentBracket || 'Unknown'
      }))
      .sort((a, b) => b.points - a.points || b.tieBreakerValue - a.tieBreakerValue);

    return res.status(200).json(sortedRunners);
  } catch (err) {
    console.error('Error fetching standings:', err);
    return res.status(500).json({ error: 'Error fetching standings' });
  }
});

router.get('/round', async (req, res) => {
  try {
      const tournament = await Tournament.findOne({ name: 'red2024' });

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
    const tournament = await Tournament.findOne({ name: 'red2024' });

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

      const { topNine, tiedRacers } = await selectTopNine();

      tournament.currentRound = 'Semifinals';
      await tournament.save();

      return res.status(200).json({
        message: 'Round 3 ended successfully. Transitioned to Semifinals.',
        nextRound: 'Semifinals',
        topNine,
        tiedRacers,
      });

    } else if (currentRound === 'Semifinals') {

      return res.status(200).json({
        message: 'Semifinals ended successfully. Transitioned to Final.',
        nextRound: 'Finals'
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
  const rounds = ['Seeding', 'Round 1', 'Round 2', 'Round 3', 'Semifinals', 'Final'];
  const currentIndex = rounds.indexOf(currentRound);
  return rounds[currentIndex + 1] || 'Completed';
}

async function processRaceResults(races, currentRound) {
  const bracketPoints = {
    High: 3,
    Middle: 1,
    Low: 0,
  };

  const usersToUpdate = {};

  for (const race of races) {
    // Collect all racers
    const racers = [race.racer1, race.racer2, race.racer3].filter(racer => racer);

    // Create a mapping of racer IDs to their results
    const racerResultsMap = {};
    for (const result of race.results) {
      racerResultsMap[result.racer.toString()] = result;
    }

    // Create an array of racer-result pairs
    const racerResultPairs = racers.map(racer => ({
      racer,
      result: racerResultsMap[racer._id.toString()],
    }));

    // Define a status order for sorting
    const statusOrder = { 'Finished': 0, 'DNF': 1, 'DNS': 2, 'DQ': 3 };

    // Sort the racerResultPairs
    racerResultPairs.sort((a, b) => {
      const aStatusOrder = statusOrder[a.result.status] ?? 4; // Default to 4 if status not recognized
      const bStatusOrder = statusOrder[b.result.status] ?? 4;

      if (aStatusOrder !== bStatusOrder) {
        return aStatusOrder - bStatusOrder;
      } else {
        if (a.result.status === 'Finished') {
          // Compare finish times
          const aTime = (a.result.finishTime.hours || 0) * 3600000 +
                        (a.result.finishTime.minutes || 0) * 60000 +
                        (a.result.finishTime.seconds || 0) * 1000 +
                        (a.result.finishTime.milliseconds || 0);

          const bTime = (b.result.finishTime.hours || 0) * 3600000 +
                        (b.result.finishTime.minutes || 0) * 60000 +
                        (b.result.finishTime.seconds || 0) * 1000 +
                        (b.result.finishTime.milliseconds || 0);

          return aTime - bTime; // Faster time ranks higher
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

    // Assign placements
    const winnerPair = racerResultPairs[0];
    const winner = winnerPair.racer;

    const losersPairs = racerResultPairs.slice(1);

    console.log(`Processing race with ${racers.length} racers for round: ${currentRound}`);

    // Seeding round logic
    if (currentRound === 'Seeding') {
      // Assign brackets based on placements
      winner.currentBracket = 'High';
      winner.points = (winner.points || 0) + bracketPoints['High']; // Update points
      winner.tieBreakerValue += bracketPoints['High'];

      console.log(`${winner.displayName} is now in High bracket with ${bracketPoints['High']} points`);
      usersToUpdate[winner._id.toString()] = winner;

      if (losersPairs.length >= 1) {
        const secondPlacePair = losersPairs[0];
        const secondPlace = secondPlacePair.racer;
        secondPlace.currentBracket = 'Middle';
        secondPlace.points = (secondPlace.points || 0) + bracketPoints['Middle']; // Update points
        secondPlace.tieBreakerValue += bracketPoints['Middle'];
        console.log(`${secondPlace.displayName} is now in Middle bracket with ${bracketPoints['Middle']} points`);
        usersToUpdate[secondPlace._id.toString()] = secondPlace;
      }

      if (losersPairs.length === 2) {
        const thirdPlacePair = losersPairs[1];
        const thirdPlace = thirdPlacePair.racer;
        thirdPlace.currentBracket = 'Low';
        thirdPlace.points = (thirdPlace.points || 0) + bracketPoints['Low']; // Update points
        thirdPlace.tieBreakerValue += bracketPoints['Low'];
        console.log(`${thirdPlace.displayName} is now in Low bracket with ${bracketPoints['Low']} points`);
        usersToUpdate[thirdPlace._id.toString()] = thirdPlace;
      }

    } else { // Non-seeding rounds
      // Get current bracket of the winner
      const currentBracket = winner.currentBracket;
      console.log(`Non-seeding round for ${winner.displayName} in ${currentBracket} bracket`);

      if (currentBracket === 'High') {
        // Winner stays in High bracket
        winner.points = (winner.points || 0) + bracketPoints['High']; // Update points
        winner.tieBreakerValue += bracketPoints['High'];
        console.log(`${winner.displayName} stays in High bracket with ${bracketPoints['High']} points and tiebreaker value: ${winner.tieBreakerValue}`);
        usersToUpdate[winner._id.toString()] = winner;

        for (const loserPair of losersPairs) {
          const loser = loserPair.racer;
          const loserResult = loserPair.result;

          // Check if the loser is the last in placement or did not finish
          if (loserResult.status === 'DNF' || loser === losersPairs[losersPairs.length - 1].racer) {
            // Demote to Middle bracket
            loser.currentBracket = 'Middle';
            loser.points = (loser.points || 0) + bracketPoints['Middle']; // Update points
            loser.tieBreakerValue += bracketPoints['Middle'];
            console.log(`${loser.displayName} moves to Middle bracket with ${bracketPoints['Middle']} points and tiebreaker value: ${loser.tieBreakerValue}`);
          } else {
            // Stays in High bracket
            loser.points = (loser.points || 0) + bracketPoints['High']; // Update points
            loser.tieBreakerValue += bracketPoints['High'];
            console.log(`${loser.displayName} stays in High bracket with ${bracketPoints['High']} points and tiebreaker value: ${loser.tieBreakerValue}`);
          }
          usersToUpdate[loser._id.toString()] = loser;
        }

      } else if (currentBracket === 'Middle') {
        // Winner promoted to High bracket
        winner.currentBracket = 'High';
        winner.points = (winner.points || 0) + bracketPoints['High']; // Update points
        winner.tieBreakerValue += bracketPoints['High'];
        console.log(`${winner.displayName} is promoted to High bracket with ${bracketPoints['High']} points and tiebreaker value: ${winner.tieBreakerValue}`);
        usersToUpdate[winner._id.toString()] = winner;

        for (const loserPair of losersPairs) {
          const loser = loserPair.racer;
          const loserResult = loserPair.result;

          if (loserResult.status === 'DNF' || loser === losersPairs[losersPairs.length - 1].racer) {
            // Demote to Low bracket
            loser.currentBracket = 'Low';
            loser.points = (loser.points || 0) + bracketPoints['Low']; // Update points
            loser.tieBreakerValue += bracketPoints['Low'];
            console.log(`${loser.displayName} moves to Low bracket with ${bracketPoints['Low']} points and tiebreaker value: ${loser.tieBreakerValue}`);
          } else {
            // Stays in Middle bracket
            loser.points = (loser.points || 0) + bracketPoints['Middle']; // Update points
            loser.tieBreakerValue += bracketPoints['Middle'];
            console.log(`${loser.displayName} stays in Middle bracket with ${bracketPoints['Middle']} points and tiebreaker value: ${loser.tieBreakerValue}`);
          }
          usersToUpdate[loser._id.toString()] = loser;
        }

      } else if (currentBracket === 'Low') {
        // Winner promoted to Middle bracket
        winner.currentBracket = 'Middle';
        winner.points = (winner.points || 0) + bracketPoints['Middle']; // Update points
        winner.tieBreakerValue += bracketPoints['Middle'];
        console.log(`${winner.displayName} is promoted to Middle bracket with ${bracketPoints['Middle']} points and tiebreaker value: ${winner.tieBreakerValue}`);
        usersToUpdate[winner._id.toString()] = winner;

        for (const loserPair of losersPairs) {
          const loser = loserPair.racer;
          // Losers stay in Low bracket
          loser.points = (loser.points || 0) + bracketPoints['Low']; // Update points
          loser.tieBreakerValue += bracketPoints['Low'];
          console.log(`${loser.displayName} stays in Low bracket with ${bracketPoints['Low']} points and tiebreaker value: ${loser.tieBreakerValue}`);
          usersToUpdate[loser._id.toString()] = loser;
        }
      }
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
async function selectTopNine() {
  // Fetch all users with the role 'runner'
  const racers = await User.find({ role: 'runner' }).sort({ points: -1, tieBreakerValue: -1 });

  if (racers.length === 0) {
    throw new Error('No racers found in the tournament.');
  }

  // Select the top 9 racers
  let topNine = racers.slice(0, 9);
  const ninthPlacePoints = topNine[8]?.points;

  // Identify racers tied at the 9th position
  const tiedRacers = racers.filter(racer => racer.points === ninthPlacePoints);

  // If there are more than 9 racers due to ties, include all tied racers
  if (tiedRacers.length > 1) {
    // Exclude racers already in topNine to avoid duplication
    const additionalTiedRacers = tiedRacers.filter(racer => !topNine.some(r => r._id.equals(racer._id)));

    // Include all tied racers
    topNine = racers.filter(racer => racer.points > ninthPlacePoints).concat(tiedRacers);
  }

  // Determine the list of tied racers at 9th position
  const finalTiedRacers = topNine.filter(racer => racer.points === ninthPlacePoints);

  return { topNine, tiedRacers: finalTiedRacers };
}


module.exports = router;