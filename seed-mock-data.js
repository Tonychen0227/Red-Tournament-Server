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
const PastResults = require('./models/PastResults');

// Connect to MongoDB
const mongoUrl = process.env.NODE_ENV === 'production' 
  ? `mongodb+srv://liam:${process.env.MONGODB_PASSWORD}.7gth0.mongodb.net/?retryWrites=true&w=majority&appName=2024`
  : `mongodb://admin:${process.env.MONGODB_PASSWORD}@mongodb:27017/redtournament?authSource=admin`;

// Mock data arrays
const mockUsers = [
  // Runners - Playoffs bracket (top tier)
  { discordUsername: 'speedrunner1', displayName: 'Lightning Fast', role: 'runner', pronouns: 'he/him', currentBracket: 'Playoffs', points: 85, bestTournamentTimeMilliseconds: 9000000 }, // 2h 30m
  { discordUsername: 'pokemonmaster99', displayName: 'Pokemon Master', role: 'runner', pronouns: 'she/her', currentBracket: 'Playoffs', points: 82, bestTournamentTimeMilliseconds: 9180000 }, // 2h 33m
  { discordUsername: 'redversion_pro', displayName: 'Red Version Pro', role: 'runner', pronouns: 'they/them', currentBracket: 'Playoffs', points: 78, bestTournamentTimeMilliseconds: 9360000 }, // 2h 36m
  { discordUsername: 'elite4champion', displayName: 'Elite4 Champion', role: 'runner', pronouns: 'he/him', currentBracket: 'Playoffs', points: 75, bestTournamentTimeMilliseconds: 9540000 }, // 2h 39m
  { discordUsername: 'pikachupower', displayName: 'Pikachu Power', role: 'runner', pronouns: 'she/her', currentBracket: 'Playoffs', points: 73, bestTournamentTimeMilliseconds: 9720000 }, // 2h 42m
  
  // Normal bracket (mid tier)
  { discordUsername: 'gymleader_brock', displayName: 'Gym Leader Brock', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 68, bestTournamentTimeMilliseconds: 9900000 }, // 2h 45m
  { discordUsername: 'misty_water', displayName: 'Misty Water', role: 'runner', pronouns: 'she/her', currentBracket: 'Normal', points: 65, bestTournamentTimeMilliseconds: 10080000 }, // 2h 48m
  { discordUsername: 'lt_surge_electric', displayName: 'Lt. Surge Electric', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 62, bestTournamentTimeMilliseconds: 10260000 }, // 2h 51m
  { discordUsername: 'erika_grass', displayName: 'Erika Grass', role: 'runner', pronouns: 'she/her', currentBracket: 'Normal', points: 60, bestTournamentTimeMilliseconds: 10440000 }, // 2h 54m
  { discordUsername: 'koga_poison', displayName: 'Koga Poison', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 58, bestTournamentTimeMilliseconds: 10620000 }, // 2h 57m
  
  // Ascension bracket (lower tier)
  { discordUsername: 'sabrina_psychic', displayName: 'Sabrina Psychic', role: 'runner', pronouns: 'she/her', currentBracket: 'Ascension', points: 55, bestTournamentTimeMilliseconds: 10800000 }, // 3h 00m
  { discordUsername: 'blaine_fire', displayName: 'Blaine Fire', role: 'runner', pronouns: 'he/him', currentBracket: 'Ascension', points: 52, bestTournamentTimeMilliseconds: 10980000 }, // 3h 03m
  { discordUsername: 'giovanni_ground', displayName: 'Giovanni Ground', role: 'runner', pronouns: 'he/him', currentBracket: 'Ascension', points: 48, bestTournamentTimeMilliseconds: 11160000 }, // 3h 06m
  { discordUsername: 'team_rocket_member', displayName: 'Team Rocket Member', role: 'runner', pronouns: 'they/them', currentBracket: 'Ascension', points: 45, bestTournamentTimeMilliseconds: 11340000 }, // 3h 09m
  { discordUsername: 'youngster_joey', displayName: 'Youngster Joey', role: 'runner', pronouns: 'he/him', currentBracket: 'Ascension', points: 42, bestTournamentTimeMilliseconds: 11520000 }, // 3h 12m
  { discordUsername: 'bug_catcher_sam', displayName: 'Bug Catcher Sam', role: 'runner', pronouns: 'he/him', currentBracket: 'Ascension', points: 38, bestTournamentTimeMilliseconds: 11700000 }, // 3h 15m
  { discordUsername: 'lass_dana', displayName: 'Lass Dana', role: 'runner', pronouns: 'she/her', currentBracket: 'Ascension', points: 35, bestTournamentTimeMilliseconds: 11880000 }, // 3h 18m
  { discordUsername: 'fisherman_ned', displayName: 'Fisherman Ned', role: 'runner', pronouns: 'he/him', currentBracket: 'Ascension', points: 32, bestTournamentTimeMilliseconds: 12060000 }, // 3h 21m
  
  // Exhibition bracket (fun/special events)
  { discordUsername: 'veteran_trainer', displayName: 'Veteran Trainer', role: 'runner', pronouns: 'he/him', currentBracket: 'Exhibition', points: 28, bestTournamentTimeMilliseconds: 12240000 }, // 3h 24m
  { discordUsername: 'cooltrainer_anna', displayName: 'Cooltrainer Anna', role: 'runner', pronouns: 'she/her', currentBracket: 'Exhibition', points: 25, bestTournamentTimeMilliseconds: 12420000 }, // 3h 27m
  { discordUsername: 'hiker_anthony', displayName: 'Hiker Anthony', role: 'runner', pronouns: 'he/him', currentBracket: 'Exhibition', points: 22, bestTournamentTimeMilliseconds: 12600000 }, // 3h 30m
  { discordUsername: 'beauty_bridget', displayName: 'Beauty Bridget', role: 'runner', pronouns: 'she/her', currentBracket: 'Exhibition', points: 20, bestTournamentTimeMilliseconds: 12780000 }, // 3h 33m
  { discordUsername: 'sailor_dwayne', displayName: 'Sailor Dwayne', role: 'runner', pronouns: 'he/him', currentBracket: 'Exhibition', points: 18, bestTournamentTimeMilliseconds: 12960000 }, // 3h 36m
  { discordUsername: 'gentleman_tucker', displayName: 'Gentleman Tucker', role: 'runner', pronouns: 'he/him', currentBracket: 'Exhibition', points: 15, bestTournamentTimeMilliseconds: 13140000 }, // 3h 39m
  { discordUsername: 'super_nerd_miguel', displayName: 'Super Nerd Miguel', role: 'runner', pronouns: 'they/them', currentBracket: 'Exhibition', points: 12, bestTournamentTimeMilliseconds: 13320000 }, // 3h 42m
  { discordUsername: 'rocker_luca', displayName: 'Rocker Luca', role: 'runner', pronouns: 'he/him', currentBracket: 'Exhibition', points: 10, bestTournamentTimeMilliseconds: 13500000 }, // 3h 45m
  { discordUsername: 'juggler_kirk', displayName: 'Juggler Kirk', role: 'runner', pronouns: 'he/him', currentBracket: 'Exhibition', points: 8, bestTournamentTimeMilliseconds: 13680000 }, // 3h 48m
  
  // Commentators and Admins
  { discordUsername: 'professor_oak', displayName: 'Professor Oak', role: 'commentator', pronouns: 'he/him', isAdmin: true, points: 0, bestTournamentTimeMilliseconds: 0 },
  { discordUsername: 'pokemon_announcer', displayName: 'Pokemon Announcer', role: 'commentator', pronouns: 'they/them', points: 0, bestTournamentTimeMilliseconds: 0 },
  { discordUsername: 'red_expert', displayName: 'Red Expert', role: 'commentator', pronouns: 'she/her', points: 0, bestTournamentTimeMilliseconds: 0 },
  { discordUsername: 'speedrun_analyst', displayName: 'Speedrun Analyst', role: 'commentator', pronouns: 'he/him', points: 0, bestTournamentTimeMilliseconds: 0 },
];

