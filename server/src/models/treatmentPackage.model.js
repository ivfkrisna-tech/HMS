const mongoose = require('mongoose');

const treatmentPackageSchema = new mongoose.Schema({
    hospitalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mrn: { type: String, default: '' },
    coupleId: { type: String, default: '' },
    packageName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    selectedServices: [{
        serviceId: { type: mongoose.Schema.Types.ObjectId },
        serviceName: { type: String },
        price: { type: Number }
    }],
    originalAmount: { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true, default: 0 },
    startDate: { type: String, default: '' },
    totalDuration: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Completed', 'Cancelled'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Future ready extensible structure
    medicines: [{ type: mongoose.Schema.Types.Mixed }],
    labTests: [{ type: mongoose.Schema.Types.Mixed }],
    procedures: [{ type: mongoose.Schema.Types.Mixed }],
    injections: [{ type: mongoose.Schema.Types.Mixed }]
}, { timestamps: true });

module.exports = mongoose.model('TreatmentPackage', treatmentPackageSchema);
