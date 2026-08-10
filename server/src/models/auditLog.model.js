const mongoose = require('mongoose');

/**
 * AuditLog — every sensitive action on patient data is recorded here.
 * Works on both cloud and local deployments.
 * Never purge — retain for compliance (DPDP Act India).
 */
const auditLogSchema = new mongoose.Schema({
    clinicId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName:   { type: String, default: 'System' },
    role:       { type: String, default: '' },

    // What happened
    action: {
        type: String,
        required: true,
    },

    // What it targeted
    targetModel: { type: String, default: '' },  // 'ClinicPatient', 'Appointment', etc.
    targetId:    { type: mongoose.Schema.Types.ObjectId, default: null },
    targetLabel: { type: String, default: '' },  // e.g. patient name (for readability in audit UI)
    
    // Field-level changes (added for Phase 4)
    field: { type: String, default: '' },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },

    // Request context
    ip:        { type: String, default: '' },
    userAgent: { type: String, default: '' },
    success:   { type: Boolean, default: true },
    reason:    { type: String, default: '' },    // if success=false, why
}, { timestamps: true });

// Query by clinic + date range for audit reports
auditLogSchema.index({ clinicId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
