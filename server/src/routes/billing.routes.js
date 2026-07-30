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
const MasterTreatmentPackage = require('../models/treatmentPackage.model');

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
        TreatmentPackage: MasterTreatmentPackage,
    };
};

// Search patients for autocomplete dropdown
router.get('/search-patients', verifyBillingAccess, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json({ success: true, patients: [] });

        const regex = new RegExp(query, 'i');
        const searchFilter = {
            $or: [
                { name: regex },
                { phone: regex },
                { mrn: regex },
                { patientId: regex }
            ]
        };

        let patients = await MasterUser.find(searchFilter)
            .select('name phone mrn patientId dob gender').limit(10).lean();

        // Also search tenant DB if results are sparse
        if (patients.length < 10 && req.tenantDb) {
            const { User: TenantUser } = getModels(req);
            const tenantPatients = await TenantUser.find(searchFilter)
                .select('name phone mrn patientId dob gender').limit(10 - patients.length).lean();
            // Merge, avoiding duplicates by _id
            const existingIds = new Set(patients.map(p => String(p._id)));
            for (const p of tenantPatients) {
                if (!existingIds.has(String(p._id))) patients.push(p);
            }
        }

        res.json({ success: true, patients });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 1. Search Patient & Fetch All Bills (pending + paid summary) — tenant-scoped
router.get('/patient/:identifier', verifyBillingAccess, async (req, res) => {
    try {
        const { identifier } = req.params;
        const { User, Appointment, LabReport, PharmacyOrder, FacilityCharge, Admission, TreatmentPackage } = getModels(req);

        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
        
        const searchQuery = {
            $or: [
                ...(isObjectId ? [{ _id: identifier }] : []),
                { mrn: identifier },
                { patientId: identifier },
                { phone: identifier },
                { name: { $regex: identifier, $options: 'i' } }
            ]
        };
        
        const roleIdStr = String(req.user.role || '').toLowerCase();
        const roleName = String(req.user._roleData?.name || '').toLowerCase();
        if (req.user.hospitalId && !['centraladmin', 'superadmin'].includes(roleIdStr) && !['centraladmin', 'superadmin'].includes(roleName)) {
            searchQuery.hospitalId = req.user.hospitalId;
        }

        let patient = await MasterUser.findOne(searchQuery);

        // If not found in master DB, try tenant DB (patients registered per-hospital)
        if (!patient && req.tenantDb) {
            const { User: TenantUser } = getModels(req);
            patient = await TenantUser.findOne(searchQuery);
        }

        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });        const baseQuery = { 
            $or: [
                { patientId: patient._id }, 
                { userId: patient._id },
                { patient: patient._id },
                ...(patient.mrn ? [{ mrn: patient.mrn }] : []),
                ...(patient.uhid ? [{ uhid: patient.uhid }] : [])
            ]
        };

        const patientSearchQuery = (req.user.hospitalId && !['centraladmin', 'superadmin'].includes(roleIdStr) && !['centraladmin', 'superadmin'].includes(roleName))
            ? { $and: [baseQuery, { $or: [{ hospitalId: req.user.hospitalId }, { hospitalId: { $exists: false } }, { hospitalId: null }] }] }
            : baseQuery;

        console.log(`Unified Patient Search Query:`, JSON.stringify(patientSearchQuery, null, 2));

        // 1. Fetch from Tenant Database
        const [tenantAppointments, tenantLabReports, tenantPharmacyOrders, tenantFacilityCharges, tenantAdmissions, tenantPackages] = req.tenantDb ? await Promise.all([
            Appointment.find(patientSearchQuery)
                .select('appointmentDate appointmentTime amount paymentStatus paymentMode serviceName doctorName status createdAt')
                .sort({ appointmentDate: -1 }).lean(),
            LabReport.find(patientSearchQuery)
                .select('testNames testName amount price paymentStatus paymentMode testStatus createdAt')
                .sort({ createdAt: -1 }).lean(),
            PharmacyOrder.find(patientSearchQuery)
                .select('items totalAmount paymentStatus orderStatus createdAt')
                .sort({ createdAt: -1 }).lean(),
            FacilityCharge.find(patientSearchQuery)
                .select('facilityName pricePerDay days totalAmount paymentStatus createdAt')
                .sort({ createdAt: -1 }).lean(),
            Admission.find(patientSearchQuery)
                .sort({ admissionDate: -1 }).lean(),
            TreatmentPackage.find(patientSearchQuery).sort({ createdAt: -1 }).lean()
        ]) : [[], [], [], [], [], []];

        // 2. Fetch from Master Database (for legacy records)
        const [masterAppointments, masterLabReports, masterPharmacyOrders, masterFacilityCharges, masterAdmissions, masterPackages] = await Promise.all([
            MasterAppointment.find(patientSearchQuery)
                .select('appointmentDate appointmentTime amount paymentStatus paymentMode serviceName doctorName status createdAt')
                .sort({ appointmentDate: -1 }).lean(),
            MasterLabReport.find(patientSearchQuery)
                .select('testNames testName amount price paymentStatus paymentMode testStatus createdAt')
                .sort({ createdAt: -1 }).lean(),
            MasterPharmacyOrder.find(patientSearchQuery)
                .select('items totalAmount paymentStatus orderStatus createdAt')
                .sort({ createdAt: -1 }).lean(),
            MasterFacilityCharge.find(patientSearchQuery)
                .select('facilityName pricePerDay days totalAmount paymentStatus createdAt')
                .sort({ createdAt: -1 }).lean(),
            MasterAdmission.find(patientSearchQuery)
                .sort({ admissionDate: -1 }).lean(),
            MasterTreatmentPackage.find(patientSearchQuery).sort({ createdAt: -1 }).lean()
        ]);

        // Merge helper to prevent duplicates
        const mergeDocs = (arr1, arr2) => {
            const map = new Map();
            [...(arr1 || []), ...(arr2 || [])].forEach(doc => map.set(String(doc._id), doc));
            return Array.from(map.values());
        };

        const appointments = mergeDocs(tenantAppointments, masterAppointments).sort((a, b) => new Date(b.createdAt || b.appointmentDate) - new Date(a.createdAt || a.appointmentDate));
        const labReports = mergeDocs(tenantLabReports, masterLabReports).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const pharmacyOrders = mergeDocs(tenantPharmacyOrders, masterPharmacyOrders).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const facilityCharges = mergeDocs(tenantFacilityCharges, masterFacilityCharges).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const admissions = mergeDocs(tenantAdmissions, masterAdmissions).sort((a, b) => new Date(b.admissionDate) - new Date(a.admissionDate));
        const packages = mergeDocs(tenantPackages, masterPackages).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log(`Raw Admissions Results (${admissions.length} found):`, JSON.stringify(admissions, null, 2));
        
        const payload = {
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
            billing: { appointments, labReports, pharmacyOrders, facilityCharges, admissions, packages }
        };
        console.log(`Final Response Keys:`, Object.keys(payload));
        console.log(`Billing Payload Keys:`, Object.keys(payload.billing));
        
        res.json(payload);

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

        const FacilityCharge = MasterFacilityCharge;
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
            packageIds = [],
            paymentMode = 'Cash'
        } = req.body;

        const { Appointment, LabReport, PharmacyOrder, FacilityCharge, Admission, TreatmentPackage } = getModels(req);

        await Promise.all([
            appointmentIds.length > 0 && Appointment.updateMany({ _id: { $in: appointmentIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            appointmentIds.length > 0 && MasterAppointment.updateMany({ _id: { $in: appointmentIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            
            labReportIds.length > 0 && LabReport.updateMany({ _id: { $in: labReportIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            labReportIds.length > 0 && MasterLabReport.updateMany({ _id: { $in: labReportIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            
            pharmacyOrderIds.length > 0 && PharmacyOrder.updateMany({ _id: { $in: pharmacyOrderIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            pharmacyOrderIds.length > 0 && MasterPharmacyOrder.updateMany({ _id: { $in: pharmacyOrderIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            
            facilityChargeIds.length > 0 && FacilityCharge.updateMany({ _id: { $in: facilityChargeIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            facilityChargeIds.length > 0 && MasterFacilityCharge.updateMany({ _id: { $in: facilityChargeIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            
            admissionIds.length > 0 && Admission.updateMany({ _id: { $in: admissionIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            admissionIds.length > 0 && MasterAdmission.updateMany({ _id: { $in: admissionIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            
            packageIds.length > 0 && TreatmentPackage.updateMany({ _id: { $in: packageIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            packageIds.length > 0 && MasterTreatmentPackage.updateMany({ _id: { $in: packageIds } }, { $set: { paymentStatus: 'Paid', paymentMode } })
        ].filter(Boolean));

        res.json({ success: true, message: 'Billing settled successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
