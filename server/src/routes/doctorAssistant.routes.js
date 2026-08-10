const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointment.model');
const Doctor = require('../models/doctor.model');
const User = require('../models/user.model');
const LabReport = require('../models/labReport.model');
const AuditLog = require('../models/auditLog.model');
const Notification = require('../models/notification.model');
const { verifyToken, requirePermission } = require('../middleware/auth.middleware');

// ==========================================
// HELPERS
// ==========================================

/**
 * Log action to AuditLog and optionally update the appointment timeline/status
 */
async function logAuditAndTimeline(appointmentId, modelName, action, field, oldValue, newValue, user, role, newStatus = null, timelineDetails = null) {
    try {
        // 1. Save to AuditLog
        await AuditLog.create({
            documentId: appointmentId,
            modelName,
            action,
            field,
            oldValue,
            newValue,
            modifiedBy: user._id,
            role
        });

        // 2. Update Timeline / Status if provided
        if (newStatus || timelineDetails) {
            const updateObj = { $push: {} };
            
            if (newStatus) {
                updateObj.$set = { consultationStatus: newStatus };
            }
            
            if (timelineDetails || newStatus) {
                updateObj.$push.timeline = {
                    status: newStatus || timelineDetails,
                    timestamp: new Date(),
                    user: user._id,
                    role: role,
                    details: timelineDetails || `Changed status to ${newStatus}`
                };
            }
            
            await Appointment.findByIdAndUpdate(appointmentId, updateObj);
        }
    } catch (err) {
        console.error('[AuditLog] Error logging:', err.message);
    }
}

/**
 * Get doctor IDs assigned to the current assistant user.
 * Returns an array of Doctor _ids.
 */
async function getAssignedDoctorIds(user) {
    if (user.assignedDoctors && user.assignedDoctors.length > 0) {
        return user.assignedDoctors;
    }
    // Fallback: if no doctors assigned, return all doctors in the same hospital
    const doctors = await Doctor.find({ hospitalId: user.hospitalId }).select('_id').lean();
    return doctors.map(d => d._id);
}

// ==========================================
// DASHBOARD STATS
// ==========================================

router.get('/dashboard-stats', verifyToken, async (req, res) => {
    try {
        const doctorIds = await getAssignedDoctorIds(req.user);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const appointments = await Appointment.find({
            hospitalId: req.user.hospitalId,
            doctorId: { $in: doctorIds },
            appointmentDate: { $gte: today, $lt: tomorrow },
            status: { $ne: 'cancelled' }
        }).lean();

        const total = appointments.length;
        const completed = appointments.filter(a => a.status === 'completed').length;
        const waiting = appointments.filter(a => !a.readyForDoctor && a.status !== 'completed').length;
        const readyForDoctor = appointments.filter(a => a.readyForDoctor && a.status !== 'completed').length;
        const reportsPending = appointments.filter(a => {
            const v = a.vitals || {};
            return !v.weight && !v.bp;
        }).length;
        const consentPending = appointments.filter(a => {
            return !a.preparation?.preparedAt;
        }).length;
        const investigationsPending = appointments.filter(a => {
            return a.labTests && a.labTests.length > 0;
        }).length;

        res.json({
            success: true,
            stats: {
                totalPatients: total,
                waiting,
                readyForDoctor,
                completed,
                reportsPending,
                consentPending,
                investigationsPending
            }
        });
    } catch (err) {
        console.error('[Assistant] Dashboard stats error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
    }
});

// ==========================================
// MY ASSIGNED DOCTORS
// ==========================================

router.get('/my-doctors', verifyToken, async (req, res) => {
    try {
        const doctorIds = await getAssignedDoctorIds(req.user);
        const doctors = await Doctor.find({ _id: { $in: doctorIds } })
            .populate('userId', 'name email phone')
            .select('name specialty departments image')
            .lean();

        res.json({ success: true, doctors });
    } catch (err) {
        console.error('[Assistant] My doctors error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch assigned doctors' });
    }
});

// ==========================================
// APPOINTMENTS (Today + All)
// ==========================================

router.get('/appointments', verifyToken, async (req, res) => {
    try {
        const doctorIds = await getAssignedDoctorIds(req.user);
        const { tab } = req.query;

        let dateFilter = {};
        if (tab !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateFilter = { appointmentDate: { $gte: today, $lt: tomorrow } };
        }

        const appointments = await Appointment.find({
            hospitalId: req.user.hospitalId,
            doctorId: { $in: doctorIds },
            status: { $ne: 'cancelled' },
            ...dateFilter
        })
            .populate('userId', 'name phone patientId mrn avatar gender dob')
            .populate('doctorId', 'name specialty')
            .sort({ appointmentDate: -1, appointmentTime: 1 })
            .lean();

        res.json({ success: true, appointments });
    } catch (err) {
        console.error('[Assistant] Appointments error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
    }
});

// ==========================================
// GET SINGLE APPOINTMENT DETAILS
// ==========================================

router.get('/appointment/:appointmentId', verifyToken, async (req, res) => {
    try {
        const appointment = await Appointment.findOne({
            _id: req.params.appointmentId,
            hospitalId: req.user.hospitalId
        })
            .populate('userId', 'name phone patientId mrn avatar gender dob bloodGroup')
            .populate('doctorId', 'name specialty')
            .lean();

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        res.json({ success: true, appointment });
    } catch (err) {
        console.error('[Assistant] Get appointment error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch appointment details' });
    }
});

