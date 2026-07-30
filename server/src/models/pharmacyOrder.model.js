const mongoose = require('mongoose');

const pharmacyOrderSchema = new mongoose.Schema({
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
    },
    patientId: { type: String, required: true },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        index: true
    },
    items: [{
        medicineName: String,
        frequency: String,
        duration: String,
        volumeMl: { type: String, default: '' },
        administrationTime: { type: String, default: '' },
        gapDays: { type: Number, default: 0 },
        startDate: { type: Date, default: null },
        mixId: { type: String },
        mixName: { type: String },
        price: { type: Number, default: 0 },
        purchased: { type: Boolean, default: false },
        quantity: { type: Number, default: 0 },
        returnedQty: { type: Number, default: 0 },
        scheduleText: { type: String, default: '' },
        dosePerAdmin: { type: Number, default: 1 },
        doseAdmin: { type: Number, default: 1 },
        dose: { type: String },
        qtyPerDose: { type: Number, default: 0 },
        days: { type: Number, default: 1 },
        totalDosageRequired: { type: Number, default: 0 }
    }],
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'PAID_BY_DOCTOR'],
        default: 'Pending'
    },
    paymentMode: { type: String },
    authorizedByDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorizedDoctorName: { type: String },
    authorizationNote: { type: String },
    totalAmount: {
        type: Number,
        default: 0
    },
    taxableAmount: {
        type: Number,
        default: 0
    },
    cgstAmount: {
        type: Number,
        default: 0
    },
    sgstAmount: {
        type: Number,
        default: 0
    },
    totalCost: {
        type: Number,
        default: 0
    },
    orderStatus: {
        type: String,
        enum: ['Upcoming', 'Completed', 'Cancelled'],
        default: 'Upcoming'
    },
    returnStatus: {
        type: String,
        enum: ['NONE', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'],
        default: 'NONE'
    }
}, { timestamps: true });

module.exports = mongoose.model('PharmacyOrder', pharmacyOrderSchema); //sdf//