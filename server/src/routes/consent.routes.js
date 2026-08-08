const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { verifySuperAdmin, verifyToken } = require('../middleware/auth.middleware');
const ConsentCategory = require('../models/consentCategory.model');
const ConsentTemplate = require('../models/consentTemplate.model');
const User = require('../models/user.model');
const Hospital = require('../models/hospital.model');
const Appointment = require('../models/appointment.model');
const Doctor = require('../models/doctor.model');
const ConsentFillerService = require('../services/consentFiller.service');

// ── Multer Configuration for .docx uploads ──────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/consent-templates');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const consentStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `consent-${uniqueSuffix}${ext}`);
    },
});

const consentFileFilter = (req, file, cb) => {
    const allowedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.mimetype === allowedMime || ext === '.docx') {
        cb(null, true);
    } else {
        cb(new Error('Only .docx files are allowed. PDF, JPG, PNG, and JPEG files are not accepted.'), false);
    }
};

const uploadConsent = multer({
    storage: consentStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: consentFileFilter,
});

// All routes require at least authentication
router.use(verifyToken);

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/stats', verifySuperAdmin, async (req, res) => {
    try {
        const [totalCategories, totalTemplates, activeTemplates, inactiveTemplates] = await Promise.all([
            ConsentCategory.countDocuments(),
            ConsentTemplate.countDocuments(),
            ConsentTemplate.countDocuments({ isActive: true }),
            ConsentTemplate.countDocuments({ isActive: false }),
        ]);

        res.json({
            success: true,
            stats: { totalCategories, totalTemplates, activeTemplates, inactiveTemplates },
        });
    } catch (err) {
        console.error('[Consent] Stats error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to load consent stats' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORY CRUD
// ══════════════════════════════════════════════════════════════════════════════

// GET all categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await ConsentCategory.find().sort({ sortOrder: 1, name: 1 });
        res.json({ success: true, categories });
    } catch (err) {
        console.error('[Consent] Get categories error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to load categories' });
    }
});

// POST create category
router.post('/categories', verifySuperAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        // Check duplicate
        const existing = await ConsentCategory.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Category with this name already exists' });
        }

        const category = await ConsentCategory.create({
            name: name.trim(),
            description: description?.trim() || '',
        });

        res.status(201).json({ success: true, category, message: 'Category created successfully' });
    } catch (err) {
        console.error('[Consent] Create category error:', err.message);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Category with this name already exists' });
        }
        res.status(500).json({ success: false, message: 'Failed to create category' });
    }
});

// PUT update category
router.put('/categories/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        // Check duplicate (exclude self)
        const existing = await ConsentCategory.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            _id: { $ne: req.params.id },
        });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Another category with this name already exists' });
        }

        const category = await ConsentCategory.findByIdAndUpdate(
            req.params.id,
            { name: name.trim(), description: description?.trim() || '' },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        res.json({ success: true, category, message: 'Category updated successfully' });
    } catch (err) {
        console.error('[Consent] Update category error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update category' });
    }
});

