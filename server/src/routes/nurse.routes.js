const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth.middleware');
const { resolveTenant } = require('../middleware/tenantMiddleware');
const MasterUser = require('../models/user.model');
const MasterAdmission = require('../models/admission.model');
const Appointment = require('../models/appointment.model');
const ClinicalVisit = require('../models/clinicalVisit.model');
const LabReport = require('../models/labReport.model');
const TreatmentPlan = require('../models/treatmentPlan.model');
const PharmacyOrder = require('../models/pharmacyOrder.model');
const Inventory = require('../models/inventory.model');
const { getTenantModels } = require('../db/tenantModels');

// Helper to get Tenant Admission model if multitenancy DB is active
const getAdmissionModel = (req) => {
    if (req.tenantDb) return getTenantModels(req.tenantDb).Admission;
    return MasterAdmission;
};

// Calculate age from dob or fertilityProfile
const calculateAge = (dob, fp) => {
    if (fp && fp.age) return fp.age;
    if (!dob) return '34';
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return dob; // string e.g. "34 yrs"
    const diff = Date.now() - birthDate.getTime();
    const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    return isNaN(age) ? '34' : age;
};

// Determine vitals status
const getVitalsStatus = (vitals) => {
    if (!vitals) return 'Stable';
    const spo2 = parseFloat(vitals.spo2 || 98);
    const pulse = parseFloat(vitals.pulse || 76);
    let sys = 120;
    if (vitals.bp && vitals.bp.includes('/')) {
        sys = parseFloat(vitals.bp.split('/')[0]);
    }
    if (spo2 < 92 || sys > 160 || sys < 85 || pulse > 120 || pulse < 45) {
        return 'Critical';
    }
    return 'Stable';
};