// ==========================================
// PATIENT PROFILE
// ==========================================

router.get('/patient/:patientId/profile', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.patientId)
            .select('-password')
            .populate('partnerPatientId', 'name phone patientId')
            .lean();

        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        res.json({ success: true, patient });
    } catch (err) {
        console.error('[Assistant] Patient profile error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch patient profile' });
    }
});

// Update patient profile (e.g., adding consents or documents)
router.put('/patient/:patientId/profile', verifyToken, async (req, res) => {
    try {
        const patient = await User.findByIdAndUpdate(
            req.params.patientId,
            req.body,
            { new: true, runValidators: true }
        ).select('-password');

        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        res.json({ success: true, message: 'Patient profile updated', patient });
    } catch (err) {
        console.error('[Assistant] Update patient profile error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update patient profile' });
    }
});

// ==========================================
// SAVE PREPARATION
// ==========================================

router.post('/appointment/:appointmentId/preparation', verifyToken, async (req, res) => {
    try {
        const { chiefComplaint, presentIllness, pastHistory, familyHistory,
            surgicalHistory, allergies, currentMedicines, lifestyle, remarks } = req.body;

        const appointment = await Appointment.findOneAndUpdate(
            { _id: req.params.appointmentId, hospitalId: req.user.hospitalId },
            {
                preparation: {
                    chiefComplaint: chiefComplaint || '',
                    presentIllness: presentIllness || '',
                    pastHistory: pastHistory || '',
                    familyHistory: familyHistory || '',
                    surgicalHistory: surgicalHistory || '',
                    allergies: allergies || '',
                    currentMedicines: currentMedicines || '',
                    lifestyle: lifestyle || '',
                    remarks: remarks || '',
                    preparedBy: req.user._id,
                    preparedAt: new Date()
                }
            },
            { new: true }
        );

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }
        
        await logAuditAndTimeline(appointment._id, 'Appointment', 'UPDATE', 'preparation', null, 'Preparation updated', req.user, 'Doctor Assistant', 'Preparation In Progress', 'Assistant updated patient preparation');

        res.json({ success: true, message: 'Preparation saved', preparation: appointment.preparation });
    } catch (err) {
        console.error('[Assistant] Save preparation error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to save preparation' });
    }
});

// ==========================================
// SAVE VITALS
// ==========================================

router.post('/appointment/:appointmentId/vitals', verifyToken, async (req, res) => {
    try {
        const { weight, height, bmi, bp, temperature, pulse, spo2, rr, bloodSugar } = req.body;

        const appointment = await Appointment.findOneAndUpdate(
            { _id: req.params.appointmentId, hospitalId: req.user.hospitalId },
            {
                vitals: {
                    weight: weight || '',
                    height: height || '',
                    bmi: bmi || '',
                    bp: bp || '',
                    temperature: temperature || '',
                    pulse: pulse || '',
                    spo2: spo2 || '',
                    rr: rr || ''
                }
            },
            { new: true }
        );

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        // Also save bloodSugar to ivfDetails if provided
        if (bloodSugar) {
            await Appointment.findByIdAndUpdate(req.params.appointmentId, {
                'ivfDetails.bloodSugar': bloodSugar
            });
        }
        
        await logAuditAndTimeline(appointment._id, 'Appointment', 'UPDATE', 'vitals', null, 'Vitals updated', req.user, 'Doctor Assistant', 'Preparation In Progress', 'Assistant updated patient vitals');

        res.json({ success: true, message: 'Vitals saved', vitals: appointment.vitals });
    } catch (err) {
        console.error('[Assistant] Save vitals error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to save vitals' });
    }
});

// ==========================================
// SAVE IVF DETAILS
// ==========================================

router.post('/appointment/:appointmentId/ivf-details', verifyToken, async (req, res) => {
    try {
        const ivfData = req.body;

        const appointment = await Appointment.findOneAndUpdate(
            { _id: req.params.appointmentId, hospitalId: req.user.hospitalId },
            { ivfDetails: { ...(ivfData || {}) } },
            { new: true }
        );

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        res.json({ success: true, message: 'IVF details saved', ivfDetails: appointment.ivfDetails });
    } catch (err) {
        console.error('[Assistant] Save IVF details error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to save IVF details' });
    }
});

// ==========================================
// SAVE DRAFT CLINICAL NOTES
// ==========================================

