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
  { discordUsername: 'slayerlol99', displayName: 'Pokemon Announcer', role: 'runner', pronouns: 'they/them', points: 0, bestTournamentTimeMilliseconds: 0, isAdmin: true },
  { discordUsername: 'pokemon_announcer', displayName: 'Pokemon Announcer', role: 'commentator', pronouns: 'they/them', points: 0, bestTournamentTimeMilliseconds: 0 },
  { discordUsername: 'red_expert', displayName: 'Red Expert', role: 'commentator', pronouns: 'she/her', points: 0, bestTournamentTimeMilliseconds: 0 },
  { discordUsername: 'speedrun_analyst', displayName: 'Speedrun Analyst', role: 'commentator', pronouns: 'he/him', points: 0, bestTournamentTimeMilliseconds: 0 },
];

const mockTournament = {
  name: 'red2025',
  currentRound: 'Round 1'
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
    await Tournament.create(mockTournament);
    console.log('✅ Tournament created');
    console.log('\n🎉 Mock data seeding completed successfully!');
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