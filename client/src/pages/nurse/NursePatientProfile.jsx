import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nurseAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import SharedReportNotesSection from '../../components/lab/SharedReportNotesSection';
import { FiArrowLeft, FiAlertCircle, FiActivity, FiPlus } from 'react-icons/fi';
import './NurseDashboard.css';
import './NursePatientProfile.css';

const NursePatientProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: authUser } = useAuth(); // Get logged-in user from Redux auth state
    const userRole = (authUser?.role || '').toLowerCase(); // 'nurse', 'doctor', etc.
    const isNurse = userRole === 'nurse';

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showVitalsModal, setShowVitalsModal] = useState(false);
    const [vitalsForm, setVitalsForm] = useState({
        weight: '', height: '', bmi: '', bp: '', pulse: '', temp: '', spo2: '', respRate: '', chiefComplaint: '', nurseNotes: ''
    });

    // Parses a time string like "08:00 AM" or "02:00 PM" into today's Date object
    const parseScheduledTime = (timeStr) => {
        try {
            const now = new Date();
            const [time, period] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
        } catch {
            return new Date(0); // fallback: always unlocked
        }
    };

    // Returns human-readable lock label e.g. "Locks until 02:00 PM"
    const getLockLabel = (timeStr) => {
        const scheduled = parseScheduledTime(timeStr);
        const now = new Date();
        const diffMs = scheduled - now;
        if (diffMs <= 0) return 'Due Now';
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `Locks until ${timeStr} (${diffMins}m)`;
        const diffHrs = Math.floor(diffMins / 60);
        const remMins = diffMins % 60;
        return `Locks until ${timeStr} (${diffHrs}h ${remMins}m)`;
    };

    useEffect(() => {
        fetchProfile();
    }, [id]);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await nurseAPI.getPatientDetails(id);
            if (res && res.profile) {
                setData(res.profile);
                if (res.profile.latestVitals) {
                    setVitalsForm({
                        weight: res.profile.latestVitals.weight || '',
                        height: res.profile.latestVitals.height || '',
                        bmi: res.profile.latestVitals.bmi || '',
                        bp: res.profile.latestVitals.bp || '',
                        pulse: res.profile.latestVitals.pulse || '',
                        temp: res.profile.latestVitals.temp || '',
                        spo2: res.profile.latestVitals.spo2 || '',
                        respRate: res.profile.latestVitals.respRate || '',
                        chiefComplaint: '',
                        nurseNotes: ''
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching patient profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateBMI = (w, h) => {
        if (!w || !h) return '';
        const htInM = parseFloat(h) / 100;
        if (htInM <= 0) return '';
        const bmiVal = parseFloat(w) / (htInM * htInM);
        return isNaN(bmiVal) ? '' : bmiVal.toFixed(1);
    };

    const handleVitalsChange = (field, val) => {
        setVitalsForm(prev => {
            const updated = { ...prev, [field]: val };
            if (field === 'weight' || field === 'height') {
                updated.bmi = calculateBMI(updated.weight, updated.height);
            }
            return updated;
        });
    };

    const handleSaveVitals = async () => {
        try {
            await nurseAPI.recordVitals({
                patientId: id,
                ...vitalsForm
            });
            alert("Vitals saved successfully!");
            setShowVitalsModal(false);
            fetchProfile();
        } catch (error) {
            alert("Error saving vitals: " + (error.message || 'Unknown error'));
        }
    };

    const handleToggleDose = async (item) => {
        const newStatus = item.isGiven ? 'Pending' : 'Given';
        try {
            await nurseAPI.updateDoseStatus(id, {
                medicineName: item.name,
                time: item.time,
                status: newStatus
            });
            fetchProfile();
        } catch (error) {
            console.error("Error updating dose status:", error);
        }
    };

    if (loading) {
        return <div className="np-loading-screen">Loading patient clinical journey...</div>;
    }

    if (!data) {
        return <div className="np-error-screen">Patient profile not found.</div>;
    }

    const { stats, medicationJourney, injectionTracking, labReports, latestVitals, currentMedicines } = data;

    return (
        <div className="np-profile-container">
            {/* Top Navigation Row */}
            <div className="np-nav-row">
                <button className="np-back-btn" onClick={() => navigate('/nurse/patients')}>
                    <FiArrowLeft /> Back to My Patients
                </button>
            </div>

            {/* Premium Header Banner Card */}
            <div className="np-header-banner">
                <div className="np-banner-top">
                    <div className="np-patient-identity">
                        <div className="np-avatar-circle">
                            {data.name ? data.name.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div className="np-identity-meta">
                            <h2>{data.name}</h2>
                            <span className="np-mrn-sub">{data.mrn} • Couple ID: {data.coupleId}</span>
                        </div>
                    </div>
                    {stats?.totalPending > 0 && currentMedicines && currentMedicines.length > 0 && (
                        <div className="np-alert-pill">
                            <FiAlertCircle /> Pending Doses: {stats.totalPending}
                        </div>
                    )}
                </div>

                <div className="np-banner-pills-grid">
                    <span className="np-info-badge">{data.age} Yrs</span>
                    <span className="np-info-badge">{data.gender === 'F' ? 'Female' : 'Male'}</span>
                    <span className="np-info-badge badge-doc">👨‍⚕️ {data.doctor}</span>
                    <span className="np-info-badge">Ward: {data.ward}</span>
                    <span className="np-info-badge">Bed No: {data.bed}</span>
                    <span className="np-info-badge font-medium">Admitted: {data.admittedDate}</span>
                    <span className={`np-info-badge status-tag ${data.vitalsStatus === 'Critical' ? 'status-critical' : 'status-stable'}`}>
                        {data.vitalsStatus || 'Stable'}
                    </span>
                </div>
            </div>

            {(!currentMedicines || currentMedicines.length === 0) ? (
                <div className="np-empty-prescription-card">
                    <div className="np-empty-icon">🩺</div>
                    <h3>No Prescription Available Yet</h3>
                    <p className="np-empty-text">
                        This patient has been registered successfully. No medicines, injections or treatment have been prescribed by the doctor yet.
                    </p>
                </div>
            ) : (
                <>
                    {/* 4 Summary Stats Cards Row */}
                    <div className="np-stats-grid">
                        <div className="np-stat-card card-blue">
                            <span className="np-stat-label">TABLETS / CAPSULES</span>
                            <span className="np-stat-value">{stats?.tabletsTotal || 0}</span>
                            <span className="np-stat-sub">Pending: {stats?.tabletsPending || 0}</span>
                        </div>
                        <div className="np-stat-card card-teal">
                            <span className="np-stat-label">DRIPS / INFUSIONS</span>
                            <span className="np-stat-value">{stats?.dripsTotal || 0}</span>
                            <span className="np-stat-sub">Pending: {stats?.dripsPending || 0}</span>
                        </div>
                        <div className="np-stat-card card-purple">
                            <span className="np-stat-label">INJECTIONS</span>
                            <span className="np-stat-value">{stats?.injectionsTotal || 0}</span>
                            <span className="np-stat-sub">Pending: {stats?.injectionsPending || 0}</span>
                        </div>
                        <div className="np-stat-card card-orange">
                            <span className="np-stat-label">TOTAL PENDING</span>
                            <span className="np-stat-value text-orange-semibold">{stats?.totalPending || 0}</span>
                            <span className="np-stat-sub text-muted">Action needed</span>
                        </div>
                    </div>

                    {/* Medication Journey Board */}
                    <div className="np-section-wrapper">
                        <div className="np-section-header-row">
                            <div>
                                <h3 className="np-section-title">💊 Medication Journey</h3>
                                <p className="np-section-subtitle">Yesterday, Today & Tomorrow treatment progress tracking</p>
                            </div>
                        </div>

                        <div className="np-journey-columns">
                            {/* Column: Yesterday */}
                            <div className="np-column-pane">
                                <div className="np-pane-heading">
                                    <h4>Yesterday <span className="np-date-label">({medicationJourney?.yesterday?.date})</span></h4>
                                </div>
                                <div className="np-pane-cards-list">
                                    {(medicationJourney?.yesterday?.items || []).map(item => (
                                        <div key={item.id} className="np-med-row-card item-given-border">
                                            <div className="np-med-main-info">
                                                <h5>✓ {item.name}</h5>
                                                <span className="np-med-sub-text">
                                                    {item.time} • {item.type}
                                                    {item.volumeMl && <span style={{ color: '#4338ca', fontWeight: 600 }}> • Vol: {item.volumeMl}</span>}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Column: Today */}
                            <div className="np-column-pane pane-active-today">
                                <div className="np-pane-heading heading-today">
                                    <h4>Today <span className="np-date-label">({medicationJourney?.today?.date})</span></h4>
                                </div>
                                <div className="np-pane-cards-list">
                                    {(medicationJourney?.today?.items || []).map(item => {
                                        const scheduledTime = parseScheduledTime(item.time);
                                        const isDueYet = new Date() >= scheduledTime;
                                        const isOverdue = !item.isGiven && isDueYet;

                                        return (
                                            <div
                                                key={item.id}
                                                className={`np-med-row-card ${
                                                    item.isGiven
                                                        ? 'item-given-border'
                                                        : isOverdue
                                                            ? 'item-due-border'
                                                            : 'item-upcoming-border'
                                                }`}
                                            >
                                                <div className="np-med-main-info">
                                                    <h5>{item.isGiven ? '✓' : isOverdue ? '⚠️' : '🔒'} {item.name}</h5>
                                                    <span className="np-med-sub-text">
                                                        {item.time} • {item.type}
                                                        {item.volumeMl && <span style={{ color: '#4338ca', fontWeight: 600 }}> • Vol: {item.volumeMl}</span>}
                                                    </span>
                                                </div>

                                                <div className="np-med-action-footer">
                                                    {/* ── Status Badge (visible to ALL roles) ── */}
                                                    {item.isGiven ? (
                                                        <span className="np-dose-badge badge-given">✅ Given</span>
                                                    ) : isOverdue ? (
                                                        isNurse ? null : ( // Doctor sees overdue warning, nurse sees action button below
                                                            <span className="np-dose-badge badge-overdue np-pulse">⚠️ Overdue (Pending Nurse)</span>
                                                        )
                                                    ) : (
                                                        <span className="np-dose-badge badge-scheduled">⏱️ Scheduled</span>
                                                    )}

                                                    {/* ── Nurse-Only Action Area ── */}
                                                    {isNurse && !item.isGiven && (
                                                        isDueYet ? (
                                                            <button
                                                                className="np-action-pill-btn"
                                                                onClick={() => handleToggleDose(item)}
                                                            >
                                                                Mark Given
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="np-action-pill-btn btn-locked"
                                                                disabled
                                                                title={`Scheduled for ${item.time}. Cannot administer before the scheduled time.`}
                                                            >
                                                                🔒 {getLockLabel(item.time)}
                                                            </button>
                                                        )
                                                    )}

                                                    {/* ── If dose is given, show progress for nurse ── */}
                                                    {isNurse && item.isGiven && (
                                                        <span className="np-progress-text">{item.progress}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Column: Tomorrow */}
                            <div className="np-column-pane">
                                <div className="np-pane-heading">
                                    <h4>Tomorrow <span className="np-date-label">({medicationJourney?.tomorrow?.date})</span></h4>
                                </div>
                                <div className="np-pane-cards-list">
                                    {(medicationJourney?.tomorrow?.items || []).map(item => (
                                        <div key={item.id} className="np-med-row-card item-scheduled-border">
                                            <div className="np-med-main-info">
                                                <h5>🔒 {item.name}</h5>
                                                <span className="np-med-sub-text">
                                                    {item.time} • {item.type}
                                                    {item.volumeMl && <span style={{ color: '#4338ca', fontWeight: 600 }}> • Vol: {item.volumeMl}</span>}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Vitals Display Block */}
            <div className="np-section-card">
                <div className="np-card-header-flex">
                    <h3 className="np-card-title"><FiActivity className="text-danger" /> Patient Vitals</h3>
                    <button onClick={() => setShowVitalsModal(true)} className="np-primary-action-btn">
                        <FiPlus /> Record Vitals
                    </button>
                </div>
                <div className="np-vitals-dashboard-grid">
                    <div className="np-vitals-pill-box">
                        <span className="np-vitals-label">BLOOD PRESSURE</span>
                        <p className="np-vitals-value">{latestVitals?.bp ? `${latestVitals.bp} mmHg` : '-'}</p>
                    </div>
                    <div className="np-vitals-pill-box">
                        <span className="np-vitals-label">PULSE RATE</span>
                        <p className="np-vitals-value">{latestVitals?.pulse ? `${latestVitals.pulse} bpm` : '-'}</p>
                    </div>
                    <div className="np-vitals-pill-box">
                        <span className="np-vitals-label">SPO₂ OXYGEN</span>
                        <p className="np-vitals-value">{latestVitals?.spo2 ? `${latestVitals.spo2}` : '-'}</p>
                    </div>
                    <div className="np-vitals-pill-box">
                        <span className="np-vitals-label">TEMPERATURE</span>
                        <p className="np-vitals-value">{latestVitals?.temp ? `${latestVitals.temp} °F` : '-'}</p>
                    </div>
                </div>
            </div>

            {/* Injection Administration Table */}
            {currentMedicines && currentMedicines.length > 0 && (
                <div className="np-section-card">
                    <h3 className="np-card-title">💉 Injection Administration Tracking</h3>
                    {(injectionTracking || []).length === 0 ? (
                        <p className="np-empty-table-text">No injections prescribed for this patient.</p>
                    ) : (
                        <div className="np-table-scroll-container">
                            <table className="np-enterprise-table">
                                <thead>
                                    <tr>
                                        <th>Injection Name</th>
                                        <th>Purchased</th>
                                        <th>Used</th>
                                        <th>Remaining</th>
                                        <th>Used Today</th>
                                        <th>Administered By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {injectionTracking.map((inj, idx) => (
                                        <tr key={idx}>
                                            <td className="font-semibold text-slate-800">{inj.name}</td>
                                            <td>{inj.purchased}</td>
                                            <td className="text-orange-semibold">{inj.used}</td>
                                            <td className="text-success-bold">{inj.remaining}</td>
                                            <td>{inj.usedToday}</td>
                                            <td className="text-muted-xs">{inj.administeredBy}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Lab Reports Wrap Block */}
            <div className="np-section-card">
                <h3 className="np-card-title">🧪 Lab Reports & Shared Clinical Notes</h3>
                {(labReports || []).length === 0 ? (
                    <p className="np-empty-table-text">No lab reports recorded for this patient yet.</p>
                ) : (
                    <div className="np-reports-stack">
                        {labReports.map(rep => (
                            <div key={rep._id} className="np-report-sub-card">
                                <div className="np-report-meta-row">
                                    <h4>{rep.testName || 'Blood Panel Report'}</h4>
                                    <span className="np-status-badge-pill">{rep.status || 'Completed'}</span>
                                </div>
                                <SharedReportNotesSection reportId={rep._id} patientId={id} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Premium Dark-Themed Vitals Input Modal Overlay */}
            {showVitalsModal && (
                <div className="np-dark-modal-overlay">
                    <div className="np-dark-modal-card">
                        <div className="np-dark-modal-header">
                            <div>
                                <h3>💉 Enter Vitals</h3>
                                <p className="np-dark-modal-meta">
                                    Patient: <span className="np-highlight-white">{data.name?.toLowerCase()}</span> • MRN: {data.mrn} • Dr. {data.doctor?.toLowerCase()}
                                </p>
                            </div>
                            <button className="np-dark-modal-close" onClick={() => setShowVitalsModal(false)}>&times;</button>
                        </div>

                        <div className="np-dark-modal-grid">
                            <div className="np-dark-form-group">
                                <label>⚖️ WEIGHT (KG)</label>
                                <input type="number" value={vitalsForm.weight} onChange={(e) => handleVitalsChange('weight', e.target.value)} />
                            </div>
                            <div className="np-dark-form-group">
                                <label>📏 HEIGHT (CM)</label>
                                <input type="number" value={vitalsForm.height} onChange={(e) => handleVitalsChange('height', e.target.value)} />
                            </div>
                            <div className="np-dark-form-group">
                                <label>📊 BMI (AUTO)</label>
                                <input type="text" readOnly value={vitalsForm.bmi} className="np-dark-readonly" />
                            </div>
                            <div className="np-dark-form-group">
                                <label>🩸 BLOOD PRESSURE</label>
                                <input type="text" placeholder="120/80" value={vitalsForm.bp} onChange={(e) => handleVitalsChange('bp', e.target.value)} />
                            </div>
                            <div className="np-dark-form-group">
                                <label>💖 PULSE (BPM)</label>
                                <input type="number" value={vitalsForm.pulse} onChange={(e) => handleVitalsChange('pulse', e.target.value)} />
                            </div>
                            <div className="np-dark-form-group">
                                <label>🌡️ TEMP (°F)</label>
                                <input type="text" value={vitalsForm.temp} onChange={(e) => handleVitalsChange('temp', e.target.value)} />
                            </div>
                            <div className="np-dark-form-group">
                                <label>🫁 SPO₂ (%)</label>
                                <input type="text" value={vitalsForm.spo2} onChange={(e) => handleVitalsChange('spo2', e.target.value)} />
                            </div>
                            <div className="np-dark-form-group">
                                <label>💨 RESP RATE (/MIN)</label>
                                <input type="text" value={vitalsForm.respRate} onChange={(e) => handleVitalsChange('respRate', e.target.value)} />
                            </div>
                        </div>

                        <div className="np-dark-form-group full-width">
                            <label>📋 CHIEF COMPLAINT</label>
                            <textarea rows={2} placeholder="Patient's chief complaint..." value={vitalsForm.chiefComplaint} onChange={(e) => handleVitalsChange('chiefComplaint', e.target.value)} />
                        </div>

                        <div className="np-dark-form-group full-width">
                            <label>📝 NURSE NOTES</label>
                            <textarea rows={2} placeholder="Any observations or notes..." value={vitalsForm.nurseNotes} onChange={(e) => handleVitalsChange('nurseNotes', e.target.value)} />
                        </div>

                        <div className="np-dark-modal-footer">
                            <button className="np-dark-btn-cancel" onClick={() => setShowVitalsModal(false)}>Cancel</button>
                            <button className="np-dark-btn-save" onClick={handleSaveVitals}>✅ Save Vitals</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NursePatientProfile;