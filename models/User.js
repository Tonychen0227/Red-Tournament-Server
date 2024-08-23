const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordUsername: { type: String, required: true, unique: true },
    role: { type: String, enum: ['runner', 'commentator'], required: true },
    isAdmin: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

module.exports = User;