const mongoose = require('mongoose');
const readline = require('readline');

const Pickems = require('../models/Pickems');
const User = require('../models/User');

const POINTS_PER_TOP9_PICK = 20;

// MongoDB Connection URI
// const MONGODB_URI = `mongodb+srv://liam:PASTEPASSWORD.7gth0.mongodb.net/tournament_test?retryWrites=true&w=majority&appName=2024`;

// Setup readline interface for Y/n prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
};

const applyTop9Points = async () => {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully.');

    const dbName = mongoose.connection.name;
    console.log(`🔍 Connected to database: ${dbName}`);

    // 2. Fetch Current Top 9 Users
    const top9Users = await User.find({ role: 'runner' })
      .sort({ points: -1, tieBreakerValue: -1, secondaryTieBreakerValue: -1 })
      .limit(9)
      .select('_id discordUsername displayName') // Select fields as needed
      .lean();

    if (top9Users.length < 9) {
      console.warn('⚠️ Less than 9 runners found. Proceeding with available users.');
    }

    // Map of User ID to Display Name for easy reference
    const top9UserMap = {};
    const top9UserIds = top9Users.map(user => {
      top9UserMap[user._id.toString()] = user.displayName || user.discordUsername;
      return user._id.toString();
    });

    console.log('\n🏆 Current Top 9 Users:');
    top9Users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.displayName || user.discordUsername}`);
    });

    // 3. Fetch All Pickems that haven't been awarded top9 points yet
    const pickemsToProcess = await Pickems.find({ top9PointsAwarded: false })
      .select('userId top9')
      .populate('userId', 'displayName discordUsername') // Populate user details
      .lean();

    console.log(`\n📊 Found ${pickemsToProcess.length} pickems to process for top 9 points.`);

    if (pickemsToProcess.length === 0) {
      console.log('ℹ️ No pickems to process. All pickems have been awarded top 9 points.');
      mongoose.connection.close();
      rl.close();
      return;
    }

    // 4. Prepare Data for Reporting
    const pickemUpdates = []; // Array to hold update operations

    pickemsToProcess.forEach(pickem => {
      const pickemId = pickem._id;
      const pickerName = pickem.userId.displayName || pickem.userId.discordUsername;

      const pickedTop9Ids = pickem.top9.map(id => id.toString());

      // Calculate the number of correct picks
      const correctPicks = pickedTop9Ids.filter(id => top9UserIds.includes(id));

      pickemUpdates.push({
        pickemId,
        pickerName,
        correctPicksCount: correctPicks.length,
        pointsToAdd: correctPicks.length * POINTS_PER_TOP9_PICK
      });
    });

    // 5. Sort Pickems by Correct Picks Descending
    const sortedPickemUpdates = pickemUpdates.sort((a, b) => b.correctPicksCount - a.correctPicksCount);

    // 6. Display Summary of Correct Picks
    console.log('\n📈 Summary of Correct Top 9 Picks:');
    sortedPickemUpdates.forEach(pickem => {
      console.log(`- ${pickem.pickerName}: ${pickem.correctPicksCount} correct pick(s)`);
    });

    // 7. Prompt for Confirmation
    const answer = await askQuestion('\n💡 Do you want to proceed with awarding points based on the above summary? (Y/n): ');

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes' && answer !== '') {
      console.log('❌ Operation cancelled by the user.');
      mongoose.connection.close();
      rl.close();
      return;
    }

    console.log('\n🔄 Starting to award points...');

    // 8. Prepare Bulk Operations for Updating Pickems Points and Flags
    const bulkPickemsOps = [];

    // Add logging to trace the pickems being processed
    console.log('\n📝 Preparing bulk operations:');

    sortedPickemUpdates.forEach(pickem => {
      if (pickem.pointsToAdd > 0) {
        console.log(`🔹 Updating points for ${pickem.pickerName} (Pickem ID: ${pickem.pickemId}): +${pickem.pointsToAdd} points`);
      } else {
        console.log(`🔸 No points to add for ${pickem.pickerName} (Pickem ID: ${pickem.pickemId})`);
      }

      bulkPickemsOps.push({
        updateOne: {
          filter: { _id: pickem.pickemId },
          update: { 
            $inc: { points: pickem.pointsToAdd },
            $set: { top9PointsAwarded: true }
          },
        },
      });
    });

    // 9. Execute Bulk Pickems Points Update
    if (bulkPickemsOps.length > 0) {
      console.log(`\n📦 Starting to update points for ${bulkPickemsOps.length} pickem(s)...`);
      const pickemsBulkWriteResult = await Pickems.bulkWrite(bulkPickemsOps);
      console.log(`✅ Updated points for ${pickemsBulkWriteResult.modifiedCount} pickem(s).`);
      console.log('📄 Bulk Write Result for Pickems:', pickemsBulkWriteResult);

      // Verification: Fetch and log a sample of updated pickems
      const pickemsToVerify = bulkPickemsOps.slice(0, 5).map(op => op.updateOne.filter._id);
      if (pickemsToVerify.length > 0) {
        const verifiedPickems = await Pickems.find({ _id: { $in: pickemsToVerify } })
          .select('userId points')
          .populate('userId', 'displayName discordUsername')
          .lean();
        console.log('\n🔍 Verification of updated Pickems:');
        verifiedPickems.forEach(pickem => {
          console.log(`- ${pickem.userId.displayName || pickem.userId.discordUsername}: ${pickem.points} points`);
        });
      }
    } else {
      console.log('ℹ️ No points to add for any pickems.');
    }

    // 10. Execute Bulk Pickems Flags Update
    // (Already handled in the same bulkWrite operation by setting top9PointsAwarded to true)

    // 11. Display Final Results
    console.log('\n🎉 Top 9 points processing completed successfully.');

    // 12. Disconnect from MongoDB and Close Readline
    mongoose.connection.close();
    rl.close();
  } catch (error) {
    console.error('❌ Error during top 9 points processing:', error);
    mongoose.connection.close();
    rl.close();
    process.exit(1); // Exit the script with an error code
  }
};

applyTop9Points();