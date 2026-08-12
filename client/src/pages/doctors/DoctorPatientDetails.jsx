import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doctorAPI, labTestAPI, questionLibraryAPI, hospitalAPI, testPackageAPI } from '../../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './DoctorPatientDetails.css';
import DynamicQuestionForm from '../../components/DynamicQuestionForm';
import { useAuth } from '../../store/hooks';
import SharedReportNotesSection from '../../components/lab/SharedReportNotesSection';

const doseOptions = [
    "OD – Once Daily",
    "BD – Twice Daily",
    "TDS – Three Times Daily",
    "QID – Four Times Daily",
    "OM – Every Morning",
    "ON – Every Night",
    "QOD – Every Alternate Day",
    "OW – Once Weekly",
    "SOS – As Needed"
];

const parseDoseFreq = (doseStr) => {
    if (!doseStr) return 0;
    const s = doseStr.toLowerCase();
    if (s.includes('qid') || s.includes('four times')) return 4;
    if (s.includes('tds') || s.includes('three times')) return 3;
    if (s.includes('bd') || s.includes('twice')) return 2;
    if (s.includes('od') || s.includes('once') || s.includes('om') || s.includes('on') || s.includes('sos') || s.includes('qod') || s.includes('ow')) return 1;
    return 0;
};

const timingOptions = [
    "Before Breakfast (BBF)",
    "After Breakfast (ABF)",
    "Before Lunch (BL)",
    "After Lunch (AL)",
    "Before Dinner (BDN)",
    "After Dinner (ADN)",
    "Before Meals (AC)",
    "After Meals (PC)",
    "With Food",
    "On Empty Stomach",
    "At Bedtime (HS)"
];

