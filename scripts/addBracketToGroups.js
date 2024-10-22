const mongoose = require('mongoose');
const Group = require('../models/Group'); 

const MONGODB_URI = `mongodb+srv://liam:PASTEPASSWORD.7gth0.mongodb.net/tournament?retryWrites=true&w=majority&appName=2024`;

// Constants for bracket assignments
const BRACKET_ASSIGNMENTS = ['Low', 'Middle', 'High'];
const GROUPS_PER_BRACKET = 6;

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        try {
            // Fetch all groups, sorted by round and groupNumber
            const groups = await Group.find({})
                .sort({ round: 1, groupNumber: 1 })
                .exec();

            // Organize groups by round
            const groupsByRound = groups.reduce((acc, group) => {
                if (!acc[group.round]) {
                    acc[group.round] = [];
                }
                acc[group.round].push(group);
                return acc;
            }, {});

            let totalUpdated = 0;

            // Iterate over each round
            for (const [round, groupsInRound] of Object.entries(groupsByRound)) {
                console.log(`\nProcessing Round: ${round}`);

                if (round === 'Seeding') {
                    // Assign 'Seeding' bracket to all groups in the Seeding round
                    const seedingResult = await Group.updateMany(
                        { round: 'Seeding' },
                        { $set: { bracket: 'Seeding' } }
                    );
                    console.log(`   🟢 Seeding Round: ${seedingResult.modifiedCount} groups updated to 'Seeding'`);
                    totalUpdated += seedingResult.modifiedCount;
                } else {
                    // Assign brackets based on groupNumber
                    // Assuming groupNumber starts at 1 and increments sequentially

                    // Sort groups by groupNumber ascending
                    const sortedGroups = groupsInRound.sort((a, b) => a.groupNumber - b.groupNumber);

                    for (let i = 0; i < sortedGroups.length; i++) {
                        let bracket = null;

                        const bracketIndex = Math.floor(i / GROUPS_PER_BRACKET);
                        if (bracketIndex < BRACKET_ASSIGNMENTS.length) {
                            bracket = BRACKET_ASSIGNMENTS[bracketIndex];
                        } else {
                            // Beyond defined brackets, skip or handle as needed
                            console.warn(`   ⚠️ Round '${round}', Group ${sortedGroups[i].groupNumber}: No bracket assignment defined for groupNumber ${sortedGroups[i].groupNumber}. Skipping.`);
                            continue;
                        }

                        // Update the group's bracket
                        const updateResult = await Group.updateOne(
                            { _id: sortedGroups[i]._id },
                            { $set: { bracket: bracket } }
                        );

                        if (updateResult.modifiedCount === 1) {
                            console.log(`   ✅ Round '${round}', Group ${sortedGroups[i].groupNumber}: Set bracket to '${bracket}'`);
                            totalUpdated += 1;
                        } else {
                            console.warn(`   ⚠️ Round '${round}', Group ${sortedGroups[i].groupNumber}: Bracket '${bracket}' not set (possibly already set or error)`);
                        }
                    }

                    // Handle if there are more than 18 groups
                    if (sortedGroups.length > BRACKET_ASSIGNMENTS.length * GROUPS_PER_BRACKET) {
                        console.warn(`   ⚠️ Round '${round}' has ${sortedGroups.length} groups, which exceeds the assignment limit of ${BRACKET_ASSIGNMENTS.length * GROUPS_PER_BRACKET} groups.`);
                    }
                }
            }

            console.log(`\n🎉 Total Groups Updated: ${totalUpdated}`);
        } catch (err) {
            console.error('❌ Error updating groups:', err);
        } finally {
            mongoose.connection.close();
            console.log('🔒 MongoDB connection closed');
        }
    })
    .catch(err => {
        console.error('❌ Failed to connect to MongoDB:', err);
    });