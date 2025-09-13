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
  { discordUsername: 'speedrunner1', displayName: 'speedrunner1', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner2', displayName: 'speedrunner2', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner3', displayName: 'speedrunner3', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner4', displayName: 'speedrunner4', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner5', displayName: 'speedrunner5', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner6', displayName: 'speedrunner6', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner7', displayName: 'speedrunner7', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner8', displayName: 'speedrunner8', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner9', displayName: 'speedrunner9', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner10', displayName: 'speedrunner10', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner11', displayName: 'speedrunner11', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner12', displayName: 'speedrunner12', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner13', displayName: 'speedrunner13', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner14', displayName: 'speedrunner14', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner15', displayName: 'speedrunner15', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner16', displayName: 'speedrunner16', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner17', displayName: 'speedrunner17', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner18', displayName: 'speedrunner18', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner19', displayName: 'speedrunner19', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner20', displayName: 'speedrunner20', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner21', displayName: 'speedrunner21', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner22', displayName: 'speedrunner22', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner23', displayName: 'speedrunner23', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner24', displayName: 'speedrunner24', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner25', displayName: 'speedrunner25', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner26', displayName: 'speedrunner26', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner27', displayName: 'speedrunner27', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner28', displayName: 'speedrunner28', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner29', displayName: 'speedrunner29', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner30', displayName: 'speedrunner30', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner31', displayName: 'speedrunner31', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner32', displayName: 'speedrunner32', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner33', displayName: 'speedrunner33', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner34', displayName: 'speedrunner34', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner35', displayName: 'speedrunner35', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner36', displayName: 'speedrunner36', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner37', displayName: 'speedrunner37', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner38', displayName: 'speedrunner38', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner39', displayName: 'speedrunner39', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner40', displayName: 'speedrunner40', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner41', displayName: 'speedrunner41', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner42', displayName: 'speedrunner42', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner43', displayName: 'speedrunner43', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  { discordUsername: 'speedrunner44', displayName: 'speedrunner44', role: 'runner', pronouns: 'he/him', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 9000000 },
  
  // Commentators and Admins
  { discordUsername: 'slayerlol99', displayName: 'slayerlol99', role: 'runner', pronouns: 'they/them', currentBracket: 'Normal', points: 0, bestTournamentTimeMilliseconds: 0, isAdmin: true },
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

    await Promise.all([
      User.find({}).then(function (users) {
        console.log("USERS");
        console.log(users);
      }),
      Tournament.find({}).then(function (tourn) {
        console.log("TOURNAMENT");
        console.log(tourn);
      }),
      Race.find({}).then(function (races) {
        console.log("RACE");
        console.log(races);
      }),
      Group.find({}).then(function (group) {
        console.log("GROUP");
        console.log(group);
      }),
      Pickems.find({}).then(function (pickems) {
        console.log("Pickems");
        console.log(pickems);
      }),
    ]);

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