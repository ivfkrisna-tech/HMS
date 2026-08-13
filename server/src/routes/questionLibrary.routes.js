const express = require('express');
const router = express.Router();
const QuestionLibrary = require('../models/questionLibrary.model');
const Hospital = require('../models/hospital.model');
const { verifyAdminOrSuperAdmin, verifyToken } = require('../middleware/auth.middleware');

const isObject = item => (item && typeof item === 'object' && !Array.isArray(item));
const deepMerge = (target, source) => {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = deepMerge(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

// Get the latest question library configuration
router.get('/', verifyToken, async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || null;
        
        // Fetch Global and Hospital Libraries
        const globalLibrary = await QuestionLibrary.findOne({ hospitalId: null }).sort({ version: -1 });
        let hospitalLibrary = null;

        if (hospitalId) {
            hospitalLibrary = await QuestionLibrary.findOne({ hospitalId }).sort({ version: -1 });
        }

        // Deep Merge Global with Hospital
        let mergedData = {};
        if (globalLibrary && globalLibrary.data) {
            mergedData = deepMerge(mergedData, globalLibrary.data);
        }
        if (hospitalLibrary && hospitalLibrary.data) {
            mergedData = deepMerge(mergedData, hospitalLibrary.data);
        }

        const library = { data: mergedData };

        let allowedDepartments = null; // null means all allowed (super/central admin)
        if (hospitalId) {
            const hospital = await Hospital.findById(hospitalId);
            if (hospital && hospital.departments) {
                allowedDepartments = hospital.departments;
            } else {
                allowedDepartments = [];
            }
        }

        res.json({ success: true, data: library, allowedDepartments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update or create question library
router.post('/', verifyToken, async (req, res) => {
    try {
        if (!req.user || (!req.user._id && !req.user.id && !req.user.hospitalId)) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Valid user credentials required.' });
        }

        const { data } = req.body;
        const hospitalId = req.user.hospitalId || null;

        if (!data) return res.status(400).json({ success: false, message: 'Library data is required' });

        const latestLibrary = await QuestionLibrary.findOne({ hospitalId }).sort({ version: -1 });
        let newVersion = 1;
        let existingData = {};
        
        if (latestLibrary) {
            newVersion = latestLibrary.version + 1;
            existingData = latestLibrary.data || {};
        }

        // Deep merge existing database tree with incoming updates
        const mergedData = deepMerge(existingData, data || {});

        const library = new QuestionLibrary({ data: mergedData, version: newVersion, hospitalId });
        await library.save();

        res.status(201).json({ success: true, message: 'Question Library updated successfully', data: library });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
