const express = require('express');
const router = express.Router();

const Tournament = require('../models/Tournament');
const Race = require('../models/Race');
const User = require('../models/User');

const ensureAdmin = require('../middleware/ensureAdmin');

router.get('/standings', async (req, res) => {
  try {
    // Find all users with role 'runner'
    const runners = await User.find({ role: 'runner' })
      .select('discordUsername displayName points hasDNF tieBreakerValue currentBracket') // Selecting required fields
      .lean();

    // Sort by points in descending order, and ensure points is set to 0 if not provided
    const sortedRunners = runners
      .map(runner => ({
        discordUsername: runner.discordUsername,
        displayName: runner.displayName || runner.discordUsername, // Use displayName or discordUsername if displayName is not provided
        points: runner.points || 0, // Set default points to 0 if undefined
        tieBreakerValue: runner.hasDNF ? -1 : (runner.tieBreakerValue || 0), // Set tieBreakerValue to -1 if hasDNF is true, otherwise default to 0
        currentBracket: runner.currentBracket || 'Unknown' // Default bracket to 'Unknown' if not set
      }))
      .sort((a, b) => b.points - a.points || b.tieBreakerValue - a.tieBreakerValue); // Sort by points, then by tieBreakerValue if points are equal

    return res.status(200).json(sortedRunners);
  } catch (err) {
    console.error('Error fetching standings:', err);
    return res.status(500).json({ error: 'Error fetching standings' });
  }
});

// router.get('/round', async (req, res) => {
//   try {
//       const tournament = await Tournament.findOne({ name: 'red2024' });

//       if (!tournament) {
//           return res.status(404).json({ error: 'Tournament not found' });
//       }

//       const currentRound = tournament.currentRound;

//       // Find all races for the current round
//       const races = await Race.find({ round: currentRound });

//       const totalRaces = races.length;
//       const completedRaces = races.filter(race => race.completed).length;

//       const now = Math.floor(Date.now() / 1000);
//       const submittedButNotReady = races.filter(race => !race.completed && race.raceDateTime > now).length;

//       const canEndRound = totalRaces > 0 && completedRaces === totalRaces;

//       return res.status(200).json({
//           currentRound: tournament.currentRound,
//           totalRaces,
//           completedRaces,
//           submittedButNotReady,
//           canEndRound
//       });
//   } catch (err) {
//       console.error('Error fetching current round:', err);
//       return res.status(500).json({ error: 'Error fetching current round' });
//   }
// });