// DELETE category
router.delete('/categories/:id', verifySuperAdmin, async (req, res) => {
    try {
        // Check if any templates reference this category
        const templateCount = await ConsentTemplate.countDocuments({ categoryId: req.params.id });
        if (templateCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category — ${templateCount} consent template(s) are using it. Remove or reassign them first.`,
            });
        }

        const category = await ConsentCategory.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (err) {
        console.error('[Consent] Delete category error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
});

// PATCH toggle category active/inactive
router.patch('/categories/:id/toggle', verifySuperAdmin, async (req, res) => {
    try {
        const category = await ConsentCategory.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        category.isActive = !category.isActive;
        await category.save();

        res.json({
            success: true,
            category,
            message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
        });
    } catch (err) {
        console.error('[Consent] Toggle category error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to toggle category status' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE CRUD
// ══════════════════════════════════════════════════════════════════════════════

// GET all templates (with search/filter)
router.get('/templates', async (req, res) => {
    try {
        const { search, categoryId, status } = req.query;
        const filter = {};

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }
        if (categoryId) {
            filter.categoryId = categoryId;
        }
        if (status === 'active') filter.isActive = true;
        else if (status === 'inactive') filter.isActive = false;

        const templates = await ConsentTemplate.find(filter)
            .populate('categoryId', 'name')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        res.json({ success: true, templates });
    } catch (err) {
        console.error('[Consent] Get templates error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to load templates' });
    }
});

// GET single template
router.get('/templates/:id', async (req, res) => {
    try {
        const template = await ConsentTemplate.findById(req.params.id)
            .populate('categoryId', 'name')
            .populate('createdBy', 'name');

        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        res.json({ success: true, template });
    } catch (err) {
        console.error('[Consent] Get template error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to load template' });
    }
});

// POST create template (with .docx upload)
router.post('/templates', verifySuperAdmin, (req, res) => {
    uploadConsent.single('templateFile')(req, res, async (uploadErr) => {
        if (uploadErr) {
            if (uploadErr instanceof multer.MulterError) {
                if (uploadErr.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ success: false, message: 'File size exceeds 10MB limit' });
                }
                return res.status(400).json({ success: false, message: uploadErr.message });
            }
            return res.status(400).json({ success: false, message: uploadErr.message });
        }

        try {
            const { name, categoryId, description, isActive } = req.body;

            if (!name || !name.trim()) {
                // Clean up uploaded file if validation fails
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ success: false, message: 'Consent name is required' });
            }
            if (!categoryId) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ success: false, message: 'Category is required' });
            }
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Template file (.docx) is required' });
            }

            // Verify category exists
            const category = await ConsentCategory.findById(categoryId);
            if (!category) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ success: false, message: 'Selected category does not exist' });
            }

            // Default placeholders for future auto-fill
            const defaultPlaceholders = [
                'patient_name', 'age', 'gender', 'address',
                'doctor_name', 'hospital_name', 'today', 'current_time',
            ];

            const template = await ConsentTemplate.create({
                name: name.trim(),
                categoryId,
                description: description?.trim() || '',
                originalFileName: req.file.originalname,
                storedFilePath: req.file.path.replace(/\\/g, '/'), // normalize path separators
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                isActive: isActive === 'false' ? false : true,
                createdBy: req.user._id,
                placeholders: defaultPlaceholders,
            });

            // Populate for response
            const populated = await ConsentTemplate.findById(template._id)
                .populate('categoryId', 'name')
                .populate('createdBy', 'name');

            res.status(201).json({
                success: true,
                template: populated,
                message: 'Consent template created successfully',
            });
        } catch (err) {
            console.error('[Consent] Create template error:', err.message);
            // Clean up uploaded file on error
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
            }
            res.status(500).json({ success: false, message: 'Failed to create consent template' });
        }
    });
});

// PUT update template (optionally replace file)
router.put('/templates/:id', verifySuperAdmin, (req, res) => {
    uploadConsent.single('templateFile')(req, res, async (uploadErr) => {
        if (uploadErr) {
            if (uploadErr instanceof multer.MulterError) {
                if (uploadErr.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ success: false, message: 'File size exceeds 10MB limit' });
                }
                return res.status(400).json({ success: false, message: uploadErr.message });
            }
            return res.status(400).json({ success: false, message: uploadErr.message });
        }

        try {
            const template = await ConsentTemplate.findById(req.params.id);
            if (!template) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(404).json({ success: false, message: 'Template not found' });
            }

            const { name, categoryId, description, isActive } = req.body;

            if (name) template.name = name.trim();
            if (categoryId) {
                const category = await ConsentCategory.findById(categoryId);
                if (!category) {
                    if (req.file) fs.unlinkSync(req.file.path);
                    return res.status(400).json({ success: false, message: 'Selected category does not exist' });
                }
                template.categoryId = categoryId;
            }
            if (description !== undefined) template.description = description.trim();
            if (isActive !== undefined) template.isActive = isActive === 'false' ? false : true;

            // Replace file if new one uploaded
            if (req.file) {
                // Delete old file
                if (template.storedFilePath && fs.existsSync(template.storedFilePath)) {
                    try { fs.unlinkSync(template.storedFilePath); } catch (_) {}
                }
                template.originalFileName = req.file.originalname;
                template.storedFilePath = req.file.path.replace(/\\/g, '/');
                template.fileSize = req.file.size;
                template.mimeType = req.file.mimetype;
                template.version = (template.version || 1) + 1;
            }

            await template.save();

            const populated = await ConsentTemplate.findById(template._id)
                .populate('categoryId', 'name')
                .populate('createdBy', 'name');

            res.json({ success: true, template: populated, message: 'Consent template updated successfully' });
        } catch (err) {
            console.error('[Consent] Update template error:', err.message);
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
            }
            res.status(500).json({ success: false, message: 'Failed to update consent template' });
        }
    });
});

// DELETE template
router.delete('/templates/:id', verifySuperAdmin, async (req, res) => {
    try {
        const template = await ConsentTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        // Delete file from disk
        if (template.storedFilePath && fs.existsSync(template.storedFilePath)) {
            try { fs.unlinkSync(template.storedFilePath); } catch (_) {}
        }

        await ConsentTemplate.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Consent template deleted successfully' });
    } catch (err) {
        console.error('[Consent] Delete template error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to delete consent template' });
    }
});

// GET download original template file
router.get('/templates/:id/download', async (req, res) => {
    try {
        const template = await ConsentTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        if (!template.storedFilePath || !fs.existsSync(template.storedFilePath)) {
            return res.status(404).json({ success: false, message: 'Template file not found on server' });
        }

        res.setHeader('Content-Disposition', `attachment; filename="${template.originalFileName}"`);
        res.setHeader('Content-Type', template.mimeType);
        res.sendFile(path.resolve(template.storedFilePath));
    } catch (err) {
        console.error('[Consent] Download template error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to download template' });
    }
});

// Helper to safely extract or calculate age
function getAge(user) {
    if (!user) return '';
    if (user.fertilityProfile && user.fertilityProfile.age) {
        const match = String(user.fertilityProfile.age).match(/\d+/);
        if (match) return match[0];
    }
    const dob = user.dob || (user.fertilityProfile && user.fertilityProfile.dob);
    if (dob) {
        const birthDate = new Date(dob);
        if (!isNaN(birthDate.getTime())) {
            const today = new Date();
            let calcAge = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                calcAge--;
            }
            return calcAge.toString();
        }
    }
    return '';
}

// Helper to beautifully format Indian addresses
function formatAddress(user) {
    if (!user) return '';
    const line1 = [user.houseNumber, user.street].filter(Boolean).join(' '); // e.g. "31/209 Malviya Nagar"
    const parts = [line1, user.address, user.city, user.state].filter(Boolean);
    let address = parts.join(', ');
    if (user.pincode) {
        address += address.length > 0 ? ` - ${user.pincode}` : user.pincode;
    }
    return address;
}

// GET generate filled template document
router.get('/templates/:id/generate', verifyToken, async (req, res) => {
    try {
        const { patientId } = req.query;
        if (!patientId) {
            return res.status(400).json({ success: false, message: 'Patient ID is required' });
        }

        const template = await ConsentTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        if (!template.storedFilePath || !fs.existsSync(template.storedFilePath)) {
            return res.status(404).json({ success: false, message: 'Template file not found on server' });
        }

        // Fetch patient
        const patient = await User.findById(patientId);
        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        // Calculate age
        const age = getAge(patient);

        // Fetch hospital
        const hospital = req.user.hospitalId ? await Hospital.findById(req.user.hospitalId) : null;

        // Fetch latest appointment to get Doctor info
        const latestAppointment = await Appointment.findOne({ userId: patientId, hospitalId: req.user.hospitalId })
            .sort({ createdAt: -1 })
            .populate('doctorId');
        
        const doctor = latestAppointment ? latestAppointment.doctorId : null;

        // Fetch partner (if applicable)
        let partner = null;
        if (patient.partnerPatientId) {
            partner = await User.findById(patient.partnerPatientId);
        } else if (patient.linkedPatients && patient.linkedPatients.length > 0) {
            partner = await User.findById(patient.linkedPatients[0].patientId);
        }

        // Aggregate address
        const address = formatAddress(patient);
        const partnerAddress = formatAddress(partner);
        
        const partnerAge = getAge(partner);

        const todayDate = new Date();

        // Create the data dictionary for docxtemplater
        const docData = {
            patient_name: patient.name || '',
            age: age,
            gender: patient.gender || '',
            address: address,
            mobile: patient.phone || '',
            email: patient.email || '',
            mrn: patient.mrn || '',
            uhid: patient.patientId || '',
            doctor_name: doctor ? doctor.name : (patient.sourceInformation?.doctorName || ''),
            doctor_registration_no: 'N/A', // Not available in schema currently
            hospital_name: hospital ? hospital.name : '',
            hospital_address: hospital ? [hospital.address, hospital.city, hospital.state].filter(Boolean).join(', ') : '',
            department: (patient.departments && patient.departments.length > 0) ? patient.departments.join(', ') : 'IVF',
            today: todayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            current_time: todayDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            appointment_date: latestAppointment ? new Date(latestAppointment.appointmentDate).toLocaleDateString('en-IN') : '',
            admission_date: '', // Could be fetched if admission model is included
            relation: patient.partnerRelation || (patient.linkedPatients && patient.linkedPatients.length > 0 ? patient.linkedPatients[0].relationLabel : ''),
            relative_name: partner ? partner.name : '',
            relative_age: partnerAge,
            relative_address: partnerAddress
        };

        // Generate filled document
        const filledBuffer = ConsentFillerService.generateFilledDocument(template.storedFilePath, docData);

        // Send back as downloadable file
        res.setHeader('Content-Disposition', `attachment; filename="Filled_${template.originalFileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(filledBuffer);

    } catch (err) {
        console.error('[Consent] Generate template error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to generate filled template' });
    }
});

