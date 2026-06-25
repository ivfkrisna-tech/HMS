const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
    hospitalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sourceType: { type: String, enum: ['B2B', 'B2C'], required: true },
    sourceName: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Source', sourceSchema);
