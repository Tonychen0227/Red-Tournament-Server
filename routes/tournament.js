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
      .select('discordUsername displayName points tieBreakerValue currentBracket') // Selecting required fields
      .lean();

    // Sort by points in descending order, and ensure points is set to 0 if not provided
    const sortedRunners = runners
      .map(runner => ({
        discordUsername: runner.discordUsername,
        displayName: runner.displayName || runner.discordUsername, // Use displayName or discordUsername if displayName is not provided
        points: runner.points || 0, // Set default points to 0 if undefined
        tieBreakerValue: runner.tieBreakerValue || 0, // Default tieBreakerValue to 0
        currentBracket: runner.currentBracket || 'Unknown' // Default bracket to 'Unknown' if not set
      }))
      .sort((a, b) => b.points - a.points || b.tieBreakerValue - a.tieBreakerValue); // Sort by points, then by tieBreakerValue if points are equal

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

      // Find all races for the current round
      const races = await Race.find({ round: currentRound });

      const totalRaces = races.length;
      const completedRaces = races.filter(race => race.completed).length;

      const canEndRound = totalRaces > 0 && completedRaces === totalRaces;

      return res.status(200).json({
          currentRound: tournament.currentRound,
          totalRaces,
          completedRaces,
          canEndRound
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

// async function processRaceResults(races, currentRound) {
//   const bracketPoints = {
//     High: 3,     // 3 points for High bracket
//     Middle: 1,   // 1 point for Middle bracket
//     Low: 0,      // 0 points for Low bracket
//   };

//   const userUpdates = [];

//   for (const race of races) {
//     const winnerId = race.winner._id.toString();
    
//     // Collect all racers (racer1, racer2, racer3)
//     const racers = [race.racer1, race.racer2, race.racer3].filter(racer => racer); // filter out undefined racer3 if it's not set

//     // Identify the losers (all racers except the winner)
//     const losers = racers.filter(racer => racer._id.toString() !== winnerId);

//     console.log(`Processing race with ${racers.length} racers for round: ${currentRound}`);

//     // Seeding round logic
//     if (currentRound === 'Seeding') {
//       const winner = race.winner;
//       winner.currentBracket = 'High';  // 1st place goes to High bracket
//       winner.points += bracketPoints['High'];
//       console.log(`${winner.displayName} is now in High bracket with ${winner.points} points`);
//       userUpdates.push(winner.save());

//       if (racers.length === 3) {
//         // 3-man race: 2nd place goes to Middle, 3rd place goes to Low
//         const secondPlace = losers[0];
//         const thirdPlace = losers[1];

//         secondPlace.currentBracket = 'Middle';  // 2nd place goes to Middle bracket
//         secondPlace.points += bracketPoints['Middle'];
//         console.log(`${secondPlace.displayName} is now in Middle bracket with ${secondPlace.points} points`);
//         userUpdates.push(secondPlace.save());

//         thirdPlace.currentBracket = 'Low';  // 3rd place goes to Low bracket
//         thirdPlace.points += bracketPoints['Low'];
//         console.log(`${thirdPlace.displayName} is now in Low bracket with ${thirdPlace.points} points`);
//         userUpdates.push(thirdPlace.save());

//       } else if (racers.length === 2) {
//         // 2-man race: 2nd place moves to Low bracket
//         const loser = losers[0];
//         loser.currentBracket = 'Low';  // 2nd place moves to Low bracket
//         loser.points += bracketPoints['Low'];
//         console.log(`${loser.displayName} is now in Low bracket with ${loser.points} points`);
//         userUpdates.push(loser.save());
//       }

//     } else {
//       // Non-seeding rounds

//       // Get winner and bracket
//       const winner = race.winner;
//       const currentBracket = winner.currentBracket;

//       console.log(`Awarding 4 points to ${winner.displayName} for winning`);
//       winner.points += 4;
//       winner.tieBreakerValue += 4;

//       console.log(`Non-seeding round for ${winner.displayName} in ${currentBracket} bracket`);

//       // High bracket logic
//       if (currentBracket === 'High') {
//         winner.points += bracketPoints['High'];
//         console.log(`${winner.displayName} stays in High bracket with ${winner.points} points (including 4 points for winning)`);
//         userUpdates.push(winner.save());

//         if (racers.length === 3) {
//           const secondPlace = losers[0];
//           const thirdPlace = losers[1];

//           // 2nd place stays in High bracket
//           secondPlace.points += bracketPoints['High'];
//           console.log(`${secondPlace.displayName} stays in High bracket with ${secondPlace.points} points`);
//           userUpdates.push(secondPlace.save());

//           // Last place or DNF demotes to Middle bracket
//           if (thirdPlace.results.status === 'DNF' || thirdPlace === losers[losers.length - 1]) {
//             thirdPlace.currentBracket = 'Middle';
//             thirdPlace.points += bracketPoints['Middle'];
//             console.log(`${thirdPlace.displayName} moves to Middle bracket with ${thirdPlace.points} points`);
//             userUpdates.push(thirdPlace.save());
//           }
//         } else if (racers.length === 2) {
//           const loser = losers[0];
//           loser.currentBracket = 'Middle';  // Last place in High moves to Middle
//           loser.points += bracketPoints['Middle'];
//           console.log(`${loser.displayName} moves to Middle bracket with ${loser.points} points`);
//           userUpdates.push(loser.save());
//         }

//       } else if (currentBracket === 'Middle') {
//         // Middle bracket logic
//         winner.currentBracket = 'High';  // 1st place promoted to High
//         winner.points += bracketPoints['High'];
//         console.log(`${winner.displayName} is promoted to High bracket with ${winner.points} points (including 4 points for winning)`);
//         userUpdates.push(winner.save());

//         if (racers.length === 3) {
//           const secondPlace = losers[0];
//           const thirdPlace = losers[1];

//           secondPlace.points += bracketPoints['Middle'];  // 2nd place stays in Middle
//           console.log(`${secondPlace.displayName} stays in Middle bracket with ${secondPlace.points} points`);
//           userUpdates.push(secondPlace.save());

//           // Last place or DNF demotes to Low bracket
//           if (thirdPlace.results.status === 'DNF' || thirdPlace === losers[losers.length - 1]) {
//             thirdPlace.currentBracket = 'Low';
//             thirdPlace.points += bracketPoints['Low'];
//             console.log(`${thirdPlace.displayName} moves to Low bracket with ${thirdPlace.points} points`);
//             userUpdates.push(thirdPlace.save());
//           }
//         } else if (racers.length === 2) {
//           const loser = losers[0];
//           loser.currentBracket = 'Low';  // Last place in Middle moves to Low
//           loser.points += bracketPoints['Low'];
//           console.log(`${loser.displayName} moves to Low bracket with ${loser.points} points`);
//           userUpdates.push(loser.save());
//         }

//       } else if (currentBracket === 'Low') {
//         // Low bracket logic
//         winner.currentBracket = 'Middle';  // 1st place promoted to Middle
//         winner.points += bracketPoints['Middle'];
//         console.log(`${winner.displayName} is promoted to Middle bracket with ${winner.points} points (including 4 points for winning)`);
//         userUpdates.push(winner.save());

//         if (racers.length === 3) {
//           const secondPlace = losers[0];
//           const thirdPlace = losers[1];

//           // 2nd and 3rd place stay in Low bracket
//           secondPlace.points += bracketPoints['Low'];
//           console.log(`${secondPlace.displayName} stays in Low bracket with ${secondPlace.points} points`);
//           userUpdates.push(secondPlace.save());

//           thirdPlace.points += bracketPoints['Low'];
//           console.log(`${thirdPlace.displayName} stays in Low bracket with ${thirdPlace.points} points`);
//           userUpdates.push(thirdPlace.save());
//         } else if (racers.length === 2) {
//           const loser = losers[0];
//           loser.points += bracketPoints['Low'];  // Loser stays in Low bracket
//           console.log(`${loser.displayName} stays in Low bracket with ${loser.points} points`);
//           userUpdates.push(loser.save());
//         }
//       }
//     }
//   }

//   // Wait for all updates to complete
//   await Promise.all(userUpdates);
// }

//Maybe working, but test from scratch:

// async function processRaceResults(races, currentRound) {
//   const bracketPoints = {
//     High: 3,
//     Middle: 1,
//     Low: 0,
//   };

//   const userUpdates = [];

//   for (const race of races) {
//     // Collect all racers
//     const racers = [race.racer1, race.racer2, race.racer3].filter(racer => racer);

//     // Create a mapping of racer IDs to their results
//     const racerResultsMap = {};
//     for (const result of race.results) {
//       racerResultsMap[result.racer.toString()] = result;
//     }

//     // Create an array of racer-result pairs
//     const racerResultPairs = racers.map(racer => ({
//       racer,
//       result: racerResultsMap[racer._id.toString()]
//     }));

//     // Define a status order for sorting
//     const statusOrder = { 'Finished': 0, 'DNF': 1, 'DNS': 2 };

//     // Sort the racerResultPairs
//     racerResultPairs.sort((a, b) => {
//       const aStatusOrder = statusOrder[a.result.status] ?? 3;
//       const bStatusOrder = statusOrder[b.result.status] ?? 3;

//       if (aStatusOrder !== bStatusOrder) {
//         return aStatusOrder - bStatusOrder;
//       } else if (a.result.status === 'Finished') {
//         // Compare finish times
//         const aTime = (a.result.finishTime.hours || 0) * 3600000 +
//                       (a.result.finishTime.minutes || 0) * 60000 +
//                       (a.result.finishTime.seconds || 0) * 1000 +
//                       (a.result.finishTime.milliseconds || 0);

//         const bTime = (b.result.finishTime.hours || 0) * 3600000 +
//                       (b.result.finishTime.minutes || 0) * 60000 +
//                       (b.result.finishTime.seconds || 0) * 1000 +
//                       (b.result.finishTime.milliseconds || 0);

//         return aTime - bTime;
//       } else {
//         // Both did not finish; order doesn't matter
//         return 0;
//       }
//     });

//     // Assign placements
//     const winnerPair = racerResultPairs[0];
//     const winner = winnerPair.racer;
//     const winnerResult = winnerPair.result;

//     const losersPairs = racerResultPairs.slice(1);

//     console.log(`Processing race with ${racers.length} racers for round: ${currentRound}`);

//     // Seeding round logic
//     if (currentRound === 'Seeding') {
//       // Assign brackets based on placements
//       // Winner to High, Second to Middle, Third to Low
//       winner.currentBracket = 'High';
//       winner.points += bracketPoints['High'];
//       // No tieBreakerValue increment in seeding round unless specified
//       console.log(`${winner.displayName} is now in High bracket with ${winner.points} points`);
//       userUpdates.push(winner.save());

//       if (losersPairs.length >= 1) {
//         const secondPlacePair = losersPairs[0];
//         const secondPlace = secondPlacePair.racer;
//         secondPlace.currentBracket = 'Middle';
//         secondPlace.points += bracketPoints['Middle'];
//         console.log(`${secondPlace.displayName} is now in Middle bracket with ${secondPlace.points} points`);
//         userUpdates.push(secondPlace.save());
//       }

//       if (losersPairs.length === 2) {
//         const thirdPlacePair = losersPairs[1];
//         const thirdPlace = thirdPlacePair.racer;
//         thirdPlace.currentBracket = 'Low';
//         thirdPlace.points += bracketPoints['Low'];
//         console.log(`${thirdPlace.displayName} is now in Low bracket with ${thirdPlace.points} points`);
//         userUpdates.push(thirdPlace.save());
//       }

//     } else {
//       // Non-seeding rounds

//       // Get current bracket of the winner
//       const currentBracket = winner.currentBracket;

//       console.log(`Awarding 4 points to ${winner.displayName} for winning`);
//       winner.points += 4;
//       winner.tieBreakerValue += 4; // Increment tieBreakerValue for winning

//       console.log(`Non-seeding round for ${winner.displayName} in ${currentBracket} bracket`);

//       if (currentBracket === 'High') {
//         // Winner stays in High bracket
//         winner.points += bracketPoints['High'];
//         console.log(`${winner.displayName} stays in High bracket with ${winner.points} points`);
//         userUpdates.push(winner.save());

//         for (const loserPair of losersPairs) {
//           const loser = loserPair.racer;
//           const loserResult = loserPair.result;

//           // Check if the loser is the last in placement or did not finish
//           if (loserResult.status === 'DNF' || loser === losersPairs[losersPairs.length - 1].racer) {
//             // Demote to Middle bracket
//             loser.currentBracket = 'Middle';
//             loser.points += bracketPoints['Middle'];
//             console.log(`${loser.displayName} moves to Middle bracket with ${loser.points} points`);
//           } else {
//             // Stays in High bracket
//             loser.points += bracketPoints['High'];
//             console.log(`${loser.displayName} stays in High bracket with ${loser.points} points`);
//           }
//           userUpdates.push(loser.save());
//         }

//       } else if (currentBracket === 'Middle') {
//         // Winner promoted to High bracket
//         winner.currentBracket = 'High';
//         winner.points += bracketPoints['High'];
//         console.log(`${winner.displayName} is promoted to High bracket with ${winner.points} points`);
//         userUpdates.push(winner.save());

//         for (const loserPair of losersPairs) {
//           const loser = loserPair.racer;
//           const loserResult = loserPair.result;

//           if (loserResult.status === 'DNF' || loser === losersPairs[losersPairs.length - 1].racer) {
//             // Demote to Low bracket
//             loser.currentBracket = 'Low';
//             loser.points += bracketPoints['Low'];
//             console.log(`${loser.displayName} moves to Low bracket with ${loser.points} points`);
//           } else {
//             // Stays in Middle bracket
//             loser.points += bracketPoints['Middle'];
//             console.log(`${loser.displayName} stays in Middle bracket with ${loser.points} points`);
//           }
//           userUpdates.push(loser.save());
//         }

//       } else if (currentBracket === 'Low') {
//         // Winner promoted to Middle bracket
//         winner.currentBracket = 'Middle';
//         winner.points += bracketPoints['Middle'];
//         console.log(`${winner.displayName} is promoted to Middle bracket with ${winner.points} points`);
//         userUpdates.push(winner.save());

//         for (const loserPair of losersPairs) {
//           const loser = loserPair.racer;
//           // Losers stay in Low bracket
//           loser.points += bracketPoints['Low'];
//           console.log(`${loser.displayName} stays in Low bracket with ${loser.points} points`);
//           userUpdates.push(loser.save());
//         }
//       }
//     }
//   }

//   // Wait for all updates to complete
//   await Promise.all(userUpdates);
// }

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
    const winnerResult = winnerPair.result;

    const losersPairs = racerResultPairs.slice(1);

    console.log(`Processing race with ${racers.length} racers for round: ${currentRound}`);

    // Seeding round logic
    if (currentRound === 'Seeding') {
      // Assign brackets based on placements
      winner.currentBracket = 'High';
      winner.points += bracketPoints['High'];
      console.log(`${winner.displayName} is now in High bracket with ${winner.points} points`);
      usersToUpdate[winner._id.toString()] = winner;

      if (losersPairs.length >= 1) {
        const secondPlacePair = losersPairs[0];
        const secondPlace = secondPlacePair.racer;
        secondPlace.currentBracket = 'Middle';
        secondPlace.points += bracketPoints['Middle'];
        console.log(`${secondPlace.displayName} is now in Middle bracket with ${secondPlace.points} points`);
        usersToUpdate[secondPlace._id.toString()] = secondPlace;
      }

      if (losersPairs.length === 2) {
        const thirdPlacePair = losersPairs[1];
        const thirdPlace = thirdPlacePair.racer;
        thirdPlace.currentBracket = 'Low';
        thirdPlace.points += bracketPoints['Low'];
        console.log(`${thirdPlace.displayName} is now in Low bracket with ${thirdPlace.points} points`);
        usersToUpdate[thirdPlace._id.toString()] = thirdPlace;
      }

    } else {
      // Non-seeding rounds

      // Get current bracket of the winner
      const currentBracket = winner.currentBracket;
      console.log(`Non-seeding round for ${winner.displayName} in ${currentBracket} bracket`);

      console.log(`Awarding 4 points to ${winner.displayName} for winning`);
      winner.points += 4;
      winner.tieBreakerValue += 4;  
      
      if (currentBracket === 'High') {
        // Winner stays in High bracket
        winner.points += bracketPoints['High'];
        console.log(`${winner.displayName} stays in High bracket with ${winner.points} points`);
        usersToUpdate[winner._id.toString()] = winner;

        for (const loserPair of losersPairs) {
          const loser = loserPair.racer;
          const loserResult = loserPair.result;

          // Check if the loser is the last in placement or did not finish
          if (loserResult.status === 'DNF' || loser === losersPairs[losersPairs.length - 1].racer) {
            // Demote to Middle bracket
            loser.currentBracket = 'Middle';
            loser.points += bracketPoints['Middle'];
            console.log(`${loser.displayName} moves to Middle bracket with ${loser.points} points`);
          } else {
            // Stays in High bracket
            loser.points += bracketPoints['High'];
            console.log(`${loser.displayName} stays in High bracket with ${loser.points} points`);
          }
          usersToUpdate[loser._id.toString()] = loser;
        }

      } else if (currentBracket === 'Middle') {
        // Winner promoted to High bracket
        winner.currentBracket = 'High';
        winner.points += bracketPoints['High'];
        console.log(`${winner.displayName} is promoted to High bracket with ${winner.points} points`);
        usersToUpdate[winner._id.toString()] = winner;

        for (const loserPair of losersPairs) {
          const loser = loserPair.racer;
          const loserResult = loserPair.result;

          if (loserResult.status === 'DNF' || loser === losersPairs[losersPairs.length - 1].racer) {
            // Demote to Low bracket
            loser.currentBracket = 'Low';
            loser.points += bracketPoints['Low'];
            console.log(`${loser.displayName} moves to Low bracket with ${loser.points} points`);
          } else {
            // Stays in Middle bracket
            loser.points += bracketPoints['Middle'];
            console.log(`${loser.displayName} stays in Middle bracket with ${loser.points} points`);
          }
          usersToUpdate[loser._id.toString()] = loser;
        }

      } else if (currentBracket === 'Low') {
        // Winner promoted to Middle bracket
        winner.currentBracket = 'Middle';
        winner.points += bracketPoints['Middle'];
        console.log(`${winner.displayName} is promoted to Middle bracket with ${winner.points} points`);
        usersToUpdate[winner._id.toString()] = winner;

        for (const loserPair of losersPairs) {
          const loser = loserPair.racer;
          // Losers stay in Low bracket
          loser.points += bracketPoints['Low'];
          console.log(`${loser.displayName} stays in Low bracket with ${loser.points} points`);
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

// Don't need this now?
// router.post('/round/update', ensureAdmin, async (req, res) => {
//     try {
//       const { round } = req.body;
  
//       const tournament = await Tournament.findOneAndUpdate(
//         { name: 'red2024' },
//         { currentRound: round },
//         { new: true }
//       );
  
//       if (!tournament) {
//         return res.status(404).json({ error: 'Tournament not found' });
//       }
  
//       return res.status(200).json({ message: 'Tournament round updated', currentRound: tournament.currentRound });
//     } catch (err) {
//       console.error('Error updating tournament round:', err);
//       return res.status(500).json({ error: 'Error updating tournament round' });
//     }
// });

module.exports = router;