const MedicineSearchInput = ({ value, onChange, medicines }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef(null);

    const sortedMedicines = React.useMemo(() => {
        return [...medicines].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [medicines]);

    const filtered = React.useMemo(() => {
        const query = (value || '').toLowerCase().trim();
        if (!query) return sortedMedicines;
        return sortedMedicines.filter(med =>
            (med.name || '').toLowerCase().includes(query)
        );
    }, [value, sortedMedicines]);

    const displayed = React.useMemo(() => {
        return filtered.slice(0, 50);
    }, [filtered]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
            setHighlightedIndex(prev => (prev + 1) % Math.max(1, displayed.length));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIsOpen(true);
            setHighlightedIndex(prev => (prev - 1 + displayed.length) % Math.max(1, displayed.length));
        } else if (e.key === 'Enter') {
            if (isOpen && highlightedIndex >= 0 && highlightedIndex < displayed.length) {
                e.preventDefault();
                onChange(displayed[highlightedIndex].name);
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <input
                value={value || ''}
                onChange={(e) => {
                    onChange(e.target.value);
                    setIsOpen(true);
                    setHighlightedIndex(-1);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search or type medicine..."
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '5px 7px', fontSize: '12px', boxSizing: 'border-box' }}
            />
            {isOpen && displayed.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    borderRadius: '6px',
                    zIndex: 9999,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    marginTop: '4px'
                }}>
                    {displayed.map((med, idx) => (
                        <div
                            key={idx}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onChange(med.name);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                background: idx === highlightedIndex ? '#eff6ff' : 'white',
                                borderBottom: '1px solid #f8fafc',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                        >
                            <span style={{ fontWeight: '600', color: '#1e293b', textAlign: 'left' }}>{med.name}</span>
                            {med.category && (
                                <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                    {med.category}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DoctorPatientDetails = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Check if the current user is a Junior Doctor
    const roleName = user?._roleData?.name?.toLowerCase() || (typeof user?.role === 'string' ? user.role.toLowerCase() : '');
    const isJrDoctor = roleName.includes('jr') && roleName.includes('doctor');

    const [appointment, setAppointment] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [catalogTests, setCatalogTests] = useState([]);
    const [catalogMedicines, setCatalogMedicines] = useState([]);
    const [testPackages, setTestPackages] = useState([]);
    const [selectedPackages, setSelectedPackages] = useState([]);
    const [dynamicLibrary, setDynamicLibrary] = useState(null);
    const [hospitalDepartments, setHospitalDepartments] = useState([]);
    const [isLocked, setIsLocked] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [hospitalContext, setHospitalContext] = useState(null);
    const [patientLatestVitals, setPatientLatestVitals] = useState(null);

    // Modal States
    const [showPrescribeModal, setShowPrescribeModal] = useState(false);

    // Inventory search states
    const [inventorySearchQuery, setInventorySearchQuery] = useState('');
    const [inventorySearchOpen, setInventorySearchOpen] = useState(false);
    const searchContainerRef = useRef(null);

    const sortedInventoryMedicines = React.useMemo(() => {
        return [...catalogMedicines].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [catalogMedicines]);

    const filteredInventoryMedicines = React.useMemo(() => {
        const query = inventorySearchQuery.toLowerCase().trim();
        if (!query) return [];
        return sortedInventoryMedicines.filter(med =>
            (med.name || '').toLowerCase().includes(query)
        );
    }, [inventorySearchQuery, sortedInventoryMedicines]);

    const displayedInventoryMedicines = React.useMemo(() => {
        return filteredInventoryMedicines.slice(0, 50);
    }, [filteredInventoryMedicines]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setInventorySearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Tab State for Left Panel
    const [activeTab, setActiveTab] = useState('overview');

    // Time Machine Feature State
    const [viewingPastSession, setViewingPastSession] = useState(null);

    // Doctor's Session Notepad (Right Panel)
    const [sessionData, setSessionData] = useState({
        diagnosis: '', notes: '', medicines: [], labTests: ''
    });

    const [selectedMedsForCompound, setSelectedMedsForCompound] = useState([]);

    const handleGroupCompound = () => {
        if (selectedMedsForCompound.length < 2) {
            alert("Please select at least 2 medicines to create an admixture.");
            return;
        }
        const mixName = prompt("Enter a name for this compound/admixture (e.g., IV Fluid Admixture):");
        if (!mixName) return;
        
        const mixId = Date.now().toString(); 
        
        setSessionData(prev => {
            const newMeds = [...prev.medicines];
            selectedMedsForCompound.forEach(idx => {
                newMeds[idx] = { ...newMeds[idx], mixId, mixName };
            });
            return { ...prev, medicines: newMeds };
        });
        setSelectedMedsForCompound([]);
    };

    // Patient Intake Profile (Left Panel - Editable by Doctor)
    const [intakeData, setIntakeData] = useState({});
    const [patientLabReports, setPatientLabReports] = useState([]);

    // Tab Scrolling Reference
    const tabsRef = useRef(null);

    const handleTabsWheel = (e) => {
        if (tabsRef.current) {
            // Only convert pure vertical scrolling to horizontal scrolling (mouse wheels)
            // Allow native 2-finger horizontal trackpad scrolling to pass through naturally
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                tabsRef.current.scrollBy({ left: e.deltaY, behavior: 'auto' });
            }
        }
    };

    const scrollTabs = (dir) => {
        if (tabsRef.current) {
            tabsRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
        }
    };

    // Add non-passive event listener for proper wheel interception without console errors
    useEffect(() => {
        const el = tabsRef.current;
        if (el) {
            el.addEventListener('wheel', handleTabsWheel, { passive: false });
        }
        return () => {
            if (el) el.removeEventListener('wheel', handleTabsWheel);
        };
    }, []);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await doctorAPI.getAppointmentDetails(appointmentId);
                console.log("FETCHED PATIENT PROFILE FROM BACKEND:", res);
                if (res.success) {
                    setAppointment(res.appointment);
                    setIntakeData(res.appointment.userId?.fertilityProfile || {});
                    
                    // Lock if completed
                    if (res.appointment.status === 'completed') {
                        setIsLocked(true);
                    }

                    if (res.appointment.userId?._id) {
                        const [histRes, fpRes] = await Promise.all([
                            doctorAPI.getPatientHistory(res.appointment.userId._id),
                            doctorAPI.getFullPatientProfile(res.appointment.userId._id)
                        ]);
                        if (histRes.success) setHistory(histRes.history || histRes.data || []);
                        if (fpRes.success) {
                            setPatientLabReports(fpRes.labReports || []);
                            if (fpRes.patient?.vitalsHistory?.length > 0) {
                                setPatientLatestVitals(fpRes.patient.vitalsHistory[fpRes.patient.vitalsHistory.length - 1]);
                            }
                        }
                    }

                    setSessionData({
                        diagnosis: res.appointment.diagnosis || '',
                        notes: res.appointment.doctorNotes || '',
                        medicines: (res.appointment.pharmacy || []).map(p => ({
                            medicineName: p.medicineName || '',
                            saltName: p.saltName || '',
                            dose: p.frequency || '',
                            days: p.duration || '',
                            volumeMl: p.volumeMl || '',
                            administrationTime: p.administrationTime || '',
                            gapDays: p.gapDays || 0,
                            startDate: p.startDate ? p.startDate.split('T')[0] : '',
                            dosePerAdmin: p.dosePerAdmin || '',
                            frequency: p.numericFrequency ? String(p.numericFrequency) : '',
                            durationDays: p.durationDays ? String(p.durationDays) : '',
                            vialSize: p.vialSize || '',
                            totalDosageRequired: p.totalDosageRequired || 0,
                            scheduleText: p.scheduleText || '',
                            mixId: p.mixId || null,
                            mixName: p.mixName || null
                        })),
                        labTests: (res.appointment.labTests || []).join(', ')
                    });
                    
                    if (res.departments) {
                        setHospitalDepartments(res.departments);
                    }
                }
            } catch (err) { console.error(err); }

            try {
                const [testRes, pkgRes] = await Promise.all([
                    labTestAPI.getLabTests(),
                    testPackageAPI.getPackages()
                ]);
                if (testRes.success) setCatalogTests(testRes.data || []);
                if (pkgRes.success) setTestPackages((pkgRes.data || []).filter(p => p.isActive));
            } catch (err) { console.error("Error fetching lab test catalog", err); }

            try {
                const medRes = await doctorAPI.getMedicines();
                if (medRes.success) {
                    setCatalogMedicines(medRes.medicines || []);
                }
            } catch (err) { console.error("Error fetching pharmacy inventory", err); }

            try {
                const libRes = await questionLibraryAPI.getLibrary();
                if (libRes.success && libRes.data && libRes.data.data) {
                    setDynamicLibrary(libRes.data.data);
                }
            } catch (err) { console.error("Error fetching dynamic question library", err); }

            finally { setLoading(false); }
        };
        fetchDetails();

        // Fetch hospital context for PDF branding
        const fetchHospital = async () => {
            try {
                const res = await hospitalAPI.getMyHospital();
                if (res.success) setHospitalContext(res.hospital);
            } catch (err) { /* ignore */ }
        };
        fetchHospital();
    }, [appointmentId]);

    const handleIntakeChange = (e) => {
        const { name, value } = e.target;
        // Handle BMI calculation
        if (name === 'height' || name === 'weight') {
            const h = name === 'height' ? value : intakeData.height;
            const w = name === 'weight' ? value : intakeData.weight;
            if (h && w) {
                const hM = parseFloat(h) / 100;
                const bmi = (parseFloat(w) / (hM * hM)).toFixed(2);
                setIntakeData(prev => ({ ...prev, [name]: value, bmi }));
                return;
            }
        }
        setIntakeData(prev => ({ ...prev, [name]: value }));
    };

    const handleSessionChange = (e) => {
        if (isLocked) return;
        setSessionData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSaveProfile = async () => {
        if (!appointment?.userId?._id) return;
        setSaving(true);
        try {
            await doctorAPI.updatePatientProfile(appointment.userId._id, intakeData);
            alert("✅ Patient profile saved successfully!");
        } catch (err) {
            alert("Error saving profile: " + err.message);
        } finally { setSaving(false); }
    };

    const handleSaveAndMerge = async () => {
        setSaving(true);
        try {
            // 1. Save Profile
            if (appointment.userId?._id) {
                await doctorAPI.updatePatientProfile(appointment.userId._id, intakeData);
            }

            // 2. Save Session
            const payload = {
                status: 'completed',
                diagnosis: sessionData.diagnosis,
                notes: sessionData.notes,
                labTests: sessionData.labTests.split(',').map(s => s.trim()).filter(Boolean),
                selectedPackages: selectedPackages,
                pharmacy: (sessionData.medicines || []).filter(m => m.medicineName?.trim()).map(m => {
                    const isInjection = (m.medicineName || '').toLowerCase().includes('inj') || (m.medicineName || '').toLowerCase().includes('drip') || m.totalDosageRequired > 0;
                    
                    const medNameLower = (m.medicineName || '').toLowerCase();
                    const unit = medNameLower.includes('insulin') || medNameLower.includes('heparin') || medNameLower.includes('iu') ? 'IU' : 'ml';
                    const actualDoseString = isInjection ? `${m.dosePerAdmin || 1} ${unit}` : (m.dose || '');
                    
                    const scheduleText = isInjection 
                        ? `${m.dosePerAdmin || 1} ${unit} x ${m.frequency || 1}/day for ${m.durationDays || 1} days` 
                        : '';
                    
                    return {
                        medicineName: m.medicineName?.trim() || '',
                        saltName: m.saltName?.trim() || '',
                        frequency: m.dose?.trim() || '',
                        duration: m.days?.trim() || '',
                        days: Number(m.days || m.duration || 1),
                        volumeMl: m.volumeMl?.trim() || '',
                        administrationTime: m.administrationTime?.trim() || '',
                        gapDays: m.gapDays ? parseInt(m.gapDays, 10) : 0,
                        startDate: m.startDate || null,
                        totalDosageRequired: Number(m.totalDosageRequired) || 0,
                        dosePerAdmin: Number(m.dosePerAdmin || m.doseAdmin || m.dose || 1),
                        doseAdmin: Number(m.dosePerAdmin || m.doseAdmin || m.dose || 1),
                        numericFrequency: Number(m.frequency) || 0,
                        durationDays: Number(m.durationDays) || 0,
                        vialSize: Number(m.vialSize) || 0,
                        scheduleText: scheduleText,
                        dose: actualDoseString,
                        mixId: m.mixId || null,
                        mixName: m.mixName || null
                    };
                })
            };

            console.log("OUTGOING PRESCRIPTION PAYLOAD:", JSON.stringify(payload, null, 2));
            await doctorAPI.updateSession(appointmentId, payload);

            alert("✅ Session saved successfully!");
            if (isEditing) {
                setIsEditing(false);
                setIsLocked(true);
            } else {
                navigate('/doctor/patients');
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally { setSaving(false); }
    };

    const generateCumulativePDF = (intake, pastHistory, currentData) => {
        const doc = new jsPDF();
        let y = 20;

        doc.setFontSize(22);
        doc.setTextColor(41, 128, 185);
        doc.text(hospitalContext?.name || "HOSPITAL", 105, y, { align: 'center' });
        y += 10;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(hospitalContext?.tagline || "Excellence in Healthcare", 105, y, { align: 'center' });
        y += 15;

        doc.setLineWidth(0.5);
        doc.setDrawColor(200);
        doc.line(10, y, 200, y);
        y += 10;

        doc.setFontSize(18);
        doc.setTextColor(0);
        doc.text("CLINICAL RECORD / PRESCRIPTION", 105, y, { align: 'center' }); y += 15;

        doc.setFillColor(240, 240, 240); doc.rect(14, y, 182, 42, 'F');
        doc.setFontSize(11);

        const cardX = 20;
        let cardY = y + 8;

        doc.setFont("helvetica", "bold");
        doc.text(`Patient Name:`, cardX, cardY);
        doc.setFont("helvetica", "normal");
        doc.text(`${intake.firstName || appointment.userId?.name || ''} ${intake.lastName || ''}`, cardX + 30, cardY);

        doc.setFont("helvetica", "bold");
        doc.text(`MRN / ID:`, cardX + 100, cardY);
        doc.setFont("helvetica", "normal");
        doc.text(`${appointment.userId?.patientId || 'N/A'}`, cardX + 130, cardY);

        cardY += 8;
        doc.setFont("helvetica", "bold");
        doc.text(`Age / Gender:`, cardX, cardY);
        doc.setFont("helvetica", "normal");
        doc.text(`${intake.age || '-'} / ${intake.gender || '-'}`, cardX + 30, cardY);

        doc.setFont("helvetica", "bold");
        doc.text(`Date:`, cardX + 100, cardY);
        doc.setFont("helvetica", "normal");
        doc.text(`${new Date().toLocaleDateString()}`, cardX + 130, cardY);

        cardY += 8;
        doc.setFont("helvetica", "bold");
        doc.text(`Contact:`, cardX, cardY);
        doc.setFont("helvetica", "normal");
        doc.text(`${appointment.userId?.phone || '-'}`, cardX + 30, cardY);

        // Doctor Name
        doc.setFont("helvetica", "bold");
        doc.text(`Doctor:`, cardX + 100, cardY);
        doc.setFont("helvetica", "normal");
        doc.text(`Dr. ${appointment.doctorName || user?.name || '-'}`, cardX + 130, cardY);

        y += 50;

        // Iterate over dynamic intake data
        const dynamicEntries = Object.entries(intake).filter(([key, val]) => 
            key !== '_id' && key !== 'createdAt' && key !== 'updatedAt' && key !== '__v' 
            && typeof val !== 'object' && val !== ''
        ).map(([key, val]) => [key, String(val)]);

        if (dynamicEntries.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [['Clinical Questionnaire', 'Response']],
                body: dynamicEntries,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                columnStyles: { 0: { fontStyle: 'bold', width: 80 } }
            });
            y = doc.lastAutoTable.finalY + 10;
        }

        if (pastHistory.length > 0) {
            doc.setFillColor(220, 240, 255); doc.rect(14, y, 180, 8, 'F');
            doc.text("PAST SESSIONS", 16, y + 6); y += 12;
            const rows = pastHistory.filter(h => h.status === 'completed' && h._id !== appointmentId).map(h => [
                new Date(h.appointmentDate).toLocaleDateString(), h.diagnosis || '-', h.doctorNotes || '-'
            ]);
            if (rows.length > 0) {
                autoTable(doc, { startY: y, head: [['Date', 'Diagnosis', 'Notes']], body: rows });
                y = doc.lastAutoTable.finalY + 10;
            }
        }

        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFillColor(200, 255, 200); doc.rect(14, y, 180, 8, 'F');
        doc.text(`CURRENT SESSION: ${new Date().toLocaleDateString()}`, 16, y + 6); y += 12;

        doc.setFontSize(10);
        doc.text(`Diagnosis: ${currentData.diagnosis}`, 16, y); y += 10;
        doc.text("Notes:", 16, y); y += 6;
        const notes = doc.splitTextToSize(currentData.notes, 170);
        doc.text(notes, 16, y); y += (notes.length * 5) + 10;

        // Medicines
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text("Prescription / Medicines:", 16, y); y += 8;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const rxItems = (currentData.pharmacy || []);
        if (rxItems.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [['#', 'Medicine Name', 'Dose / Frequency', 'Timing / Instructions', 'Days']],
                body: rxItems.map((p, i) => [i + 1, p.medicineName, p.frequency || '-', p.saltName || '-', p.duration || '-']),
                theme: 'striped',
                headStyles: { fillColor: [76, 175, 80], textColor: 255 },
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 55 }, 2: { cellWidth: 40 }, 3: { cellWidth: 50 }, 4: { cellWidth: 20 } },
            });
            y = doc.lastAutoTable.finalY + 10;
        } else {
            doc.text('No medicines prescribed.', 16, y); y += 8;
        }

        // Lab Tests
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text("Lab Tests Ordered:", 16, y); y += 8;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const labItems = (currentData.labTests || []);
        if (labItems.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [['#', 'Test Name']],
                body: labItems.map((t, i) => [i + 1, t]),
                theme: 'striped',
                headStyles: { fillColor: [33, 150, 243], textColor: 255 },
            });
            y = doc.lastAutoTable.finalY + 10;
        } else {
            doc.text('No lab tests ordered.', 16, y); y += 8;
        }

        // Footer
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setDrawColor(200); doc.line(14, y, 196, y); y += 10;
        doc.setFontSize(9); doc.setTextColor(120);
        doc.text(`Doctor: Dr. ${appointment.doctorName || user?.name || 'N/A'}`, 16, y);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 130, y);

        doc.save("Patient_Record.pdf");
    };

    // ─── STANDALONE PRESCRIPTION PDF ─────────────────────────────────────────
    const generatePrescriptionPDF = () => {
        const pt = appointment?.userId || {};
        const doc = new jsPDF();
        const hName = hospitalContext?.name || 'HOSPITAL';
        const hAddr = [hospitalContext?.address, hospitalContext?.city, hospitalContext?.state].filter(Boolean).join(', ');
        const hPhone = hospitalContext?.phone || '';
        const profile = pt.fertilityProfile || intakeData;
        let y = 18;

        // Header
        doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
        doc.text(hName, 105, y, { align: 'center' }); y += 7;
        if (hAddr) {
            doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
            doc.text(hAddr, 105, y, { align: 'center' }); y += 5;
        }
        if (hPhone) { doc.text(`Ph: ${hPhone}`, 105, y, { align: 'center' }); y += 5; }
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(76, 175, 80);
        doc.text('PRESCRIPTION SLIP', 105, y, { align: 'center' }); y += 5;
        doc.setDrawColor(76, 175, 80); doc.setLineWidth(0.5);
        doc.line(14, y, 196, y); y += 8;
        doc.setTextColor(0); doc.setFont('helvetica', 'normal');

        // Patient Info
        autoTable(doc, {
            startY: y,
            body: [
                ['Patient', pt.name || '-', 'MRN', pt.patientId || 'N/A'],
                ['Age / Gender', `${profile?.age || '-'} / ${profile?.gender || '-'}`, 'Phone', pt.phone || '-'],
                ['Doctor', `Dr. ${appointment?.doctorName || user?.name || '-'}`, 'Date', new Date().toLocaleDateString('en-IN')],
                ['Diagnosis', appointment?.diagnosis || sessionData.diagnosis || '-', '', ''],
            ],
            theme: 'grid',
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 38 },
                2: { fontStyle: 'bold', cellWidth: 28 },
            },
            bodyStyles: { fontSize: 10 },
        });
        y = doc.lastAutoTable.finalY + 10;

        // Medicines
        const rxItems = sessionData.medicines?.length > 0
            ? sessionData.medicines.filter(m => m.medicineName?.trim())
            : (appointment?.pharmacy || []).map(p => ({ medicineName: p.medicineName, saltName: p.saltName || '', dose: p.frequency || '', days: p.duration || '' }));

        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(33, 37, 41);
        doc.text('Medicines Prescribed', 14, y); y += 6;
        if (rxItems.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [['#', 'Medicine Name', 'Dose / Frequency', 'Timing / Instructions', 'Days']],
                body: rxItems.map((m, i) => [i + 1, m.medicineName || '-', m.dose || '-', m.saltName || '-', m.days || '-']),
                theme: 'striped',
                headStyles: { fillColor: [76, 175, 80], textColor: 255 },
                bodyStyles: { fontSize: 10 },
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 55 }, 2: { cellWidth: 40 }, 3: { cellWidth: 50 }, 4: { cellWidth: 20 } },
            });
            y = doc.lastAutoTable.finalY + 10;
        } else {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
            doc.text('No medicines prescribed.', 16, y); y += 8;
        }

        // Lab Tests
        const labItems = sessionData.labTests
            ? sessionData.labTests.split(',').map(t => t.trim()).filter(Boolean)
            : (appointment?.labTests || []);

        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(33, 37, 41);
        doc.text('Lab Tests Ordered', 14, y); y += 6;
        if (labItems.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [['#', 'Test Name']],
                body: labItems.map((t, i) => [i + 1, t]),
                theme: 'striped',
                headStyles: { fillColor: [33, 150, 243], textColor: 255 },
                bodyStyles: { fontSize: 10 },
            });
            y = doc.lastAutoTable.finalY + 10;
        } else {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
            doc.text('No lab tests ordered.', 16, y); y += 8;
        }

        // Notes
        if (sessionData.notes || appointment?.doctorNotes) {
            const notesText = sessionData.notes || appointment?.doctorNotes || '';
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(33, 37, 41);
            doc.text('Clinical Notes', 14, y); y += 6;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60);
            const wrapped = doc.splitTextToSize(notesText, 170);
            doc.text(wrapped, 16, y); y += wrapped.length * 5 + 8;
        }

        // Footer
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setDrawColor(200); doc.line(14, y, 196, y); y += 6;
        doc.setFontSize(9); doc.setTextColor(120);
        doc.text(`Doctor: Dr. ${appointment?.doctorName || user?.name || 'N/A'}`, 14, y);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 196, y, { align: 'right' });
        y += 5;
        doc.setFontSize(8);
        doc.text('This prescription is valid for 30 days from the date of issue.', 105, y, { align: 'center' });

        doc.save(`Prescription_${pt.patientId || 'Patient'}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // ─── CONSULTATION RECEIPT PDF ─────────────────────────────────────────────
    const generateReceiptPDF = () => {
        const pt = appointment?.userId || {};
        const doc = new jsPDF();
        const hName = hospitalContext?.name || 'HOSPITAL';
        const hAddr = [hospitalContext?.address, hospitalContext?.city, hospitalContext?.state].filter(Boolean).join(', ');
        const hPhone = hospitalContext?.phone || '';
        const hEmail = hospitalContext?.email || '';
        let y = 18;

        doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
        doc.text(hName, 105, y, { align: 'center' }); y += 7;
        if (hAddr) {
            doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
            doc.text(hAddr, 105, y, { align: 'center' }); y += 5;
        }
        if (hPhone || hEmail) {
            const contact = [hPhone && `Ph: ${hPhone}`, hEmail && `Email: ${hEmail}`].filter(Boolean).join('  |  ');
            doc.setFontSize(9); doc.setTextColor(100);
            doc.text(contact, 105, y, { align: 'center' }); y += 5;
        }
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(41, 128, 185);
        doc.text('Consultation Receipt', 105, y, { align: 'center' }); y += 5;
        doc.setDrawColor(41, 128, 185); doc.setLineWidth(0.5);
        doc.line(14, y, 196, y); y += 8;
        doc.setTextColor(0); doc.setFont('helvetica', 'normal');

        const dateDisplay = new Date(appointment?.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        autoTable(doc, {
            startY: y,
            body: [
                ['Patient Name', pt.name || '-'],
                ['MRN / ID', pt.patientId || 'N/A'],
                ['Phone', pt.phone || '-'],
                ['Doctor', `Dr. ${appointment?.doctorName || user?.name || '-'}`],
                ['Date & Time', `${dateDisplay} @ ${appointment?.appointmentTime || '-'}`],
                ['Service', appointment?.serviceName || 'Consultation'],
                ['Consultation Fee', `Rs. ${Number(appointment?.amount || 0).toLocaleString('en-IN')}`],
                ['Payment Method', appointment?.paymentMethod || 'Cash'],
                ['Payment Status', (appointment?.paymentStatus || 'Paid').toUpperCase() + ' \u2713'],
            ],
            theme: 'grid',
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 } },
            bodyStyles: { fontSize: 10 },
            alternateRowStyles: { fillColor: [245, 249, 255] },
        });

        y = doc.lastAutoTable.finalY + 10;
        doc.setDrawColor(200); doc.line(14, y, 196, y); y += 6;
        doc.setFontSize(8); doc.setTextColor(120);
        doc.text(`Doctor: Dr. ${appointment?.doctorName || user?.name || 'N/A'}`, 14, y);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 196, y, { align: 'right' });
        y += 5;
        doc.text(`Thank you for choosing ${hName}`, 105, y, { align: 'center' });

        doc.save(`Receipt_${pt.patientId || 'Patient'}.pdf`);
    };

    if (loading) {
        return (
            <div className="dpd-loading">
                <div className="dpd-spinner"></div>
                <p>Loading patient data...</p>
            </div>
        );
    }

    if (!appointment) {
        return (
            <div className="dpd-loading">
                <p>❌ Appointment not found.</p>
                <button onClick={() => navigate('/doctor/patients')} className="dpd-back-btn">← Back to Dashboard</button>
            </div>
        );
    }

    const patient = appointment.userId || {};
    const profile = patient.fertilityProfile || intakeData;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: '📋' },
        { id: 'history', label: 'Past Visits', icon: '📜' },
        { id: 'documents', label: 'Reports', icon: '📁' },
        { id: 'consents', label: 'Consent Forms', icon: '📝' },
    ];

    // Dynamic Form Tabs Injection
    let dynamicTabs = [];
    if (dynamicLibrary) {
        Object.keys(dynamicLibrary).forEach(dept => {
            if (dynamicLibrary[dept]) {
                Object.keys(dynamicLibrary[dept]).forEach((catKey, i) => {
                    dynamicTabs.push({ 
                        id: `dyn_${dept.replace(/\s/g, '')}_${i}`, 
                        label: `${dept === 'IVF' ? '' : dept + ' - '}${catKey}`, 
                        icon: '📋', 
                        data: dynamicLibrary[dept][catKey] 
                    });
                });
            }
        });
    }

    const allTabs = [...tabs, ...dynamicTabs];

    return (
        <div className="dpd-container" style={isJrDoctor ? { gridTemplateColumns: '1fr' } : {}}>
            {/* LEFT PANEL */}
            <div className="dpd-left">
                {/* Patient Header Card */}
                <div className="dpd-patient-header">
                    <button className="dpd-back-link" onClick={() => navigate('/doctor/patients')}>
                        ← Back
                    </button>
                    <div className="dpd-patient-identity">
                        <div className="dpd-patient-avatar">
                            {(patient.name || 'P')[0].toUpperCase()}
                        </div>
                        <div className="dpd-patient-meta">
                            <h2>{patient.name || 'Unknown Patient'}</h2>
                            <div className="dpd-patient-tags">
                                <span className="dpd-tag tag-mrn">MRN: {patient.patientId || 'N/A'}</span>
                                <span className="dpd-tag tag-phone">📱 {patient.phone || '-'}</span>
                                {profile.age && <span className="dpd-tag tag-age">Age: {profile.age}</span>}
                                {profile.gender && <span className="dpd-tag tag-gender">{profile.gender}</span>}
                                {profile.bloodGroup && <span className="dpd-tag tag-blood">🩸 {profile.bloodGroup}</span>}
                            </div>
                            
                            {/* Patient Alerts Panel */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                {/* Check High BP */}
                                {appointment.vitals?.bp && parseInt(appointment.vitals.bp.split('/')[0]) >= 140 && (
                                    <span style={{ padding: '4px 10px', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                        ⚠️ High BP ({appointment.vitals.bp})
                                    </span>
                                )}
                                {/* Check Allergies */}
                                {(appointment.preparation?.allergies || profile.allergies) && (
                                    <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#92400e', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                        ⚠️ Has Allergies
                                    </span>
                                )}
                                {/* Check Diabetes */}
                                {((appointment.preparation?.pastHistory || '').toLowerCase().includes('diabetes') || (profile.medicalHistory || '').toLowerCase().includes('diabetes')) && (
                                    <span style={{ padding: '4px 10px', background: '#e0e7ff', color: '#3730a3', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                        🩸 Diabetic
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="dpd-appt-info">
                        <div className="dpd-appt-item">
                            <span className="dpd-appt-label">Date</span>
                            <span className="dpd-appt-value">{new Date(appointment.appointmentDate).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="dpd-appt-item">
                            <span className="dpd-appt-label">Time</span>
                            <span className="dpd-appt-value">{appointment.appointmentTime}</span>
                        </div>
                        <div className="dpd-appt-item">
                            <span className="dpd-appt-label">Status</span>
                            <span className={`dpd-appt-status status-${appointment.status}`}>
                                {appointment.status} {isLocked && '🔒 Locked'}
                            </span>
                        </div>
                        <div className="dpd-appt-item" style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '15px' }}>
                            <span className="dpd-appt-label">Consultation</span>
                            <span className="dpd-appt-status" style={{ background: '#fef3c7', color: '#d97706' }}>
                                {appointment.consultationStatus || 'Patient Checked In'}
                            </span>
                        </div>
                        <div className="dpd-appt-item">
                            <span className="dpd-appt-label">Service</span>
                            <span className="dpd-appt-value">{appointment.serviceName || 'Consultation'}</span>
                        </div>
                    </div>
                </div>

                {/* DOCTOR ASSISTANT PREPARATION SUMMARY (PHASE 4) */}
                {(appointment.preparation?.preparedAt || appointment.vitals?.weight) && (
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', margin: '0 20px 20px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '15px', color: '#0f172a', margin: 0 }}>🩺 Assistant Preparation</h3>
                            <div>
                                <span style={{ fontSize: '12px', background: appointment.readyForDoctor ? '#dcfce7' : '#fef3c7', color: appointment.readyForDoctor ? '#166534' : '#d97706', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', marginRight: '10px' }}>
                                    {appointment.readyForDoctor ? 'Ready For Doctor' : 'Preparation In Progress'}
                                </span>
                                {appointment.vitals?.weight && appointment.doctorReview?.vitalsStatus === 'Pending' && (
                                    <button 
                                        onClick={async () => {
                                            try {
                                                await doctorAPI.reviewVitals(appointment._id, 'Accepted');
                                                alert('Vitals Accepted!');
                                                window.location.reload();
                                            } catch(e) { alert('Failed to accept vitals'); }
                                        }}
                                        style={{ padding: '4px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                                    >
                                        ✅ Accept Vitals
                                    </button>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            {appointment.vitals?.bp && (
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Blood Pressure</div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{appointment.vitals.bp} mmHg</div>
                                </div>
                            )}
                            {appointment.vitals?.weight && (
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Vitals</div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                                        {appointment.vitals.weight}kg | {appointment.vitals.height}cm | BMI {appointment.vitals.bmi}
                                    </div>
                                </div>
                            )}
                            {appointment.preparation?.chiefComplaint && (
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Chief Complaint</div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{appointment.preparation.chiefComplaint}</div>
                                </div>
                            )}
                            {appointment.draftClinicalNotes && (
                                <div style={{ background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: '8px', padding: '12px' }}>
                                    <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px', fontWeight: 'bold' }}>Draft Notes from Assistant</div>
                                    <div style={{ fontSize: '13px', color: '#7f1d1d' }}>{appointment.draftClinicalNotes.substring(0, 50)}...</div>
                                </div>
                            )}
                        </div>
                        {/* Consultation Timeline */}
                        {appointment.timeline && appointment.timeline.length > 0 && (
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
                                <h4 style={{ fontSize: '13px', color: '#334155', marginBottom: '10px' }}>⏳ Consultation Timeline</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {appointment.timeline.map((event, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', fontSize: '11px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '4px 10px', color: '#475569' }}>
                                            <span style={{ fontWeight: 'bold', marginRight: '6px' }}>{event.status}</span>
                                            <span>{new Date(event.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs Navigation */}
                <div className="dpd-tabs-container">
                    <button className="dpd-tab-scroll-btn" onClick={() => scrollTabs('left')} title="Scroll Left">‹</button>
                    <div className="dpd-tabs-nav" ref={tabsRef}>
                        {allTabs.map(tab => {
                            if (tab.id === 'consents') {
                                return (
                                    <button
                                        type="button"
                                        key={tab.id}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log("Switching tab to consents safely");
                                            setActiveTab('consents');
                                        }}
                                        className={`dpd-tab-btn ${activeTab === 'consents' ? 'active' : ''}`}
                                    >
                                        <span className="dpd-tab-icon">📝</span>
                                        <span className="dpd-tab-label">Consent Forms</span>
                                    </button>
                                );
                            }
                            return (
                                <button
                                    type="button"
                                    key={tab.id}
                                    className={`dpd-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveTab(tab.id);
                                    }}
                                >
                                    <span className="dpd-tab-icon">{tab.icon}</span>
                                    <span className="dpd-tab-label">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <button className="dpd-tab-scroll-btn" onClick={() => scrollTabs('right')} title="Scroll Right">›</button>
                </div>

                {/* Tab Content */}
                <div className="dpd-tab-content">
                    {/* OVERVIEW */}
                    {activeTab === 'overview' && (() => {
                        console.log("FULL APPOINTMENT DATA:", appointment);
                        console.log("FULL PATIENT DATA:", patient);
                        const latestVitals = appointment?.vitals || (patient?.vitalsHistory && patient?.vitalsHistory[0]) || patient?.fertilityProfile?.vitals || {};

                        const calcBMI = (h, w) => {
                            if (!h || !w || isNaN(h) || isNaN(w)) return null;
                            const hM = h / 100;
                            return (w / (hM * hM)).toFixed(1);
                        };

                        const displayHeight = latestVitals.height || latestVitals.heightCm || patient?.height || '-';
                        const displayWeight = latestVitals.weight || latestVitals.weightKg || patient?.weight || '-';
                        const displayBMI    = latestVitals.bmi || (displayHeight !== '-' && displayWeight !== '-' ? calcBMI(displayHeight, displayWeight) : patient?.bmi) || '-';
                        const displayBP     = latestVitals.bp || latestVitals.bloodPressure || '-';
                        const displayPulse  = latestVitals.pulse || latestVitals.pulseRate || '-';
                        const displayTemp   = latestVitals.temp || latestVitals.temperature || '-';
                        const displaySpO2   = latestVitals.spo2 || latestVitals.spO2 || '-';
                        const displayResp   = latestVitals.respRate || latestVitals.respiratoryRate || latestVitals.rr || '-';
                        
                        const valChiefComplaint = latestVitals.chiefComplaint || appointment?.chiefComplaint || profile.chiefComplaint || intakeData.chiefComplaint || '-';
                        const displayNotes  = latestVitals.nurseNotes || latestVitals.notes || '';

                        let isHighBP = false;
                        if (displayBP && typeof displayBP === 'string' && displayBP.includes('/')) {
                            const [sysStr, diaStr] = displayBP.split('/');
                            const sys = parseInt(sysStr, 10);
                            const dia = parseInt(diaStr, 10);

                            if (!isNaN(sys) && !isNaN(dia)) {
                                isHighBP = sys >= 140 || dia >= 90;
                            }
                        }
                        const spo2Num = displaySpO2 !== '-' ? parseInt(displaySpO2) : 100;
                        const isLowSpO2 = spo2Num < 95 && spo2Num > 0;

                        return (
                            <div className="dpd-tab-panel">
                                <h3 className="dpd-panel-title">📋 Patient Overview</h3>
                                <div className="dpd-overview-grid">
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Full Name</span>
                                    <span className="dpd-ov-value">{patient.name || '-'}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Phone</span>
                                    <span className="dpd-ov-value">{patient.phone || '-'}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Email</span>
                                    <span className="dpd-ov-value">{patient.email || '-'}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Age</span>
                                    <span className="dpd-ov-value">{profile.age || intakeData.age || '-'}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Gender</span>
                                    <span className="dpd-ov-value">{profile.gender || intakeData.gender || '-'}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Blood Group</span>
                                    <span className="dpd-ov-value">{profile.bloodGroup || intakeData.bloodGroup || '-'}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Height</span>
                                    <span className="dpd-ov-value">{displayHeight} {displayHeight !== '-' ? 'cm' : ''}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Weight</span>
                                    <span className="dpd-ov-value">{displayWeight} {displayWeight !== '-' ? 'kg' : ''}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">BMI</span>
                                    <span className="dpd-ov-value">{displayBMI}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Address</span>
                                    <span className="dpd-ov-value">{patient.address || profile.address || '-'}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Chief Complaint</span>
                                    <span className="dpd-ov-value">{valChiefComplaint}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Reason for Visit</span>
                                    <span className="dpd-ov-value">{profile.reasonForVisit || intakeData.reasonForVisit || '-'}</span>
                                </div>
                                <div className="dpd-ov-card" style={isHighBP ? { border: '2px solid #ef4444', background: '#fef2f2' } : {}}>
                                    <span className="dpd-ov-label" style={isHighBP ? { color: '#b91c1c' } : {}}>
                                        BP {isHighBP && <span style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '10px', marginLeft: '6px' }}>⚠️ High BP</span>}
                                    </span>
                                    <span className="dpd-ov-value" style={isHighBP ? { color: '#b91c1c' } : {}}>{displayBP} {displayBP !== '-' ? 'mmHg' : ''}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Pulse</span>
                                    <span className="dpd-ov-value">{displayPulse} {displayPulse !== '-' ? 'bpm' : ''}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Temperature</span>
                                    <span className="dpd-ov-value">{displayTemp} {displayTemp !== '-' ? '°F' : ''}</span>
                                </div>
                                <div className="dpd-ov-card" style={isLowSpO2 ? { border: '2px solid #f97316', background: '#fff7ed' } : {}}>
                                    <span className="dpd-ov-label" style={isLowSpO2 ? { color: '#c2410c' } : {}}>
                                        SpO2 {isLowSpO2 && <span style={{ fontSize: '11px', background: '#ffedd5', color: '#9a3412', padding: '2px 6px', borderRadius: '10px', marginLeft: '6px' }}>⚠️ Low</span>}
                                    </span>
                                    <span className="dpd-ov-value" style={isLowSpO2 ? { color: '#c2410c' } : {}}>{displaySpO2}{displaySpO2 !== '-' ? '%' : ''}</span>
                                </div>
                                <div className="dpd-ov-card">
                                    <span className="dpd-ov-label">Resp Rate</span>
                                    <span className="dpd-ov-value">{displayResp} {displayResp !== '-' ? '/min' : ''}</span>
                                </div>
                            </div>

                            {displayNotes && displayNotes !== '-' && (
                                <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#1e293b' }}>📝 Nurse / Assistant Notes</h4>
                                    <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>{displayNotes}</p>
                                </div>
                            )}

                            {/* Partner Quick Info */}
                            {(profile.partnerFirstName || intakeData.partnerFirstName) && (
                                <div className="dpd-partner-quick">
                                    <h4>👫 Spouse/Partner Info</h4>
                                    <div className="dpd-overview-grid">
                                        <div className="dpd-ov-card">
                                            <span className="dpd-ov-label">Partner Name</span>
                                            <span className="dpd-ov-value">{profile.partnerFirstName || intakeData.partnerFirstName || '-'} {profile.partnerLastName || intakeData.partnerLastName || ''}</span>
                                        </div>
                                        <div className="dpd-ov-card">
                                            <span className="dpd-ov-label">Partner Phone</span>
                                            <span className="dpd-ov-value">{profile.partnerMobile || intakeData.partnerMobile || '-'}</span>
                                        </div>
                                        <div className="dpd-ov-card">
                                            <span className="dpd-ov-label">Partner Age</span>
                                            <span className="dpd-ov-value">{profile.partnerAge || intakeData.partnerAge || profile.husbandAge || intakeData.husbandAge || '-'}</span>
                                        </div>
                                        <div className="dpd-ov-card">
                                            <span className="dpd-ov-label">Partner Blood Group</span>
                                            <span className="dpd-ov-value">{profile.partnerBloodGroup || intakeData.partnerBloodGroup || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        );
                    })()}

                    {/* PAST VISITS HISTORY */}
                    {activeTab === 'history' && (
                        <div className="dpd-tab-panel">
                            <h3 className="dpd-panel-title">📜 Previous Consultations ({history.length})</h3>
                            {history.length === 0 ? (
                                <div className="dpd-empty-hist">
                                    <p>No previous visits recorded.</p>
                                </div>
                            ) : (
                                <div className="dpd-history-list">
                                    {history.map(h => (
                                        <div
                                            key={h._id}
                                            className={`dpd-history-card ${h._id === appointmentId ? 'current' : ''} ${viewingPastSession && viewingPastSession._id === h._id ? 'viewing-active' : ''}`}
                                            onClick={() => {
                                                if (h._id === appointmentId) setViewingPastSession(null);
                                                else setViewingPastSession(viewingPastSession && viewingPastSession._id === h._id ? null : h);
                                            }}
                                            style={{ cursor: 'pointer', transition: 'all 0.2s', border: viewingPastSession && viewingPastSession._id === h._id ? '2px solid #3b82f6' : '' }}
                                        >
                                            {viewingPastSession && viewingPastSession._id === h._id && (
                                                <div style={{ background: '#3b82f6', color: '#fff', padding: '2px 8px', fontSize: '11px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px', fontWeight: 'bold' }}>
                                                    👁️ Viewing Right Now
                                                </div>
                                            )}
                                            <div className="dpd-hist-top">
                                                <span className="dpd-hist-date">
                                                    {new Date(h.visitDate || h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                <span className={`dpd-hist-status status-${h.status}`}>{h.status}</span>
                                            </div>
                                            {/* Diagnosis */}
                                            <div className="dpd-hist-diagnosis">
                                                <strong>Diagnosis:</strong>{' '}
                                                {(h.doctorConsultation?.diagnosis?.length > 0
                                                    ? h.doctorConsultation.diagnosis.join(', ')
                                                    : null) || 'No diagnosis recorded'}
                                            </div>
                                            {/* Notes */}
                                            {h.doctorConsultation?.clinicalNotes && (
                                                <div className="dpd-hist-notes">
                                                    <strong>Notes:</strong> {h.doctorConsultation.clinicalNotes}
                                                </div>
                                            )}
                                            {/* Prescription / Medicines */}
                                            {h.doctorConsultation?.prescription?.length > 0 && (
                                                <div className="dpd-hist-notes">
                                                    <strong>💊 Medicines:</strong>{' '}
                                                    {h.doctorConsultation.prescription.map(p => `${p.medicine} (${p.dosage}, ${p.duration})`).join(' · ')}
                                                </div>
                                            )}
                                            {/* Lab Tests */}
                                            {h.doctorConsultation?.labTests?.length > 0 && (
                                                <div className="dpd-hist-notes">
                                                    <strong>🧪 Lab Tests:</strong>{' '}
                                                    {h.doctorConsultation.labTests.join(', ')}
                                                </div>
                                            )}
                                            {h._id === appointmentId && <span className="dpd-current-badge">📌 Current Session</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* DYNAMIC FORMS RENDERER */}
                    {dynamicTabs.map(dTab => (
                        activeTab === dTab.id && (
                            <div key={dTab.id} style={{ display: 'block' }}>
                                <DynamicQuestionForm
                                    categoryName={dTab.label}
                                    questions={dTab.data}
                                    intakeData={intakeData}
                                    setIntakeData={setIntakeData}
                                    readOnly={isLocked}
                                />
                                {!isLocked && (
                                    <button className="dpd-save-section" onClick={handleSaveProfile} disabled={saving} style={{ marginTop: '20px' }}>
                                        {saving ? 'Saving...' : `💾 Save ${dTab.label} Data`}
                                    </button>
                                )}
                            </div>
                        )
                    ))}

                    {/* DOCUMENTS / REPORTS TAB */}
                    {activeTab === 'documents' && (
                        <div className="dpd-tab-panel">
                            <h3 className="dpd-panel-title">📁 Uploaded Reports &amp; Documents</h3>
                            {(patient.fertilityProfile?.previousReports || []).length === 0 ? (
                                <div className="dpd-empty-hist"><p>No documents uploaded for this patient.</p></div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                                    {(patient.fertilityProfile?.previousReports || []).map((doc, i) => (
                                        <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', marginBottom: '6px' }}>
                                                📄 {doc.fileName || `Document ${i + 1}`}
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
                                                {doc.date ? new Date(doc.date).toLocaleDateString('en-IN') : ''}
                                            </div>
                                            {doc.url && (
                                                <a href={doc.url} target="_blank" rel="noreferrer"
                                                   style={{ color: '#3b82f6', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
                                                    👁 View Document
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* DIAGNOSTIC LAB REPORTS WITH SHARED NOTES */}
                            <div style={{ marginTop: '32px', borderTop: '1px dashed #cbd5e1', paddingTop: '20px' }}>
                                <h3 className="dpd-panel-title" style={{ color: '#0f172a', marginBottom: '14px' }}>🧪 Diagnostic Lab Reports &amp; Notes</h3>
                                {patientLabReports.length === 0 ? (
                                    <div className="dpd-empty-hist"><p>No diagnostic lab reports generated for this patient.</p></div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {patientLabReports.map((rep) => (
                                            <div key={rep._id} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '18px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                                                        🧪 Conducted Tests: {(rep.testNames || []).join(', ')}
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                                                        {rep.testStatus}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '12px' }}>
                                                    Requested on: {rep.createdAt ? new Date(rep.createdAt).toLocaleDateString('en-IN') : 'N/A'} | Payment: {rep.paymentStatus}
                                                </div>
                                                {rep.reportFile?.url && (
                                                    <div style={{ marginBottom: '14px' }}>
                                                        <a href={rep.reportFile.url} target="_blank" rel="noreferrer"
                                                           style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
                                                            📄 View Digital PDF Report ({rep.reportFile.name || 'Report'})
                                                        </a>
                                                    </div>
                                                )}
                                                <SharedReportNotesSection 
                                                    reportId={rep._id}
                                                    patientId={patient._id || rep.userId}
                                                    appointmentId={rep.appointmentId}
                                                    hospitalId={rep.hospitalId}
                                                    readOnly={isLocked || isJrDoctor}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CONSENTS TAB */}
                    {activeTab === 'consents' && (
                        <div className="dpd-tab-panel">
                            <div style={{ padding: '20px', background: '#dcfce7', color: '#166534', fontWeight: 'bold', borderRadius: '8px' }}>
                                Consent Forms Section Working
                            </div>
                            
                            {/* Original UI commented out for testing
                            <h3 className="dpd-panel-title">📝 Consent Forms</h3>
                            {(patient?.consents || []).length === 0 ? (
                                <div className="dpd-empty-hist"><p>No consent forms generated or uploaded.</p></div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                                    {(patient?.consents || []).map((doc, i) => {
                                        const isPending = doc.status === 'Pending';
                                        return (
                                        <div key={doc._id || i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' }}>
                                                    📄 {String(doc.consentName || `Consent Form ${i + 1}`)}
                                                </div>
                                                {isPending ? (
                                                    <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                                        ⏳ Pending Signature
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                                        ✅ Signed
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                {doc.uploadedAt ? `Generated/Uploaded: ${new Date(doc.uploadedAt).toLocaleDateString('en-IN')}` : ''}
                                                {(!isPending && doc.signedDate) ? ` | Signed: ${new Date(doc.signedDate).toLocaleDateString('en-IN')}` : ''}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                                                {doc.fileUrl && (
                                                    <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                                                       onClick={(e) => { e.preventDefault(); window.open(doc.fileUrl, '_blank'); }}
                                                       style={{ flex: 1, textAlign: 'center', background: '#eff6ff', color: '#3b82f6', fontSize: '0.82rem', fontWeight: 600, padding: '8px', borderRadius: '6px', textDecoration: 'none' }}>
                                                        👁 Preview
                                                    </a>
                                                )}
                                                {doc.fileUrl && (
                                                    <a href={doc.fileUrl} download
                                                       onClick={(e) => { e.preventDefault(); window.open(doc.fileUrl, '_blank'); }}
                                                       style={{ flex: 1, textAlign: 'center', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, padding: '8px', borderRadius: '6px', textDecoration: 'none' }}>
                                                        ⬇️ Download
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            )}
                            */}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL - SESSION NOTEPAD */}
            {!isJrDoctor && (
                <div className={`dpd-right ${viewingPastSession ? 'time-machine-active' : ''}`} style={viewingPastSession ? { background: '#f8fafc', borderLeft: '4px solid #3b82f6' } : {}}>
                    {viewingPastSession ? (
                    <>
                        <div className="dpd-right-header" style={{ background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h2 style={{ color: '#1e3a8a' }}>🕰️ Past Session</h2>
                                    <span style={{ fontSize: '12px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>Read-only</span>
                                </div>
                                <p className="dpd-right-subtitle" style={{ color: '#3b82f6', fontWeight: 600 }}>
                                    Viewing notes from {new Date(viewingPastSession.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingPastSession(null)}
                                style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                ✕ Exit Time Machine
                            </button>
                        </div>

                        <div className="dpd-right-content">
                            <div className="dpd-session-field">
                                <label>🔍 Diagnosis at the time</label>
                                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.7)', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#334155' }}>
                                    {viewingPastSession.diagnosis || <em style={{ color: '#94a3b8' }}>No diagnosis recorded</em>}
                                </div>
                            </div>

                            <div className="dpd-session-field">
                                <label>📋 Clinical Notes</label>
                                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.7)', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#334155', minHeight: '80px', whiteSpace: 'pre-wrap' }}>
                                    {viewingPastSession.doctorNotes || <em style={{ color: '#94a3b8' }}>No notes recorded</em>}
                                </div>
                            </div>

                            <div className="dpd-session-field">
                                <label>💊 Prescription Given</label>
                                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.7)', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#334155', minHeight: '60px' }}>
                                    {viewingPastSession.pharmacy?.length > 0 ? (
                                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                            {viewingPastSession.pharmacy.map((p, i) => (
                                                <li key={i}><strong>{p.medicineName}</strong></li>
                                            ))}
                                        </ul>
                                    ) : <em style={{ color: '#94a3b8' }}>No prescription recorded</em>}
                                </div>
                            </div>

                            <div className="dpd-session-field">
                                <label>🧪 Lab Tests Ordered</label>
                                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.7)', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#334155' }}>
                                    {(viewingPastSession.labTests || []).length > 0
                                        ? (viewingPastSession.labTests || []).join(', ')
                                        : <em style={{ color: '#94a3b8' }}>No lab tests ordered</em>}
                                </div>
                            </div>
                        </div>

                        <div className="dpd-right-footer" style={{ background: '#f1f5f9' }}>
                            <button
                                onClick={() => {
                                    setSessionData({
                                        diagnosis: viewingPastSession.diagnosis || '',
                                        notes: viewingPastSession.doctorNotes || '',
                                        prescription: viewingPastSession.pharmacy?.map(p => p.medicineName).join('\n') || '',
                                        labTests: (viewingPastSession.labTests || []).join(', ')
                                    });
                                    setViewingPastSession(null);
                                    alert("Historical data copied into your Current Session editor!");
                                }}
                                style={{ padding: '10px 18px', background: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                📋 Copy to Current Session
                            </button>
                            <button className="dpd-btn-finish" onClick={() => setViewingPastSession(null)} style={{ background: '#64748b' }}>
                                Return to Current Editing
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="dpd-right-header">
                            <div>
                                <h2>📝 Current Session</h2>
                                <p className="dpd-right-subtitle">Record diagnosis, notes & prescription</p>
                            </div>
                            <span className={`dpd-session-status status-${appointment.status}`}>
                                {appointment.status}
                            </span>
                        </div>

                        {patientLatestVitals && (
                            <div style={{ margin: '0 20px 15px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', width: '100%' }}>🩺 Recent Vitals from Nurse ({(new Date(patientLatestVitals.timestamp || Date.now())).toLocaleString()})</div>
                                {patientLatestVitals.bp && <div style={{ fontSize: '13px', color: '#475569' }}><b>BP:</b> {patientLatestVitals.bp}</div>}
                                {patientLatestVitals.pulse && <div style={{ fontSize: '13px', color: '#475569' }}><b>Pulse:</b> {patientLatestVitals.pulse} bpm</div>}
                                {patientLatestVitals.spo2 && <div style={{ fontSize: '13px', color: '#475569' }}><b>SpO2:</b> {patientLatestVitals.spo2}%</div>}
                                {patientLatestVitals.temp && <div style={{ fontSize: '13px', color: '#475569' }}><b>Temp:</b> {patientLatestVitals.temp}</div>}
                                {patientLatestVitals.weight && <div style={{ fontSize: '13px', color: '#475569' }}><b>Weight:</b> {patientLatestVitals.weight} kg</div>}
                            </div>
                        )}

                        {/* --- DOCTOR ASSISTANT DATA --- */}
                        {appointment.preparation?.preparedAt && (
                            <div style={{ margin: '0 20px 15px', padding: '16px', background: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#4338ca' }}>
                                        👨‍⚕️ Prepared by Assistant ({(new Date(appointment.preparation.preparedAt)).toLocaleString()})
                                    </div>
                                    {appointment.readyForDoctor && (
                                        <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                                            ✅ Ready for Doctor
                                        </span>
                                    )}
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                                    {appointment.preparation.chiefComplaint && (
                                        <div><b style={{color: '#374151'}}>Chief Complaint:</b> <div style={{color: '#4b5563', whiteSpace: 'pre-wrap'}}>{appointment.preparation.chiefComplaint}</div></div>
                                    )}
                                    {appointment.preparation.presentIllness && (
                                        <div><b style={{color: '#374151'}}>Present Illness:</b> <div style={{color: '#4b5563', whiteSpace: 'pre-wrap'}}>{appointment.preparation.presentIllness}</div></div>
                                    )}
                                    {appointment.preparation.pastHistory && (
                                        <div><b style={{color: '#374151'}}>Past History:</b> <div style={{color: '#4b5563', whiteSpace: 'pre-wrap'}}>{appointment.preparation.pastHistory}</div></div>
                                    )}
                                    {appointment.preparation.allergies && (
                                        <div><b style={{color: '#374151'}}>Allergies:</b> <div style={{color: '#4b5563', whiteSpace: 'pre-wrap'}}>{appointment.preparation.allergies}</div></div>
                                    )}
                                    {appointment.preparation.currentMedicines && (
                                        <div style={{gridColumn: '1 / -1'}}><b style={{color: '#374151'}}>Current Medicines:</b> <div style={{color: '#4b5563', whiteSpace: 'pre-wrap'}}>{appointment.preparation.currentMedicines}</div></div>
                                    )}
                                </div>

                                {appointment.draftClinicalNotes && (
                                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #a5b4fc' }}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                            <b style={{fontSize: '13px', color: '#374151'}}>📝 Draft Clinical Notes:</b>
                                            {!isLocked && (
                                                <div>
                                                    <button 
                                                        onClick={async () => {
                                                            try {
                                                                await doctorAPI.reviewDraftNotes(appointment._id, 'Approved');
                                                                setSessionData(prev => ({ ...prev, notes: prev.notes ? prev.notes + '\n\n' + appointment.draftClinicalNotes : appointment.draftClinicalNotes }));
                                                                alert('Draft notes approved and copied to your session notes!');
                                                            } catch(e) { alert('Failed to approve notes'); }
                                                        }}
                                                        style={{ padding: '4px 10px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', marginRight: '6px' }}
                                                    >
                                                        ✅ Approve & Copy
                                                    </button>
                                                    <button 
                                                        onClick={async () => {
                                                            try {
                                                                await doctorAPI.reviewDraftNotes(appointment._id, 'Rejected');
                                                                alert('Draft notes rejected!');
                                                            } catch(e) { alert('Failed to reject notes'); }
                                                        }}
                                                        style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                                                    >
                                                        ❌ Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{fontSize: '13px', color: '#4b5563', whiteSpace: 'pre-wrap', marginTop: '6px', background: 'rgba(255,255,255,0.6)', padding: '8px', borderRadius: '6px'}}>
                                            {appointment.draftClinicalNotes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {isLocked && (
                            <div style={{ padding: '15px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>⚠️</span>
                                <div style={{ fontSize: '13px', color: '#92400e' }}>
                                    <b>Session Locked.</b> This clinical record has been marked as complete and is now immutable. 
                                    Contact administrator for any corrections.
                                </div>
                            </div>
                        )}

                        <div className="dpd-right-content">
                            <div className="dpd-session-field">
                                <label>🔍 Diagnosis</label>
                                <input
                                    name="diagnosis"
                                    value={sessionData.diagnosis}
                                    onChange={handleSessionChange}
                                    placeholder="Enter diagnosis..."
                                    className="dpd-diag-input"
                                    disabled={isLocked}
                                />
                            </div>

                            <div className="dpd-session-field dpd-notes-field">
                                <label>📋 Clinical Notes</label>
                                <textarea
                                    name="notes"
                                    value={sessionData.notes}
                                    onChange={handleSessionChange}
                                    placeholder="Write detailed clinical notes, observations, examination findings..."
                                    className="dpd-notes-textarea"
                                    disabled={isLocked}
                                />
                            </div>

                            <div className="dpd-session-field">
                                {!isLocked && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPrescribeModal(true)}
                                        style={{ padding: '14px', fontSize: '15px', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)', marginTop: '10px' }}
                                    >
                                        💊 / 🧪 Prescribe Medicines & Lab Tests
                                    </button>
                                )}

                                {(sessionData.medicines?.length > 0 || sessionData.labTests || (isLocked && appointment.pharmacy?.length > 0)) && (
                                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px', fontSize: '13px', color: '#475569' }}>
                                        {(sessionData.medicines?.length > 0 || (isLocked && appointment.pharmacy?.length > 0)) && <div style={{ marginBottom: '4px' }}><b>✅ Medicines included ({sessionData.medicines?.length || appointment.pharmacy?.length || 0})</b></div>}
                                        {(sessionData.labTests || (isLocked && appointment.labTests?.length > 0)) && <div><b>✅ Lab Tests included</b></div>}
                                        {!isLocked && (
                                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setShowPrescribeModal(true)}>
                                                Click above button to view/edit details.
                                            </div>
                                        )}
                                        {isLocked && (
                                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '12px' }}>
                                                Check the Consultation Report (PDF) for full history.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="dpd-right-footer">
                            {!isLocked ? (
                                <>
                                    <button className="dpd-btn-save-draft" onClick={handleSaveProfile} disabled={saving}>
                                        💾 Save Profile
                                    </button>
                                    <button className="dpd-btn-finish" onClick={handleSaveAndMerge} disabled={saving}>
                                        {saving ? '⏳ Saving...' : (isEditing ? '🔄 Update & Save Changes' : '✅ Save & Generate Prescription')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="dpd-btn-save-draft"
                                        onClick={generatePrescriptionPDF}
                                    >
                                        📄 Reprint Prescription
                                    </button>
                                    <button 
                                        className="dpd-btn-save-draft" 
                                        style={{ background: '#f59e0b', color: '#fff', border: 'none' }}
                                        onClick={() => { setIsLocked(false); setIsEditing(true); }}
                                    >
                                        ✏️ Edit Consultation
                                    </button>
                                    <button className="dpd-btn-finish" onClick={() => navigate('/doctor/patients')} style={{ background: '#64748b' }}>
                                        ← Back to Queue
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
            )}

            {/* ====== MODALS ====== */}
            {!isJrDoctor && showPrescribeModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', width: '850px', maxWidth: '95vw', height: '85vh', maxHeight: '850px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem', fontWeight: '800' }}>⚕️ Prescribe Medicines & Lab Tests</h3>
                            <button onClick={() => setShowPrescribeModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>✕</button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '30px', paddingRight: '8px' }}>

                            {/* Medicines Section */}
                            <div>
                                <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>💊 Medicines Prescribed</h4>

                                {/* Inventory Medicine Search bar */}
                                {sessionData.medicines.length > 1 && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <button 
                                            type="button" 
                                            onClick={handleGroupCompound}
                                            style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            🔗 Group Selected as Compound
                                        </button>
                                    </div>
                                )}
                                <div ref={searchContainerRef} style={{ marginBottom: '16px', position: 'relative' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>
                                        Search Medicine From Inventory
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Search medicine by name..."
                                        value={inventorySearchQuery}
                                        onChange={(e) => {
                                            setInventorySearchQuery(e.target.value);
                                            setInventorySearchOpen(true);
                                        }}
                                        onFocus={() => setInventorySearchOpen(true)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1.5px solid #c7d2fe',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            boxSizing: 'border-box',
                                            background: '#fff'
                                        }}
                                    />
                                    {inventorySearchOpen && displayedInventoryMedicines.length > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            background: 'white',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                            borderRadius: '6px',
                                            zIndex: 9999,
                                            maxHeight: '180px',
                                            overflowY: 'auto',
                                            marginTop: '4px'
                                        }}>
                                            {displayedInventoryMedicines.map((med, idx) => (
                                                <div
                                                    key={idx}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setSessionData(prev => ({
                                                            ...prev,
                                                            medicines: [...prev.medicines, { medicineName: med.name, saltName: '', dose: '', days: '', volumeMl: '', administrationTime: '', gapDays: 0, startDate: '', dosePerAdmin: '', frequency: '', durationDays: '', vialSize: med.packVolume || '', totalDosageRequired: 0 }]
                                                        }));
                                                        setInventorySearchQuery('');
                                                        setInventorySearchOpen(false);
                                                    }}
                                                    style={{
                                                        padding: '8px 12px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px',
                                                        background: 'white',
                                                        borderBottom: '1px solid #f8fafc',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                                >
                                                    <span style={{ fontWeight: '600', color: '#1e293b' }}>{med.name}</span>
                                                    {med.category && (
                                                        <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                            {med.category}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Medicine Table */}
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ background: '#f1f5f9' }}>
                                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '1px solid #e2e8f0', width: '30%' }}>Medicine Name</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '1px solid #e2e8f0', width: '12%' }}>Qty/Dose</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '1px solid #e2e8f0', width: '20%' }}>Frequency</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '1px solid #e2e8f0', width: '25%' }}>Food / Timing Instructions</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '1px solid #e2e8f0', width: '10%' }}>Days</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#374151', borderBottom: '1px solid #e2e8f0', width: '3%' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sessionData.medicines.map((med, idx) => {
                                                const catalogMed = catalogMedicines.find(c => c.name === med.medicineName) || {};
                                                const medCategory = med.category || catalogMed.category || '';
                                                const isInjection = (med.medicineName || '').toLowerCase().includes('inj') || 
                                                                    (med.medicineName || '').toLowerCase().includes('drip') || 
                                                                    medCategory.toLowerCase() === 'injection';
                                                return (
                                                <React.Fragment key={idx}>
                                                <tr style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <MedicineSearchInput
                                                            value={med.medicineName}
                                                            onChange={val => setSessionData(prev => { const m = [...prev.medicines]; m[idx] = { ...m[idx], medicineName: val }; return { ...prev, medicines: m }; })}
                                                            medicines={catalogMedicines}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            placeholder="e.g. 1"
                                                            value={med.dosePerAdmin || med.doseAdmin || ''}
                                                            onChange={e => {
                                                                const val = Number(e.target.value);
                                                                setSessionData(prev => {
                                                                    const m = [...prev.medicines];
                                                                    const freq = parseFloat(m[idx].frequency) || 0;
                                                                    const dur = parseFloat(m[idx].durationDays) || parseFloat(m[idx].days) || 0;
                                                                    m[idx] = {
                                                                        ...m[idx],
                                                                        dosePerAdmin: val,
                                                                        doseAdmin: val,
                                                                        totalDosageRequired: val * freq * dur
                                                                    };
                                                                    return { ...prev, medicines: m };
                                                                });
                                                            }}
                                                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '5px 7px', fontSize: '12px', boxSizing: 'border-box' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <select
                                                            value={med.dose}
                                                            onChange={e => {
                                                                const newDose = e.target.value;
                                                                const numFreq = parseDoseFreq(newDose);
                                                                setSessionData(prev => {
                                                                    const m = [...prev.medicines];
                                                                    const updatedFreq = numFreq > 0 ? numFreq : (parseFloat(m[idx].frequency) || 0);
                                                                    const dosePerAdmin = parseFloat(m[idx].dosePerAdmin) || 0;
                                                                    const durDays = parseFloat(m[idx].durationDays) || parseFloat(m[idx].days) || 0;
                                                                    m[idx] = {
                                                                        ...m[idx],
                                                                        dose: newDose,
                                                                        frequency: String(updatedFreq),
                                                                        totalDosageRequired: dosePerAdmin * updatedFreq * durDays
                                                                    };
                                                                    return { ...prev, medicines: m };
                                                                });
                                                            }}
                                                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '5px 7px', fontSize: '12px', boxSizing: 'border-box' }}
                                                        >
                                                            <option value="">-- Select Dose --</option>
                                                            {doseOptions.map(opt => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                            {med.dose && !doseOptions.includes(med.dose) && (
                                                                <option value={med.dose}>{med.dose}</option>
                                                            )}
                                                        </select>
                                                    </td>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <select
                                                            value={med.saltName}
                                                            onChange={e => setSessionData(prev => { const m = [...prev.medicines]; m[idx] = { ...m[idx], saltName: e.target.value }; return { ...prev, medicines: m }; })}
                                                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '5px 7px', fontSize: '12px', boxSizing: 'border-box' }}
                                                        >
                                                            <option value="">-- Select Timing --</option>
                                                            {timingOptions.map(opt => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                            {med.saltName && !timingOptions.includes(med.saltName) && (
                                                                <option value={med.saltName}>{med.saltName}</option>
                                                            )}
                                                        </select>
                                                    </td>
                                                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <input
                                                            value={med.days}
                                                            onChange={e => {
                                                                const newDays = e.target.value;
                                                                const numDays = parseFloat(newDays) || 0;
                                                                setSessionData(prev => {
                                                                    const m = [...prev.medicines];
                                                                    const dosePerAdmin = parseFloat(m[idx].dosePerAdmin) || 0;
                                                                    const freq = parseFloat(m[idx].frequency) || 0;
                                                                    m[idx] = {
                                                                        ...m[idx],
                                                                        days: newDays,
                                                                        durationDays: String(numDays),
                                                                        totalDosageRequired: dosePerAdmin * freq * numDays
                                                                    };
                                                                    return { ...prev, medicines: m };
                                                                });
                                                            }}
                                                            placeholder="e.g. 7"
                                                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '5px 7px', fontSize: '12px', boxSizing: 'border-box' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        {med.mixId && (
                                                            <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #d8b4fe' }}>
                                                                🔗 {med.mixName}
                                                            </span>
                                                        )}
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedMedsForCompound.includes(idx)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setSelectedMedsForCompound(prev => [...prev, idx]);
                                                                else setSelectedMedsForCompound(prev => prev.filter(i => i !== idx));
                                                            }}
                                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                            title="Select for Compound Admixture"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setSessionData(prev => ({ ...prev, medicines: prev.medicines.filter((_, i) => i !== idx) }))}
                                                            style={{ background: '#fee2e2', border: 'none', borderRadius: '4px', color: '#dc2626', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >×</button>
                                                    </td>
                                                </tr>
                                                {isInjection && (
                                                    <tr style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                        <td colSpan={6} style={{ padding: '8px 12px 14px 12px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#eef2ff', padding: '10px', borderRadius: '6px', border: '1px dashed #c7d2fe' }}>
                                                                
                                                                {/* Multi-dose Calculation Row */}
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', display: 'block', marginBottom: '4px' }}>Dose/Admin (ml)</label>
                                                                        <input type="number" min="0" step="any" value={med.dosePerAdmin || med.doseAdmin || ''} onChange={e => {
                                                                            const val = Number(e.target.value);
                                                                            setSessionData(prev => { 
                                                                                const m = [...prev.medicines]; 
                                                                                const freq = parseFloat(m[idx].frequency) || 0;
                                                                                const dur = parseFloat(m[idx].durationDays) || 0;
                                                                                m[idx] = { ...m[idx], dosePerAdmin: val, doseAdmin: val, totalDosageRequired: val * freq * dur }; 
                                                                                return { ...prev, medicines: m }; 
                                                                            });
                                                                        }} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #c7d2fe', borderRadius: '4px', boxSizing: 'border-box' }} placeholder="e.g. 1.5" />
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', display: 'block', marginBottom: '4px' }}>Frequency (/day)</label>
                                                                        <input type="number" min="0" step="any" value={med.frequency || ''} onChange={e => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            setSessionData(prev => { 
                                                                                const m = [...prev.medicines]; 
                                                                                const dose = parseFloat(m[idx].dosePerAdmin) || 0;
                                                                                const dur = parseFloat(m[idx].durationDays) || 0;
                                                                                m[idx] = { ...m[idx], frequency: e.target.value, totalDosageRequired: dose * val * dur }; 
                                                                                return { ...prev, medicines: m }; 
                                                                            });
                                                                        }} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #c7d2fe', borderRadius: '4px', boxSizing: 'border-box' }} placeholder="e.g. 2" />
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', display: 'block', marginBottom: '4px' }}>Duration (days)</label>
                                                                        <input type="number" min="0" value={med.durationDays || ''} onChange={e => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            setSessionData(prev => { 
                                                                                const m = [...prev.medicines]; 
                                                                                const dose = parseFloat(m[idx].dosePerAdmin) || 0;
                                                                                const freq = parseFloat(m[idx].frequency) || 0;
                                                                                m[idx] = { ...m[idx], durationDays: e.target.value, totalDosageRequired: dose * freq * val }; 
                                                                                return { ...prev, medicines: m }; 
                                                                            });
                                                                        }} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #c7d2fe', borderRadius: '4px', boxSizing: 'border-box' }} placeholder="e.g. 5" />
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', display: 'block', marginBottom: '4px' }}>Total Vial Size (ml)</label>
                                                                        <input type="number" min="0" step="any" value={med.vialSize || ''} onChange={e => setSessionData(prev => { const m = [...prev.medicines]; m[idx] = { ...m[idx], vialSize: e.target.value }; return { ...prev, medicines: m }; })} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #c7d2fe', borderRadius: '4px', boxSizing: 'border-box' }} placeholder="e.g. 10" />
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#16a34a', display: 'block', marginBottom: '4px' }}>Total Reqd. (ml)</label>
                                                                        <input type="text" readOnly value={med.totalDosageRequired || 0} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #86efac', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 'bold', boxSizing: 'border-box' }} />
                                                                    </div>
                                                                </div>

                                                                {/* IVF Specific Schedule Row */}
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', display: 'block', marginBottom: '4px' }}>Volume (ml/IU)</label>
                                                                        <input value={med.volumeMl || ''} onChange={e => setSessionData(prev => { const m = [...prev.medicines]; m[idx] = { ...m[idx], volumeMl: e.target.value }; return { ...prev, medicines: m }; })} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #c7d2fe', borderRadius: '4px', boxSizing: 'border-box' }} placeholder="e.g. 1.5 ml" />
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', display: 'block', marginBottom: '4px' }}>Admin Time</label>
                                                                        <input value={med.administrationTime || ''} onChange={e => setSessionData(prev => { const m = [...prev.medicines]; m[idx] = { ...m[idx], administrationTime: e.target.value }; return { ...prev, medicines: m }; })} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #c7d2fe', borderRadius: '4px', boxSizing: 'border-box' }} placeholder="e.g. 09:00 AM" />
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', display: 'block', marginBottom: '4px' }}>Gap Days</label>
                                                                        <input type="number" min="0" value={med.gapDays || 0} onChange={e => setSessionData(prev => { const m = [...prev.medicines]; m[idx] = { ...m[idx], gapDays: parseInt(e.target.value) || 0 }; return { ...prev, medicines: m }; })} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #c7d2fe', borderRadius: '4px', boxSizing: 'border-box' }} placeholder="e.g. 2 for alternate" />
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', display: 'block', marginBottom: '4px' }}>Start Date</label>
                                                                        <input type="date" value={med.startDate || ''} onChange={e => setSessionData(prev => { const m = [...prev.medicines]; m[idx] = { ...m[idx], startDate: e.target.value }; return { ...prev, medicines: m }; })} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', border: '1px solid #c7d2fe', borderRadius: '4px', boxSizing: 'border-box' }} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
                                            )})}
                                            {sessionData.medicines.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                                        No medicines added yet. Use quick-add above or click "+ Add Row".
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSessionData(prev => ({ ...prev, medicines: [...prev.medicines, { medicineName: '', saltName: '', dose: '', days: '', volumeMl: '', administrationTime: '', gapDays: 0, startDate: '', dosePerAdmin: '', frequency: '', durationDays: '', vialSize: '', totalDosageRequired: 0 }] }))}
                                    style={{ marginTop: '8px', padding: '6px 14px', fontSize: '12px', background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: '6px', color: '#16a34a', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    + Add Row
                                </button>
                            </div>

                            <hr style={{ border: 'none', borderTop: '2px dashed #e2e8f0', margin: '0' }} />

                            {/* Lab Tests Section */}
                            <div>
                                <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>🧪 Select Lab Tests</h4>

                                {/* ===== TEST PACKAGES SECTION ===== */}
                                {testPackages.length > 0 && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            📦 Test Packages <span style={{ background: '#eef2ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{testPackages.length}</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                            {testPackages.map(pkg => {
                                                const isSelected = selectedPackages.includes(pkg._id);
                                                const pkgTestNames = (pkg.tests || []).map(t => t.name || t);
                                                const individualTotal = (pkg.tests || []).reduce((s, t) => s + (t.price || 0), 0);
                                                const displayPrice = pkg.discountedPrice || pkg.price || individualTotal;
                                                const savings = individualTotal > displayPrice ? Math.round(((individualTotal - displayPrice) / individualTotal) * 100) : 0;

                                                return (
                                                    <div
                                                        key={pkg._id}
                                                        onClick={() => {
                                                            const newSelectedPkgs = isSelected
                                                                ? selectedPackages.filter(id => id !== pkg._id)
                                                                : [...selectedPackages, pkg._id];
                                                            setSelectedPackages(newSelectedPkgs);

                                                            // Auto-toggle all tests in this package
                                                            let currentTests = sessionData.labTests ? sessionData.labTests.split(', ').filter(t => t.trim()) : [];
                                                            if (!isSelected) {
                                                                // Add all package test names
                                                                pkgTestNames.forEach(tn => {
                                                                    if (!currentTests.includes(tn)) currentTests.push(tn);
                                                                });
                                                            } else {
                                                                // Remove package test names (only if not in another selected package)
                                                                const otherPkgTests = testPackages
                                                                    .filter(p => newSelectedPkgs.includes(p._id))
                                                                    .flatMap(p => (p.tests || []).map(t => t.name || t));
                                                                pkgTestNames.forEach(tn => {
                                                                    if (!otherPkgTests.includes(tn)) {
                                                                        currentTests = currentTests.filter(t => t !== tn);
                                                                    }
                                                                });
                                                            }
                                                            setSessionData(prev => ({ ...prev, labTests: currentTests.join(', ') }));
                                                        }}
                                                        style={{
                                                            padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                                                            border: `2px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                                                            background: isSelected ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)' : '#fafafa',
                                                            transition: 'all 0.25s', position: 'relative',
                                                            boxShadow: isSelected ? '0 4px 12px rgba(99,102,241,0.15)' : 'none'
                                                        }}
                                                    >
                                                        {isSelected && (
                                                            <div style={{ position: 'absolute', top: '8px', right: '10px', width: '22px', height: '22px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: '800' }}>✓</div>
                                                        )}
                                                        <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '14px', marginBottom: '4px' }}>{pkg.name}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                            <span style={{ fontWeight: '800', color: '#059669', fontSize: '15px' }}>₹{displayPrice}</span>
                                                            {savings > 0 && (
                                                                <>
                                                                    <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '12px' }}>₹{individualTotal}</span>
                                                                    <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '700' }}>{savings}% OFF</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {pkgTestNames.map((tn, i) => (
                                                                <span key={i} style={{ fontSize: '10px', padding: '2px 6px', background: isSelected ? '#c7d2fe' : '#e2e8f0', color: isSelected ? '#3730a3' : '#475569', borderRadius: '6px', fontWeight: '600' }}>{tn}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ===== INDIVIDUAL TESTS ===== */}
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Individual Tests</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                                    {catalogTests.length > 0 ? catalogTests.filter(t => t.isActive).map(test => {
                                        const isChecked = sessionData.labTests.split(', ').includes(test.name);
                                        return (
                                            <label key={test._id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', cursor: 'pointer', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', background: isChecked ? '#eff6ff' : '#fafafa', borderColor: isChecked ? '#93c5fd' : '#e2e8f0', transition: 'all 0.2s' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        let currentTests = sessionData.labTests ? sessionData.labTests.split(', ') : [];
                                                        if (e.target.checked) {
                                                            currentTests.push(test.name);
                                                        } else {
                                                            currentTests = currentTests.filter(t => t !== test.name);
                                                        }
                                                        setSessionData(prev => ({ ...prev, labTests: currentTests.join(', ') }));
                                                    }}
                                                    style={{ marginTop: '2px', cursor: 'pointer', width: '16px', height: '16px' }}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{test.name}</div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{test.category} {test.price ? `• ₹${test.price}` : ''}</div>
                                                </div>
                                            </label>
                                        );
                                    }) : <p style={{ color: '#94a3b8', fontSize: '13px', gridColumn: '1 / -1', textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>No lab tests defined by Super Admin.</p>}
                                </div>

                                {/* ===== PRICING SUMMARY ===== */}
                                {selectedPackages.length > 0 && (
                                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px' }}>
                                        <div style={{ fontWeight: '700', color: '#166534', fontSize: '13px', marginBottom: '6px' }}>📦 Package Pricing Applied:</div>
                                        {selectedPackages.map(pkgId => {
                                            const pkg = testPackages.find(p => p._id === pkgId);
                                            if (!pkg) return null;
                                            const displayPrice = pkg.discountedPrice || pkg.price || 0;
                                            return (
                                                <div key={pkgId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '4px 0', color: '#334155' }}>
                                                    <span>{pkg.name} ({(pkg.tests || []).length} tests)</span>
                                                    <span style={{ fontWeight: '700', color: '#059669' }}>₹{displayPrice}</span>
                                                </div>
                                            );
                                        })}
                                        <div style={{ borderTop: '1px dashed #86efac', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '14px', color: '#15803d' }}>
                                            <span>Total Package Cost:</span>
                                            <span>₹{selectedPackages.reduce((sum, pkgId) => {
                                                const pkg = testPackages.find(p => p._id === pkgId);
                                                return sum + (pkg?.discountedPrice || pkg?.price || 0);
                                            }, 0)}</span>
                                        </div>
                                    </div>
                                )}
                                <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Edit Final Lab Tests (Comma separated):</label>
                                <input
                                    name="labTests"
                                    value={sessionData.labTests}
                                    onChange={handleSessionChange}
                                    placeholder="CBC, LFT, KFT..."
                                    className="dpd-diag-input"
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>

                        </div>

                        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setShowPrescribeModal(false)} style={{ padding: '12px 24px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>Close</button>
                            <button onClick={() => setShowPrescribeModal(false)} style={{ padding: '12px 30px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)' }}>Save Selections & Resume Note</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorPatientDetails;