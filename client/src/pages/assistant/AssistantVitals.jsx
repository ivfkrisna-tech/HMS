import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiActivity, FiSave, FiArrowLeft } from 'react-icons/fi';
import { assistantAPI } from '../../utils/api';
import './AssistantDashboard.css';

const AssistantVitals = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [appointment, setAppointment] = useState(null);

    const [vitals, setVitals] = useState({
        height: '',
        weight: '',
        bmi: '',
        temperature: '',
        bp: '',
        pulse: '',
        spo2: '',
        rr: '',
        bloodSugar: ''
    });

    useEffect(() => {
        if (appointmentId) fetchAppointment();
    }, [appointmentId]);

    const fetchAppointment = async () => {
        try {
            const res = await assistantAPI.getAppointmentDetails(appointmentId);
            if (res.success) {
                setAppointment(res.appointment);
                if (res.appointment.vitals) {
                    setVitals({
                        ...res.appointment.vitals,
                        bloodSugar: res.appointment.ivfDetails?.bloodSugar || ''
                    });
                }
            }
        } catch (error) {
            console.error("Failed to load appointment details", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateBMI = (h, w) => {
        if (!h || !w) return '';
        const heightMeters = parseFloat(h) / 100;
        const weightKg = parseFloat(w);
        if (heightMeters > 0 && weightKg > 0) {
            return (weightKg / (heightMeters * heightMeters)).toFixed(2);
        }
        return '';
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newVitals = { ...vitals, [name]: value };
        if (name === 'height' || name === 'weight') {
            newVitals.bmi = calculateBMI(newVitals.height, newVitals.weight);
        }
        setVitals(newVitals);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await assistantAPI.saveVitals(appointmentId, vitals);
            if (res.success) {
                alert('Vitals saved successfully');
            }
        } catch (error) {
            console.error("Failed to save vitals", error);
            alert('Error saving vitals');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="assistant-dashboard"><div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div></div>;

    return (
        <div className="assistant-dashboard">
            <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer', display: 'flex' }} title="Back">
                        <FiArrowLeft />
                    </button>
                    <div>
                        <h1>Vitals Entry</h1>
                        <p>{appointment?.userId?.name} • {appointment?.userId?.mrn || appointment?.userId?.patientId}</p>
                    </div>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                    <FiSave /> {saving ? 'Saving...' : 'Save Vitals'}
                </button>
            </header>

            <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    
                    {/* Basic Metrics */}
                    <div className="form-group">
                        <label className="staff-label">Height (cm)</label>
                        <input type="number" name="height" value={vitals.height} onChange={handleChange} className="staff-input" placeholder="e.g., 170" />
                    </div>
                    
                    <div className="form-group">
                        <label className="staff-label">Weight (kg)</label>
                        <input type="number" name="weight" value={vitals.weight} onChange={handleChange} className="staff-input" placeholder="e.g., 70" />
                    </div>
                    
                    <div className="form-group">
                        <label className="staff-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            BMI 
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '400' }}>(Auto-calculated)</span>
                        </label>
                        <input type="text" name="bmi" value={vitals.bmi} readOnly className="staff-input" placeholder="--" disabled style={{ background: '#f8fafc', cursor: 'not-allowed' }} />
                    </div>

                    <div className="form-group">
                        <label className="staff-label">Temperature (°F)</label>
                        <input type="number" name="temperature" value={vitals.temperature} onChange={handleChange} className="staff-input" placeholder="e.g., 98.6" />
                    </div>

                    {/* Cardiovascular & Respiratory */}
                    <div className="form-group">
                        <label className="staff-label">Blood Pressure (mmHg)</label>
                        <input type="text" name="bp" value={vitals.bp} onChange={handleChange} className="staff-input" placeholder="e.g., 120/80" />
                    </div>

                    <div className="form-group">
                        <label className="staff-label">Pulse (bpm)</label>
                        <input type="number" name="pulse" value={vitals.pulse} onChange={handleChange} className="staff-input" placeholder="e.g., 72" />
                    </div>

                    <div className="form-group">
                        <label className="staff-label">SpO2 (%)</label>
                        <input type="number" name="spo2" value={vitals.spo2} onChange={handleChange} className="staff-input" placeholder="e.g., 98" />
                    </div>

                    <div className="form-group">
                        <label className="staff-label">Respiratory Rate (breaths/min)</label>
                        <input type="number" name="rr" value={vitals.rr} onChange={handleChange} className="staff-input" placeholder="e.g., 16" />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="staff-label">Blood Sugar (mg/dL)</label>
                        <input type="text" name="bloodSugar" value={vitals.bloodSugar} onChange={handleChange} className="staff-input" placeholder="e.g., Fasting: 90" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssistantVitals;
