const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { resolveTenant } = require('../middleware/tenantMiddleware');
const { getTenantModels } = require('../db/tenantModels');

const MasterUser = require('../models/user.model');
const MasterAppointment = require('../models/appointment.model');
const MasterSource = require('../models/source.model');

// Middleware: Verify role is hospitaladmin or higher
const verifyHospitalAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const role = typeof req.user.role === 'string' ? req.user.role.toLowerCase() : '';
    const isAllowed = ['hospitaladmin', 'superadmin', 'centraladmin'].includes(role);
    if (isAllowed) {
        return next();
    }
    return res.status(403).json({ success: false, message: 'Access denied: Hospital Admin privileges required' });
};

// Helper: Resolve models dynamically based on tenantDb
const getModels = (req) => {
    if (req.tenantDb) {
        const m = getTenantModels(req.tenantDb);
        return {
            User: MasterUser,
            Appointment: MasterAppointment,
            Source: m.Source
        };
    }
    return {
        User: MasterUser,
        Appointment: MasterAppointment,
        Source: MasterSource
    };
};

// Helper: format Couple Name for display
function formatCoupleName(patients) {
    if (!patients || patients.length === 0) return '';
    if (patients.length === 1) return patients[0].name.split(' ')[0];

    const husband = patients.find(p => 
        (p.gender && p.gender.toLowerCase() === 'male') || 
        p.partnerRelation === 'Wife'
    );
    const wife = patients.find(p => 
        (p.gender && p.gender.toLowerCase() === 'female') || 
        p.partnerRelation === 'Husband'
    );

    if (husband && wife) {
        return `${husband.name.split(' ')[0]} - ${wife.name.split(' ')[0]}`;
    }

    return patients.map(p => p.name.split(' ')[0]).join(' - ');
}

