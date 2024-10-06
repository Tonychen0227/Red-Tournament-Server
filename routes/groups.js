const express = require('express');
const router = express.Router();

const ensureAdmin = require('../middleware/ensureAdmin');
const ensureRunner = require('../middleware/ensureRunner');

const Group = require('../models/Group');
const User = require('../models/User');
const Tournament = require('../models/Tournament');

router.post('/', ensureAdmin, async (req, res) => {
  try {
    const { pot1UserId, pot2UserId, pot3UserId } = req.body;

    // Fetch the current tournament
    const tournament = await Tournament.findOne({ name: 'red2024' });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Extract the current round from the tournament
    const currentRound = tournament.currentRound;

    const memberIds = [pot1UserId, pot2UserId];
    if (pot3UserId) memberIds.push(pot3UserId);

   // Count groups for the current round to generate the next groupNumber
   const groupCountForCurrentRound = await Group.countDocuments({ round: currentRound });
   const nextGroupNumber = groupCountForCurrentRound + 1; // Next group number starts from 1

    // Create new group
    const newGroup = new Group({
      groupNumber: nextGroupNumber,
      members: memberIds,
      round: currentRound
    });

    await newGroup.save();

    // Update users' currentGroup field
    await User.updateMany(
      { _id: { $in: memberIds } },
      { $set: { currentGroup: newGroup._id } }
    );

    res.status(201).json(newGroup);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Server erfyror' });
  }
});

router.get('/', async (req, res) => {
  try {
    // Fetch the Tournament document (e.g., 'red2024')
    const tournament = await Tournament.findOne({ name: 'red2024' });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const currentRound = tournament.currentRound;

    // Fetch groups where group.round matches the current round
    const groups = await Group.find({ round: currentRound })
      .populate('members')
      .exec();

    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/count', async (req, res) => {
  try {
    // Fetch the tournament to get the current round
    const tournament = await Tournament.findOne({ name: 'red2024' });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const currentRound = tournament.currentRound;

    // Count groups for the current round
    const groupCount = await Group.countDocuments({ round: currentRound });

    res.json({ count: groupCount });
  } catch (err) {
    console.error('Error counting groups:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// router.get('/user/current', ensureRunner, async (req, res) => {
//   try {
//       const userId = req.user._id;

//       // Find the user and populate the currentGroup
//       const user = await User.findById(userId)
//           .populate({
//               path: 'currentGroup',
//               populate: {
//                   path: 'members',
//                   select: 'discordUsername displayName initialPot role pronouns'
//               }
//           })
//           .exec();

//       if (!user) {
//           return res.status(404).json({ error: 'User not found' });
//       }

//       if (!user.currentGroup) {
//           return res.status(404).json({ error: 'You are not currently assigned to any group' });
//       }

//       res.json({
//           groupNumber: user.currentGroup.groupNumber,
//           members: user.currentGroup.members
//       });
//   } catch (err) {
//       console.error('Error fetching user group:', err);
//       res.status(500).json({ error: 'Server error' });
//   }
// });

router.get('/user/current', ensureRunner, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find the user and populate the currentGroup
    const user = await User.findById(userId)
      .populate({
        path: 'currentGroup',
        populate: {
          path: 'members',
          select: 'discordUsername displayName initialPot role pronouns'
        }
      })
      .exec();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.currentGroup) {
      return res.status(404).json({ error: 'You are not currently assigned to any group' });
    }

    res.json({
      groupNumber: user.currentGroup.groupNumber,
      members: user.currentGroup.members,
      raceStartTime: user.currentGroup.raceStartTime
    });
  } catch (err) {
    console.error('Error fetching user group:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
