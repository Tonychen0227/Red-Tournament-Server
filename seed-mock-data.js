/**
 * Mock Data Seeder for Red Tournament Application
 * 
 * This script populates the MongoDB database with realistic sample data
 * for development and testing purposes.
 * 
 * Usage: node seed-mock-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('./models/User');
const Tournament = require('./models/Tournament');
const Race = require('./models/Race');
const Group = require('./models/Group');
const Pickems = require('./models/Pickems');

// Connect to MongoDB
const mongoUrl = process.env.NODE_ENV === 'production' 
  ? `mongodb+srv://liam:${process.env.MONGODB_PASSWORD}.7gth0.mongodb.net/?retryWrites=true&w=majority&appName=2024`
  : `mongodb://admin:${process.env.MONGODB_PASSWORD}@mongodb:27017/redtournament?authSource=admin`;

// Mock data arrays
const mockUsers = [
  // Runners
  { discordUsername: 'speedrunner1', displayName: 'Lightning Fast', role: 'runner', pronouns: 'he/him', initialPot: '1', currentBracket: 'High', points: 85, tieBreakerValue: 15420 },
  { discordUsername: 'pokemonmaster99', displayName: 'Pokemon Master', role: 'runner', pronouns: 'she/her', initialPot: '1', currentBracket: 'High', points: 82, tieBreakerValue: 15680 },
  { discordUsername: 'redversion_pro', displayName: 'Red Version Pro', role: 'runner', pronouns: 'they/them', initialPot: '1', currentBracket: 'High', points: 78, tieBreakerValue: 16200 },
  { discordUsername: 'elite4champion', displayName: 'Elite4 Champion', role: 'runner', pronouns: 'he/him', initialPot: '1', currentBracket: 'High', points: 75, tieBreakerValue: 16500 },
  { discordUsername: 'pikachupower', displayName: 'Pikachu Power', role: 'runner', pronouns: 'she/her', initialPot: '1', currentBracket: 'High', points: 73, tieBreakerValue: 16800 },
  
  { discordUsername: 'gymleader_brock', displayName: 'Gym Leader Brock', role: 'runner', pronouns: 'he/him', initialPot: '2', currentBracket: 'Middle', points: 68, tieBreakerValue: 17200 },
  { discordUsername: 'misty_water', displayName: 'Misty Water', role: 'runner', pronouns: 'she/her', initialPot: '2', currentBracket: 'Middle', points: 65, tieBreakerValue: 17500 },
  { discordUsername: 'lt_surge_electric', displayName: 'Lt. Surge Electric', role: 'runner', pronouns: 'he/him', initialPot: '2', currentBracket: 'Middle', points: 62, tieBreakerValue: 17800 },
  { discordUsername: 'erika_grass', displayName: 'Erika Grass', role: 'runner', pronouns: 'she/her', initialPot: '2', currentBracket: 'Middle', points: 60, tieBreakerValue: 18100 },
  { discordUsername: 'koga_poison', displayName: 'Koga Poison', role: 'runner', pronouns: 'he/him', initialPot: '2', currentBracket: 'Middle', points: 58, tieBreakerValue: 18400 },
  
  { discordUsername: 'sabrina_psychic', displayName: 'Sabrina Psychic', role: 'runner', pronouns: 'she/her', initialPot: '3', currentBracket: 'Low', points: 55, tieBreakerValue: 18700 },
  { discordUsername: 'blaine_fire', displayName: 'Blaine Fire', role: 'runner', pronouns: 'he/him', initialPot: '3', currentBracket: 'Low', points: 52, tieBreakerValue: 19000 },
  { discordUsername: 'giovanni_ground', displayName: 'Giovanni Ground', role: 'runner', pronouns: 'he/him', initialPot: '3', currentBracket: 'Low', points: 48, tieBreakerValue: 19300 },
  { discordUsername: 'team_rocket_member', displayName: 'Team Rocket Member', role: 'runner', pronouns: 'they/them', initialPot: '3', currentBracket: 'Low', points: 45, tieBreakerValue: 19600 },
  { discordUsername: 'youngster_joey', displayName: 'Youngster Joey', role: 'runner', pronouns: 'he/him', initialPot: '3', currentBracket: 'Low', points: 42, tieBreakerValue: 19900 },
  { discordUsername: 'bug_catcher_sam', displayName: 'Bug Catcher Sam', role: 'runner', pronouns: 'he/him', initialPot: '3', currentBracket: 'Low', points: 38, tieBreakerValue: 20200 },
  { discordUsername: 'lass_dana', displayName: 'Lass Dana', role: 'runner', pronouns: 'she/her', initialPot: '3', currentBracket: 'Low', points: 35, tieBreakerValue: 20500 },
  { discordUsername: 'fisherman_ned', displayName: 'Fisherman Ned', role: 'runner', pronouns: 'he/him', initialPot: '3', currentBracket: 'Low', points: 32, tieBreakerValue: 20800 },
  
  // Commentators and Admins
  { discordUsername: 'professor_oak', displayName: 'Professor Oak', role: 'commentator', pronouns: 'he/him', isAdmin: true, points: 0 },
  { discordUsername: 'pokemon_announcer', displayName: 'Pokemon Announcer', role: 'commentator', pronouns: 'they/them', points: 0 },
  { discordUsername: 'red_expert', displayName: 'Red Expert', role: 'commentator', pronouns: 'she/her', points: 0 },
  { discordUsername: 'speedrun_analyst', displayName: 'Speedrun Analyst', role: 'commentator', pronouns: 'he/him', points: 0 },
];

const mockTournament = {
  name: 'Pokemon Red Tournament 2025',
  currentRound: 'Round 2'
};

// Helper function to generate random timestamps
function getRandomTimestamp(daysFromNow = 0, hoursRange = 24) {
  const now = Date.now();
  const dayOffset = daysFromNow * 24 * 60 * 60 * 1000;
  const randomOffset = Math.random() * hoursRange * 60 * 60 * 1000;
  return Math.floor(now + dayOffset + randomOffset);
}

// Helper function to generate finish times
function generateFinishTime() {
  const baseMinutes = 140 + Math.random() * 60; // 140-200 minutes
  const hours = Math.floor(baseMinutes / 60);
  const minutes = Math.floor(baseMinutes % 60);
  const seconds = Math.floor(Math.random() * 60);
  const milliseconds = Math.floor(Math.random() * 1000);
  
  return { hours, minutes, seconds, milliseconds };
}

async function seedDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, {
      dbName: process.env.NODE_ENV === 'production' ? 'tournament' : 'redtournament'
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Tournament.deleteMany({}),
      Race.deleteMany({}),
      Group.deleteMany({}),
      Pickems.deleteMany({})
    ]);
    console.log('✅ Existing data cleared');

    // Create users
    console.log('👥 Creating users...');
    const createdUsers = await User.insertMany(mockUsers);
    console.log(`✅ Created ${createdUsers.length} users`);

    // Create tournament
    console.log('🏆 Creating tournament...');
    const tournament = await Tournament.create(mockTournament);
    console.log('✅ Tournament created');

    // Create groups for different rounds
    console.log('👥 Creating groups...');
    const runners = createdUsers.filter(user => user.role === 'runner');
    const groups = [];
    let groupCounter = 1;

    // Seeding groups (4 runners per group)
    for (let i = 0; i < Math.ceil(runners.length / 4); i++) {
      const groupMembers = runners.slice(i * 4, (i + 1) * 4).map(user => user._id);
      if (groupMembers.length > 0) {
        groups.push({
          groupNumber: groupCounter++,
          members: groupMembers,
          round: 'Seeding',
          bracket: 'Seeding',
          raceStartTime: getRandomTimestamp(-2, 8)
        });
      }
    }

    // Round 1 groups - continue incrementing group numbers globally
    for (let bracket of ['High', 'Middle', 'Low']) {
      const bracketRunners = runners.filter(user => user.currentBracket === bracket);
      for (let i = 0; i < Math.ceil(bracketRunners.length / 4); i++) {
        const groupMembers = bracketRunners.slice(i * 4, (i + 1) * 4).map(user => user._id);
        if (groupMembers.length > 0) {
          groups.push({
            groupNumber: groupCounter++,
            members: groupMembers,
            round: 'Round 1',
            bracket: bracket,
            raceStartTime: getRandomTimestamp(-1, 6)
          });
        }
      }
    }

    const createdGroups = await Group.insertMany(groups);
    console.log(`✅ Created ${createdGroups.length} groups`);

    // Update users with their current groups
    console.log('🔗 Assigning users to groups...');
    for (const group of createdGroups) {
      if (group.round === 'Round 1') {
        await User.updateMany(
          { _id: { $in: group.members } },
          { currentGroup: group._id }
        );
      }
    }

    // Create races
    console.log('🏁 Creating races...');
    const races = [];
    const commentators = createdUsers.filter(user => user.role === 'commentator');

    for (const group of createdGroups) {
      if (group.members.length >= 2) {
        const raceMembers = group.members.slice(0, 4); // Max 4 racers per race
        const raceCommentators = commentators.slice(0, 2).map(c => c._id);
        
        const race = {
          racer1: raceMembers[0],
          racer2: raceMembers[1],
          racer3: raceMembers[2] || null,
          racer4: raceMembers[3] || null,
          raceDateTime: group.raceStartTime,
          raceSubmitted: group.raceStartTime + (2 * 60 * 60 * 1000), // 2 hours later
          round: group.round,
          bracket: group.bracket === 'Seeding' ? null : group.bracket,
          commentators: raceCommentators,
          completed: Math.random() > 0.3, // 70% of races completed
          cancelled: false,
          restreamPlanned: Math.random() > 0.7, // 30% have restream planned
          restreamChannel: 'RedRaceTV',
          restreamer: createdUsers.find(u => u.isAdmin)?._id,
          results: [],
          winner: null
        };

        // Add results if race is completed
        if (race.completed) {
          const participants = raceMembers.filter(id => id);
          const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
          
          race.results = shuffledParticipants.map((racerId, index) => {
            const status = Math.random() > 0.9 ? 'DNF' : 'Finished'; // 10% DNF rate
            return {
              racer: racerId,
              status: status,
              finishTime: status === 'Finished' ? generateFinishTime() : { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 },
              dnfOrder: status === 'DNF' ? index + 1 : null
            };
          });

          // Set winner (first finisher)
          const finishedResults = race.results.filter(r => r.status === 'Finished');
          if (finishedResults.length > 0) {
            race.winner = finishedResults[0].racer;
          }
        }

        races.push(race);
      }
    }

    const createdRaces = await Race.insertMany(races);
    console.log(`✅ Created ${createdRaces.length} races`);

    // Create pickems for some users
    console.log('🎯 Creating pickems...');
    const pickemsData = [];
    const eligibleUsers = runners.slice(0, 8); // First 8 users make pickems

    for (const user of eligibleUsers) {
      const shuffledRunners = [...runners].sort(() => Math.random() - 0.5);
      
      const pickems = {
        userId: user._id,
        top9: shuffledRunners.slice(0, 9).map(r => r._id),
        overallWinner: shuffledRunners[Math.floor(Math.random() * 5)]._id, // Pick from top 5
        bestTimeWho: shuffledRunners[Math.floor(Math.random() * 3)]._id, // Pick from top 3
        closestTime: 8400000 + Math.random() * 1800000, // Around 2h 20min ± 30min in ms
        round1Picks: shuffledRunners.slice(0, 8).map(r => r._id),
        round2Picks: shuffledRunners.slice(0, 4).map(r => r._id),
        round3Picks: shuffledRunners.slice(0, 2).map(r => r._id),
        semiFinalsPicks: shuffledRunners.slice(0, 2).map(r => r._id),
        finalPick: shuffledRunners[0]._id,
        points: Math.floor(Math.random() * 50) + 10, // 10-60 points
        top9PointsAwarded: Math.random() > 0.5
      };

      pickemsData.push(pickems);
    }

    const createdPickems = await Pickems.insertMany(pickemsData);
    console.log(`✅ Created ${createdPickems.length} pickems entries`);

    console.log('\n🎉 Mock data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • ${createdUsers.length} users (${runners.length} runners, ${commentators.length} commentators)`);
    console.log(`   • 1 tournament`);
    console.log(`   • ${createdGroups.length} groups`);
    console.log(`   • ${createdRaces.length} races`);
    console.log(`   • ${createdPickems.length} pickems entries`);
    console.log('\n✨ Your application now has realistic sample data!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔐 Database connection closed');
  }
}

// Run the seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };