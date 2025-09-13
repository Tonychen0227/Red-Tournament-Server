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

    await Promise.all([
      User.find({}).then(function (users) {
        console.log(users);
      }),
      Tournament.find({}).then(function (users) {
        console.log(users);
      }),
      Race.find({}).then(function (users) {
        console.log(users);
      }),
      Group.find({}).then(function (users) {
        console.log(users);
      }),
      Pickems.find({}).then(function (users) {
        console.log(users);
      }),
    ]);
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