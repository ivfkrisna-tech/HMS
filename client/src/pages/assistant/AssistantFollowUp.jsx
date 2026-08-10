import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiAlertCircle, FiSave, FiArrowLeft } from 'react-icons/fi';
import { assistantAPI } from '../../utils/api';
import './AssistantDashboard.css';

const AssistantFollowUp = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [appointment, setAppointment] = useState(null);

    const [followUp, setFollowUp] = useState({
        nextVisitDate: '',
        nextVisitTime: '',
        followUpReason: '',
        pendingInvestigations: '',
        pendingReports: '',
        pendingConsents: ''
    });

    useEffect(() => {
        if (appointmentId) fetchAppointment();
    }, [appointmentId]);

    const fetchAppointment = async () => {
        try {
            const res = await assistantAPI.getAppointmentDetails(appointmentId);
            if (res.success) {
                setAppointment(res.appointment);
                if (res.appointment.preparation) {
                    setFollowUp({
                        nextVisitDate: res.appointment.preparation.nextVisitDate || '',
                        nextVisitTime: res.appointment.preparation.nextVisitTime || '',
                        followUpReason: res.appointment.preparation.followUpReason || '',
                        pendingInvestigations: res.appointment.preparation.pendingInvestigations || '',
                        pendingReports: res.appointment.preparation.pendingReports || '',
                        pendingConsents: res.appointment.preparation.pendingConsents || ''
                    });
                }
            }
        } catch (error) {
            console.error("Failed to load appointment details", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFollowUp({ ...followUp, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // We append follow-up details into the preparation object
            const res = await assistantAPI.savePreparation(appointmentId, followUp);
            if (res.success) {
                alert('Follow-up details saved successfully');
            }
        } catch (error) {
            console.error("Failed to save follow-up", error);
            alert('Error saving follow-up details');
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
                        <h1>Follow-up Planning</h1>
                        <p>{appointment?.userId?.name} • {appointment?.userId?.mrn || appointment?.userId?.patientId}</p>
                    </div>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                    <FiSave /> {saving ? 'Saving...' : 'Save Follow-up'}
                </button>
            </header>

            <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiCalendar style={{ color: '#3b82f6' }} /> Scheduling Details
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '30px' }}>
                    <div className="form-group">
                        <label className="staff-label">Next Visit Date</label>
                        <input type="date" name="nextVisitDate" value={followUp.nextVisitDate} onChange={handleChange} className="staff-input" />
                    </div>
                    
                    <div className="form-group">
                        <label className="staff-label">Next Visit Time (Optional)</label>
                        <input type="time" name="nextVisitTime" value={followUp.nextVisitTime} onChange={handleChange} className="staff-input" />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="staff-label">Follow-up Reason / Reminder Note</label>
                        <textarea name="followUpReason" value={followUp.followUpReason} onChange={handleChange} className="staff-input" placeholder="e.g., Post-surgery checkup..." style={{ height: '80px', resize: 'vertical' }}></textarea>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '30px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiAlertCircle style={{ color: '#f59e0b' }} /> Pending Requirements for Next Visit
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="form-group">
                            <label className="staff-label">Pending Investigations</label>
                            <input type="text" name="pendingInvestigations" value={followUp.pendingInvestigations} onChange={handleChange} className="staff-input" placeholder="e.g., Fasting Blood Sugar, X-Ray" />
                            <small style={{ color: '#94a3b8', marginTop: '4px', display: 'block' }}>Tests patient needs to complete before returning.</small>
                        </div>

                        <div className="form-group">
                            <label className="staff-label">Pending Reports to Bring</label>
                            <input type="text" name="pendingReports" value={followUp.pendingReports} onChange={handleChange} className="staff-input" placeholder="e.g., Previous discharge summary" />
                        </div>

                        <div className="form-group">
                            <label className="staff-label">Pending Consents</label>
                            <input type="text" name="pendingConsents" value={followUp.pendingConsents} onChange={handleChange} className="staff-input" placeholder="e.g., Minor procedure consent form" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssistantFollowUp;
