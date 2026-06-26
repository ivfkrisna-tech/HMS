/**
 * tenantModels.js — Returns Mongoose models bound to a specific tenant DB connection.
 *
 * Why this is needed:
 *   Normal Mongoose models (e.g. require('../models/user.model')) are always
 *   bound to the DEFAULT connection (master DB). For tenant data, we need
 *   the same schemas but bound to the TENANT connection.
 *
 * Usage in a route:
 *   const { User, Appointment } = getTenantModels(req.tenantDb);
 *   const patients = await User.find({ hospitalId: req.hospitalId });
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── Schema Definitions (reusable, not bound to any connection) ───────────────

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: false, unique: true, sparse: true },
    password: { type: String, required: false },
    phone: { type: String, default: '' },
    role: { type: mongoose.Schema.Types.Mixed, default: 'patient' },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, default: null },
    patientId: { type: String, unique: true, sparse: true },
    dob: String,
    gender: String,
    bloodGroup: String,
    address: String,
    city: String,
    mrn: { type: String, unique: true, sparse: true },
    partnerPatientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    partnerRelation: { type: String, enum: ['Husband', 'Wife'], default: null },
    coupleId: { type: String, default: null, index: true },
    linkedAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    aadhaarNumber: { type: String, unique: true, sparse: true, trim: true },
    isAadhaarVerified: { type: Boolean, default: false },
    patientType: { type: String, enum: ['Primary', 'Partner'], default: 'Primary' },
    departments: [{ type: String }],
    avatar: { type: String, default: null },
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
    }
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

const appointmentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hospitalId: { type: mongoose.Schema.Types.ObjectId },
    date: Date,
    time: String,
    appointmentDate: Date,
    appointmentTime: { type: String, default: '' },
    tokenNumber: { type: Number, default: null },
    status: { type: String, default: 'Scheduled' },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Waived'], default: 'Pending' },
    fee: { type: Number, default: 0 },
    type: String,
    notes: String,
    department: String,
    doctorName: String,
    serviceName: String,
    amount: { type: Number, default: 0 },
    bookedBy: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

const labReportSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    testName: String,
    status: { type: String, default: 'Pending' },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Waived'], default: 'Pending' },
    price: { type: Number, default: 0 },
    results: mongoose.Schema.Types.Mixed,
    hospitalId: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

const pharmacyOrderSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [{ name: String, qty: Number, price: Number }],
    totalAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Waived'], default: 'Pending' },
    hospitalId: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

const facilityChargeSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    facilityName: { type: String, required: true },
    pricePerDay: { type: Number, required: true },
    daysUsed: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Waived'], default: 'Pending' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hospitalId: { type: mongoose.Schema.Types.ObjectId },
    notes: String,
}, { timestamps: true });

const roleSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    permissions: [String],
    dashboardPath: { type: String, default: '/my-dashboard' },
    navLinks: [{ label: String, path: String }],
    hospitalId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isSystemRole: { type: Boolean, default: false },
}, { timestamps: true });

const admissionSchema = new mongoose.Schema({
    hospitalId: { type: mongoose.Schema.Types.ObjectId },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId },
    admittedBy: { type: mongoose.Schema.Types.ObjectId },
    admissionDate: { type: Date, default: Date.now },
    dischargeDate: Date,
    status: { type: String, enum: ['Admitted', 'Discharged'], default: 'Admitted' },
    ward: String,
    bedNumber: String,
    selectedFacilities: [{
        facilityName: String,
        pricePerDay: Number,
        days: Number,
        totalAmount: Number
    }],
    totalAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    notes: String,
}, { timestamps: true });

const sourceSchema = new mongoose.Schema({
    hospitalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sourceType: { type: String, enum: ['B2B', 'B2C'], required: true },
    sourceName: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const serviceMasterSchema = new mongoose.Schema({
    hospitalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    serviceName: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

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

const sharedReportNoteSchema = new mongoose.Schema({
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', index: true },
    patientId: { type: String, required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabReport', required: true, unique: true },
    notes: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
    updatedRole: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ─── Model Factory ────────────────────────────────────────────────────────────

/**
 * Returns all Mongoose models bound to the given tenant connection.
 * Models are cached on the connection object itself to avoid re-registering.
 *
 * @param {mongoose.Connection} tenantDb
 * @returns {{ User, Appointment, LabReport, PharmacyOrder, FacilityCharge, Role }}
 */
function getTenantModels(tenantDb) {
    if (!tenantDb) {
        throw new Error('tenantDb connection is required for getTenantModels()');
    }

    // Helper: register model once per connection
    const model = (name, schema) => {
        try {
            return tenantDb.model(name);
        } catch {
            return tenantDb.model(name, schema);
        }
    };

    return {
        User: model('User', userSchema),
        Appointment: model('Appointment', appointmentSchema),
        LabReport: model('LabReport', labReportSchema),
        PharmacyOrder: model('PharmacyOrder', pharmacyOrderSchema),
        FacilityCharge: model('FacilityCharge', facilityChargeSchema),
        Role: model('Role', roleSchema),
        Admission: model('Admission', admissionSchema),
        Source: model('Source', sourceSchema),
        ServiceMaster: model('ServiceMaster', serviceMasterSchema),
        TreatmentPackage: model('TreatmentPackage', treatmentPackageSchema),
        SharedReportNote: model('SharedReportNote', sharedReportNoteSchema),
    };
}

module.exports = { getTenantModels };
