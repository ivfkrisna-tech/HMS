import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientAPI, admissionAPI, uploadAPI, receptionAPI } from '../../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../store/hooks';
import './UnifiedPatientProfile.css';

const UnifiedPatientProfile = () => {
    const { id: patientId } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [patientData, setPatientData] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [consentForm, setConsentForm] = useState({ name: '', file: null });
    const [uploadingConsent, setUploadingConsent] = useState(false);

    const handleConsentFileChange = (e) => {
        setConsentForm(prev => ({ ...prev, file: e.target.files[0] }));
    };

    const handleSaveConsent = async () => {
        if (!consentForm.name || !consentForm.file) {
            alert("Please enter Consent Name and select a file.");
            return;
        }
        setUploadingConsent(true);
        try {
            const formData = new FormData();
            formData.append('images', consentForm.file);
            const uploadRes = await uploadAPI.uploadImages(formData);
            
            if (uploadRes.success && uploadRes.files && uploadRes.files.length > 0) {
                const newConsent = {
                    consentName: consentForm.name,
                    fileUrl: uploadRes.files[0].url,
                    fileType: uploadRes.files[0].mimetype || 'document',
                    uploadedAt: new Date().toISOString()
                };
                
                const updatedConsents = [...(patientData.consents || []), newConsent];
                const res = await receptionAPI.updateIntake(patientData._id, { consents: updatedConsents });
                
                if (res.success) {
                    setPatientData(prev => ({ ...prev, consents: updatedConsents }));
                    setConsentForm({ name: '', file: null });
                    alert("Consent saved successfully!");
                } else {
                    alert(res.message || "Failed to update patient profile.");
                }
            } else {
                alert("File upload failed.");
            }
        } catch (err) {
            console.error(err);
            alert("Error saving consent.");
        } finally {
            setUploadingConsent(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        setError('');
        setPatientData(null);
        setTimeline([]);
        setAdmissions([]);
        const fetchProfile = async () => {
            try {
                const res = await patientAPI.getFullHistory(patientId);
                if (res.success) {
                    setPatientData(res.user);
                    setTimeline(res.timeline || []);
                }
            } catch (err) {
                console.error("Error fetching unified profile", err);
                setError('Failed to load patient history or unauthorized access.');
            } finally {
                setLoading(false);
            }
        };
        const fetchAdmissions = async () => {
            try {
                const res = await admissionAPI.getPatientAdmissions(patientId);
                if (res.success) setAdmissions(res.admissions || []);
            } catch (err) { /* admissions are optional — fail silently */ }
        };
        fetchProfile();
        fetchAdmissions();
    }, [patientId]);

    const calculateMetrics = () => {
        let metrics = {
            totalPaid: 0,
            totalDue: 0,
            appointmentsCount: 0,
            upcomingAppointments: 0,
            pendingLabs: 0,
            completedLabs: 0
        };

        const now = new Date();
        const isPaid = (status) => (status || '').toLowerCase() === 'paid';
        const isPending = (status) => ['pending', 'unpaid', ''].includes((status || '').toLowerCase());

        timeline.forEach(item => {
            if (item.linkedPatientId) return; // Skip partner timeline items for metrics
            const data = item.data;
            if (item.type === 'appointment') {
                metrics.appointmentsCount++;
                if (new Date(data.appointmentDate) >= now.setHours(0, 0, 0, 0) && data.status !== 'cancelled' && data.status !== 'completed') {
                    metrics.upcomingAppointments++;
                }
                const amt = Number(data.amount) || 0;
                if (isPaid(data.paymentStatus)) metrics.totalPaid += amt;
                else if (isPending(data.paymentStatus)) metrics.totalDue += amt;
            } else if (item.type === 'labReport') {
                if ((data.status || '').toLowerCase() === 'completed') metrics.completedLabs++;
                else metrics.pendingLabs++;
                const amt = Number(data.amount) || 0;
                if (isPaid(data.paymentStatus)) metrics.totalPaid += amt;
                else if (isPending(data.paymentStatus)) metrics.totalDue += amt;
            } else if (item.type === 'pharmacyOrder') {
                const amt = Number(data.totalAmount) || 0;
                if (isPaid(data.paymentStatus)) metrics.totalPaid += amt;
                else if (isPending(data.paymentStatus)) metrics.totalDue += amt;
            }
        });

        // Include active admission charges in pending dues
        admissions.forEach(adm => {
            if (isPaid(adm.paymentStatus)) {
                metrics.totalPaid += Number(adm.totalAmount) || 0;
            } else if (adm.status === 'Admitted') {
                metrics.totalDue += Number(adm.totalAmount) || 0;
            }
        });

        return metrics;
    };

    const generatePDFForUser = async (targetPatientId) => {
        try {
            const res = await patientAPI.getFullHistory(targetPatientId);
            if (res.success && res.user) {
                const doc = new jsPDF();
                let y = 20;

                // Header
                doc.setFontSize(22);
                doc.setTextColor(41, 128, 185);
                doc.text("PAWAN HARISH IVF CENTER", 105, y, { align: 'center' });
                y += 10;
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text("Complete Unified Patient Record", 105, y, { align: 'center' });
                y += 15;

                // Patient Details Block
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.setFillColor(240, 240, 240);
                doc.rect(14, y, 182, 35, 'F');

                y += 10;
                doc.setFont("helvetica", "bold"); doc.text("Patient Name:", 18, y);
                doc.setFont("helvetica", "normal"); doc.text(`${res.user.name || '-'}`, 55, y);
                doc.setFont("helvetica", "bold"); doc.text("MRN / ID:", 120, y);
                doc.setFont("helvetica", "normal"); doc.text(`${res.user.patientId || '-'}`, 150, y);

                y += 10;
                doc.setFont("helvetica", "bold"); doc.text("Phone:", 18, y);
                doc.setFont("helvetica", "normal"); doc.text(`${res.user.phone || '-'}`, 55, y);
                doc.setFont("helvetica", "bold"); doc.text("DOB:", 120, y);
                doc.setFont("helvetica", "normal"); doc.text(`${res.user.dob ? new Date(res.user.dob).toLocaleDateString() : '-'}`, 150, y);

                y += 10;
                doc.setFont("helvetica", "bold"); doc.text("Gender:", 18, y);
                doc.setFont("helvetica", "normal"); doc.text(`${res.user.gender || '-'}`, 55, y);
                doc.setFont("helvetica", "bold"); doc.text("Report Date:", 120, y);
                doc.setFont("helvetica", "normal"); doc.text(`${new Date().toLocaleDateString()}`, 150, y);

                y += 20;

                // Timeline Records
                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.text("Comprehensive Medical & Financial History", 14, y);
                y += 8;

                const tableBody = (res.timeline || []).map(item => {
                    const d = new Date(item.date).toLocaleDateString();
                    let desc = '';
                    let amount = '-';
                    let payStatus = '-';

                    if (item.type === 'appointment') {
                        desc = `Appointment w/ ${item.data.doctorName || 'Doctor'} - ${item.data.serviceName || 'Consultation'}`;
                        amount = `₹${item.data.amount || 0}`;
                        payStatus = item.data.paymentStatus || 'pending';
                    } else if (item.type === 'clinicalVisit') {
                        desc = `Clinical Visit - ${item.summary?.outcome || 'Session Recorded'}`;
                    } else if (item.type === 'labReport') {
                        desc = `Lab Order: ${(item.data.testNames || []).join(', ')} [${item.data.status}]`;
                        amount = `₹${item.data.amount || 0}`;
                        payStatus = item.data.paymentStatus || 'pending';
                    } else if (item.type === 'pharmacyOrder') {
                        desc = `Pharmacy Order (${item.data.items?.length || 0} items) [${item.data.status}]`;
                        amount = `₹${item.data.totalAmount || 0}`;
                        payStatus = item.data.paymentStatus || 'pending';
                    }

                    return [d, item.type.toUpperCase(), desc, amount, payStatus];
                });

                autoTable(doc, {
                    startY: y,
                    head: [['Date', 'Category', 'Description/Details', 'Amount', 'Payment status']],
                    body: tableBody,
                    theme: 'grid',
                    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                    columnStyles: { 2: { cellWidth: 80 } }
                });

                doc.save(`Patient_Profile_${res.user.patientId || res.user._id}.pdf`);
            } else {
                alert("Failed to download profile: user data not found.");
            }
        } catch (error) {
            console.error("Error downloading profile", error);
            alert("Failed to download profile.");
        }
    };

    const generatePDF = () => {
        if (!patientData) return;
        generatePDFForUser(patientData._id);
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading unified profile...</div>;
    if (error) return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: 'red' }}>{error}</p>
            <button onClick={() => navigate(-1)} style={{ marginTop: '12px', padding: '8px 16px', cursor: 'pointer' }}>← Go Back</button>
        </div>
    );
    if (!patientData) return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <p>Patient not found or no data available.</p>
            <button onClick={() => navigate(-1)} style={{ marginTop: '12px', padding: '8px 16px', cursor: 'pointer' }}>← Go Back</button>
        </div>
    );

    const metrics = calculateMetrics();
    const profile = patientData.fertilityProfile || {};

    // Helper functions for the status boxes
    const getUpcomingAppointments = () => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return timeline.filter(t =>
            !t.linkedPatientId &&
            t.type === 'appointment' &&
            new Date(t.data.appointmentDate) >= now &&
            t.data.status !== 'cancelled' && t.data.status !== 'completed'
        ).sort((a, b) => new Date(a.data.appointmentDate) - new Date(b.data.appointmentDate));
    };

    const getLabTestStatus = () => {
        return timeline.filter(t => !t.linkedPatientId && t.type === 'labReport').slice(0, 5);
    };

    const getMedications = () => {
        let active = [];
        let previous = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Map deduplication
        const seenCurrent = new Set();
        const seenPrev = new Set();

        timeline.forEach(t => {
            if (t.linkedPatientId) return; // Skip partner medications
            const isRecent = new Date(t.date) >= thirtyDaysAgo;

            const addMed = (name, details) => {
                if (!name) return;
                const key = name.toLowerCase().trim();
                const medObj = { name, details: details || '', date: t.date };

                if (isRecent) {
                    if (!seenCurrent.has(key)) {
                        seenCurrent.add(key);
                        active.push(medObj);
                    }
                } else {
                    if (!seenCurrent.has(key) && !seenPrev.has(key)) {
                        seenPrev.add(key);
                        previous.push(medObj);
                    }
                }
            };

            if (t.type === 'pharmacyOrder' && t.data.items) {
                t.data.items.forEach(i => addMed(i.medicineName, `Qty: ${i.quantity || '-'}`));
            } else if (t.type === 'appointment' && t.data.pharmacy) {
                t.data.pharmacy.forEach(m => addMed(m.medicineName, `${m.frequency || ''} ${m.duration || ''}`.trim()));
            } else if (t.type === 'clinicalVisit' && t.data.doctorConsultation?.prescription) {
                t.data.doctorConsultation.prescription.forEach(p => addMed(p.medicine, `${p.dosage || ''} ${p.duration || ''}`.trim()));
            }
        });

        return { active, previous };
    };

    const formatCoupleId = (rawId) => {
        if (!rawId || rawId === 'N/A') return 'N/A';
        const match = rawId.match(/^(CPL-)0*(\d+)$/);
        if (!match) return rawId;
        const num = parseInt(match[2], 10);
        if (num <= 999) return `CPL-${String(num).padStart(3, '0')}`;
        return `CPL-${num}`;
    };

    const getPartnerFirstName = () => {
        if (!patientData?.partnerPatientId) return 'Partner';
        const partnerObj = patientData.partnerPatientId;
        if (partnerObj.firstName) return partnerObj.firstName.trim();
        if (partnerObj.name) {
            const parts = partnerObj.name.trim().split(/\s+/);
            if (parts.length > 1 && ['mr', 'mrs', 'ms', 'dr', 'mr.', 'mrs.', 'ms.', 'dr.'].includes(parts[0].toLowerCase())) {
                return parts[1];
            }
            if (parts[0]) return parts[0];
        }
        return 'Partner';
    };
    const partnerFirstName = getPartnerFirstName();

    const upcomingAppts = getUpcomingAppointments();
    const labStatus = getLabTestStatus();
    const meds = getMedications();

    return (
        <div className="upp-container">
            <button className="btn-secondary" style={{ marginBottom: '16px' }} onClick={() => navigate(-1)}>
                &larr; Back
            </button>

            {/* Header Profile Card */}
            <div className="upp-header-card">
                <div className="upp-identity">
                    <div className="upp-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                        {patientData.avatar
                            ? <img src={patientData.avatar} alt={patientData.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                            : (patientData.name || 'P')[0].toUpperCase()
                        }
                    </div>
                    <div className="upp-info">
                        <h1>{patientData.name || 'Unknown Patient'}</h1>
                        <div className="upp-tags">
                            <span className="upp-tag">MRN/ID: {patientData.patientId || patientData._id}</span>
                            <span className="upp-tag">📞 {patientData.phone || '-'}</span>
                            <span className="upp-tag">🩸 {profile.bloodGroup || 'O-'}</span>
                            <span className="upp-tag">{patientData.gender || 'Unknown'} - {patientData.dob ? new Date().getFullYear() - new Date(patientData.dob).getFullYear() : (profile.age || '-')} yrs</span>
                            {patientData.email && <span className="upp-tag">✉️ {patientData.email}</span>}
                        </div>
                        { (patientData.houseNumber || patientData.street || patientData.city || patientData.state || patientData.pincode || patientData.address) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.9rem', marginTop: '8px' }}>
                                <span>📍</span>
                                <span>
                                    {[
                                        patientData.houseNumber,
                                        patientData.street,
                                        patientData.address,
                                        patientData.city,
                                        patientData.state,
                                        patientData.pincode
                                    ].filter(Boolean).join(', ')}
                                </span>
                            </div>
                        )}
                        {patientData.sourceInformation?.sourceType && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#64748b', fontSize: '0.9rem', marginTop: '12px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontWeight: 600, color: '#475569' }}>📢 Source: {patientData.sourceInformation.sourceType}</div>
                                {patientData.sourceInformation.sourceType === 'Newspaper' && patientData.sourceInformation.newspaperName && <div>📰 Newspaper: {patientData.sourceInformation.newspaperName}</div>}
                                {patientData.sourceInformation.sourceType === 'Camp' && (
                                    <>
                                        {patientData.sourceInformation.campName && <div>🏕️ Camp Name: {patientData.sourceInformation.campName}</div>}
                                        {patientData.sourceInformation.campLocation && <div>📍 Location: {patientData.sourceInformation.campLocation}</div>}
                                        {patientData.sourceInformation.reference && <div>👤 Reference: {patientData.sourceInformation.reference}</div>}
                                    </>
                                )}
                                {patientData.sourceInformation.sourceType === 'Family & Friends' && patientData.sourceInformation.referencePersonName && <div>👤 Reference Person: {patientData.sourceInformation.referencePersonName}</div>}
                                {patientData.sourceInformation.sourceType === 'Doctor Reference' && (
                                    <>
                                        {patientData.sourceInformation.doctorName && <div>👨‍⚕️ Doctor: {patientData.sourceInformation.doctorName}</div>}
                                        {patientData.sourceInformation.hospitalName && <div>🏥 Hospital: {patientData.sourceInformation.hospitalName}</div>}
                                    </>
                                )}
                                {patientData.sourceInformation.sourceType === 'Others' && patientData.sourceInformation.description && <div>📝 Description: {patientData.sourceInformation.description}</div>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="upp-actions">
                    <button className="upp-btn-download" onClick={generatePDF}>
                        📥 Download Full Profile
                    </button>
                    {(currentUser && (
                        currentUser?._roleData?.name?.toLowerCase().includes('reception') ||
                        currentUser?._roleData?.name?.toLowerCase().includes('admin') ||
                        currentUser?._roleData?.name?.toLowerCase().includes('staff') ||
                        currentUser?._roleData?.name?.toLowerCase().includes('front') ||
                        currentUser?.role?.toLowerCase()?.includes('reception') ||
                        currentUser?.role?.toLowerCase()?.includes('admin') ||
                        currentUser?.role?.toLowerCase()?.includes('staff') ||
                        currentUser?.role?.toLowerCase()?.includes('front') ||
                        currentUser?._roleData?.permissions?.includes('patient_create') ||
                        currentUser?._roleData?.permissions?.includes('*')
                    )) && (
                        <button className="upp-btn-edit" onClick={() => navigate(`/reception/dashboard?mode=intake&patientId=${patientData._id}`)}>
                            ✏️ Edit Profile
                        </button>
                    )}
                </div>
            </div>

            {/* Partner Information Card */}
            <div className="upp-partner-card">
                <div className="upp-partner-info">
                    <div className="upp-partner-title">
                        <span>🔗 Partner Information</span>
                    </div>
                    {patientData.partnerPatientId ? (
                        <div className="upp-partner-details">
                            <div className="upp-partner-tags-row">
                                <span className="upp-tag">Name: {patientData.partnerPatientId.name || `${patientData.partnerPatientId.firstName || ''} ${patientData.partnerPatientId.lastName || ''}`.trim() || 'Unknown'}</span>
                                <span className="upp-tag">Relation: {patientData.partnerRelation || 'Partner'}</span>
                            </div>
                            <div className="upp-partner-tags-row">
                                <span className="upp-tag">MRN: {patientData.partnerPatientId.patientId || patientData.partnerPatientId.mrn || patientData.partnerPatientId._id}</span>
                                <span className="upp-tag">Couple ID: {formatCoupleId(patientData.coupleId || patientData.partnerPatientId.coupleId || 'N/A')}</span>
                            </div>
                        </div>
                    ) : (
                        <span className="upp-partner-empty">No Partner Linked</span>
                    )}
                </div>
                {patientData.partnerPatientId && (
                    <div className="upp-partner-actions">
                        <button className="upp-btn-partner-view" onClick={() => navigate(`/patient/${patientData.partnerPatientId._id || patientData.partnerPatientId}`)}>
                            👥 View {partnerFirstName} Profile
                        </button>
                        <button className="upp-btn-partner-download" onClick={() => generatePDFForUser(patientData.partnerPatientId._id || patientData.partnerPatientId)}>
                            📥 Download {partnerFirstName} Profile
                        </button>
                    </div>
                )}
            </div>

            {/* Metrics Grid */}
            <div className="upp-metrics">
                <div className="upp-metric-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <span className="upp-metric-label">Total Visits</span>
                    <span>{metrics.appointmentsCount}</span>
                </div>
                <div className="upp-metric-card" style={{ borderLeft: '4px solid #eab308' }}>
                    <span className="upp-metric-label">Upcoming Appts</span>
                    <span>{metrics.upcomingAppointments}</span>
                </div>
                <div className="upp-metric-card" style={{ borderLeft: '4px solid #ef4444' }}>
                    <span className="upp-metric-label">Pending Dues</span>
                    <span style={{ color: '#ef4444' }}>₹{metrics.totalDue}</span>
                </div>
                <div className="upp-metric-card" style={{ borderLeft: '4px solid #22c55e' }}>
                    <span className="upp-metric-label">Total Paid</span>
                    <span style={{ color: '#22c55e' }}>₹{metrics.totalPaid}</span>
                </div>
            </div>

            {/* Content Layout */}
            <div className="upp-content-grid">

                {/* Left Column: Vertical Timeline */}
                <div className="upp-section">
                    <h3>Chronological History ({timeline.length} Records)</h3>
                    {timeline.length === 0 ? (
                        <p style={{ color: '#64748b' }}>No clinical or financial history recorded yet.</p>
                    ) : (
                        <div className="upp-timeline">
                            {timeline.map((item, idx) => {
                                const ds = new Date(item.date).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                });

                                return (
                                    <div key={idx} className={`upp-timeline-item type-${item.type}`}>
                                        <div className="upp-tl-header">
                                            <span className="upp-tl-date">{ds}</span>
                                            <span className={`upp-tl-badge badge-${item.type}`}>
                                                {item.type.replace(/([A-Z])/g, ' $1').trim()}
                                            </span>
                                        </div>

                                        <div className="upp-tl-body">
                                            {item.type === 'appointment' && (
                                                <>
                                                    <strong>{item.data.serviceName || 'Consultation'} with {item.data.doctorName || 'Doctor'}</strong>
                                                    <div>Status: <span style={{ textTransform: 'capitalize' }}>{item.data.status}</span></div>
                                                    {item.data.amount > 0 && (
                                                        <div>
                                                            Fees: ₹{item.data.amount} ({item.data.paymentStatus})
                                                            {item.data.paymentMethod && <span> | Method: {item.data.paymentMethod}</span>}
                                                            {item.data.paymentProofUrl && (
                                                                <span style={{ marginLeft: '8px' }}>
                                                                    | Proof: <a href={item.data.paymentProofUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>[View Proof]</a>
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {item.type === 'clinicalVisit' && (
                                                <>
                                                    <strong>Clinical Evaluation</strong>
                                                    <div>Chief Complaint: {item.summary.primaryComplaint}</div>
                                                    <div>Diagnosis: {item.summary.outcome}</div>
                                                    {item.data.doctorConsultation?.clinicalNotes && (
                                                        <div style={{ marginTop: '8px', fontStyle: 'italic', background: '#fff', padding: '8px', borderLeft: '3px solid #cbd5e1' }}>
                                                            "{item.data.doctorConsultation.clinicalNotes}"
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {item.type === 'labReport' && (
                                                <>
                                                    <strong>Lab Order ({item.data.status})</strong>
                                                    <div>Tests: {(item.data.testNames || []).join(', ')}</div>
                                                    {item.data.amount > 0 && <div>Fees: ₹{item.data.amount} ({item.data.paymentStatus})</div>}
                                                    {item.data.reportFileUrl && (
                                                        <a href={item.data.reportFileUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, marginTop: '5px', display: 'inline-block' }}>
                                                            📄 View Result
                                                        </a>
                                                    )}
                                                </>
                                            )}

                                            {item.type === 'pharmacyOrder' && (
                                                <>
                                                    <strong>Pharmacy Dispensation ({item.data.status})</strong>
                                                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                                        {(item.data.items || []).map((med, mIdx) => (
                                                            <li key={mIdx}>{med.medicineName} x{med.quantity}</li>
                                                        ))}
                                                    </ul>
                                                    <div>Total: ₹{item.data.totalAmount} ({item.data.paymentStatus})</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right Column: Financial & Other Summaries */}
                <div className="upp-side-col" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Status: Upcoming Appointments */}
                    <div className="upp-section">
                        <h3>Upcoming Appointments</h3>
                        {upcomingAppts.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No upcoming appointments.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {upcomingAppts.map((apt, idx) => (
                                    <div key={idx} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                                            {new Date(apt.data.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {apt.data.appointmentTime || 'TBD'}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{apt.data.doctorName || 'Doctor'} - {apt.data.serviceName || 'Consultation'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status: Lab Tests */}
                    <div className="upp-section">
                        <h3>Recent Lab Tests</h3>
                        {labStatus.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No lab tests recorded.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {labStatus.map((lab, idx) => (
                                    <div key={idx} style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>
                                                {(lab.data.testNames || []).join(', ').substring(0, 30)}{(lab.data.testNames || []).join(', ').length > 30 ? '...' : ''}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{new Date(lab.date).toLocaleDateString('en-IN')}</div>
                                        </div>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
                                            background: lab.data.status === 'completed' ? '#dcfce7' : '#fef3c7',
                                            color: lab.data.status === 'completed' ? '#166534' : '#92400e'
                                        }}>{lab.data.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Medications */}
                    <div className="upp-section">
                        <h3 style={{ marginBottom: '16px' }}>Medications</h3>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', marginBottom: '8px' }}>Currently On (~30 days)</div>
                            {meds.active.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>No active medications found.</p>
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: '#334155' }}>
                                    {meds.active.map((m, i) => (
                                        <li key={i} style={{ marginBottom: '6px' }}>
                                            <strong>{m.name}</strong> {m.details && <span style={{ color: '#64748b', fontSize: '12px' }}>({m.details})</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Previously On</div>
                            {meds.previous.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>No previous medications.</p>
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#475569' }}>
                                    {meds.previous.map((m, i) => (
                                        <li key={i} style={{ marginBottom: '4px' }}>
                                            <strong>{m.name}</strong> <span style={{ color: '#94a3b8', fontSize: '12px' }}>({new Date(m.date).toLocaleDateString('en-IN')})</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Patient Consent Information */}
                    <div className="upp-section">
                        <h3>📋 Patient Consent Information</h3>
                        
                        <h4 style={{ fontSize: '14px', marginBottom: '12px', color: '#1e293b' }}>Consent Records</h4>
                        {(patientData.consents || []).length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>No consents uploaded yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                                {(patientData.consents).map((c, i) => (
                                    <div key={i} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '1.4rem' }}>{c.fileUrl?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{c.consentName}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{new Date(c.uploadedAt).toLocaleDateString('en-IN')}</div>
                                            </div>
                                        </div>
                                        {c.fileUrl && (
                                            <a href={c.fileUrl} title="View / Download" target="_blank" rel="noreferrer" style={{ background: '#dcfce7', color: '#166534', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', fontSize: '14px', textDecoration: 'none' }}>
                                                👁
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <h4 style={{ fontSize: '14px', marginBottom: '12px', color: '#1e293b' }}>Add New Consent</h4>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Consent Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter Consent Name" 
                                        value={consentForm.name}
                                        onChange={(e) => setConsentForm(prev => ({...prev, name: e.target.value}))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Upload Consent File</label>
                                    <input 
                                        type="file" 
                                        accept=".pdf, .jpg, .jpeg, .png"
                                        onChange={handleConsentFileChange}
                                        style={{ width: '100%', padding: '5px 0', fontSize: '14px' }}
                                    />
                                </div>
                                <button 
                                    onClick={handleSaveConsent}
                                    disabled={uploadingConsent}
                                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '6px', cursor: uploadingConsent ? 'not-allowed' : 'pointer', fontWeight: '600', width: '100%', marginTop: '4px', opacity: uploadingConsent ? 0.7 : 1 }}
                                >
                                    {uploadingConsent ? 'Saving...' : 'Save Consent'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Uploaded Documents & Reports */}
                    <div className="upp-section">
                        <h3>📁 Reports &amp; Documents</h3>
                        {(patientData.fertilityProfile?.previousReports || []).length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No documents uploaded yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(patientData.fertilityProfile.previousReports).map((doc, i) => (
                                    <div key={i} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>📄 {doc.fileName || `Document ${i + 1}`}</div>
                                            {doc.date && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{new Date(doc.date).toLocaleDateString('en-IN')}</div>}
                                        </div>
                                        {doc.url && (
                                            <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontSize: '12px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>👁 View</a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Lab Report Files from Timeline */}
                    {timeline.filter(t => !t.linkedPatientId && t.type === 'labReport' && t.data.reportFileUrl).length > 0 && (
                        <div className="upp-section">
                            <h3>🧪 Lab Report Files</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {timeline.filter(t => !t.linkedPatientId && t.type === 'labReport' && t.data.reportFileUrl).map((t, i) => (
                                    <div key={i} style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#0369a1' }}>{(t.data.testNames || []).join(', ') || 'Lab Report'}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{new Date(t.date).toLocaleDateString('en-IN')}</div>
                                        </div>
                                        <a href={t.data.reportFileUrl} target="_blank" rel="noreferrer" style={{ color: '#0369a1', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>👁 View</a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="upp-section">
                        <h3>Recent Finances</h3>
                        {timeline.filter(t => !t.linkedPatientId && (t.data.amount > 0 || t.data.totalAmount > 0)).slice(0, 5).map((t, idx) => {
                            const amt = t.data.amount || t.data.totalAmount;
                            const status = t.data.paymentStatus || 'pending';
                            const label = t.type === 'appointment' ? 'Visit Fee' : t.type === 'labReport' ? 'Lab Tests' : 'Medicines';

                            return (
                                <div key={idx} className="upp-finance-row">
                                    <span>
                                        <strong>{label}</strong>
                                        {t.data.paymentMethod && <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>({t.data.paymentMethod})</span>}
                                        <br /><small style={{ color: '#64748b' }}>{new Date(t.date).toLocaleDateString()}</small>
                                    </span>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                            <div style={{ fontWeight: 600 }}>₹{amt}</div>
                                            {t.data.paymentProofUrl && (
                                                <a href={t.data.paymentProofUrl} target="_blank" rel="noreferrer" title="View Payment Proof" style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none' }}>👁</a>
                                            )}
                                        </div>
                                        <div className={`upp-finance-status status-${status}`}>{status}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default UnifiedPatientProfile;