// GET generate and convert filled template to PDF
router.get('/templates/:id/generate-pdf', verifyToken, async (req, res) => {
    try {
        console.log(`[PDF Gen] API called for Template ID: ${req.params.id}`);
        const { patientId } = req.query;
        if (!patientId) {
            console.error('[PDF Gen] Missing patientId in query');
            return res.status(400).json({ success: false, message: 'Patient ID is required' });
        }
        console.log(`[PDF Gen] Patient ID: ${patientId}`);

        const template = await ConsentTemplate.findById(req.params.id);
        if (!template) {
            console.error(`[PDF Gen] Template not found in database: ${req.params.id}`);
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        console.log(`[PDF Gen] Template found: ${template.name}`);

        if (!template.storedFilePath) {
            console.error(`[PDF Gen] Template file path missing in database`);
            return res.status(404).json({ success: false, message: 'Template file path is missing' });
        }

        if (!fs.existsSync(template.storedFilePath)) {
            console.error(`[PDF Gen] Word file missing on disk: ${template.storedFilePath}`);
            return res.status(404).json({ success: false, message: 'Template Word file not found on server' });
        }
        console.log(`[PDF Gen] File path found and file exists: ${template.storedFilePath}`);

        // Ensure temp folder exists
        const tempFolder = os.tmpdir();
        if (!fs.existsSync(tempFolder)) {
            console.error(`[PDF Gen] Temp folder does not exist: ${tempFolder}`);
            fs.mkdirSync(tempFolder, { recursive: true });
        }

        // Fetch patient
        console.log(`[PDF Gen] Fetching patient data...`);
        const patient = await User.findById(patientId);
        if (!patient) {
            console.error(`[PDF Gen] Patient not found in database: ${patientId}`);
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        // Calculate age
        const age = getAge(patient);

        // Fetch hospital
        console.log(`[PDF Gen] Fetching hospital data for user: ${req.user.hospitalId}`);
        const hospital = req.user.hospitalId ? await Hospital.findById(req.user.hospitalId) : null;

        // Fetch latest appointment to get Doctor info
        console.log(`[PDF Gen] Fetching latest appointment...`);
        const latestAppointment = await Appointment.findOne({ userId: patientId, hospitalId: req.user.hospitalId })
            .sort({ createdAt: -1 })
            .populate('doctorId');
        
        const doctor = latestAppointment ? latestAppointment.doctorId : null;

        // Fetch partner (if applicable)
        console.log(`[PDF Gen] Fetching partner data...`);
        let partner = null;
        if (patient.partnerPatientId) {
            partner = await User.findById(patient.partnerPatientId);
        } else if (patient.linkedPatients && patient.linkedPatients.length > 0) {
            partner = await User.findById(patient.linkedPatients[0].patientId);
        }

        // Aggregate address
        const address = formatAddress(patient);
        const partnerAddress = formatAddress(partner);
        
        const partnerAge = getAge(partner);

        const todayDate = new Date();

        // Create the data dictionary for docxtemplater
        const docData = {
            patient_name: patient.name || '',
            age: age,
            gender: patient.gender || '',
            address: address,
            mobile: patient.phone || '',
            email: patient.email || '',
            mrn: patient.mrn || '',
            uhid: patient.patientId || '',
            doctor_name: doctor ? doctor.name : (patient.sourceInformation?.doctorName || ''),
            doctor_registration_no: 'N/A',
            hospital_name: hospital ? hospital.name : '',
            hospital_address: hospital ? [hospital.address, hospital.city, hospital.state].filter(Boolean).join(', ') : '',
            department: (patient.departments && patient.departments.length > 0) ? patient.departments.join(', ') : 'IVF',
            today: todayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            current_time: todayDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            appointment_date: latestAppointment && latestAppointment.appointmentDate ? new Date(latestAppointment.appointmentDate).toLocaleDateString('en-IN') : '',
            admission_date: '',
            relation: patient.partnerRelation || (patient.linkedPatients && patient.linkedPatients.length > 0 ? patient.linkedPatients[0].relationLabel : ''),
            relative_name: partner ? partner.name : '',
            relative_age: partnerAge,
            relative_address: partnerAddress
        };

        // Generate filled document (.docx)
        console.log(`[PDF Gen] Reading Word template and replacing placeholders...`);
        let filledDocxBuffer;
        try {
            filledDocxBuffer = ConsentFillerService.generateFilledDocument(template.storedFilePath, docData);
            console.log(`[PDF Gen] Placeholder replacement successful.`);
        } catch (fillErr) {
            console.error(`[PDF Gen] Placeholder replacement failed:`, fillErr);
            return res.status(500).json({ success: false, message: 'Placeholder replacement failed', error: fillErr.message });
        }

        // Convert .docx to .pdf in memory
        console.log(`[PDF Gen] PDF conversion started...`);
        let pdfBuffer;
        try {
            pdfBuffer = ConsentFillerService.convertToPdf(filledDocxBuffer);
            console.log(`[PDF Gen] PDF conversion completed successfully.`);
        } catch (convErr) {
            console.error(`[PDF Gen] PDF conversion failed:`, convErr);
            return res.status(500).json({ success: false, message: 'PDF conversion failed', error: convErr.message });
        }

        // Send back as downloadable file
        const pdfFilename = template.originalFileName ? template.originalFileName.replace(/\.docx?$/i, '.pdf') : 'Filled_Consent.pdf';
        res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
        console.log(`[PDF Gen] Response sent successfully.`);

    } catch (err) {
        console.error('[PDF Gen] Unexpected error during PDF generation:', err.stack);
        res.status(500).json({ success: false, message: 'Internal Server Error during PDF generation', error: err.message });
    }
});

module.exports = router;
