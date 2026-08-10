import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheckSquare, FiSquare, FiSend, FiArrowLeft } from 'react-icons/fi';
import { assistantAPI } from '../../utils/api';
import './AssistantDashboard.css';

const AssistantTasks = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [appointment, setAppointment] = useState(null);

    const [tasks, setTasks] = useState({
        vitals: false,
        preparation: false,
        clinicalNotes: false
    });

    useEffect(() => {
        if (appointmentId) fetchAppointment();
    }, [appointmentId]);

    const fetchAppointment = async () => {
        try {
            const res = await assistantAPI.getAppointmentDetails(appointmentId);
            if (res.success) {
                setAppointment(res.appointment);
                
                // Dynamically compute checklist based on data presence
                setTasks({
                    vitals: !!res.appointment.vitals?.height || !!res.appointment.vitals?.bp,
                    preparation: !!res.appointment.preparation?.chiefComplaint || !!res.appointment.preparation?.presentIllness,
                    clinicalNotes: !!res.appointment.draftClinicalNotes
                });
            }
        } catch (error) {
            console.error("Failed to load appointment details", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkReady = async () => {
        setSaving(true);
        try {
            const res = await assistantAPI.markReady(appointmentId);
            if (res.success) {
                alert('Patient marked as Ready for Doctor!');
                fetchAppointment(); // Refresh state
            }
        } catch (error) {
            console.error("Failed to mark ready", error);
            alert('Error marking patient as ready');
        } finally {
            setSaving(false);
        }
    };

    const isReadyForDoctor = Object.values(tasks).filter(Boolean).length >= 1; // Need at least 1 task done to mark ready

    if (loading) return <div className="assistant-dashboard"><div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div></div>;

    return (
        <div className="assistant-dashboard">
            <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer', display: 'flex' }} title="Back">
                        <FiArrowLeft />
                    </button>
                    <div>
                        <h1>Preparation Tasks</h1>
                        <p>{appointment?.userId?.name} • {appointment?.userId?.mrn || appointment?.userId?.patientId}</p>
                    </div>
                </div>
            </header>

            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <div style={{ background: 'white', borderRadius: '12px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '30px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '25px', color: '#1e293b', fontSize: '1.2rem', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' }}>
                        Patient Preparation Checklist (Auto-calculated)
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Task Item */}
                        <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: tasks.vitals ? '#f0fdf4' : '#f8fafc', border: `1px solid ${tasks.vitals ? '#bbf7d0' : '#e2e8f0'}` }}
                        >
                            {tasks.vitals ? <FiCheckSquare style={{ fontSize: '24px', color: '#16a34a' }} /> : <FiSquare style={{ fontSize: '24px', color: '#94a3b8' }} />}
                            <span style={{ fontSize: '1.05rem', color: tasks.vitals ? '#166534' : '#334155', fontWeight: '500', textDecoration: tasks.vitals ? 'line-through' : 'none' }}>
                                Vitals Logged
                            </span>
                        </div>

                        {/* Task Item */}
                        <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: tasks.preparation ? '#f0fdf4' : '#f8fafc', border: `1px solid ${tasks.preparation ? '#bbf7d0' : '#e2e8f0'}` }}
                        >
                            {tasks.preparation ? <FiCheckSquare style={{ fontSize: '24px', color: '#16a34a' }} /> : <FiSquare style={{ fontSize: '24px', color: '#94a3b8' }} />}
                            <span style={{ fontSize: '1.05rem', color: tasks.preparation ? '#166534' : '#334155', fontWeight: '500', textDecoration: tasks.preparation ? 'line-through' : 'none' }}>
                                Chief Complaint / History Logged
                            </span>
                        </div>

                        {/* Task Item */}
                        <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: tasks.clinicalNotes ? '#f0fdf4' : '#f8fafc', border: `1px solid ${tasks.clinicalNotes ? '#bbf7d0' : '#e2e8f0'}` }}
                        >
                            {tasks.clinicalNotes ? <FiCheckSquare style={{ fontSize: '24px', color: '#16a34a' }} /> : <FiSquare style={{ fontSize: '24px', color: '#94a3b8' }} />}
                            <span style={{ fontSize: '1.05rem', color: tasks.clinicalNotes ? '#166534' : '#334155', fontWeight: '500', textDecoration: tasks.clinicalNotes ? 'line-through' : 'none' }}>
                                Draft Clinical Notes Added
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <button 
                        onClick={handleMarkReady}
                        disabled={!isReadyForDoctor || saving || appointment?.readyForDoctor}
                        style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '10px', 
                            padding: '16px 32px', 
                            background: appointment?.readyForDoctor ? '#10b981' : isReadyForDoctor ? '#3b82f6' : '#cbd5e1', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '50px', 
                            fontWeight: 'bold', 
                            fontSize: '1.1rem',
                            cursor: (!isReadyForDoctor || saving || appointment?.readyForDoctor) ? 'not-allowed' : 'pointer',
                            boxShadow: appointment?.readyForDoctor ? '0 10px 15px -3px rgba(16, 185, 129, 0.3)' : isReadyForDoctor ? '0 10px 15px -3px rgba(59, 130, 246, 0.3)' : 'none',
                            transition: 'all 0.3s',
                            width: '100%'
                        }}
                    >
                        <FiSend size={20} /> {saving ? 'Marking...' : appointment?.readyForDoctor ? 'Marked as Ready' : 'Mark as "Ready For Doctor"'}
                    </button>
                    {!isReadyForDoctor && !appointment?.readyForDoctor && <p style={{ color: '#94a3b8', marginTop: '10px', fontSize: '0.9rem' }}>Log vitals or preparation data to enable this button.</p>}
                </div>
            </div>
        </div>
    );
};

export default AssistantTasks;
