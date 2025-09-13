const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');

const User = require('../models/User');
const Group = require('../models/Group');
const Race = require('../models/Race');
const Pickems = require('../models/Pickems');
const Tournament = require('../models/Tournament');

const ensureAuthenticated = require('../middleware/ensureAuthenticated');

router.post('/submit-one-off', ensureAuthenticated, async (req, res) => {
  
  const { selectedRunners, selectedWinner, selectedBestTimeRunner, bestTime } = req.body;

  const userId = req.user._id;

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
      top27: selectedRunners.map(runner => runner._id),
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

router.post('/submit-round-picks', ensureAuthenticated, async (req, res) => {
  const { selectedWinners } = req.body;
  const userId = req.user._id;

  try {
    const tournament = await Tournament.findOne().sort({ _id: -1 });

    if (!tournament) {
      return res.status(404).json({ message: 'No active tournament found.' });
    }

    const currentRound = tournament.currentRound;

    const validRoundsMap = {
      'Round 1': 'round1Picks',
      'Round 2': 'round2Picks',
      'Round 3': 'round3Picks',
      'Quarterfinals': 'quarterFinalsPicks',
      'Semifinals': 'semiFinalsPicks',
      'Final': 'finalPick',
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
    
    const pickems = await Pickems.findOne({ userId })
    .populate('top27', 'displayName')
    .populate('overallWinner', 'displayName')
    .populate('bestTimeWho', 'displayName')
    .populate('round1Picks', 'displayName')
    .populate('round2Picks', 'displayName')
    .populate('round3Picks', 'displayName')
    .populate('quarterFinalsPicks', 'displayName')
    .populate('semiFinalsPicks', 'displayName')
    .populate('finalPick', 'displayName');

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
      .populate('userId', 'displayName discordUsername')
      .select('userId points')
      .sort({ points: -1 });

    if (!pickemsList) {
      return res.status(404).json({ message: 'No Pickems entries found' });
    }

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
      const pickems = await Pickems.findOne({ userId })
          .populate('top27', 'displayName discordUsername')
          .populate('overallWinner', 'displayName discordUsername')
          .populate('bestTimeWho', 'displayName discordUsername')
          .populate('round1Picks', 'displayName discordUsername')
          .populate('round2Picks', 'displayName discordUsername')
          .populate('round3Picks', 'displayName discordUsername')
          .populate('quarterFinals', 'displayName discordUsername')
          .populate('semiFinalsPicks', 'displayName discordUsername')
          .populate('finalPick', 'displayName discordUsername')
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

const getTop27Picks = async () => {
  try {
    const top27Picks = await Pickems.aggregate([
      { $unwind: '$top27' },
      {
        $group: {
          _id: '$top27',
          pickCount: { $sum: 1 },
        },
      },
      { $sort: { pickCount: -1 } },
      { $limit: 27 },
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
          pickCount: 1,
        },
      },
    ]);

    return top27Picks;
  } catch (error) {
    console.error('Error in getTop27Picks:', error);
    throw error;
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
                      { case: { $eq: ["$$currentRound", "Quarterfinals"] }, then: "$quarterFinalsPicks" },
                      { case: { $eq: ["$$currentRound", "Semifinals"] }, then: "$semiFinalsPicks" },
                      { case: { $eq: ["$$currentRound", "Final"] }, then: "$finalPick" }
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
            // Determine the maximum pickCount
            {
              $group: {
                _id: null,
                maxPickCount: { $max: "$pickCount" },
                picks: { $push: { userId: "$_id", pickCount: "$pickCount" } }
              }
            },
            // Filter users with pickCount equal to maxPickCount
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
      // Exclude groups with no favorite
      {
        $match: {
          favorite: { $ne: [] } // Ensure favorite exists
        }
      },
      {
        $project: {
          groupNumber: 1,
          round: 1,
          raceStartTime: 1,
          favorite: 1
        }
      },
      // Group by round and accumulate groups
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
      // Rename _id to round for clarity
      {
        $project: {
          _id: 0,
          round: "$_id",
          groups: 1
        }
      },
      {
        $sort: { round: 1 }
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

    const rounds = ['round1Picks', 'round2Picks', 'round3Picks', 'quarterFinalsPicks', 'semiFinalsPicks'];

    const topPicksByRound = {};

    for (const round of rounds) {
      const topPicks = await getTopPicksByRound(round, topPicksByRoundLimit);
      topPicksByRound[round] = topPicks;
    }

    const [
      topOverallWinners,
      topBestTimePicks,
      top27Picks,
    ] = await Promise.all([
      getTopOverallWinners(topWinnersLimit),
      getTopBestTimePicks(topBestTimeLimit),
      getTop27Picks(),
    ]);

    res.json({
      topOverallWinners,
      topBestTimePicks,
      top27Picks,
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

// Admin routes
router.get('/tournament/picks', async (req, res) => {
  try {
    const fastestRace = await Race.aggregate([
      { $unwind: '$results' },
      { $match: { 'results.status': 'Finished' } },
      {
        $addFields: {
          'results.totalTime': {
            $add: [
              { $multiply: ['$results.finishTime.hours', 3600000] },
              { $multiply: ['$results.finishTime.minutes', 60000] },
              { $multiply: ['$results.finishTime.seconds', 1000] },
              '$results.finishTime.milliseconds',
            ],
          },
        },
      },
      { $sort: { 'results.totalTime': 1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'users',
          localField: 'results.racer',
          foreignField: '_id',
          as: 'racerDetails',
        },
      },
      { $unwind: '$racerDetails' },
      {
        $project: {
          _id: 0,
          racerId: '$results.racer',
          racer: '$racerDetails.displayName',
          discordUsername: '$racerDetails.discordUsername',
          totalTime: '$results.totalTime',
          raceDateTime: 1,
        },
      },
    ]);

    const fastestTimeRacerId = fastestRace[0]?.racerId;
    const fastestTimeInMilliseconds = fastestRace[0]?.totalTime;

    let allUsers = await User.find({ role: 'runner' })
      .select('displayName discordUsername points bestTournamentTimeMilliseconds currentBracket')
      .lean();

    allUsers = allUsers.map(user => {
      return user;
    });

    const top27Users = allUsers
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return a.bestTournamentTimeMilliseconds - b.bestTournamentTimeMilliseconds;
      })
      .slice(0, 9);

    const allPickems = await Pickems.find()
      .populate('userId', 'displayName discordUsername')
      .lean();

    const correctFastestTimePickers = allPickems.filter(pickem => {
      return pickem.bestTimeWho?.toString() === fastestTimeRacerId?.toString();
    }).map(pickem => ({
      displayName: pickem.userId.displayName,
      discordUsername: pickem.userId.discordUsername,
    }));

    let closestTimeGuesser = null;
    let closestTimeDifference = Infinity;

    allPickems.forEach(pickem => {
      const guessTime = pickem.closestTime;
      const timeDifference = Math.abs(guessTime - fastestTimeInMilliseconds);

      if (timeDifference < closestTimeDifference) {
        closestTimeGuesser = {
          displayName: pickem.userId.displayName,
          discordUsername: pickem.userId.discordUsername,
        };
        closestTimeDifference = timeDifference;
      }
    });

    res.status(200).json({
      fastestRace: fastestRace[0] || null,
      top27Users,
      correctFastestTimePickers,
      closestTimeGuesser,
    });
  } catch (error) {
    console.error('Error fetching tournament picks:', error);
    res.status(500).json({ message: 'Error fetching tournament picks.', error });
  }
});

module.exports = router;