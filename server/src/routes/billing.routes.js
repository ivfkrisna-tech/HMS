const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth.middleware');
const { resolveTenant } = require('../middleware/tenantMiddleware');
const { getTenantModels } = require('../db/tenantModels');

// Master fallbacks & Models
const MasterUser = require('../models/user.model');
const MasterAppointment = require('../models/appointment.model');
const MasterLabReport = require('../models/labReport.model');
const MasterPharmacyOrder = require('../models/pharmacyOrder.model');
const MasterFacilityCharge = require('../models/facilityCharge.model');
const MasterAdmission = require('../models/admission.model');
const MasterTreatmentPackage = require('../models/treatmentPackage.model');
const LabTest = require('../models/labTest.model');

// Dynamic Age Extraction (Safe null-checks for all age/DOB formats)
const getPatientAge = (patient) => {
    if (!patient) return 'N/A';

    // 1. Direct or nested age fields check
    const rawAge = patient.age 
                ?? patient.ageYears 
                ?? patient.age_years 
                ?? patient.patientDetails?.age 
                ?? patient.patientDetails?.ageYears 
                ?? patient.kyc?.age;

    if (rawAge !== undefined && rawAge !== null && rawAge !== '' && rawAge !== 'N/A') {
        const parsed = parseInt(String(rawAge).replace(/\D/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    // 2. Direct or nested DOB fields check
    const dobVal = patient.dob 
                || patient.dateOfBirth 
                || patient.date_of_birth 
                || patient.patientDetails?.dob 
                || patient.patientDetails?.dateOfBirth 
                || patient.fertilityProfile?.dob
                || patient.kyc?.dob;

    if (!dobVal) return 'N/A';

    let birthDate;
    if (dobVal instanceof Date) {
        birthDate = dobVal;
    } else if (typeof dobVal === 'string') {
        if (dobVal.includes('/')) {
            const parts = dobVal.split('/');
            if (parts[2]?.length === 4) birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
            else if (parts[0]?.length === 4) birthDate = new Date(parts[0], parts[1] - 1, parts[2]);
        } else if (dobVal.includes('-')) {
            const parts = dobVal.split('-');
            if (parts[0]?.length === 4) birthDate = new Date(parts[0], parts[1] - 1, parts[2]);
            else if (parts[2]?.length === 4) birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
        }
        if (!birthDate || isNaN(birthDate.getTime())) {
            birthDate = new Date(dobVal);
        }
    }

    if (birthDate && !isNaN(birthDate.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 0 ? age : 'N/A';
    }

    return 'N/A';
};

// Billing access middleware
const verifyBillingAccess = async (req, res, next) => {
    try {
        await verifyToken(req, res, async () => {
            const roleIdStr = String(req.user.role || '').toLowerCase();
            const roleData = req.user._roleData;
            const roleName = (roleData?.name || '').toLowerCase();
            const perms = roleData?.permissions || [];

            if (['cashier', 'accountant', 'reception', 'receptionist', 'centraladmin', 'superadmin', 'hospitaladmin', 'pharmacy', 'pharmacist'].includes(roleIdStr) ||
                ['cashier', 'accountant', 'reception', 'receptionist', 'centraladmin', 'superadmin', 'hospitaladmin', 'pharmacy', 'pharmacist'].includes(roleName) ||
                perms.includes('billing_view') || perms.includes('billing_manage') || perms.includes('pharmacy_manage') ||
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

// Helper function to build ObjectId + String variant query array
const getIdVariants = (idVal) => {
    if (!idVal) return [];
    const idStr = String(idVal);
    const variants = [idStr];
    if (mongoose.Types.ObjectId.isValid(idStr)) {
        variants.push(new mongoose.Types.ObjectId(idStr));
    }
    return variants;
};

// Search patients for autocomplete dropdown
router.get('/search-patients', verifyBillingAccess, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json({ success: true, patients: [] });

        const regex = new RegExp(query, 'i');
        const role = req.user.role || '';
        const roleIdStr = typeof role === 'string' ? role.toLowerCase() : String(role);
        const roleData = req.user._roleData;
        const roleName = roleData?.name ? roleData.name.toLowerCase() : '';

        const baseSearch = {
            $or: [
                { name: regex },
                { phone: regex },
                { mrn: regex },
                { patientId: regex }
            ]
        };

        const isCentral = ['centraladmin', 'superadmin'].includes(roleIdStr) || ['centraladmin', 'superadmin'].includes(roleName);

        const searchFilter = (req.user.hospitalId && !isCentral)
            ? { ...baseSearch, hospitalId: { $in: getIdVariants(req.user.hospitalId) } }
            : baseSearch;

        let patients = await MasterUser.find(searchFilter)
            .select('name phone mrn patientId dob dateOfBirth gender age ageYears patientDetails kyc')
            .limit(10).lean();

        if (patients.length < 10 && req.tenantDb) {
            const { User: TenantUser } = getModels(req);
            const tenantPatients = await TenantUser.find(searchFilter)
                .select('name phone mrn patientId dob dateOfBirth gender age ageYears patientDetails kyc')
                .limit(10 - patients.length).lean();

            const existingIds = new Set(patients.map(p => String(p._id)));
            for (const p of tenantPatients) {
                if (!existingIds.has(String(p._id))) patients.push(p);
            }
        }

        const formattedPatients = patients.map(p => ({
            ...p,
            age: getPatientAge(p)
        }));

        res.json({ success: true, patients: formattedPatients });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 1. Search Patient & Fetch All Bills
router.get('/patient/:identifier', verifyBillingAccess, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const { identifier } = req.params;
        const { Appointment, LabReport, PharmacyOrder, FacilityCharge, Admission, TreatmentPackage } = getModels(req);

        const identifierVariants = getIdVariants(identifier);

        const searchQuery = {
            $or: [
                { _id: { $in: identifierVariants } },
                { mrn: identifier },
                { patientId: identifier },
                { phone: identifier },
                { name: { $regex: identifier, $options: 'i' } }
            ]
        };

        const roleIdStr = String(req.user.role || '').toLowerCase();
        const roleName = String(req.user._roleData?.name || '').toLowerCase();
        const isCentral = ['centraladmin', 'superadmin'].includes(roleIdStr) || ['centraladmin', 'superadmin'].includes(roleName);

        if (req.user.hospitalId && !isCentral) {
            searchQuery.hospitalId = { $in: getIdVariants(req.user.hospitalId) };
        }

        let masterPatient = await MasterUser.findOne(searchQuery).lean();
        let tenantPatient = null;

        if (req.tenantDb) {
            const { User: TenantUser } = getModels(req);
            tenantPatient = await TenantUser.findOne(searchQuery).lean();
        }

        if (!masterPatient && !tenantPatient) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        const patient = {
            ...(masterPatient || {}),
            ...(tenantPatient || {})
        };

        const patientIdVariants = getIdVariants(patient._id);

        const baseQuery = {
            $or: [
                { patientId: { $in: patientIdVariants } },
                { userId: { $in: patientIdVariants } },
                { patient: { $in: patientIdVariants } },
                { _id: { $in: patientIdVariants } },
                ...(patient.mrn ? [{ mrn: patient.mrn }] : []),
                ...(patient.uhid ? [{ uhid: patient.uhid }] : [])
            ]
        };

        const patientSearchQuery = (req.user.hospitalId && !isCentral)
            ? { ...baseQuery, hospitalId: { $in: getIdVariants(req.user.hospitalId) } }
            : baseQuery;

        const [tenantAppointments, tenantLabReports, tenantPharmacyOrders, tenantFacilityCharges, tenantAdmissions, tenantPackages] = req.tenantDb ? await Promise.all([
            Appointment.find(patientSearchQuery)
                .select('appointmentDate appointmentTime amount paymentStatus paymentMode serviceName doctorName status createdAt')
                .sort({ appointmentDate: -1 }).lean(),
            LabReport.find(patientSearchQuery)
                .select('testNames testName amount price paymentStatus paymentMode testStatus createdAt sgst cgst discount')
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

        const [masterAppointments, masterLabReports, masterPharmacyOrders, masterFacilityCharges, masterAdmissions, masterPackages] = await Promise.all([
            MasterAppointment.find(patientSearchQuery)
                .select('appointmentDate appointmentTime amount paymentStatus paymentMode serviceName doctorName status createdAt')
                .sort({ appointmentDate: -1 }).lean(),
            MasterLabReport.find(patientSearchQuery)
                .select('testNames testName amount price paymentStatus paymentMode testStatus createdAt sgst cgst discount')
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

        const mergeDocs = (arr1, arr2) => {
            const map = new Map();
            [...(arr1 || []), ...(arr2 || [])].forEach(doc => map.set(String(doc._id), doc));
            return Array.from(map.values());
        };

        const appointments = mergeDocs(tenantAppointments, masterAppointments).sort((a, b) => new Date(b.createdAt || b.appointmentDate) - new Date(a.createdAt || a.appointmentDate));
        const labReports = mergeDocs(tenantLabReports, masterLabReports).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const pharmacyOrders = mergeDocs(tenantPharmacyOrders, masterPharmacyOrders).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const facilityCharges = mergeDocs(tenantFacilityCharges, masterFacilityCharges).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const admissions = mergeDocs(tenantAdmissions, masterAdmissions).sort((a, b) => new Date(b.admissionDate || b.createdAt) - new Date(a.admissionDate || a.createdAt));
        const packages = mergeDocs(tenantPackages, masterPackages).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const allLabTests = await LabTest.find({}).lean();
        const hidStr = (req.user.hospitalId || '').toString();

        const finalLabReports = labReports.map(report => {
            const r = { ...report };
            if (!r.sgst && !r.cgst) {
                let computedSgst = 0;
                let computedCgst = 0;
                const tNames = Array.isArray(r.testNames) ? r.testNames : (r.testName ? [r.testName] : []);
                tNames.forEach(name => {
                    const normalized = name.trim().toLowerCase();
                    const testObj = allLabTests.find(t => t.name.trim().toLowerCase() === normalized);
                    if (testObj) {
                        let basePrice = testObj.price || 0;
                        if (hidStr && testObj.hospitalPrices && testObj.hospitalPrices[hidStr]) {
                            basePrice = testObj.hospitalPrices[hidStr];
                        }
                        if (testObj.sgst) computedSgst += (basePrice * testObj.sgst) / 100;
                        if (testObj.cgst) computedCgst += (basePrice * testObj.cgst) / 100;
                    }
                });
                r.sgst = computedSgst;
                r.cgst = computedCgst;
            }
            return r;
        });

        const calculatedAge = getPatientAge(patient);

        const payload = {
            success: true,
            patient: {
                _id: patient._id,
                name: patient.name,
                mrn: patient.mrn,
                patientId: patient.patientId,
                phone: patient.phone,
                gender: patient.gender,
                dob: patient.dob || patient.dateOfBirth || patient.patientDetails?.dob || patient.fertilityProfile?.dob,
                age: calculatedAge,
                avatar: patient.avatar || null,
            },
            billing: { appointments, labReports: finalLabReports, pharmacyOrders, facilityCharges, admissions, packages }
        };

        res.json(payload);

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. Add Facility Charge
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

// 2b. Edit Facility Charge (Before Payment)
router.put('/facility-charge/:id', verifyBillingAccess, async (req, res) => {
    try {
        const { pricePerDay, days, facilityName } = req.body;
        const FacilityCharge = MasterFacilityCharge;

        const charge = await FacilityCharge.findById(req.params.id);
        if (!charge) return res.status(404).json({ success: false, message: 'Charge not found' });

        if (charge.paymentStatus === 'Paid') {
            return res.status(400).json({ success: false, message: 'Cannot edit a paid charge' });
        }

        if (pricePerDay !== undefined) charge.pricePerDay = Number(pricePerDay);
        if (days !== undefined) charge.days = Number(days);
        if (facilityName !== undefined) charge.facilityName = facilityName;

        charge.totalAmount = charge.pricePerDay * charge.days;
        await charge.save();

        res.json({ success: true, message: 'Charge updated successfully', charge });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. Mark items as paid
router.put('/pay', verifyBillingAccess, async (req, res) => {
    try {
        const {
            appointmentIds = [],
            labReportIds = [],
            pharmacyOrderIds = [],
            facilityChargeIds = [],
            admissionIds = [],
            packageIds = [],
            packageInstallmentIds = [],
            paymentMode = 'Cash'
        } = req.body;

        const { Appointment, LabReport, PharmacyOrder, FacilityCharge, Admission, TreatmentPackage } = getModels(req);

        await Promise.all([
            appointmentIds.length > 0 && Appointment.updateMany({ _id: { $in: appointmentIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            appointmentIds.length > 0 && MasterAppointment.updateMany({ _id: { $in: appointmentIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            ...(labReportIds || []).map(id => {
                const disc = (req.body.labDiscounts && req.body.labDiscounts[id]) ? Number(req.body.labDiscounts[id]) : (Number(req.body.discount) || 0);
                return LabReport.updateOne({ _id: id }, { $set: { paymentStatus: 'Paid', paymentMode, discount: disc } });
            }),
            ...(labReportIds || []).map(id => {
                const disc = (req.body.labDiscounts && req.body.labDiscounts[id]) ? Number(req.body.labDiscounts[id]) : (Number(req.body.discount) || 0);
                return MasterLabReport.updateOne({ _id: id }, { $set: { paymentStatus: 'Paid', paymentMode, discount: disc } });
            }),
            pharmacyOrderIds.length > 0 && PharmacyOrder.updateMany({ _id: { $in: pharmacyOrderIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            pharmacyOrderIds.length > 0 && MasterPharmacyOrder.updateMany({ _id: { $in: pharmacyOrderIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),

            facilityChargeIds.length > 0 && FacilityCharge.updateMany({ _id: { $in: facilityChargeIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            facilityChargeIds.length > 0 && MasterFacilityCharge.updateMany({ _id: { $in: facilityChargeIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),

            admissionIds.length > 0 && Admission.updateMany({ _id: { $in: admissionIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            admissionIds.length > 0 && MasterAdmission.updateMany({ _id: { $in: admissionIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),

            packageIds.length > 0 && TreatmentPackage.updateMany({ _id: { $in: packageIds } }, { $set: { paymentStatus: 'Paid', paymentMode } }),
            packageIds.length > 0 && MasterTreatmentPackage.updateMany({ _id: { $in: packageIds } }, { $set: { paymentStatus: 'Paid', paymentMode } })
        ].filter(Boolean));

        if (packageInstallmentIds && packageInstallmentIds.length > 0) {
            for (const item of packageInstallmentIds) {
                let pkgId, instId;

                if (typeof item === 'string') {
                    const parts = item.split('|');
                    pkgId = parts[0];
                    instId = parts[1];
                } else if (typeof item === 'object' && item !== null) {
                    pkgId = item.packageId || item.pkgId;
                    instId = item.installmentId || item.instId;
                }

                if (pkgId && instId) {
                    let pkg = await TreatmentPackage.findById(pkgId);
                    let isMaster = false;

                    if (!pkg) {
                        pkg = await MasterTreatmentPackage.findById(pkgId);
                        isMaster = true;
                    }

                    if (pkg && pkg.paymentSchedule) {
                        let inst = pkg.paymentSchedule.id(instId);
                        if (!inst) {
                            inst = pkg.paymentSchedule.find(s => s._id.toString() === String(instId));
                        }

                        if (inst) {
                            inst.status = 'Paid';
                            inst.paidDate = new Date();
                        }

                        pkg.markModified('paymentSchedule');

                        const allPaid = pkg.paymentSchedule.every(s => s.status === 'Paid');
                        if (allPaid) {
                            pkg.paymentStatus = 'Paid';
                            pkg.paymentMode = paymentMode || pkg.paymentMode;
                        }

                        if (isMaster) {
                            await MasterTreatmentPackage.findByIdAndUpdate(pkgId, {
                                paymentSchedule: pkg.paymentSchedule,
                                paymentStatus: pkg.paymentStatus,
                                paymentMode: pkg.paymentMode
                            });
                        } else {
                            await pkg.save();
                        }
                    }
                }
            }
        }

        res.json({ success: true, message: 'Billing settled successfully' });
    } catch (error) {
        console.error("Billing Save Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;