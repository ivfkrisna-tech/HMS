import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assistantAPI, doctorAPI, uploadAPI } from '../../utils/api';

const AssistantAppointments = () => {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [vitalsPatient, setVitalsPatient] = useState(null);
    const [uploadPatient, setUploadPatient] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [vitals, setVitals] = useState({
        weight: '', height: '', bmi: '', bloodPressure: '',
        pulse: '', temperature: '', spo2: '', respiratoryRate: '',
        chiefComplaint: '', notes: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAppointments();
    }, []);

    // Calculate BMI when weight/height change
    useEffect(() => {
        const w = parseFloat(vitals.weight);
        const h = parseFloat(vitals.height) / 100; // cm to m
        if (w > 0 && h > 0) {
            setVitals(v => ({ ...v, bmi: (w / (h * h)).toFixed(1) }));
        }
    }, [vitals.weight, vitals.height]);

    const handleUploadReport = async (e) => {
        e.preventDefault();
        if (!uploadFile) return;
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('images', uploadFile);
            
            const res = await uploadAPI.uploadImages(formData);
            if (res.success && res.files && res.files.length > 0) {
                const uploadedFile = res.files[0];
                const patientId = uploadPatient.userId?._id || uploadPatient.patientId;
                
                const existingProfile = uploadPatient.userId?.fertilityProfile || {};
                const existingReports = existingProfile.previousReports || [];
                
                const newReport = {
                    fileName: uploadFile.name,
                    url: uploadedFile.url,
                    date: new Date().toISOString()
                };

                await doctorAPI.updatePatientProfile(patientId, {
                    previousReports: [...existingReports, newReport]
                });

                alert("Report uploaded successfully!");
                setUploadPatient(null);
                setUploadFile(null);
                fetchAppointments();
            } else {
                throw new Error("Upload failed");
            }
        } catch (err) {
            console.error(err);
            alert("Error uploading report: " + (err.message || ''));
        } finally {
            setUploading(false);
        }
    };

    const handleSaveVitals = async () => {
        if (!vitalsPatient) return;
        setSaving(true);
        try {
            const appointmentId = vitalsPatient._id;
            
            const payload = {
                weight: vitals.weight,
                height: vitals.height,
                bmi: vitals.bmi,
                bloodPressure: vitals.bloodPressure,
                pulse: vitals.pulse,
                temperature: vitals.temperature,
                spo2: vitals.spo2,
                respiratoryRate: vitals.respiratoryRate,
                chiefComplaint: vitals.chiefComplaint,
                notes: vitals.notes
            };

            await assistantAPI.saveVitals(appointmentId, payload);

            alert('Vitals saved successfully!');
            setVitalsPatient(null);
            setVitals({ weight: '', height: '', bmi: '', bloodPressure: '', pulse: '', temperature: '', spo2: '', respiratoryRate: '', chiefComplaint: '', notes: '' });
            fetchAppointments();
        } catch (err) {
            alert('Error saving vitals: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const openVitalsForm = (apt) => {
        const existing = apt.userId?.fertilityProfile?.vitals || {};
        setVitals({
            weight: existing.weight || '',
            height: existing.height || '',
            bmi: existing.bmi || '',
            bloodPressure: existing.bloodPressure || '',
            pulse: existing.pulse || '',
            temperature: existing.temperature || '',
            spo2: existing.spo2 || '',
            respiratoryRate: existing.respiratoryRate || '',
            chiefComplaint: '',
            notes: ''
        });
        setVitalsPatient(apt);
    };

    const fetchAppointments = async () => {
        try {
            const res = await assistantAPI.getAppointments('all');
            if (res.success) {
                setAppointments(res.appointments);
            }
        } catch (error) {
            console.error("Failed to fetch appointments", error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredAppointments = () => {
        return appointments.filter(apt => {
            // Unified Search
            const term = searchTerm.toLowerCase();
            const pName = (apt.userId?.name || apt.patientId?.name || apt.patientName || '').toLowerCase();
            const pMrn = (apt.userId?.mrn || apt.userId?._id || apt.patientId?.mrn || apt.patientId?._id || '').toLowerCase();
            const pPhone = (apt.userId?.phone || apt.patientId?.phone || '').toLowerCase();

            if (!pName.includes(term) && !pMrn.includes(term) && !pPhone.includes(term)) {
                return false;
            }
            
            return true;
        });
    };

    const filteredAppointments = getFilteredAppointments();

    const handleAction = (path, appointmentId) => {
        localStorage.setItem('activeAppointmentId', appointmentId);
        navigate(`/assistant/${path}/${appointmentId}`);
    };

    const getStatusStyle = (status) => {
        const lower = status?.toLowerCase() || '';
        if (lower.includes('completed')) return { bg: '#eff6ff', color: '#2563eb' };
        if (lower.includes('ready') || lower.includes('confirmed')) return { bg: '#ecfdf5', color: '#059669' };
        if (lower.includes('preparation') || lower.includes('waiting') || lower.includes('pending') || lower.includes('in')) return { bg: '#fffbeb', color: '#d97706' };
        if (lower.includes('cancelled')) return { bg: '#fef2f2', color: '#dc2626' };
        return { bg: '#f1f5f9', color: '#475569' };
    };

    // ─── STYLES ─────────────────────────────────────────────────────
    const S = {
        page: { minHeight: '100vh', background: 'radial-gradient(circle at top right, #f0f9ff, #e0f2fe, #f1f5f9)', fontFamily: "'Outfit', 'Inter', system-ui, sans-serif", padding: '32px', color: '#1e293b' },
        topbar: { background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.6)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', borderRadius: '24px', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' },
        topLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
        logo: { width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' },
        title: { margin: '0 0 6px 0', fontSize: '2rem', fontWeight: '800', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
        subtitle: { margin: 0, color: '#64748b', fontSize: '1rem', fontWeight: '500' },
        searchWrap: { position: 'relative', flex: 1, maxWidth: '350px' },
        searchIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '1rem' },
        content: { padding: '0' },
        sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' },
        sectionTitle: { color: '#1e293b', fontSize: '1.5rem', fontWeight: '800', margin: 0 },
        table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', minWidth: '1000px' },
        th: { padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em', background: '#f8fafc' },
        td: { padding: '16px', verticalAlign: 'middle', border: 'none' },
        tableWrap: { background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.6)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', padding: '24px', overflowX: 'auto' },
        avatar: (color) => ({ width: '40px', height: '40px', borderRadius: '12px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '0.95rem', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }),
        empty: { textAlign: 'center', padding: '60px 20px', background: 'rgba(255, 255, 255, 0.7)', borderRadius: '24px', border: '2px dashed #cbd5e1' },
        loadingWrap: { textAlign: 'center', padding: '60px 0', color: '#94a3b8' },
        overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        modal: { background: 'linear-gradient(145deg, #1e293b, #0f172a)', borderRadius: '20px', width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' },
        modalHeader: { padding: '22px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        modalBody: { padding: '24px 28px' },
        formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
        formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
        formLabel: { color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
        formInput: { padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc', fontSize: '0.88rem', outline: 'none' },
        formTextarea: { padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f8fafc', fontSize: '0.88rem', outline: 'none', minHeight: '70px', resize: 'vertical', fontFamily: 'inherit' },
        modalFooter: { padding: '18px 28px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
        btn: (bg, color = '#fff') => ({ padding: '7px 18px', borderRadius: '9px', border: 'none', background: bg, color, fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }),
    };

    const cssStyles = `
        .assistant-search-input {
            width: 100%;
            padding: 11px 16px 11px 42px;
            background: #ffffff;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            color: #1e293b;
            font-size: 0.92rem;
            outline: none;
            transition: all 0.2s;
            box-sizing: border-box;
        }
        .assistant-search-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .assistant-table-row {
            background: white;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
            z-index: 1;
        }
        .assistant-table-row:hover {
            transform: scale(1.005);
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.06);
            z-index: 10;
        }
        .assistant-table-row td:first-child {
            border-radius: 12px 0 0 12px;
        }
        .assistant-table-row td:last-child {
            border-radius: 0 12px 12px 0;
        }
        .assistant-th:first-child {
            border-radius: 12px 0 0 12px;
        }
        .assistant-th:last-child {
            border-radius: 0 12px 12px 0;
        }
        .assistant-action-btn {
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        .btn-vitals {
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .btn-vitals:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 18px rgba(59, 130, 246, 0.4);
        }
        .btn-report {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }
        .btn-report:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 18px rgba(245, 158, 11, 0.4);
        }
        .btn-notes {
            background: linear-gradient(135deg, #8b5cf6, #d946ef);
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }
        .btn-notes:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 18px rgba(139, 92, 246, 0.4);
        }
        .btn-consent {
            background: linear-gradient(135deg, #10b981, #059669);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .btn-consent:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 18px rgba(16, 185, 129, 0.4);
        }
    `;

    return (
        <div style={S.page}>
            <style>{cssStyles}</style>
            <div style={S.topbar}>
                <div style={S.topLeft}>
                    <div style={S.logo}>📅</div>
                    <div>
                        <h1 style={S.title}>Appointments</h1>
                        <p style={S.subtitle}>View and manage all appointments for assigned doctors</p>
                    </div>
                </div>
            </div>

            <div style={S.content}>
                <div style={S.tableWrap}>
                    <div style={S.sectionHeader}>
                        <h3 style={S.sectionTitle}>📁 Appointment Roster</h3>
                        <div style={{ ...S.searchWrap, maxWidth: '350px', flex: 'none' }}>
                            <span style={S.searchIcon}>🔍</span>
                            <input
                                type="text"
                                placeholder="Search by Patient Name, MRN, or Phone..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="assistant-search-input"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div style={S.loadingWrap}>
                            <div style={{ width: '38px', height: '38px', border: '3px solid rgba(0,0,0,0.08)', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                            <p style={{ fontSize: '0.9rem' }}>Loading appointments...</p>
                            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                        </div>
                    ) : filteredAppointments.length === 0 ? (
                        <div style={S.empty}>
                            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📋</div>
                            <h4 style={{ color: '#1e293b', margin: '0 0 6px', fontWeight: '700' }}>No Appointments Found</h4>
                            <p style={{ color: '#64748b', margin: 0, fontSize: '0.88rem' }}>
                                Try adjusting your search to find what you're looking for.
                            </p>
                        </div>
                    ) : (
                        <table style={S.table}>
                            <thead>
                                <tr>
                                    <th style={S.th} className="assistant-th">#</th>
                                    <th style={S.th}>Patient</th>
                                    <th style={S.th}>Doctor</th>
                                    <th style={S.th}>Date & Time</th>
                                    <th style={S.th}>Status</th>
                                    <th style={S.th} className="assistant-th">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAppointments.map((apt, idx) => {
                                    const statusS = getStatusStyle(apt.consultationStatus || apt.status);
                                    return (
                                        <tr key={apt._id} className="assistant-table-row">
                                                <td style={{ ...S.td, color: '#475569', fontWeight: '600', fontSize: '0.82rem' }}>{idx + 1}</td>
                                                <td style={S.td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={S.avatar('linear-gradient(135deg, #6366f1, #8b5cf6)')}>
                                                            {(apt.userId?.name || 'W')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ color: '#1e293b', fontWeight: '700', fontSize: '0.88rem' }}>{apt.userId?.name || 'Unknown'}</div>
                                                            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{apt.serviceName || 'Consultation'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={S.td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={S.avatar('linear-gradient(135deg, #10b981, #059669)')}>
                                                            {(apt.doctorId?.name || apt.doctorName || 'D')[0].toUpperCase()}
                                                        </div>
                                                        <span style={{ color: '#1e293b', fontWeight: '600', fontSize: '0.85rem' }}>
                                                            {apt.doctorId?.name || apt.doctorName || 'Not Assigned'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ ...S.td, color: '#1e293b', fontWeight: '600', fontSize: '0.85rem' }}>
                                                    {new Date(apt.appointmentDate).toLocaleDateString()}
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '2px' }}>{apt.appointmentTime || '-'}</span>
                                                </td>
                                                <td style={S.td}>
                                                    <span style={{
                                                        background: statusS.bg, color: statusS.color,
                                                        padding: '6px 14px', borderRadius: '20px',
                                                        fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase',
                                                        letterSpacing: '0.03em', display: 'inline-block'
                                                    }}>
                                                        {apt.consultationStatus || 'Patient Checked In'}
                                                    </span>
                                                </td>
                                                <td style={S.td}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => openVitalsForm(apt)}
                                                            className="assistant-action-btn btn-vitals"
                                                        >
                                                            💉 Vitals
                                                        </button>
                                                        <button
                                                            onClick={() => setUploadPatient(apt)}
                                                            className="assistant-action-btn btn-report"
                                                        >
                                                            📁 Upload Report
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction('clinical-notes', apt._id)}
                                                            className="assistant-action-btn btn-notes"
                                                        >
                                                            📝 Clinical Notes
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAction('consents', apt._id); }}
                                                            type="button"
                                                            className="assistant-action-btn btn-consent"
                                                        >
                                                            📄 Consent Form
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                    )}
                </div>
            </div>

            {/* ─── VITALS MODAL ─── */}
            {
                vitalsPatient && (
                    <div style={S.overlay} onClick={() => setVitalsPatient(null)}>
                        <div style={S.modal} onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div style={S.modalHeader}>
                                <div>
                                    <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', fontWeight: '800' }}>
                                        💉 Enter Vitals
                                    </h2>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                                        Patient: <strong style={{ color: '#e2e8f0' }}>{vitalsPatient.userId?.name || 'Unknown'}</strong> •
                                        MRN: {vitalsPatient.userId?.patientId || 'N/A'} •
                                        Dr. {vitalsPatient.doctorName}
                                    </p>
                                </div>
                                <button onClick={() => setVitalsPatient(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
                            </div>

                            {/* Body */}
                            <div style={S.modalBody}>
                                <div style={S.formGrid}>
                                    {[
                                        { key: 'weight', label: 'Weight (kg)', icon: '⚖️', type: 'number' },
                                        { key: 'height', label: 'Height (cm)', icon: '📏', type: 'number' },
                                        { key: 'bmi', label: 'BMI (auto)', icon: '📊', type: 'text', readOnly: true },
                                        { key: 'bloodPressure', label: 'Blood Pressure', icon: '🩸', type: 'text', placeholder: '120/80' },
                                        { key: 'pulse', label: 'Pulse (bpm)', icon: '💓', type: 'number' },
                                        { key: 'temperature', label: 'Temp (°F)', icon: '🌡️', type: 'number' },
                                        { key: 'spo2', label: 'SpO₂ (%)', icon: '🫁', type: 'number' },
                                        { key: 'respiratoryRate', label: 'Resp Rate (/min)', icon: '💨', type: 'number' },
                                    ].map(field => (
                                        <div key={field.key} style={S.formGroup}>
                                            <label style={S.formLabel}>{field.icon} {field.label}</label>
                                            <input
                                                type={field.type}
                                                value={vitals[field.key]}
                                                readOnly={field.readOnly}
                                                placeholder={field.placeholder || ''}
                                                onChange={e => setVitals({ ...vitals, [field.key]: e.target.value })}
                                                style={{
                                                    ...S.formInput,
                                                    ...(field.readOnly ? { background: 'rgba(255,255,255,0.02)', color: '#64748b' } : {})
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Chief Complaint */}
                                <div style={{ ...S.formGroup, marginTop: '16px' }}>
                                    <label style={S.formLabel}>📋 Chief Complaint</label>
                                    <textarea
                                        value={vitals.chiefComplaint}
                                        onChange={e => setVitals({ ...vitals, chiefComplaint: e.target.value })}
                                        placeholder="Patient's chief complaint..."
                                        style={S.formTextarea}
                                    />
                                </div>

                                {/* Nurse Notes */}
                                <div style={{ ...S.formGroup, marginTop: '12px' }}>
                                    <label style={S.formLabel}>📝 Nurse Notes</label>
                                    <textarea
                                        value={vitals.notes}
                                        onChange={e => setVitals({ ...vitals, notes: e.target.value })}
                                        placeholder="Any observations or notes..."
                                        style={S.formTextarea}
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={S.modalFooter}>
                                <button onClick={() => setVitalsPatient(null)} style={{ ...S.btn('rgba(255,255,255,0.08)'), color: '#94a3b8' }}>Cancel</button>
                                <button
                                    onClick={handleSaveVitals}
                                    disabled={saving}
                                    style={{ ...S.btn('linear-gradient(135deg, #10b981, #059669)'), opacity: saving ? 0.6 : 1, minWidth: '140px' }}
                                >
                                    {saving ? '⏳ Saving...' : '✅ Save Vitals'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* UPload Report Modal */}
            {uploadPatient && (
                <div style={S.overlay}>
                    <div style={{ ...S.modal, maxWidth: '400px' }}>
                        <div style={S.modalHeader}>
                            <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc' }}>
                                📁 Upload Master Record
                            </h2>
                            <button onClick={() => setUploadPatient(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.3rem', cursor: 'pointer' }}>&times;</button>
                        </div>
                        <form onSubmit={handleUploadReport} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
                                Upload previous medical reports, prescriptions, or scans for <b>{uploadPatient.userId?.name || 'Patient'}</b>.
                            </p>
                            
                            <input 
                                type="file" 
                                accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.webp"
                                onChange={(e) => setUploadFile(e.target.files[0])}
                                required
                                style={{ padding: '10px', border: '1px dashed #475569', borderRadius: '8px', color: '#e2e8f0' }}
                            />

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button type="button" onClick={() => setUploadPatient(null)} style={S.btn('rgba(255,255,255,0.08)', '#94a3b8')}>Cancel</button>
                                <button type="submit" disabled={uploading || !uploadFile} style={S.btn('linear-gradient(135deg, #3b82f6, #6366f1)', '#fff')}>
                                    {uploading ? 'Uploading...' : 'Save Report'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssistantAppointments;
