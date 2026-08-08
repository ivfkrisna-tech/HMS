const mongoose = require('mongoose');

const consentTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Consent template name is required'],
        trim: true,
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ConsentCategory',
        required: [true, 'Category is required'],
    },
    description: {
        type: String,
        default: '',
        trim: true,
    },
    // Original uploaded file info
    originalFileName: {
        type: String,
        required: true,
    },
    storedFilePath: {
        type: String,
        required: true,
    },
    fileSize: {
        type: Number,
        default: 0,
    },
    mimeType: {
        type: String,
        default: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    // Status
    isActive: {
        type: Boolean,
        default: true,
    },
    // Who uploaded
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    // ── Future-Ready Fields ──────────────────────────────────────────────────
    // Version tracking for future template revisions
    version: {
        type: Number,
        default: 1,
    },
    // Pre-defined placeholders that can be auto-filled in Phase 2
    // e.g. ['patient_name', 'age', 'gender', 'address', 'doctor_name', 'hospital_name', 'today', 'current_time']
    placeholders: {
        type: [String],
        default: [],
    },
    // Extensible metadata for future requirements (e.g. language, hospital-specific overrides)
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });

// Index for efficient queries
consentTemplateSchema.index({ categoryId: 1 });
consentTemplateSchema.index({ isActive: 1 });
consentTemplateSchema.index({ name: 'text' });

module.exports = mongoose.model('ConsentTemplate', consentTemplateSchema);
