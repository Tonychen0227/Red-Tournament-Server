const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({
  racer1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  racer2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  racer3: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  datetime: { type: Number, required: true }, // Unix timestamp

  results: [{
    racer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['Finished', 'DNF', 'DQ'], required: true },
    finishTime: {
        hours: { type: Number, default: 0 },
        minutes: { type: Number, default: 0 },
        seconds: { type: Number, default: 0 },
        milliseconds: { type: Number, default: 0 }
    }
  }],
  
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completed: { type: Boolean, default: false }
});

const Race = mongoose.model('Race', raceSchema);

module.exports = Race;
