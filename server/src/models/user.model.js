const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: false, unique: true, sparse: true },
    password: { type: String, required: false },
    phone: { type: String, default: '' },

    // Dynamic role reference — points to a Role document in the DB
    // Special string roles: 'centraladmin' (top-level), 'hospitaladmin' (hospital-level), 'superadmin' (legacy)
    role: {
        type: mongoose.Schema.Types.Mixed, // ObjectId (normal) or String ('centraladmin'/'hospitaladmin'/'superadmin')
        default: 'patient'
    },

    // Hospital reference for multi-tenant support
    // centraladmin: null (manages all hospitals)
    // hospitaladmin: points to their hospital
    // staff: points to the hospital they belong to
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null },

    // Patient ID for clinical tracking
    patientId: { type: String, unique: true, sparse: true },
    mrn: { type: String, unique: true, sparse: true },
    partnerPatientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    partnerRelation: { type: String, enum: ['Husband', 'Wife'], default: null },
    coupleId: { type: String, default: null, index: true },
    linkedAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },

    // Static Demographics
    dob: String,
    marriageDate: { type: String, default: null },
    gender: String,
    bloodGroup: String,
    houseNumber: { type: String, default: null },
    street: { type: String, default: null },
    address: String, // Kept for backwards compatibility
    city: String,
    state: { type: String, default: null },
    pincode: { type: String, default: null },

    // Identity Verification (KYC)
    aadhaarNumber: { type: String, unique: true, sparse: true, trim: true },
    isAadhaarVerified: { type: Boolean, default: false },

    // Clinical Profile
    patientType: { type: String, enum: ['Primary', 'Partner'], default: 'Primary' },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fertilityProfile: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Patient Source Information
    sourceInformation: {
        sourceType: { type: String, default: null },
        sourceName: { type: String, default: null },
        newspaperName: { type: String, default: null },
        campName: { type: String, default: null },
        campLocation: { type: String, default: null },
        reference: { type: String, default: null },
        referencePersonName: { type: String, default: null },
        doctorName: { type: String, default: null },
        hospitalName: { type: String, default: null },
        description: { type: String, default: null }
    },

    // Linked Patients — bidirectional family/relation links (e.g. husband ↔ wife)
    // Each entry stores the linked patient's User _id and a human-readable relation label.
    // The link is always kept symmetric: linking A→B automatically creates B→A.
    linkedPatients: [{
        patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        relationLabel: { type: String, trim: true, default: 'Related' },
    }],

    services: [String],
    departments: { type: [String], default: ['IVF'] },

    // Profile Image
    avatar: { type: String, default: null },

    // --- PATIENT CONSENT INFORMATION ---
    consents: [{
        consentName: { type: String, required: true },
        fileUrl: { type: String, default: null },
        fileType: { type: String, default: null },
        uploadedAt: { type: Date, default: Date.now }
    }],

    // --- NURSE & CLINICAL LOGS ---
    nursingNotes: { type: Array, default: [] },
    medicationLogs: { type: Array, default: [] },
    vitalsHistory: { type: Array, default: [] }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.comparePassword = async function (entered) {
    if (!this.password) return false;
    return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);