router.post('/appointment/:appointmentId/clinical-notes', verifyToken, async (req, res) => {
    try {
        const { draftClinicalNotes, assistantNotes } = req.body;

        const update = {};
        if (draftClinicalNotes !== undefined) update.draftClinicalNotes = draftClinicalNotes;
        if (assistantNotes !== undefined) update.assistantNotes = assistantNotes;

        const appointment = await Appointment.findOneAndUpdate(
            { _id: req.params.appointmentId, hospitalId: req.user.hospitalId },
            update,
            { new: true }
        );

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }
        
        await logAuditAndTimeline(appointment._id, 'Appointment', 'UPDATE', 'draftClinicalNotes', null, 'Draft clinical notes updated', req.user, 'Doctor Assistant', 'Preparation In Progress', 'Assistant saved draft clinical notes');

        res.json({ success: true, message: 'Clinical notes saved' });
    } catch (err) {
        console.error('[Assistant] Save clinical notes error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to save clinical notes' });
    }
});

// ==========================================
// SAVE REPORTS / PRESCRIPTIONS
// ==========================================

router.post('/appointment/:appointmentId/reports', verifyToken, async (req, res) => {
    try {
        const { files } = req.body; // array of { url, name, type }

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files provided' });
        }

        const appointment = await Appointment.findOneAndUpdate(
            { _id: req.params.appointmentId, hospitalId: req.user.hospitalId },
            { $push: { prescriptions: { $each: files } } },
            { new: true }
        );

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        res.json({ success: true, message: 'Reports saved', prescriptions: appointment.prescriptions });
    } catch (err) {
        console.error('[Assistant] Save reports error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to save reports' });
    }
});

// ==========================================
// SAVE INVESTIGATION (LAB TESTS)
// ==========================================

router.post('/appointment/:appointmentId/investigations', verifyToken, async (req, res) => {
    try {
        const { labTestName } = req.body; 

        if (!labTestName) {
            return res.status(400).json({ success: false, message: 'Lab test name is required' });
        }

        const appointment = await Appointment.findOneAndUpdate(
            { _id: req.params.appointmentId, hospitalId: req.user.hospitalId },
            { $push: { labTests: labTestName } },
            { new: true }
        );

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        res.json({ success: true, message: 'Investigation added', labTests: appointment.labTests });
    } catch (err) {
        console.error('[Assistant] Save investigation error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to add investigation' });
    }
});

// ==========================================
// MARK READY FOR DOCTOR
// ==========================================

router.post('/appointment/:appointmentId/mark-ready', verifyToken, async (req, res) => {
    try {
        const appointment = await Appointment.findOneAndUpdate(
            { _id: req.params.appointmentId, hospitalId: req.user.hospitalId },
            { readyForDoctor: true, readyAt: new Date() },
            { new: true }
        );

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }
        await logAuditAndTimeline(appointment._id, 'Appointment', 'UPDATE', 'readyForDoctor', false, true, req.user, 'Doctor Assistant', 'Ready For Doctor', 'Assistant marked patient as ready for doctor');

        // Create Notification for the Doctor
        await Notification.create({
            senderId: req.user.id,
            hospitalId: req.user.hospitalId,
            recipientRole: 'doctor',
            recipientId: appointment.doctorId,
            message: `Patient ${appointment.userId?.name || 'Walk-in'} is Ready For Doctor.`,
            referenceType: 'ClinicalVisit',
            referenceId: appointment._id,
            patientId: appointment.userId?._id?.toString() || 'Unknown'
        });

        res.json({ success: true, message: 'Patient marked as ready for doctor' });
    } catch (err) {
        console.error('[Assistant] Mark ready error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to mark patient as ready' });
    }
});

// ==========================================
// CHECKLIST (Derived from existing data)
// ==========================================

router.get('/appointment/:appointmentId/checklist', verifyToken, async (req, res) => {
    try {
        const appointment = await Appointment.findOne({
            _id: req.params.appointmentId,
            hospitalId: req.user.hospitalId
        }).lean();

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        const vitals = appointment.vitals || {};
        const prep = appointment.preparation || {};

        const checklist = {
            vitalsCompleted: !!(vitals.weight || vitals.bp || vitals.pulse),
            reportsUploaded: !!(appointment.prescriptions && appointment.prescriptions.length > 0),
            consentGenerated: !!prep.preparedAt,
            preparationDone: !!(prep.chiefComplaint || prep.pastHistory || prep.presentIllness),
            investigationAdded: !!(appointment.labTests && appointment.labTests.length > 0),
            readyForDoctor: !!appointment.readyForDoctor
        };

        res.json({ success: true, checklist });
    } catch (err) {
        console.error('[Assistant] Checklist error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch checklist' });
    }
});

// ==========================================
// GET SINGLE APPOINTMENT DETAILS
// ==========================================

router.get('/appointment/:appointmentId', verifyToken, async (req, res) => {
    try {
        const appointment = await Appointment.findOne({
            _id: req.params.appointmentId,
            hospitalId: req.user.hospitalId
        })
            .populate('userId', 'name phone patientId mrn avatar gender dob email address houseNumber street city state pincode fertilityProfile sourceInformation linkedPatients partnerPatientId partnerRelation consents')
            .populate('doctorId', 'name specialty')
            .populate('preparation.preparedBy', 'name')
            .lean();

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        res.json({ success: true, appointment });
    } catch (err) {
        console.error('[Assistant] Appointment details error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch appointment details' });
    }
});

module.exports = router;
