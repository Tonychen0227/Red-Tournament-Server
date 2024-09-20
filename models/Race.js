const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({

  raceTimeId: { type: String, unique: true, sparse: true },

  racer1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  racer2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  racer3: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  raceDateTime: { type: Number, required: true }, // Unix timestamp
  raceSubmitted: { type: Number, required: true }, // Unix timestamp

  round: { type: String, enum: ['Seeding', 'Round 1', 'Round 2', 'Round 3', 'Semifinals', 'Final'], required: true },
  bracket: { type: String, enum: ['High', 'Middle', 'Low', "Seeding"] }, // null for seeding?

  commentators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  completed: { type: Boolean, default: false },
  cancelled: { type: Boolean, default: false },
  
  results: [{
    racer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['Finished', 'DNF', 'DNS', 'DQ'], required: true },
    finishTime: {
      hours: { type: Number, default: 0 },
      minutes: { type: Number, default: 0 },
      seconds: { type: Number, default: 0 },
      milliseconds: { type: Number, default: 0 }
    }
  }],

  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});


const Race = mongoose.model('Race', raceSchema);

module.exports = Race;