const mockTournament = {
  name: 'Pokemon Red Tournament 2025',
  currentRound: 'Round 2'
};

// Mock past results data
const mockPastResults = [
  {
    tournamentYear: 2024,
    gold: { name: 'Lightning Fast', userId: null },
    silver: { name: 'Pokemon Master', userId: null },
    bronze: { name: 'Red Version Pro', userId: null },
    spotlightVideos: [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=jNQXAC9IVRw'
    ]
  },
  {
    tournamentYear: 2023,
    gold: { name: 'Elite4 Champion', userId: null },
    silver: { name: 'Pikachu Power', userId: null },
    bronze: { name: 'Gym Leader Brock', userId: null },
    spotlightVideos: [
      'https://www.youtube.com/watch?v=9bZkp7q19f0',
      'https://www.youtube.com/watch?v=1w7OgIMMRc4',
      'https://www.youtube.com/watch?v=GtUVQei3nX4'
    ]
  },
  {
    tournamentYear: 2022,
    gold: { name: 'Misty Water', userId: null },
    silver: { name: 'Lt. Surge Electric', userId: null },
    bronze: { name: 'Erika Grass', userId: null },
    spotlightVideos: [
      'https://www.youtube.com/watch?v=fJ9rUzIMcZQ'
    ]
  },
  {
    tournamentYear: 2021,
    gold: { name: 'Koga Poison', userId: null },
    silver: { name: 'Sabrina Psychic', userId: null },
    bronze: { name: 'Blaine Fire', userId: null },
    spotlightVideos: [
      'https://www.youtube.com/watch?v=ZZ5LpwO-An4',
      'https://www.youtube.com/watch?v=hFZFjoX2cGg'
    ]
  },
  {
    tournamentYear: 2020,
    gold: { name: 'Giovanni Ground', userId: null },
    silver: { name: 'Team Rocket Member', userId: null },
    bronze: { name: 'Youngster Joey', userId: null },
    spotlightVideos: [
      'https://www.youtube.com/watch?v=y6120QOlsfU',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=oHg5SJYRHA0'
    ]
  }
];

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
      Pickems.deleteMany({}),
      PastResults.deleteMany({})
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

    // Round 1 groups for each bracket
    for (let bracket of ['Playoffs', 'Normal', 'Ascension', 'Exhibition']) {
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

    // Round 2 groups - mix some runners from different brackets
    const topRunners = runners.slice(0, 12); // Top 12 runners advance to Round 2
    for (let i = 0; i < Math.ceil(topRunners.length / 4); i++) {
      const groupMembers = topRunners.slice(i * 4, (i + 1) * 4).map(user => user._id);
      if (groupMembers.length > 0) {
        groups.push({
          groupNumber: groupCounter++,
          members: groupMembers,
          round: 'Round 2',
          bracket: 'Normal', // Consolidate to Normal bracket for Round 2
          raceStartTime: getRandomTimestamp(0, 4)
        });
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
    let raceIdCounter = 1;

    for (const group of createdGroups) {
      if (group.members.length >= 2) {
        const raceMembers = group.members.slice(0, 4); // Max 4 racers per race
        const raceCommentators = commentators.slice(0, 2).map(c => c._id);
        
        const race = {
          raceTimeId: `RT2025-${String(raceIdCounter).padStart(3, '0')}`, // RT2025-001, RT2025-002, etc.
          racer1: raceMembers[0],
          racer2: raceMembers[1],
          racer3: raceMembers[2] || null,
          racer4: raceMembers[3] || null,
          raceDateTime: group.raceStartTime,
          raceSubmitted: group.raceStartTime + (2 * 60 * 60 * 1000), // 2 hours later
          round: group.round,
          bracket: group.bracket,
          commentators: raceCommentators,
          completed: Math.random() > 0.3, // 70% of races completed
          cancelled: false,
          restreamPlanned: Math.random() > 0.7, // 30% have restream planned
          restreamChannel: 'RedRaceTV',
          restreamer: createdUsers.find(u => u.isAdmin)?._id,
          results: [],
          winner: null
        };

        raceIdCounter++;

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
    const eligibleUsers = runners.slice(0, 12); // First 12 users make pickems

    for (const user of eligibleUsers) {
      const shuffledRunners = [...runners].sort(() => Math.random() - 0.5);
      
      const pickems = {
        userId: user._id,
        top27: shuffledRunners.slice(0, 27).map(r => r._id), // Top 27 instead of top9
        overallWinner: shuffledRunners[Math.floor(Math.random() * 5)]._id, // Pick from top 5
        bestTimeWho: shuffledRunners[Math.floor(Math.random() * 3)]._id, // Pick from top 3
        closestTime: 8400000 + Math.random() * 1800000, // Around 2h 20min ± 30min in ms
        round1Picks: shuffledRunners.slice(0, 16).map(r => r._id), // More picks for round 1
        round2Picks: shuffledRunners.slice(0, 8).map(r => r._id),
        round3Picks: shuffledRunners.slice(0, 4).map(r => r._id),
        quarterFinalsPicks: shuffledRunners.slice(0, 4).map(r => r._id), // Add quarterfinals picks
        semiFinalsPicks: shuffledRunners.slice(0, 2).map(r => r._id),
        finalPick: shuffledRunners[0]._id,
        points: Math.floor(Math.random() * 50) + 10, // 10-60 points
        top27PointsAwarded: Math.random() > 0.5 // Use top27PointsAwarded instead of top9
      };

      pickemsData.push(pickems);
    }

    const createdPickems = await Pickems.insertMany(pickemsData);
    console.log(`✅ Created ${createdPickems.length} pickems entries`);

    // Create past results
    console.log('🏆 Creating past results...');
    
    // First, try to match some existing users to past winners
    const pastResultsWithUserIds = mockPastResults.map(result => {
      const goldUser = createdUsers.find(user => user.displayName === result.gold.name);
      const silverUser = createdUsers.find(user => user.displayName === result.silver.name);
      const bronzeUser = createdUsers.find(user => user.displayName === result.bronze.name);
      
      return {
        ...result,
        gold: { 
          name: result.gold.name, 
          userId: goldUser ? goldUser._id : undefined 
        },
        silver: { 
          name: result.silver.name, 
          userId: silverUser ? silverUser._id : undefined 
        },
        bronze: { 
          name: result.bronze.name, 
          userId: bronzeUser ? bronzeUser._id : undefined 
        }
      };
    });

    const createdPastResults = await PastResults.insertMany(pastResultsWithUserIds);
    console.log(`✅ Created ${createdPastResults.length} past results entries`);

    console.log('\n🎉 Mock data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • ${createdUsers.length} users (${runners.length} runners, ${commentators.length} commentators)`);
    console.log(`   • 1 tournament`);
    console.log(`   • ${createdGroups.length} groups`);
    console.log(`   • ${createdRaces.length} races`);
    console.log(`   • ${createdPickems.length} pickems entries`);
    console.log(`   • ${createdPastResults.length} past results entries`);
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