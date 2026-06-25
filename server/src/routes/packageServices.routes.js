const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth.middleware');
const { resolveTenant } = require('../middleware/tenantMiddleware');
const { getTenantModels } = require('../db/tenantModels');

const MasterUser = require('../models/user.model');
const MasterServiceMaster = require('../models/serviceMaster.model');
const MasterTreatmentPackage = require('../models/treatmentPackage.model');

// Middleware: Verify hospital admin or higher
const verifyHospitalAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const role = typeof req.user.role === 'string' ? req.user.role.toLowerCase() : '';
    const isAllowed = ['hospitaladmin', 'superadmin', 'centraladmin', 'doctor'].includes(role) || role.includes('reception');
    if (isAllowed) {
        return next();
    }
    return res.status(403).json({ success: false, message: 'Access denied: Appropriate clinical or admin privileges required' });
};

// Helper: Resolve models dynamically
const getModels = (req) => {
    if (req.tenantDb) {
        const m = getTenantModels(req.tenantDb);
        return {
            User: MasterUser,
            ServiceMaster: m.ServiceMaster || MasterServiceMaster,
            TreatmentPackage: m.TreatmentPackage || MasterTreatmentPackage
        };
    }
    return {
        User: MasterUser,
        ServiceMaster: MasterServiceMaster,
        TreatmentPackage: MasterTreatmentPackage
    };
};

// Helper: format Couple Name
function formatCoupleName(patients) {
    if (!patients || patients.length === 0) return '';
    if (patients.length === 1) return patients[0].name.split(' ')[0];

    const husband = patients.find(p => 
        (p.gender && p.gender.toLowerCase() === 'male') || 
        p.partnerRelation === 'Husband'
    );
    const wife = patients.find(p => 
        (p.gender && p.gender.toLowerCase() === 'female') || 
        p.partnerRelation === 'Wife'
    );

    if (husband && wife) {
        return `${husband.name.split(' ')[0]} - ${wife.name.split(' ')[0]}`;
    }
    return patients.map(p => p.name.split(' ')[0]).join(' - ');
}

// ─── SERVICE MASTER CRUD ────────────────────────────────────────────────────────

