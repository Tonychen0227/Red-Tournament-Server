const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    method: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: {
      type: String,
      required: true
    },
    requestData: {
      type: mongoose.Schema.Types.Mixed, // Any additional request data (e.g., body, query params)
    }
  });
  

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;