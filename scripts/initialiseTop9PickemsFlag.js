const mongoose = require('mongoose');
const readline = require('readline');

// Import your models
const Pickems = require('../models/Pickems');
const User = require('../models/User');

// MongoDB Connection URI
// const MONGODB_URI = `mongodb+srv://liam:PASTEPASSWORD.7gth0.mongodb.net/tournament_test?retryWrites=true&w=majority&appName=2024`;

// Initialize the flag to false:
const initializeTop9PointsAwarded = async () => {
  try {
    // Connect to MongoDB with updated options
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB successfully.');

    const dbName = mongoose.connection.name;
    console.log(`🔍 Connected to database: ${dbName}`);

    // Check how many Pickems already have top9PointsAwarded set to true
    const alreadyProcessedCount = await Pickems.countDocuments({ top9PointsAwarded: true });
    console.log(`📋 Pickems already processed (top9PointsAwarded: true): ${alreadyProcessedCount}`);

    // Check how many Pickems need to be updated
    const toUpdateCount = await Pickems.countDocuments({ top9PointsAwarded: { $exists: false } });
    console.log(`📋 Pickems to update (top9PointsAwarded: false): ${toUpdateCount}`);

    if (toUpdateCount === 0) {
      console.log('✅ No Pickems need updating. All Pickems have top9PointsAwarded set.');
      await mongoose.connection.close();
      return;
    }

    // Update all Pickems where top9PointsAwarded is not set (undefined)
    const result = await Pickems.updateMany(
      { top9PointsAwarded: { $exists: false } },
      { $set: { top9PointsAwarded: false } }
    );

    console.log(`✅ Updated ${result.modifiedCount} Pickems to set top9PointsAwarded to false.`);

    // Optional: Log a few updated Pickems to confirm
    const sampleUpdatedPickems = await Pickems.find({ top9PointsAwarded: false })
      .limit(5)
      .select('userId top9PointsAwarded')
      .lean();
    
    console.log('\n🔍 Sample Updated Pickems:');
    sampleUpdatedPickems.forEach(pickem => {
      console.log(`- Pickem ID: ${pickem._id}, User ID: ${pickem.userId}, top9PointsAwarded: ${pickem.top9PointsAwarded}`);
    });

    // Disconnect from MongoDB
    await mongoose.connection.close();
    console.log('🔒 Disconnected from MongoDB.');
  } catch (error) {
    console.error('❌ Error initializing top9PointsAwarded:', error);
    try {
      await mongoose.connection.close();
      console.log('🔒 Disconnected from MongoDB due to error.');
    } catch (closeError) {
      console.error('❌ Error closing MongoDB connection:', closeError);
    }
    process.exit(1); // Exit the script with an error code
  }
};

// Execute the initialization function
initializeTop9PointsAwarded();