const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pickemsSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true , unique: true},
  
  top27: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  top9: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  
  overallWinner: { type: Schema.Types.ObjectId, ref: 'User' },
  
  bestTimeWho: { type: Schema.Types.ObjectId, ref: 'User' },
  
  closestTime: Number, // Closest time guess in milliseconds

  round1Picks: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  round2Picks: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  round3Picks: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  quarterFinalsPicks: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  semiFinalsPicks: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  finalPick: { type: Schema.Types.ObjectId, ref: 'User' },
  points: { type: Number, default: 0 },
  top27PointsAwarded: { type: Boolean, default: false },
  top9PointsAwarded: { type: Boolean, default: false }
});

module.exports = mongoose.model('Pickems', pickemsSchema);