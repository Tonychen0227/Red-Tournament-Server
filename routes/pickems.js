const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');

const User = require('../models/User');
const Group = require('../models/Group');
const Pickems = require('../models/Pickems');
const Tournament = require('../models/Tournament');

const ensureAuthenticated = require('../middleware/ensureAuthenticated');

// Submit one-off picks
router.post('/submit-one-off', ensureAuthenticated, async (req, res) => {
  
  const { selectedRunners, selectedWinner, selectedBestTimeRunner, bestTime } = req.body;

  const userId = req.user._id;

  // Calculate the closestTime in milliseconds from the bestTime object
  const closestTime =
    (bestTime.hours * 3600000) +
    (bestTime.minutes * 60000) +
    (bestTime.seconds * 1000) +
    bestTime.milliseconds;


  try {
    const pickems = await Pickems.findOne({ userId });

    if (pickems) {
      return res.status(400).json({ message: 'You have already submitted your one-off picks.' });
    }

    const newPickems = new Pickems({
      userId,
      top9: selectedRunners.map(runner => runner._id),
      overallWinner: selectedWinner._id,
      bestTimeWho: selectedBestTimeRunner._id,
      closestTime
    });

    await newPickems.save();

    res.status(201).json({ message: 'Pickems saved successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error saving pickems', error });
  }
});

// Submit round picks
router.post('/submit-round-picks', ensureAuthenticated, async (req, res) => {
  const { selectedWinners } = req.body;
  const userId = req.user._id;

  try {
    // Fetch the active tournament
    const tournament = await Tournament.findOne().sort({ _id: -1 }); // Adjust query if needed

    if (!tournament) {
      return res.status(404).json({ message: 'No active tournament found.' });
    }

    const currentRound = tournament.currentRound;

    // Validate currentRound against the schema's enum
    const validRoundsMap = {
      'Round 1': 'round1Picks',
      'Round 2': 'round2Picks',
      'Round 3': 'round3Picks',
      'Semifinals': 'semiFinalsPicks',
    };

    if (!validRoundsMap[currentRound]) {
      return res.status(400).json({ message: `Invalid current round: ${currentRound}.` });
    }

    const roundField = validRoundsMap[currentRound];

    const pickems = await Pickems.findOne({ userId });

    if (!pickems) {
      return res.status(404).json({ message: 'Pickems not found for this user.' });
    }

    // Check if picks for the current round have already been submitted
    if (pickems[roundField] && pickems[roundField].length > 0) {
      return res.status(400).json({ message: `You have already submitted picks for ${currentRound}.` });
    }

    // Validate selectedRunners array
    if (!Array.isArray(selectedWinners) || selectedWinners.length === 0) {
      return res.status(400).json({ message: 'Selected runners must be a non-empty array.' });
    }

    pickems[roundField] = selectedWinners;

    await pickems.save();

    res.status(200).json({ message: `${currentRound} picks submitted successfully.` });
  } catch (error) {
    console.error('Error submitting round picks:', error);
    res.status(500).json({ message: 'Error submitting round picks.', error });
  }
});

// Get current user's Pickems
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find the pickems and populate all user-related fields
    const pickems = await Pickems.findOne({ userId })
    .populate('top9', 'displayName') // Populate top9 with displayName field
    .populate('overallWinner', 'displayName')
    .populate('bestTimeWho', 'displayName')
    .populate('round1Picks', 'displayName')
    .populate('round2Picks', 'displayName')
    .populate('round3Picks', 'displayName')
    .populate('semiFinalsPicks', 'displayName');

    // Return the pickems object if it exists, otherwise null
    res.status(200).json(pickems || null);
  } catch (error) {
    console.error('Error fetching Pickems:', error);
    res.status(500).json({ message: 'Error fetching Pickems', error });
  }
});