// 1. GET ALL SOURCES (with patient count)
router.get('/', verifyToken, resolveTenant, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.hospitalId;
        if (!hospitalId) {
            return res.status(400).json({ success: false, message: 'Hospital ID not found in context' });
        }

        const { Source, User } = getModels(req);
        
        const filter = { hospitalId };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.type) filter.sourceType = req.query.type;

        const sources = await Source.find(filter).sort({ createdAt: -1 }).lean();

        // Calculate dynamic patient count
        const hospitalIdFilter = [hospitalId];
        const mongoose = require('mongoose');
        if (mongoose.Types.ObjectId.isValid(hospitalId)) {
            hospitalIdFilter.push(new mongoose.Types.ObjectId(hospitalId));
        }

        const sourcesWithCount = await Promise.all(sources.map(async (source) => {
            const patientsForSource = await User.find({
                hospitalId: { $in: hospitalIdFilter },
                role: 'patient',
                'sourceInformation.sourceType': { $regex: new RegExp(`^${source.sourceType.trim()}$`, 'i') },
                'sourceInformation.sourceName': { $regex: new RegExp(`^${source.sourceName.trim()}$`, 'i') }
            }).select('_id coupleId').lean();

            const seenCouples = new Set();
            let count = 0;
            for (const p of patientsForSource) {
                if (p.coupleId) {
                    const normalizedId = String(p.coupleId).trim().toUpperCase();
                    if (!seenCouples.has(normalizedId)) {
                        seenCouples.add(normalizedId);
                        count++;
                    }
                } else {
                    count++;
                }
            }

            return {
                ...source,
                totalPatients: count
            };
        }));

        res.json({ success: true, data: sourcesWithCount });
    } catch (error) {
        console.error('Fetch sources error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. CREATE A NEW SOURCE
router.post('/', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.hospitalId;
        if (!hospitalId) {
            return res.status(400).json({ success: false, message: 'Hospital ID not found' });
        }

        const { sourceType, sourceName, status, fields } = req.body;
        if (!sourceType || !sourceName) {
            return res.status(400).json({ success: false, message: 'Source Type and Source Name are required' });
        }

        const { Source } = getModels(req);

        // Check for duplicate in the same hospital
        const existing = await Source.findOne({
            hospitalId,
            sourceType,
            sourceName: { $regex: new RegExp(`^${sourceName.trim()}$`, 'i') }
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'Source with this name already exists' });
        }

        const newSource = new Source({
            hospitalId,
            sourceType,
            sourceName: sourceName.trim(),
            status: status || 'Active',
            createdBy: req.user._id,
            fields: fields || []
        });

        await newSource.save();
        res.status(201).json({ success: true, data: newSource });
    } catch (error) {
        console.error('Create source error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. UPDATE SOURCE
router.put('/:id', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.hospitalId;
        const { id } = req.params;
        const { sourceName, status, fields } = req.body;

        const { Source, User } = getModels(req);

        const source = await Source.findOne({ _id: id, hospitalId });
        if (!source) {
            return res.status(404).json({ success: false, message: 'Source not found' });
        }

        const oldName = source.sourceName;
        const oldType = source.sourceType;

        if (sourceName && sourceName.trim() !== oldName) {
            const trimmedName = sourceName.trim();
            // Check duplicate
            const duplicate = await Source.findOne({
                _id: { $ne: id },
                hospitalId,
                sourceType: oldType,
                sourceName: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
            });

            if (duplicate) {
                return res.status(400).json({ success: false, message: 'Another source with this name already exists' });
            }

            source.sourceName = trimmedName;

            const hospitalIdFilter = [hospitalId];
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(hospitalId)) {
                hospitalIdFilter.push(new mongoose.Types.ObjectId(hospitalId));
            }

            // Automatically update existing patient records
            await User.updateMany(
                {
                    hospitalId: { $in: hospitalIdFilter },
                    'sourceInformation.sourceType': { $regex: new RegExp(`^${oldType.trim()}$`, 'i') },
                    'sourceInformation.sourceName': { $regex: new RegExp(`^${oldName.trim()}$`, 'i') }
                },
                {
                    $set: {
                        'sourceInformation.sourceType': oldType,
                        'sourceInformation.sourceName': trimmedName
                    }
                }
            );
        }

        if (status) {
            source.status = status;
        }

        if (fields !== undefined) {
            source.fields = fields;
        }

        await source.save();
        res.json({ success: true, data: source });
    } catch (error) {
        console.error('Update source error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. DELETE SOURCE
router.delete('/:id', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.hospitalId;
        const { id } = req.params;

        const { Source } = getModels(req);

        const deleted = await Source.findOneAndDelete({ _id: id, hospitalId });
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Source not found' });
        }

        res.json({ success: true, message: 'Source deleted successfully' });
    } catch (error) {
        console.error('Delete source error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. GET PATIENTS REGISTERED UNDER SOURCE
router.get('/:id/patients', verifyToken, resolveTenant, verifyHospitalAdmin, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.hospitalId;
        const { id } = req.params;

        const { Source, User, Appointment } = getModels(req);

        const source = await Source.findOne({ _id: id, hospitalId });
        if (!source) {
            return res.status(404).json({ success: false, message: 'Source not found' });
        }

        const hospitalIdFilter = [hospitalId];
        const mongoose = require('mongoose');
        if (mongoose.Types.ObjectId.isValid(hospitalId)) {
            hospitalIdFilter.push(new mongoose.Types.ObjectId(hospitalId));
        }

        const patients = await User.find({
            hospitalId: { $in: hospitalIdFilter },
            role: 'patient',
            'sourceInformation.sourceType': { $regex: new RegExp(`^${source.sourceType.trim()}$`, 'i') },
            'sourceInformation.sourceName': { $regex: new RegExp(`^${source.sourceName.trim()}$`, 'i') }
        }).lean();

        const rawPatientsData = await Promise.all(patients.map(async (patient) => {
            let coupleName = patient.name;
            if (patient.coupleId) {
                const couplePatients = await User.find({ coupleId: patient.coupleId }).select('name gender partnerRelation').lean();
                coupleName = formatCoupleName(couplePatients);
            } else {
                coupleName = patient.name.split(' ')[0];
            }

            return {
                _id: patient._id,
                coupleName,
                coupleId: patient.coupleId || null,
                registrationDate: patient.createdAt,
                sourceType: patient.sourceInformation?.sourceType || 'N/A',
                source: patient.sourceInformation?.sourceName || 'N/A'
            };
        }));

        // Filter duplicates by coupleId
        const patientsData = [];
        const seenCouples = new Set();
        for (const item of rawPatientsData) {
            if (item.coupleId) {
                if (seenCouples.has(item.coupleId)) {
                    continue;
                }
                seenCouples.add(item.coupleId);
            }
            patientsData.push(item);
        }

        res.json({
            success: true,
            sourceName: source.sourceName,
            patients: patientsData
        });
    } catch (error) {
        console.error('Fetch source patients error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
