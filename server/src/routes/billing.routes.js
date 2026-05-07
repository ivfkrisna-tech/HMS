const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { resolveTenant } = require('../middleware/tenantMiddleware');
const { getTenantModels } = require('../db/tenantModels');

// Master fallbacks
const MasterUser = require('../models/user.model');
const MasterAppointment = require('../models/appointment.model');
const MasterLabReport = require('../models/labReport.model');
const MasterPharmacyOrder = require('../models/pharmacyOrder.model');
const MasterFacilityCharge = require('../models/facilityCharge.model');
const MasterAdmission = require('../models/admission.model');

// Billing access middleware — receptionist also gets billing view
const verifyBillingAccess = async (req, res, next) => {
    try {
        await verifyToken(req, res, async () => {
            const roleIdStr = String(req.user.role || '').toLowerCase();
            const roleData = req.user._roleData;
            const roleName = (roleData?.name || '').toLowerCase();
            const perms = roleData?.permissions || [];

            if (['cashier', 'accountant', 'reception', 'receptionist', 'centraladmin', 'superadmin', 'hospitaladmin'].includes(roleIdStr) ||
                ['cashier', 'accountant', 'reception', 'receptionist', 'centraladmin', 'superadmin', 'hospitaladmin'].includes(roleName) ||
                perms.includes('billing_view') || perms.includes('billing_manage') ||
                perms.includes('appointment_manage') || perms.includes('*')) {
                await resolveTenant(req, res, next);
            } else {
                return res.status(403).json({ success: false, message: 'Billing access required' });
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Helper: get models scoped to tenant or master
const getModels = (req) => {
    if (req.tenantDb) return getTenantModels(req.tenantDb);
    return {
        User: MasterUser,
        Appointment: MasterAppointment,
        LabReport: MasterLabReport,
        PharmacyOrder: MasterPharmacyOrder,
        FacilityCharge: MasterFacilityCharge,
        Admission: MasterAdmission,
    };
};

// Search patients for autocomplete dropdown
router.get('/search-patients', verifyBillingAccess, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json({ success: true, patients: [] });

        const regex = new RegExp(query, 'i');
        const patients = await MasterUser.find({
            $or: [
                { name: regex },
                { phone: regex },
                { mrn: regex },
                { patientId: regex }
            ]
        }).select('name phone mrn patientId dob gender').limit(10).lean();

        res.json({ success: true, patients });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 1. Search Patient & Fetch All Bills (pending + paid summary) — tenant-scoped
router.get('/patient/:identifier', verifyBillingAccess, async (req, res) => {
    try {
        const { identifier } = req.params;
        const { User, Appointment, LabReport, PharmacyOrder, FacilityCharge, Admission } = getModels(req);

        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
        
        const patient = await MasterUser.findOne({
            $or: [
                ...(isObjectId ? [{ _id: identifier }] : []),
                { mrn: identifier },
                { patientId: identifier },
                { phone: identifier },
                { name: { $regex: identifier, $options: 'i' } }
            ]
        });

        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

        // Return ALL records for every category — frontend splits paid vs pending by paymentStatus field
        const [appointments, labReports, pharmacyOrders, facilityCharges, admissions] = await Promise.all([
            Appointment.find({ $or: [{ userId: patient._id }, { patientId: patient._id }] })
                .select('appointmentDate appointmentTime amount paymentStatus paymentMode serviceName doctorName status createdAt')
                .sort({ appointmentDate: -1 }).lean(),
            LabReport.find({ $or: [{ userId: patient._id }, { patientId: patient._id }] })
                .select('testNames testName amount price paymentStatus paymentMode testStatus createdAt')
                .sort({ createdAt: -1 }).lean(),
            PharmacyOrder.find({ $or: [{ userId: patient._id }, { patientId: patient._id }] })
                .select('items totalAmount paymentStatus orderStatus createdAt')
                .sort({ createdAt: -1 }).lean(),
            FacilityCharge.find({ patientId: patient._id })
                .select('facilityName pricePerDay days totalAmount paymentStatus createdAt')
                .sort({ createdAt: -1 }).lean(),
            Admission.find({ patientId: patient._id })
                .sort({ admissionDate: -1 }).lean(),
        ]);

        res.json({
            success: true,
            patient: {
                _id: patient._id,
                name: patient.name,
                mrn: patient.mrn,
                patientId: patient.patientId,
                phone: patient.phone,
                gender: patient.gender,
                dob: patient.dob,
                avatar: patient.avatar || null,
            },
            billing: { appointments, labReports, pharmacyOrders, facilityCharges, admissions }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 1.5 Search Patients for Dropdown — tenant-scoped
router.get('/search-patients', verifyBillingAccess, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) return res.json({ success: true, patients: [] });

        // Use MasterUser for searching across all patients
        const patients = await MasterUser.find({
            role: 'patient',
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } },
                { mrn: { $regex: query, $options: 'i' } },
                { patientId: { $regex: query, $options: 'i' } }
            ]
        }).select('name phone mrn patientId email dob').limit(10).lean();

        res.json({ success: true, patients });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. Add Facility Charge — saves to tenant DB
router.post('/facility-charge', verifyBillingAccess, async (req, res) => {
    try {
        const { patientId, facilityName, pricePerDay, days } = req.body;
        if (!patientId || !facilityName || !pricePerDay || !days) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const { FacilityCharge } = getModels(req);
        const charge = new FacilityCharge({
            hospitalId: req.hospitalId || req.user.hospitalId,
            patientId,
            facilityName,
            pricePerDay: Number(pricePerDay),
            days: Number(days),
            totalAmount: Number(pricePerDay) * Number(days),
            addedBy: req.user._id || req.user.userId
        });

        await charge.save();
        res.status(201).json({ success: true, message: 'Facility charge added', charge });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. Mark items as paid — updates tenant DB
router.put('/pay', verifyBillingAccess, async (req, res) => {
    try {
        const {
            appointmentIds = [],
            labReportIds = [],
            pharmacyOrderIds = [],
            facilityChargeIds = [],
            admissionIds = [],
            paymentMode = 'Cash'
        } = req.body;

        const { Appointment, LabReport, PharmacyOrder, FacilityCharge, Admission } = getModels(req);

        await Promise.all([
            appointmentIds.length > 0 && Appointment.updateMany(
                { _id: { $in: appointmentIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            labReportIds.length > 0 && LabReport.updateMany(
                { _id: { $in: labReportIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            pharmacyOrderIds.length > 0 && PharmacyOrder.updateMany(
                { _id: { $in: pharmacyOrderIds } }, { $set: { paymentStatus: 'Paid' } }),
            facilityChargeIds.length > 0 && FacilityCharge.updateMany(
                { _id: { $in: facilityChargeIds } }, { $set: { paymentStatus: 'Paid' } }),
            admissionIds.length > 0 && Admission.updateMany(
                { _id: { $in: admissionIds } }, { $set: { paymentStatus: 'Paid' } }),
        ].filter(Boolean));

        res.json({ success: true, message: 'Billing settled successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
