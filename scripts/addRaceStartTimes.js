const mongoose = require('mongoose');
const Race = require('../models/Race');
const Group = require('../models/Group');
const User = require('../models/User');

mongoose.connect(`mongodb+srv://liam:PASTEPASSWORD.7gth0.mongodb.net/?retryWrites=true&w=majority&appName=2024`, {
    dbName: 'tournament'
  });

const migrateRaceStartTime = async () => {
    try {
        // Fetch all races
        const races = await Race.find({});

        // console.log(races[0]);

        for (const race of races) {

            if (race.round == "Round 1") {
                // Fetch racer1 to get currentGroup
                const racer1 = await User.findById(race.racer1).select('currentGroup');

                if (!racer1 || !racer1.currentGroup) {
                    console.warn(`Racer1 (ID: ${race.racer1}) does not belong to any group for Race ID: ${race._id}`);
                    continue;
                }

                const group = await Group.findById(racer1.currentGroup);

                if (!group) {
                    console.warn(`Group (ID: ${racer1.currentGroup}) not found for Race ID: ${race._id}`);
                    continue;
                }

                // Update the group if raceStartTime is not set
                if (!group.raceStartTime) {
                    group.raceStartTime = race.raceDateTime;

                    await group.save();

                    console.log(`Updated Group ID: ${group._id} with raceStartTime: ${race.raceSubmitted}`);
                } else {
                    console.log(`Group ID: ${group._id} already has a raceStartTime`);
                }   
            }
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration encountered an error:', err);
    } finally {
        mongoose.connection.close();
    }
};

migrateRaceStartTime();
