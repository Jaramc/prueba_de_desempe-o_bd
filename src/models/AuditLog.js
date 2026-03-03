const mongoose = require('mongoose');

// this schema stores a log every time a product gets deleted
// so we can audit what was removed and when
const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      default: 'DELETE',
    },
    entity: {
      type: String,
      default: 'product',
    },
    deleted_record: {
      type: Object, // stores the full product data that was deleted
      required: true,
    },
    performed_at: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'audit_logs' }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
