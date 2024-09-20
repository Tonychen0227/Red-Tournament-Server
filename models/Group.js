const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    groupNumber: { type: Number, required: true, unique: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;
