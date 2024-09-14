const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordUsername: { type: String, required: true, unique: true },
    displayName: { type: String },
    role: { type: String, enum: ['runner', 'commentator'], required: true },
    isAdmin: { type: Boolean, default: false },
    timezone: { type: String, default: null } 
});

const User = mongoose.model('User', userSchema);

module.exports = User;