// Get points for all Pickems players, ordered by points (descending)
router.get('/leaderboard', async (req, res) => {
  try {
    // Find all Pickems entries, sort by points in descending order, and populate the userId with username
    const pickemsList = await Pickems.find()
      .populate('userId', 'displayName discordUsername') // Populate userId to get the displayName
      .select('userId points') // Select only the points and userId fields
      .sort({ points: -1 }); // Sort by points in descending order

    // If no Pickems entries found, return an empty array
    if (!pickemsList) {
      return res.status(404).json({ message: 'No Pickems entries found' });
    }

    // Respond with the sorted array of Pickems entries
    res.status(200).json(pickemsList);
  } catch (error) {
    console.error('Error retrieving Pickems points:', error);
    res.status(500).json({ message: 'Error retrieving Pickems points', error });
  }
});

// Get a user's Pickems by userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
      // Find the Pickems for the provided userId and populate user-related fields
      const pickems = await Pickems.findOne({ userId })
          .populate('top9', 'displayName discordUsername')
          .populate('overallWinner', 'displayName discordUsername')
          .populate('bestTimeWho', 'displayName discordUsername')
          .populate('round1Picks', 'displayName discordUsername')
          .populate('round2Picks', 'displayName discordUsername')
          .populate('round3Picks', 'displayName discordUsername')
          .populate('semiFinalsPicks', 'displayName discordUsername')
          .populate('userId', 'username');

      if (!pickems) {
        return res.status(200).json(null);
      }

      res.status(200).json(pickems);
  } catch (error) {
      console.error('Error retrieving Pickems:', error);
      res.status(500).json({ message: 'Error retrieving Pickems', error });
  }
});

// Stats
const getTopOverallWinners = async (limit = 5) => {
  const topWinners = await Pickems.aggregate([
    {
      $group: {
        _id: '$overallWinner',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        displayName: '$user.displayName',
        discordUsername: '$user.discordUsername',
        currentBracket: '$user.currentBracket',
        count: 1,
      },
    },
  ]);

  return topWinners;
};

const getTopBestTimePicks = async (limit = 5) => {
  const topBestTime = await Pickems.aggregate([
    {
      $group: {
        _id: '$bestTimeWho',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        displayName: '$user.displayName',
        discordUsername: '$user.discordUsername',
        currentBracket: '$user.currentBracket',
        count: 1,
      },
    },
  ]);

  return topBestTime;
};

