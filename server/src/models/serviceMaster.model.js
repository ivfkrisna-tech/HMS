const mongoose = require('mongoose');

const serviceMasterSchema = new mongoose.Schema({
    hospitalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    serviceName: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('ServiceMaster', serviceMasterSchema);
