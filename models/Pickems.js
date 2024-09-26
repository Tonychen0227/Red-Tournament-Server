const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pickemsSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  top9: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs (User references)
  
  overallWinner: { type: Schema.Types.ObjectId, ref: 'User' }, // User ID (User reference)
  
  bestTimeWho: { type: Schema.Types.ObjectId, ref: 'User' }, // User ID (User reference)
  
  closestTime: Number, // Closest time guess in milliseconds

  round1Picks: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs (User references)
  round2Picks: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs (User references)
  round3Picks: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs (User references)
  round4Picks: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs (User references)

  semiFinalsPicks: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs (User references)

  points: { type: Number, default: 0 }, // Total points for this user
});

module.exports = mongoose.model('Pickems', pickemsSchema);