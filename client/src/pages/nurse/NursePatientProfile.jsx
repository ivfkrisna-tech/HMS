import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nurseAPI } from '../../utils/api';
import SharedReportNotesSection from '../../components/lab/SharedReportNotesSection';
import { FiArrowLeft, FiAlertCircle, FiCheckCircle, FiClock, FiPlus, FiActivity, FiFileText } from 'react-icons/fi';
import './NurseDashboard.css';

const NursePatientProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showVitalsModal, setShowVitalsModal] = useState(false);
    const [vitalsForm, setVitalsForm] = useState({
        weight: '', height: '', bmi: '', bp: '', pulse: '', temp: '', spo2: '', respRate: '', chiefComplaint: '', nurseNotes: ''
    });

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
        return <div className="p-12 text-center text-gray-500 font-medium">Loading patient clinical journey...</div>;
    }

    if (!data) {
        return <div className="p-12 text-center text-red-500 font-medium">Patient profile not found.</div>;
    }

    const { stats, medicationJourney, injectionTracking, labReports, latestVitals, vitalsHistory, currentMedicines } = data;

    return (
        <div className="nurse-dashboard-container">
            {/* Back Navigation */}
            <button className="back-link" onClick={() => navigate('/nurse/patients')}>
                <FiArrowLeft /> Back to My Patients
            </button>

            {/* Banner Header */}
            <div className="patient-header-banner">
                <div className="banner-top-row">
                    <div className="banner-user-info">
                        <div className="banner-avatar">
                            {data.name ? data.name.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div>
                            <h2>{data.name}</h2>
                            <p>{data.mrn} • Couple ID: {data.coupleId}</p>
                        </div>
                    </div>
                    {stats?.totalPending > 0 && currentMedicines && currentMedicines.length > 0 && (
                        <div className="pending-doses-alert-box">
                            <FiAlertCircle className="text-blue-600 text-lg" />
                            Pending Doses: {stats.totalPending}
                        </div>
                    )}
                </div>

                <div className="banner-pills-row">
                    <span className="info-tag">{data.age} yrs</span>
                    <span className="info-tag">{data.gender === 'F' ? 'Female' : 'Male'}</span>
                    <span className="info-tag">{data.doctor}</span>
                    <span className="info-tag">{data.ward}</span>
                    <span className="info-tag">{data.bed}</span>
                    <span className="info-tag">Admitted: {data.admittedDate}</span>
                    <span className={`info-tag ${data.vitalsStatus === 'Critical' ? 'bg-red-50 text-red-600 border-red-200' : 'info-tag-green'}`}>
                        {data.vitalsStatus || 'Stable'}
                    </span>
                </div>
            </div>

            {(!currentMedicines || currentMedicines.length === 0) ? (
                <div className="profile-section-card bg-white p-12 text-center my-6 border border-slate-200 rounded-2xl shadow-sm">
                    <div className="text-6xl mb-4">🩺</div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Prescription Available Yet</h3>
                    <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed mb-2">
                        This patient has been registered successfully. No medicines, injections or treatment have been prescribed by the doctor yet.
                    </p>
                    <p className="text-slate-400 text-xs italic">
                        Once the doctor saves a prescription, live medication schedules and treatment timelines will automatically appear here.
                    </p>
                </div>
            ) : (
                <>
                    {/* Stats Counter Grid */}
                    <div className="med-stats-grid">
                        <div className="med-stat-card">
                            <div className="stat-header">💊 Tablets / Capsules</div>
                            <div className="stat-num">{stats?.tabletsTotal || 0}</div>
                            <div className="stat-sub">Pending: {stats?.tabletsPending || 0}</div>
                        </div>
                        <div className="med-stat-card">
                            <div className="stat-header">💧 Drips / Infusions</div>
                            <div className="stat-num">{stats?.dripsTotal || 0}</div>
                            <div className="stat-sub">Pending: {stats?.dripsPending || 0}</div>
                        </div>
                        <div className="med-stat-card">
                            <div className="stat-header">💉 Injections</div>
                            <div className="stat-num">{stats?.injectionsTotal || 0}</div>
                            <div className="stat-sub">Pending: {stats?.injectionsPending || 0}</div>
                        </div>
                        <div className="med-stat-card">
                            <div className="stat-header">⚠️ Total Pending</div>
                            <div className="stat-num text-orange-600">{stats?.totalPending || 0}</div>
                            <div className="stat-sub text-gray-500">Action needed</div>
                        </div>
                    </div>

                    {/* Medication Journey */}
                    <div className="journey-header">
                        <div className="journey-title-wrap">
                            <h3>💊 Medication Journey</h3>
                            <p className="journey-subtitle">Yesterday, Today & Tomorrow treatment progress tracking</p>
                            <div className="journey-legend">
                                <div className="legend-item"><span className="legend-color legend-given"></span> Given</div>
                                <div className="legend-item"><span className="legend-color legend-due"></span> Due Now</div>
                                <div className="legend-item"><span className="legend-color legend-upcoming"></span> Upcoming</div>
                                <div className="legend-item"><span className="legend-color legend-scheduled"></span> Scheduled</div>
                            </div>
                        </div>
                        <div className="pending-doses-blue-btn">
                            <span className="num">{stats?.totalPending || 0}</span>
                            <span className="txt">Pending Doses</span>
                        </div>
                    </div>

                    {/* 3 Columns */}
                    <div className="journey-columns-grid">
                        {/* Yesterday */}
                        <div className="journey-col">
                            <div className="col-header">
                                <h4>Yesterday <span>({medicationJourney?.yesterday?.date})</span></h4>
                            </div>
                            {(medicationJourney?.yesterday?.items || []).map(item => (
                                <div key={item.id} className="med-card">
                                    <div className="med-card-top">
                                        <h5>✓ {item.name}</h5>
                                    </div>
                                    <div className="med-time">{item.time} • {item.type}</div>
                                    <div className="progress-segments">
                                        <div className="seg green"></div><div className="seg green"></div><div className="seg green"></div>
                                    </div>
                                    <div className="med-card-bot">
                                        <span className="bot-txt-green">Given</span>
                                        <span className="text-gray-500">{item.progress}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Today */}
                        <div className="journey-col">
                            <div className="col-header today">
                                <h4>Today <span>({medicationJourney?.today?.date})</span></h4>
                            </div>
                            {(medicationJourney?.today?.items || []).map(item => (
                                <div key={item.id} className="med-card">
                                    <div className="med-card-top">
                                        <h5>{item.isGiven ? '✓' : '⌛'} {item.name}</h5>
                                    </div>
                                    <div className="med-time">{item.time} • {item.type}</div>
                                    <div className="progress-segments">
                                        <div className={`seg ${item.isGiven ? 'green' : (item.status === 'Due Now' ? 'orange' : 'yellow')}`}></div>
                                        <div className={`seg ${item.isGiven ? 'green' : 'gray'}`}></div>
                                    </div>
                                    <div className="med-card-bot">
                                        <span className={item.isGiven ? 'bot-txt-green' : (item.status === 'Due Now' ? 'bot-txt-orange font-bold' : 'text-yellow-600')}>
                                            {item.status}
                                        </span>
                                        {!item.isGiven ? (
                                            <button className="btn-action-dose" onClick={() => handleToggleDose(item)}>
                                                Mark Given
                                            </button>
                                        ) : (
                                            <span className="text-gray-500">{item.progress}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Tomorrow */}
                        <div className="journey-col">
                            <div className="col-header tomorrow">
                                <h4>Tomorrow <span>({medicationJourney?.tomorrow?.date})</span></h4>
                            </div>
                            {(medicationJourney?.tomorrow?.items || []).map(item => (
                                <div key={item.id} className="med-card">
                                    <div className="med-card-top">
                                        <h5>🔒 {item.name}</h5>
                                    </div>
                                    <div className="med-time">{item.time} • {item.type}</div>
                                    <div className="progress-segments">
                                        <div className="seg"></div><div className="seg"></div>
                                    </div>
                                    <div className="med-card-bot">
                                        <span className="bot-txt-blue">Scheduled</span>
                                        <span className="text-gray-400">{item.progress}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Vitals Section */}
            <div className="profile-section-card">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="!mb-0"><FiActivity className="inline text-red-500 mr-2" /> Patient Vitals</h3>
                    <button
                        onClick={() => setShowVitalsModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition"
                    >
                        <FiPlus /> Record Vitals
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Blood Pressure</span>
                        <p className="text-lg font-bold text-slate-800">{latestVitals?.bp ? `${latestVitals.bp} mmHg` : '-'}</p>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Pulse Rate</span>
                        <p className="text-lg font-bold text-slate-800">{latestVitals?.pulse ? `${latestVitals.pulse} bpm` : '-'}</p>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">SpO₂ Oxygen</span>
                        <p className="text-lg font-bold text-slate-800">{latestVitals?.spo2 ? `${latestVitals.spo2}` : '-'}</p>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Temperature</span>
                        <p className="text-lg font-bold text-slate-800">{latestVitals?.temp ? `${latestVitals.temp} °F` : '-'}</p>
                    </div>
                </div>
            </div>

            {/* Injection Tracking Section */}
            {currentMedicines && currentMedicines.length > 0 && (
                <div className="profile-section-card">
                    <h3>💉 Injection Administration Tracking</h3>
                    {(injectionTracking || []).length === 0 ? (
                        <p className="text-gray-500 text-sm italic">No injections prescribed for this patient.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 text-gray-500">
                                        <th className="pb-2 font-semibold">Injection Name</th>
                                        <th className="pb-2 font-semibold">Purchased</th>
                                        <th className="pb-2 font-semibold">Used</th>
                                        <th className="pb-2 font-semibold">Remaining</th>
                                        <th className="pb-2 font-semibold">Used Today</th>
                                        <th className="pb-2 font-semibold">Administered By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {injectionTracking.map((inj, idx) => (
                                        <tr key={idx} className="border-b border-gray-100 last:border-0 text-gray-700">
                                            <td className="py-3 font-semibold text-slate-800">{inj.name}</td>
                                            <td className="py-3">{inj.purchased}</td>
                                            <td className="py-3 text-orange-600 font-medium">{inj.used}</td>
                                            <td className="py-3 text-green-600 font-bold">{inj.remaining}</td>
                                            <td className="py-3">{inj.usedToday}</td>
                                            <td className="py-3 text-xs text-gray-500">{inj.administeredBy} ({inj.time})</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Lab Reports & Notes Integration */}
            <div className="profile-section-card">
                <h3>🧪 Lab Reports & Shared Clinical Notes</h3>
                {(labReports || []).length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No lab reports recorded for this patient yet.</p>
                ) : (
                    <div className="flex flex-col gap-6">
                        {labReports.map(rep => (
                            <div key={rep._id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-slate-800">{rep.testName || 'Blood Panel Report'}</h4>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                                        {rep.status || 'Completed'}
                                    </span>
                                </div>
                                {/* Embed SharedReportNotesSection */}
                                <SharedReportNotesSection
                                    reportId={rep._id}
                                    patientId={id}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Vitals Modal */}
            {showVitalsModal && (
                <div className="modal-overlay">
                    <div className="vitals-modal-box">
                        <div className="vitals-modal-header">
                            <div>
                                <h3>🩺 Record Patient Vitals</h3>
                                <p>Enter clinical measurements for {data.name} ({data.mrn})</p>
                            </div>
                            <button className="btn-close-modal" onClick={() => setShowVitalsModal(false)}>&times;</button>
                        </div>

                        <div className="vitals-grid-2">
                            <div className="vitals-form-group">
                                <label>Weight (kg)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 65"
                                    value={vitalsForm.weight}
                                    onChange={(e) => handleVitalsChange('weight', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Height (cm)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 165"
                                    value={vitalsForm.height}
                                    onChange={(e) => handleVitalsChange('height', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>BMI (auto-calc)</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={vitalsForm.bmi}
                                    placeholder="23.9"
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Blood Pressure</label>
                                <input
                                    type="text"
                                    placeholder="120/80"
                                    value={vitalsForm.bp}
                                    onChange={(e) => handleVitalsChange('bp', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Pulse Rate (bpm)</label>
                                <input
                                    type="number"
                                    placeholder="74"
                                    value={vitalsForm.pulse}
                                    onChange={(e) => handleVitalsChange('pulse', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Temperature (°F)</label>
                                <input
                                    type="text"
                                    placeholder="98.6"
                                    value={vitalsForm.temp}
                                    onChange={(e) => handleVitalsChange('temp', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>SpO₂ Oxygen (%)</label>
                                <input
                                    type="text"
                                    placeholder="98%"
                                    value={vitalsForm.spo2}
                                    onChange={(e) => handleVitalsChange('spo2', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Respiratory Rate</label>
                                <input
                                    type="text"
                                    placeholder="18"
                                    value={vitalsForm.respRate}
                                    onChange={(e) => handleVitalsChange('respRate', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="vitals-form-group mb-4">
                            <label>Chief Complaint / Symptoms</label>
                            <input
                                type="text"
                                placeholder="Patient reporting mild abdominal pain..."
                                value={vitalsForm.chiefComplaint}
                                onChange={(e) => handleVitalsChange('chiefComplaint', e.target.value)}
                            />
                        </div>

                        <div className="vitals-form-group">
                            <label>Nursing Observation Notes</label>
                            <textarea
                                rows={3}
                                placeholder="Shift observation notes..."
                                value={vitalsForm.nurseNotes}
                                onChange={(e) => handleVitalsChange('nurseNotes', e.target.value)}
                            />
                        </div>

                        <div className="vitals-modal-footer">
                            <button className="btn-modal-cancel" onClick={() => setShowVitalsModal(false)}>Cancel</button>
                            <button className="btn-modal-save" onClick={handleSaveVitals}>Save Vitals & Notes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NursePatientProfile;
