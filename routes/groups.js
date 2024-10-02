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

    // console.log(req);

    // Validate input
    // if (!pot1UserId || !pot2UserId) {
    //   return res.status(400).json({ error: 'At least two users are required' });
    // }

    // Fetch the current tournament
    const tournament = await Tournament.findOne({ name: 'red2024' });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Extract the current round from the tournament
    const currentRound = tournament.currentRound;

    const memberIds = [pot1UserId, pot2UserId];
    if (pot3UserId) memberIds.push(pot3UserId);

    // Generate the next groupNumber
    const lastGroup = await Group.findOne().sort({ groupNumber: -1 }).exec();
    const nextGroupNumber = lastGroup ? lastGroup.groupNumber + 1 : 1;

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
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('members')
      .exec();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/count', async (req, res) => {
  try {
    const groupCount = await Group.countDocuments();
    res.json({ count: groupCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

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
          members: user.currentGroup.members
      });
  } catch (err) {
      console.error('Error fetching user group:', err);
      res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