// 1. GET ALL SERVICES
router.get('/services', verifyToken, resolveTenant, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.query.hospitalId || req.hospitalId;
        const { status } = req.query;
        const { ServiceMaster } = getModels(req);

        const filter = { hospitalId };
        if (status) filter.status = status;

        const services = await ServiceMaster.find(filter).sort({ createdAt: -1 }).lean();
        res.json({ success: true, services });
    } catch (error) {
        console.error('Fetch services error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. CREATE SERVICE
router.post('/services', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.body.hospitalId || req.hospitalId;
        const { serviceName, price, description, status } = req.body;
        const { ServiceMaster } = getModels(req);

        if (!serviceName || price === undefined || price === null || price === '') {
            return res.status(400).json({ success: false, message: 'Service Name and Price are required' });
        }

        const trimmedName = serviceName.trim();
        const duplicate = await ServiceMaster.findOne({
            hospitalId,
            serviceName: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
        });

        if (duplicate) {
            return res.status(400).json({ success: false, message: 'Service with this name already exists' });
        }

        const newService = await ServiceMaster.create({
            hospitalId,
            serviceName: trimmedName,
            price: Number(price),
            description: description || '',
            status: status || 'Active',
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, message: 'Service created successfully', service: newService });
    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. UPDATE SERVICE
router.put('/services/:id', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.body.hospitalId || req.hospitalId;
        const { id } = req.params;
        const { serviceName, price, description, status } = req.body;
        const { ServiceMaster } = getModels(req);

        const service = await ServiceMaster.findOne({ _id: id, hospitalId });
        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        if (serviceName) {
            const trimmedName = serviceName.trim();
            const dup = await ServiceMaster.findOne({
                _id: { $ne: id },
                hospitalId,
                serviceName: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
            });
            if (dup) {
                return res.status(400).json({ success: false, message: 'Another service with this name already exists' });
            }
            service.serviceName = trimmedName;
        }

        if (price !== undefined && price !== null && price !== '') service.price = Number(price);
        if (description !== undefined) service.description = description;
        if (status) service.status = status;

        await service.save();
        res.json({ success: true, message: 'Service updated successfully', service });
    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. TOGGLE SERVICE STATUS
router.patch('/services/:id/status', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.hospitalId;
        const { id } = req.params;
        const { status } = req.body;
        const { ServiceMaster } = getModels(req);

        const updated = await ServiceMaster.findOneAndUpdate(
            { _id: id, hospitalId },
            { $set: { status } },
            { new: true }
        );

        if (!updated) return res.status(404).json({ success: false, message: 'Service not found' });
        res.json({ success: true, message: `Service ${status === 'Active' ? 'enabled' : 'disabled'} successfully`, service: updated });
    } catch (error) {
        console.error('Toggle status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. DELETE SERVICE
router.delete('/services/:id', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.hospitalId;
        const { id } = req.params;
        const { ServiceMaster } = getModels(req);

        const deleted = await ServiceMaster.findOneAndDelete({ _id: id, hospitalId });
        if (!deleted) return res.status(404).json({ success: false, message: 'Service not found' });
        res.json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── REGISTERED PATIENTS DROPDOWN / SEARCH ──────────────────────────────────────

router.get('/registered-patients', verifyToken, resolveTenant, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.query.hospitalId || req.hospitalId;
        const { query } = req.query;
        const { User } = getModels(req);

        const hospitalIdFilter = [hospitalId];
        if (mongoose.Types.ObjectId.isValid(hospitalId)) {
            hospitalIdFilter.push(new mongoose.Types.ObjectId(hospitalId));
        }

        const filter = {
            hospitalId: { $in: hospitalIdFilter },
            role: 'patient'
        };

        if (query && query.trim()) {
            const q = query.trim();
            filter.$or = [
                { name: { $regex: q, $options: 'i' } },
                { mrn: { $regex: q, $options: 'i' } },
                { patientId: { $regex: q, $options: 'i' } },
                { coupleId: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } }
            ];
        }

        const patients = await User.find(filter).sort({ createdAt: -1 }).lean();

        // Deduplicate couple-wise so Husband/Wife appear once as requested
        const seenCouples = new Set();
        const deduplicated = [];

        for (const pat of patients) {
            const cplKey = pat.coupleId && pat.coupleId !== 'N/A' ? pat.coupleId : pat._id.toString();
            if (!seenCouples.has(cplKey)) {
                seenCouples.add(cplKey);
                let displayName = pat.name;
                let mrnDisplay = pat.mrn || pat.patientId || 'N/A';
                if (pat.coupleId && pat.coupleId !== 'N/A') {
                    const cplMembers = patients.filter(p => p.coupleId === pat.coupleId);
                    displayName = formatCoupleName(cplMembers);
                    mrnDisplay = cplMembers.map(m => m.mrn || m.patientId).filter(Boolean).join(' / ');
                }
                deduplicated.push({
                    _id: pat._id,
                    patientId: pat._id,
                    name: displayName,
                    patientName: pat.name,
                    mrn: mrnDisplay,
                    coupleId: pat.coupleId || 'N/A',
                    phone: pat.phone || ''
                });
            }
        }

        res.json({ success: true, patients: deduplicated });
    } catch (error) {
        console.error('Fetch registered patients error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── TREATMENT PACKAGES CRUD ────────────────────────────────────────────────────

// 1. GET ALL PACKAGES
router.get('/packages', verifyToken, resolveTenant, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.query.hospitalId || req.hospitalId;
        const { TreatmentPackage, User } = getModels(req);

        const packages = await TreatmentPackage.find({ hospitalId }).sort({ createdAt: -1 }).lean();

        // Attach patient details
        const enriched = await Promise.all(packages.map(async (pkg) => {
            let patientName = 'Unknown Patient';
            let coupleName = '-';
            let phone = '';

            if (pkg.patientId) {
                const pat = await User.findById(pkg.patientId).select('name phone coupleId gender partnerRelation mrn patientId').lean();
                if (pat) {
                    patientName = pat.name;
                    phone = pat.phone || '';
                    if (pat.coupleId && pat.coupleId !== 'N/A') {
                        const cplMembers = await User.find({ coupleId: pat.coupleId }).select('name gender partnerRelation').lean();
                        coupleName = formatCoupleName(cplMembers);
                    } else {
                        coupleName = pat.name.split(' ')[0];
                    }
                }
            }

            return {
                ...pkg,
                patientName,
                coupleName,
                phone
            };
        }));

        res.json({ success: true, packages: enriched });
    } catch (error) {
        console.error('Fetch packages error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. GET PACKAGE FOR SPECIFIC PATIENT (PROFILE INTEGRATION)
router.get('/patient/:patientId', verifyToken, resolveTenant, async (req, res) => {
    try {
        const { patientId } = req.params;
        const { TreatmentPackage, User } = getModels(req);

        const pat = await User.findById(patientId).select('coupleId mrn patientId hospitalId').lean();
        if (!pat) return res.status(404).json({ success: false, message: 'Patient not found' });

        const filter = {
            $or: [
                { patientId: new mongoose.Types.ObjectId(patientId) }
            ]
        };

        if (pat.coupleId && pat.coupleId !== 'N/A') {
            filter.$or.push({ coupleId: pat.coupleId });
        }
        if (pat.mrn) {
            filter.$or.push({ mrn: pat.mrn });
        }

        const packages = await TreatmentPackage.find(filter).sort({ createdAt: -1 }).lean();
        res.json({ success: true, packages, activePackage: packages[0] || null });
    } catch (error) {
        console.error('Fetch patient package error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. CREATE PACKAGE
router.post('/packages', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.body.hospitalId || req.hospitalId;
        const {
            patientId,
            mrn,
            coupleId,
            packageName,
            description,
            selectedServices,
            originalAmount,
            discountPercent,
            finalAmount,
            startDate,
            totalDuration,
            status
        } = req.body;

        const { TreatmentPackage } = getModels(req);

        if (!patientId || !packageName) {
            return res.status(400).json({ success: false, message: 'Patient and Package Title are required' });
        }

        const newPkg = await TreatmentPackage.create({
            hospitalId,
            patientId,
            mrn: mrn || '',
            coupleId: coupleId || '',
            packageName: packageName.trim(),
            description: description || '',
            selectedServices: selectedServices || [],
            originalAmount: Number(originalAmount) || 0,
            discountPercent: Number(discountPercent) || 0,
            finalAmount: Number(finalAmount) || 0,
            startDate: startDate || '',
            totalDuration: Number(totalDuration) || 0,
            status: status || 'Active',
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, message: 'Treatment Package created and assigned successfully', package: newPkg });
    } catch (error) {
        console.error('Create package error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. UPDATE PACKAGE
router.put('/packages/:id', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.body.hospitalId || req.hospitalId;
        const { id } = req.params;
        const {
            packageName,
            description,
            selectedServices,
            originalAmount,
            discountPercent,
            finalAmount,
            startDate,
            totalDuration,
            status
        } = req.body;

        const { TreatmentPackage } = getModels(req);

        const pkg = await TreatmentPackage.findOne({ _id: id, hospitalId });
        if (!pkg) return res.status(404).json({ success: false, message: 'Treatment Package not found' });

        if (packageName) pkg.packageName = packageName.trim();
        if (description !== undefined) pkg.description = description;
        if (selectedServices) pkg.selectedServices = selectedServices;
        if (originalAmount !== undefined) pkg.originalAmount = Number(originalAmount) || 0;
        if (discountPercent !== undefined) pkg.discountPercent = Number(discountPercent) || 0;
        if (finalAmount !== undefined) pkg.finalAmount = Number(finalAmount) || 0;
        if (startDate !== undefined) pkg.startDate = startDate;
        if (totalDuration !== undefined) pkg.totalDuration = Number(totalDuration) || 0;
        if (status) pkg.status = status;

        await pkg.save();
        res.json({ success: true, message: 'Treatment Package updated successfully', package: pkg });
    } catch (error) {
        console.error('Update package error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. DELETE PACKAGE
router.delete('/packages/:id', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.hospitalId;
        const { id } = req.params;
        const { TreatmentPackage } = getModels(req);

        const deleted = await TreatmentPackage.findOneAndDelete({ _id: id, hospitalId });
        if (!deleted) return res.status(404).json({ success: false, message: 'Treatment Package not found' });
        res.json({ success: true, message: 'Treatment Package deleted successfully' });
    } catch (error) {
        console.error('Delete package error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
