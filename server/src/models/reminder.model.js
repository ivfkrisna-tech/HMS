const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        required: true,
        index: true
    },
    patientId: {
        type: String, // Or ObjectId, depending on how it's saved. Using String to accommodate MRN/string IDs.
        required: true
    },
    patientName: {
        type: String,
        required: true
    },
    phone: {
        type: String
    },
    reminderDate: {
        type: Date,
        required: true,
        index: true
    },
    note: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending',
        index: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Reminder', reminderSchema);
