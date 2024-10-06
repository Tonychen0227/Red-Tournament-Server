// retroactiveScoring.js
const mongoose = require('mongoose');

// Import your models
const Race = require('../models/Race');
const Pickems = require('../models/Pickems');
const User = require('../models/User'); // Ensure you have a User model

const POINTS_PER_CORRECT_PICK = 5;

// MongoDB Connection URI
const MONGODB_URI = `mongodb+srv://liam:PASTEPASSWORD.7gth0.mongodb.net/tournament?retryWrites=true&w=majority&appName=2024`;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB successfully.');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1); // Exit the script if connection fails
});

/**
 * Retroactively assigns points to users based on their correct picks.
 */
const retroactiveScoring = async () => {
  try {
    // Fetch all completed races
    const completedRaces = await Race.find({ completed: true });

    console.log(`🏁 Found ${completedRaces.length} completed race(s) to process.`);

    for (const race of completedRaces) {
      if (!race.winner) {
        console.warn(`⚠️ Race ${race._id} has no winner. Skipping.`);
        continue;
      }

      const round = race.round;

      // Map round names to Pickems fields
      const validRoundsMap = {
        'Round 1': 'round1Picks',
        'Round 2': 'round2Picks',
        'Round 3': 'round3Picks',
        'Semifinals': 'semiFinalsPicks',
        // Add more rounds if necessary
      };

      const pickField = validRoundsMap[round];

      if (!pickField) {
        console.warn(`⚠️ No pick field mapping found for round: "${round}". Skipping race ${race._id}.`);
        continue;
      }

      // Find all Pickems that have a pick for this round including the winner
      const matchingPickems = await Pickems.find({
        [pickField]: race.winner,
        scoredRaces: { $ne: race._id }, // Ensure race hasn't been scored for this Pickem
      }).populate('userId'); // Populate user details for better logging

      if (matchingPickems.length === 0) {
        console.log(`ℹ️ No users correctly picked the winner for race ${race._id} (${round}).`);
        continue;
      }

      console.log(`✅ Race ${race._id} (${round}): Winner is ${race.winner}. ${matchingPickems.length} user(s) picked correctly:`);

      // Update points and log user details
      const updatePromises = matchingPickems.map(async (pickem) => {
        const user = pickem.userId;

        if (!user) {
          console.warn(`⚠️ Pickems ${pickem._id} has no associated user. Skipping.`);
          return null;
        }

        // Increment points
        pickem.points += POINTS_PER_CORRECT_PICK;

        // Optionally, track scored races to prevent double-scoring
        pickem.scoredRaces = pickem.scoredRaces || [];
        pickem.scoredRaces.push(race._id);

        // Save the updated Pickems document
        await pickem.save();

        // Log user information
        console.log(`   - User ID: ${user._id}, Username: ${user.displayName}, New Points: ${pickem.points}`);

        return pickem;
      });

      // Await all updates
      const updatedPickems = await Promise.all(updatePromises);

      // Filter out any nulls (in case of missing users)
      const successfullyUpdated = updatedPickems.filter(pickem => pickem !== null).length;

      console.log(`🔄 Processed race ${race._id}. Awarded ${successfullyUpdated} user(s) with ${POINTS_PER_CORRECT_PICK} point(s) each.`);
      console.log('---'); // Separator for readability
    }

    console.log('🎉 Retroactive scoring completed successfully.');
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error during retroactive scoring:', error);
    mongoose.connection.close();
    process.exit(1); // Exit the script with an error code
  }
};

// Execute the scoring function
retroactiveScoring();