router.get('/round', async (req, res) => {
  try {
      const tournament = await Tournament.findOne({ name: 'red2024' });

      if (!tournament) {
          return res.status(404).json({ error: 'Tournament not found' });
      }

      const currentRound = tournament.currentRound;

      // Find all races for the current round
      const races = await Race.find({ round: currentRound });

      const now = Math.floor(Date.now() / 1000); // Current time in Unix timestamp

      // Races submitted but still upcoming (not completed, raceDateTime is in the future)
      const upcomingRaces = races.filter(race => !race.completed && race.raceDateTime > now).length;

      // Races submitted and awaiting results (not completed, raceDateTime is in the past)
      const awaitingResults = races.filter(race => !race.completed && race.raceDateTime <= now).length;

      // Completed races
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

    // Process race results
    await processRaceResults(races, currentRound);

    // Update the tournament to the next round
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

  // Map to keep track of users to update
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
      result: racerResultsMap[racer._id.toString()]
    }));

    // Define a status order for sorting
    const statusOrder = { 'Finished': 0, 'DNF': 1, 'DNS': 2 };

    // Sort the racerResultPairs
    racerResultPairs.sort((a, b) => {
      const aStatusOrder = statusOrder[a.result.status] ?? 3;
      const bStatusOrder = statusOrder[b.result.status] ?? 3;

      if (aStatusOrder !== bStatusOrder) {
        return aStatusOrder - bStatusOrder;
      } else if (a.result.status === 'Finished') {
        // Compare finish times
        const aTime = (a.result.finishTime.hours || 0) * 3600000 +
                      (a.result.finishTime.minutes || 0) * 60000 +
                      (a.result.finishTime.seconds || 0) * 1000 +
                      (a.result.finishTime.milliseconds || 0);

        const bTime = (b.result.finishTime.hours || 0) * 3600000 +
                      (b.result.finishTime.minutes || 0) * 60000 +
                      (b.result.finishTime.seconds || 0) * 1000 +
                      (b.result.finishTime.milliseconds || 0);

        return aTime - bTime;
      } else {
        // Both did not finish; order doesn't matter
        return 0;
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
      winner.tieBreakerValue += bracketPoints['High'];

      console.log(`${winner.displayName} is now in High bracket`);
      usersToUpdate[winner._id.toString()] = winner;

      if (losersPairs.length >= 1) {
        const secondPlacePair = losersPairs[0];
        const secondPlace = secondPlacePair.racer;
        secondPlace.currentBracket = 'Middle';
        secondPlace.tieBreakerValue += bracketPoints['Middle'];
        console.log(`${secondPlace.displayName} is now in Middle bracket`);
        usersToUpdate[secondPlace._id.toString()] = secondPlace;
      }

      if (losersPairs.length === 2) {
        const thirdPlacePair = losersPairs[1];
        const thirdPlace = thirdPlacePair.racer;
        thirdPlace.currentBracket = 'Low';
        thirdPlace.tieBreakerValue += bracketPoints['Low'];
        console.log(`${thirdPlace.displayName} is now in Low bracket`);
        usersToUpdate[thirdPlace._id.toString()] = thirdPlace;
      }

    } else { // Non-seeding rounds
      // Get current bracket of the winner
      const currentBracket = winner.currentBracket;
      console.log(`Non-seeding round for ${winner.displayName} in ${currentBracket} bracket`);

      if (currentBracket === 'High') {
        // Winner stays in High bracket
        winner.tieBreakerValue += bracketPoints['High'];
        console.log(`${winner.displayName} stays in High bracket with tiebreaker value: ${winner.tieBreakerValue}`);
        usersToUpdate[winner._id.toString()] = winner;

        for (const loserPair of losersPairs) {
          const loser = loserPair.racer;
          const loserResult = loserPair.result;

          // Check if the loser is the last in placement or did not finish
          if (loserResult.status === 'DNF' || loser === losersPairs[losersPairs.length - 1].racer) {
            // Demote to Middle bracket
            loser.currentBracket = 'Middle';
            loser.tieBreakerValue += bracketPoints['Middle'];
            console.log(`${loser.displayName} moves to Middle bracket with tiebreaker value: ${loser.tieBreakerValue}`);
          } else {
            // Stays in High bracket
            loser.tieBreakerValue += bracketPoints['High'];
            console.log(`${loser.displayName} stays in High bracket with tiebreaker value: ${loser.tieBreakerValue}`);
          }
          usersToUpdate[loser._id.toString()] = loser;
        }

      } else if (currentBracket === 'Middle') {
        // Winner promoted to High bracket
        winner.currentBracket = 'High';
        winner.tieBreakerValue += bracketPoints['High'];
        console.log(`${winner.displayName} is promoted to High bracket with tiebreaker value: ${winner.tieBreakerValue}`);
        usersToUpdate[winner._id.toString()] = winner;

        for (const loserPair of losersPairs) {
          const loser = loserPair.racer;
          const loserResult = loserPair.result;

          if (loserResult.status === 'DNF' || loser === losersPairs[losersPairs.length - 1].racer) {
            // Demote to Low bracket
            loser.currentBracket = 'Low';
            loser.tieBreakerValue += bracketPoints['Low'];
            console.log(`${loser.displayName} moves to Low bracket with tiebreaker value: ${loser.tieBreakerValue}`);
          } else {
            // Stays in Middle bracket
            loser.tieBreakerValue += bracketPoints['Middle'];
            console.log(`${loser.displayName} stays in Middle bracket with tiebreaker value: ${loser.tieBreakerValue}`);
          }
          usersToUpdate[loser._id.toString()] = loser;
        }

      } else if (currentBracket === 'Low') {
        // Winner promoted to Middle bracket
        winner.currentBracket = 'Middle';
        winner.tieBreakerValue += bracketPoints['Middle'];
        console.log(`${winner.displayName} is promoted to Middle bracket with tiebreaker value: ${winner.tieBreakerValue}`);
        usersToUpdate[winner._id.toString()] = winner;

        for (const loserPair of losersPairs) {
          const loser = loserPair.racer;
          // Losers stay in Low bracket
          loser.tieBreakerValue += bracketPoints['Low'];
          console.log(`${loser.displayName} stays in Low bracket with tiebreaker value: ${loser.tieBreakerValue}`);
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


module.exports = router;