// Helper to fetch active prescriptions from ClinicalVisit and PharmacyOrder
const getPatientPrescriptions = async (realUserId, hospitalFilter) => {
    const userIdStr = realUserId.toString();
    const visits = await ClinicalVisit.find({ $or: [{ patientId: realUserId }, { patientId: userIdStr }], ...hospitalFilter }).sort({ visitDate: -1 }).limit(10).lean();
    const orders = await PharmacyOrder.find({ $or: [{ userId: realUserId }, { patientId: userIdStr }], ...hospitalFilter }).sort({ createdAt: -1 }).limit(10).lean();

    const medMap = new Map();
    visits.forEach(v => {
        if (v.doctorConsultation?.prescription && Array.isArray(v.doctorConsultation.prescription)) {
            v.doctorConsultation.prescription.forEach((p, idx) => {
                const name = p.medicine || p.medicineName;
                if (!name || name === 'Medicine') return;
                const lower = name.toLowerCase();
                if (!medMap.has(lower)) {
                    medMap.set(lower, {
                        id: `rx_${v._id}_${idx}`,
                        name: name,
                        dose: p.dosage || 'Standard Dose',
                        frequency: p.frequency || 'Twice daily',
                        type: lower.includes('inj') ? 'Injection' : (lower.includes('drip') || lower.includes('infusion') || lower.includes('cef') ? 'IV Drip' : 'Tablet'),
                        duration: p.duration || '5 days',
                        instruction: p.instruction || 'As prescribed',
                        prescriptionDate: v.visitDate ? new Date(v.visitDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(v.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                        doctorName: 'Assigned Doctor'
                    });
                }
            });
        }
    });

    orders.forEach(o => {
        if (o.items && Array.isArray(o.items)) {
            o.items.forEach((item, idx) => {
                const name = item.medicineName || item.name;
                if (!name) return;
                const lower = name.toLowerCase();
                if (!medMap.has(lower)) {
                    medMap.set(lower, {
                        id: `ord_${o._id}_${idx}`,
                        name: name,
                        dose: item.dose || 'Standard Dose',
                        frequency: item.frequency || 'Twice daily',
                        type: lower.includes('inj') ? 'Injection' : (lower.includes('drip') || lower.includes('infusion') || lower.includes('cef') ? 'IV Drip' : 'Tablet'),
                        duration: item.duration || '5 days',
                        instruction: item.instruction || 'As prescribed',
                        prescriptionDate: o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
                        doctorName: 'Assigned Doctor'
                    });
                }
            });
        }
    });

    return Array.from(medMap.values());
};

// 1. GET /api/nurse/patients — Get all patients under nurse care dynamically from DB
router.get('/patients', verifyToken, resolveTenant, async (req, res) => {
    try {
        const hospitalId = req.hospitalId || req.user.hospitalId;
        const hospitalFilter = hospitalId ? { hospitalId } : {};

        const Admission = getAdmissionModel(req);
        const activeAdmissions = await Admission.find({
            status: 'Admitted',
            ...hospitalFilter
        }).populate('patientId', 'name mrn coupleId patientId dob gender avatar phone fertilityProfile vitalsHistory medicationLogs').populate('admittedBy', 'name').lean();

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentAppointments = await Appointment.find({
            appointmentDate: { $gte: thirtyDaysAgo },
            status: { $ne: 'cancelled' },
            ...hospitalFilter
        }).populate('userId', 'name mrn coupleId patientId dob gender avatar phone fertilityProfile vitalsHistory medicationLogs').populate('doctorId', 'name').lean();

        const patientMap = new Map();
        const todayStr = new Date().toISOString().split('T')[0];

        // Process admitted patients
        for (const adm of activeAdmissions) {
            if (!adm.patientId) continue;
            const p = adm.patientId;
            const idStr = p._id.toString();
            const latestVitals = (p.vitalsHistory && p.vitalsHistory.length > 0)
                ? p.vitalsHistory[p.vitalsHistory.length - 1]
                : null;

            const docName = adm.admittedBy?.name ? (adm.admittedBy.name.startsWith('Dr.') ? adm.admittedBy.name : `Dr. ${adm.admittedBy.name}`) : 'Assigned Doctor';
            const meds = await getPatientPrescriptions(p._id, hospitalFilter);
            const medLogs = p.medicationLogs || [];
            const todayLogs = medLogs.filter(l => l.date === todayStr);
            const pendingCount = Math.max(0, meds.length - todayLogs.length);

            patientMap.set(idStr, {
                _id: p._id,
                name: p.name || 'Unknown Patient',
                mrn: p.mrn || p.patientId || `MRN-${p._id.toString().substring(0, 10).toUpperCase()}`,
                coupleId: p.coupleId || 'N/A',
                doctorName: docName,
                gender: p.gender || 'N/A',
                age: calculateAge(p.dob, p.fertilityProfile),
                ward: adm.ward || 'General Ward',
                bed: adm.bedNumber || 'Unassigned',
                vitalsStatus: getVitalsStatus(latestVitals),
                pendingDosesCount: pendingCount,
                allGiven: pendingCount === 0 && meds.length > 0,
                hasPrescription: meds.length > 0,
                isAdmitted: true,
                admissionDate: adm.admissionDate ? new Date(adm.admissionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
                followUpStatus: 'Inpatient Care',
                appointmentStatus: 'Admitted'
            });
        }

        // Process appointment patients
        for (const appt of recentAppointments) {
            if (!appt.userId) continue;
            const p = appt.userId;
            const idStr = p._id.toString();
            const docName = appt.doctorId?.name ? (appt.doctorId.name.startsWith('Dr.') ? appt.doctorId.name : `Dr. ${appt.doctorId.name}`) : 'Assigned Doctor';

            if (patientMap.has(idStr)) {
                const existing = patientMap.get(idStr);
                if (docName !== 'Assigned Doctor') existing.doctorName = docName;
                continue;
            }

            const latestVitals = (p.vitalsHistory && p.vitalsHistory.length > 0)
                ? p.vitalsHistory[p.vitalsHistory.length - 1]
                : null;

            const meds = await getPatientPrescriptions(p._id, hospitalFilter);
            const medLogs = p.medicationLogs || [];
            const todayLogs = medLogs.filter(l => l.date === todayStr);
            const pendingCount = Math.max(0, meds.length - todayLogs.length);

            patientMap.set(idStr, {
                _id: p._id,
                name: p.name || 'Unknown Patient',
                mrn: p.mrn || p.patientId || `MRN-${p._id.toString().substring(0, 10).toUpperCase()}`,
                coupleId: p.coupleId || 'N/A',
                doctorName: docName,
                gender: p.gender || 'N/A',
                age: calculateAge(p.dob, p.fertilityProfile),
                ward: 'Outpatient',
                bed: 'Consultation',
                vitalsStatus: getVitalsStatus(latestVitals),
                pendingDosesCount: pendingCount,
                allGiven: pendingCount === 0 && meds.length > 0,
                hasPrescription: meds.length > 0,
                isAdmitted: false,
                admissionDate: 'N/A',
                followUpStatus: appt.status || 'Scheduled',
                appointmentStatus: appt.status || 'Confirmed'
            });
        }

        const patientsList = Array.from(patientMap.values());
        res.json({ success: true, patients: patientsList });
    } catch (error) {
        console.error("Get Nurse Patients Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. GET /api/nurse/patient/:id — Get comprehensive profile, medication journey & vitals dynamically from DB
router.get('/patient/:id', verifyToken, resolveTenant, async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalId = req.hospitalId || req.user.hospitalId;
        const hospitalFilter = hospitalId ? { hospitalId } : {};

        const isObjectId = mongoose.Types.ObjectId.isValid(id);
        const userQuery = isObjectId ? { _id: id } : { $or: [{ patientId: id }, { mrn: id }] };
        const user = await MasterUser.findOne(userQuery).lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        const realUserId = user._id;

        const Admission = getAdmissionModel(req);
        const admission = await Admission.findOne({ patientId: realUserId, status: 'Admitted', ...hospitalFilter }).populate('admittedBy', 'name').sort({ admissionDate: -1 }).lean();
        const latestAppt = await Appointment.findOne({ userId: realUserId, ...hospitalFilter }).populate('doctorId', 'name').sort({ appointmentDate: -1 }).lean();

        const doctorName = admission?.admittedBy?.name ? (admission.admittedBy.name.startsWith('Dr.') ? admission.admittedBy.name : `Dr. ${admission.admittedBy.name}`) : (latestAppt?.doctorId?.name ? (latestAppt.doctorId.name.startsWith('Dr.') ? latestAppt.doctorId.name : `Dr. ${latestAppt.doctorId.name}`) : 'Assigned Doctor');

        const vitalsHistory = user.vitalsHistory || [];
        const latestVitals = vitalsHistory.length > 0 ? vitalsHistory[vitalsHistory.length - 1] : {};

        const visits = await ClinicalVisit.find({ patientId: realUserId, ...hospitalFilter }).sort({ visitDate: -1 }).lean();
        const treatmentHistory = [];
        visits.forEach(v => {
            if (v.doctorConsultation?.diagnosis && v.doctorConsultation.diagnosis.length > 0) {
                treatmentHistory.push({
                    date: v.visitDate ? new Date(v.visitDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(v.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                    diagnosis: v.doctorConsultation.diagnosis.join(', '),
                    notes: v.doctorConsultation.clinicalNotes || v.doctorConsultation.procedureAdvice || ''
                });
            }
        });

        const currentMedicines = await getPatientPrescriptions(realUserId, hospitalFilter);
        currentMedicines.forEach(m => {
            if (m.doctorName === 'Assigned Doctor') m.doctorName = doctorName;
        });

        const injectionHistory = currentMedicines.filter(m => m.type === 'Injection' || m.name.toLowerCase().includes('inj'));
        const labReports = await LabReport.find({ $or: [{ userId: realUserId }, { patientId: realUserId.toString() }], ...hospitalFilter }).sort({ createdAt: -1 }).lean();
        const packages = admission?.selectedFacilities || [];

        // Build dynamic Medication Journey
        const medLogs = user.medicationLogs || [];
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        const isLogged = (name, dateStr, timeStr) => medLogs.some(l => l.medicineName === name && l.date === dateStr && (!timeStr || l.time === timeStr));

        const yesterdayItems = [];
        const todayItems = [];
        const tomorrowItems = [];

        currentMedicines.forEach((med, i) => {
            const freq = (med.frequency || '').toLowerCase();
            let times = ['09:00 AM'];
            if (freq.includes('twice') || freq.includes('bid') || freq.includes('2')) {
                times = ['08:00 AM', '08:00 PM'];
            } else if (freq.includes('thrice') || freq.includes('tid') || freq.includes('3')) {
                times = ['08:00 AM', '02:00 PM', '08:00 PM'];
            } else if (freq.includes('four') || freq.includes('qid') || freq.includes('4')) {
                times = ['06:00 AM', '12:00 PM', '06:00 PM', '10:00 PM'];
            }

            times.forEach((t, idx) => {
                const yLogged = isLogged(med.name, yesterdayStr, t);
                yesterdayItems.push({
                    id: `y_${i}_${idx}`,
                    name: med.name,
                    time: t,
                    type: med.type,
                    status: yLogged ? 'Given' : 'Completed',
                    progress: yLogged ? 'Administered' : 'Logged',
                    isGiven: yLogged
                });

                const tLogged = isLogged(med.name, todayStr, t);
                todayItems.push({
                    id: `t_${i}_${idx}`,
                    name: med.name,
                    time: t,
                    type: med.type,
                    status: tLogged ? 'Given' : 'Due Now',
                    progress: tLogged ? 'Administered today' : `${med.duration} course`,
                    isGiven: tLogged
                });

                tomorrowItems.push({
                    id: `tm_${i}_${idx}`,
                    name: med.name,
                    time: t,
                    type: med.type,
                    status: 'Scheduled',
                    progress: 'Scheduled tomorrow',
                    isGiven: false
                });
            });
        });

        const medicationJourney = {
            yesterday: {
                date: new Date(Date.now() - 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                items: yesterdayItems
            },
            today: {
                date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                items: todayItems
            },
            tomorrow: {
                date: new Date(Date.now() + 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                items: tomorrowItems
            }
        };

        const tabletsToday = todayItems.filter(i => i.type === 'Tablet');
        const dripsToday = todayItems.filter(i => i.type === 'IV Drip');
        const injectionsToday = todayItems.filter(i => i.type === 'Injection');
        const pendingToday = todayItems.filter(i => !i.isGiven);

        const stats = {
            tabletsTotal: tabletsToday.length,
            tabletsPending: tabletsToday.filter(i => !i.isGiven).length,
            dripsTotal: dripsToday.length,
            dripsPending: dripsToday.filter(i => !i.isGiven).length,
            injectionsTotal: injectionsToday.length,
            injectionsPending: injectionsToday.filter(i => !i.isGiven).length,
            totalPending: pendingToday.length
        };

        const injectionTracking = [];
        for (const injMed of currentMedicines.filter(m => m.type === 'Injection' || m.name.toLowerCase().includes('inj'))) {
            const cleanName = injMed.name.replace(/^Inj\.\s*/i, '').trim();
            const inv = await Inventory.findOne({ name: { $regex: cleanName, $options: 'i' }, ...hospitalFilter }).lean();
            const injLogs = medLogs.filter(l => l.medicineName === injMed.name && l.status === 'Given');
            const todayInjLogs = injLogs.filter(l => l.date === todayStr);
            const yesterdayInjLogs = injLogs.filter(l => l.date === yesterdayStr);
            const latestLog = injLogs[injLogs.length - 1];

            const purchasedQty = inv ? `${inv.stock + injLogs.length} units` : `${injLogs.length || 0} units`;
            const remainingQty = inv ? `${inv.stock} units` : '0 units';

            injectionTracking.push({
                name: injMed.name,
                purchased: purchasedQty,
                used: `${injLogs.length} units`,
                remaining: remainingQty,
                usedToday: `${todayInjLogs.length} units`,
                usedYesterday: `${yesterdayInjLogs.length} units`,
                administeredBy: latestLog ? (latestLog.administeredBy || 'Nurse') : 'N/A',
                date: latestLog ? latestLog.date : 'N/A',
                time: latestLog ? latestLog.time : 'N/A'
            });
        }

        res.json({
            success: true,
            profile: {
                _id: user._id,
                mrn: user.mrn || user.patientId || `MRN-${user._id.toString().substring(0, 10).toUpperCase()}`,
                coupleId: user.coupleId || 'N/A',
                name: user.name,
                age: calculateAge(user.dob, user.fertilityProfile),
                gender: user.gender || 'N/A',
                doctor: doctorName,
                ward: admission?.ward || (latestAppt ? 'Outpatient' : 'General Ward'),
                bed: admission?.bedNumber || (latestAppt ? 'Consultation' : 'Unassigned'),
                admittedDate: admission?.admissionDate ? new Date(admission.admissionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
                vitalsStatus: getVitalsStatus(latestVitals),
                latestVitals,
                vitalsHistory,
                currentMedicines,
                injectionHistory,
                treatmentHistory,
                labReports,
                packages,
                followUpStatus: latestAppt?.status || (admission ? 'Inpatient Care' : 'None'),
                appointmentStatus: latestAppt?.status || (admission ? 'Admitted' : 'None'),
                medicationJourney,
                stats,
                injectionTracking
            }
        });
    } catch (error) {
        console.error("Get Patient Details Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. POST /api/nurse/patient/:id/dose-status — Mark dose given/pending
router.post('/patient/:id/dose-status', verifyToken, resolveTenant, async (req, res) => {
    try {
        const { id } = req.params;
        const { medicineName, time, status } = req.body;
        const todayStr = new Date().toISOString().split('T')[0];

        const user = await MasterUser.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'Patient not found' });

        let medLogs = user.medicationLogs || [];
        if (status === 'Given') {
            if (!medLogs.some(l => l.medicineName === medicineName && l.date === todayStr && l.time === time)) {
                medLogs.push({
                    medicineName,
                    date: todayStr,
                    time,
                    status: 'Given',
                    administeredBy: req.user.name || 'Nurse',
                    timestamp: new Date()
                });
            }
        } else {
            // Revert status
            medLogs = medLogs.filter(l => !(l.medicineName === medicineName && l.date === todayStr && l.time === time));
        }

        user.medicationLogs = medLogs;
        user.markModified('medicationLogs');
        await user.save();

        res.json({ success: true, message: `Dose marked as ${status}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. POST /api/nurse/vitals — Record patient vitals permanently
router.post('/vitals', verifyToken, resolveTenant, async (req, res) => {
    try {
        const { patientId, weight, height, bmi, bp, pulse, temp, spo2, respRate, chiefComplaint, nurseNotes } = req.body;
        if (!patientId) return res.status(400).json({ success: false, message: 'patientId is required' });

        const user = await MasterUser.findById(patientId);
        if (!user) return res.status(404).json({ success: false, message: 'Patient not found' });

        const newVitalEntry = {
            id: `v_${Date.now()}`,
            timestamp: new Date(),
            recordedBy: req.user.name || 'Nurse',
            weight: weight || '',
            height: height || '',
            bmi: bmi || '',
            bp: bp || '',
            pulse: pulse || '',
            temp: temp || '',
            spo2: spo2 || '',
            respRate: respRate || '',
            chiefComplaint: chiefComplaint || '',
            notes: nurseNotes || ''
        };

        const vitalsList = user.vitalsHistory || [];
        vitalsList.push(newVitalEntry);
        user.vitalsHistory = vitalsList;
        user.markModified('vitalsHistory');

        // If nurseNotes provided, also save to nursingNotes array
        if (nurseNotes) {
            const notesList = user.nursingNotes || [];
            notesList.push({
                id: `n_${Date.now()}`,
                note: nurseNotes,
                author: req.user.name || 'Nurse',
                role: 'Nurse',
                timestamp: new Date()
            });
            user.nursingNotes = notesList;
            user.markModified('nursingNotes');
        }

        await user.save();

        // Also record in ClinicalVisit intake if active visit exists today
        try {
            const todayStart = new Date();
            todayStart.setHours(0,0,0,0);
            let visit = await ClinicalVisit.findOne({ patientId: user._id, visitDate: { $gte: todayStart } });
            if (!visit) {
                visit = new ClinicalVisit({
                    patientId: user._id,
                    hospitalId: req.hospitalId || req.user.hospitalId,
                    visitDate: new Date(),
                    intake: {
                        filledBy: req.user._id || req.user.id,
                        timestamp: new Date(),
                        vitals: { bp, pulse, temp, weight, bmi, height, spo2, respRate },
                        chiefComplaint,
                        completed: true
                    },
                    status: 'ready_for_doctor'
                });
            } else {
                visit.intake = {
                    ...visit.intake,
                    filledBy: req.user._id || req.user.id,
                    timestamp: new Date(),
                    vitals: { bp, pulse, temp, weight, bmi, height, spo2, respRate },
                    chiefComplaint: chiefComplaint || visit.intake?.chiefComplaint,
                    completed: true
                };
            }
            await visit.save();
        } catch (vErr) {
            console.error("Non-blocking clinical visit save error:", vErr.message);
        }

        res.json({ success: true, message: 'Vitals recorded successfully', entry: newVitalEntry });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. GET & POST /api/nurse/notes/:patientId — Nursing notes management
router.get('/notes/:patientId', verifyToken, resolveTenant, async (req, res) => {
    try {
        const user = await MasterUser.findById(req.params.patientId).lean();
        if (!user) return res.status(404).json({ success: false, message: 'Patient not found' });
        res.json({ success: true, notes: (user.nursingNotes || []).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/notes/:patientId', verifyToken, resolveTenant, async (req, res) => {
    try {
        const { note } = req.body;
        if (!note) return res.status(400).json({ success: false, message: 'Note content is required' });

        const user = await MasterUser.findById(req.params.patientId);
        if (!user) return res.status(404).json({ success: false, message: 'Patient not found' });

        const newNote = {
            id: `n_${Date.now()}`,
            note,
            author: req.user.name || 'Nurse',
            role: req.user.role || 'Nurse',
            timestamp: new Date()
        };

        const notesList = user.nursingNotes || [];
        notesList.push(newNote);
        user.nursingNotes = notesList;
        user.markModified('nursingNotes');
        await user.save();

        res.json({ success: true, message: 'Note added successfully', note: newNote });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