const getTop9Picks = async () => {
  try {
    // Perform aggregation on the Pickems collection
    const top9Picks = await Pickems.aggregate([
      // Unwind the top9 array to handle each pick individually
      { $unwind: '$top9' },
      
      // Group by the top9 user ID and count the number of picks per user
      {
        $group: {
          _id: '$top9',
          pickCount: { $sum: 1 },
        },
      },
      
      // Sort the users by pickCount in descending order
      { $sort: { pickCount: -1 } },
      
      // Limit the results to Top 9
      { $limit: 9 },
      
      // Lookup to populate user details from the users collection
      {
        $lookup: {
          from: 'users', // Ensure this matches your actual User collection name
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      
      // Unwind the user array to simplify the structure
      { $unwind: '$user' },
      
      // Project the necessary fields: userId, displayName, discordUsername, and pickCount
      {
        $project: {
          _id: 0,
          userId: '$_id',
          displayName: '$user.displayName',
          discordUsername: '$user.discordUsername',
          currentBracket: '$user.currentBracket',
          pickCount: 1,
        },
      },
    ]);

    return top9Picks;
  } catch (error) {
    console.error('Error in getTop9Picks:', error);
    throw error; // Propagate the error to be handled in the route
  }
};


const getTopPicksByRound = async (roundField, limit = 5) => {
  const topPicks = await Pickems.aggregate([
    { $unwind: `$${roundField}` },
    {
      $group: {
        _id: `$${roundField}`,
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        displayName: '$user.displayName',
        discordUsername: '$user.discordUsername',
        currentBracket: '$user.currentBracket',
        count: 1,
      },
    },
  ]);

  return topPicks;
};

const getFavoritePerGroup = async () => {
  try {

    const favoritePerGroup = await Group.aggregate([
      // Step 1: Exclude 'Seeding' rounds
      {
        $match: {
          round: { $ne: "Seeding" } // Exclude 'Seeding' rounds
        }
      },
      // Step 2: Lookup into Pickems based on group members and current round
      {
        $lookup: {
          from: "pickems",
          let: { groupMembers: "$members", currentRound: "$round" },
          pipeline: [
            {
              $project: {
                userId: 1,
                picks: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$$currentRound", "Round 1"] }, then: "$round1Picks" },
                      { case: { $eq: ["$$currentRound", "Round 2"] }, then: "$round2Picks" },
                      { case: { $eq: ["$$currentRound", "Round 3"] }, then: "$round3Picks" },
                      { case: { $eq: ["$$currentRound", "Semifinals"] }, then: "$semiFinalsPicks" },
                      { case: { $eq: ["$$currentRound", "Final"] }, then: "$finalPicks" }
                    ],
                    default: []
                  }
                }
              }
            },
            { $unwind: "$picks" },
            { $match: { $expr: { $in: ["$picks", "$$groupMembers"] } } },
            {
              $group: {
                _id: "$picks",
                pickCount: { $sum: 1 }
              }
            },
            // Step 3: Determine the maximum pickCount
            {
              $group: {
                _id: null,
                maxPickCount: { $max: "$pickCount" },
                picks: { $push: { userId: "$_id", pickCount: "$pickCount" } }
              }
            },
            // Step 4: Filter users with pickCount equal to maxPickCount
            {
              $project: {
                picks: {
                  $filter: {
                    input: "$picks",
                    as: "pick",
                    cond: { $eq: ["$$pick.pickCount", "$maxPickCount"] }
                  }
                }
              }
            },
            { $unwind: "$picks" },
            {
              $lookup: {
                from: "users",
                localField: "picks.userId",
                foreignField: "_id",
                as: "user"
              }
            },
            { $unwind: "$user" },
            {
              $project: {
                _id: 0,
                userId: "$picks.userId",
                displayName: "$user.displayName",
                discordUsername: '$user.discordUsername',
                currentBracket: '$user.currentBracket',
                pickCount: "$picks.pickCount"
              }
            }
          ],
          as: "favorite"
        }
      },
      // Step 5: Exclude groups with no favorite
      {
        $match: {
          favorite: { $ne: [] } // Ensure favorite exists
        }
      },
      // Step 6: Project necessary fields
      {
        $project: {
          groupNumber: 1,
          round: 1,
          raceStartTime: 1,
          favorite: 1
        }
      },
      // Step 7: Group by round and accumulate groups
      {
        $group: {
          _id: "$round",
          groups: {
            $push: {
              groupNumber: "$groupNumber",
              raceStartTime: "$raceStartTime",
              favorite: "$favorite"
            }
          }
        }
      },
      // Step 8: Rename _id to round for clarity
      {
        $project: {
          _id: 0,
          round: "$_id",
          groups: 1
        }
      },
      // Optional: Sort rounds if desired
      {
        $sort: { round: 1 } // Adjust sorting as needed
      }
    ]);

    return favoritePerGroup;

  } catch (error) {
    console.error("Error in getFavoritePerGroup:", error);
    throw error;
  }
};


router.get('/stats/all', async (req, res) => {
  try {
    const topWinnersLimit = 5;
    const topBestTimeLimit = 5;
    const topPicksByRoundLimit = 5;

    // Define the rounds corresponding to each race
    const rounds = ['round1Picks', 'round2Picks', 'round3Picks', 'semiFinalsPicks'];

    const topPicksByRound = {};

    for (const round of rounds) {
      const topPicks = await getTopPicksByRound(round, topPicksByRoundLimit);
      topPicksByRound[round] = topPicks;
    }

    const [
      topOverallWinners,
      topBestTimePicks,
      top9Picks,
    ] = await Promise.all([
      getTopOverallWinners(topWinnersLimit),
      getTopBestTimePicks(topBestTimeLimit),
      getTop9Picks(),
    ]);

    res.json({
      topOverallWinners,
      topBestTimePicks,
      top9Picks,
      topPicksByRound,
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).send('Server Error');
  }
});

router.get('/stats/favorites', async (req, res) => {
  try {
    const favorites = await getFavoritePerGroup();
    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).send('Server Error');
  }
});

module.exports = router;