import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiSave, FiEdit3, FiArrowLeft } from 'react-icons/fi';
import { assistantAPI } from '../../utils/api';
import './AssistantDashboard.css';

const AssistantClinicalNotes = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [appointment, setAppointment] = useState(null);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (appointmentId) fetchAppointment();
    }, [appointmentId]);

    const fetchAppointment = async () => {
        try {
            const res = await assistantAPI.getAppointmentDetails(appointmentId);
            if (res.success) {
                setAppointment(res.appointment);
                setNotes(res.appointment.draftClinicalNotes || '');
            }
        } catch (error) {
            console.error("Failed to load appointment details", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await assistantAPI.saveClinicalNotes(appointmentId, { draftClinicalNotes: notes });
            if (res.success) {
                alert('Draft clinical notes saved successfully');
            }
        } catch (error) {
            console.error("Failed to save clinical notes", error);
            alert('Error saving clinical notes');
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
                        <h1>Draft Clinical Notes</h1>
                        <p>{appointment?.userId?.name} • {appointment?.userId?.mrn || appointment?.userId?.patientId}</p>
                    </div>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                    <FiSave /> {saving ? 'Saving...' : 'Save Draft'}
                </button>
            </header>

            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                    <FiEdit3 style={{ fontSize: '20px', color: '#3b82f6' }} />
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Clinical Notes Editor</h2>
                </div>
                
                {/* Dummy Rich Text Editor Toolbar */}
                <div style={{ display: 'flex', gap: '10px', padding: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderBottom: 'none', borderRadius: '8px 8px 0 0' }}>
                    <button style={{ padding: '6px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>B</button>
                    <button style={{ padding: '6px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', fontStyle: 'italic', cursor: 'pointer' }}>I</button>
                    <button style={{ padding: '6px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', textDecoration: 'underline', cursor: 'pointer' }}>U</button>
                    <div style={{ width: '1px', background: '#cbd5e1', margin: '0 5px' }}></div>
                    <button style={{ padding: '6px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}>List</button>
                    <button style={{ padding: '6px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}>Quote</button>
                </div>
                
                <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Start typing preliminary clinical observations, patient responses, and draft diagnosis notes here..."
                    style={{ 
                        width: '100%', 
                        minHeight: '400px', 
                        padding: '20px', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '0 0 8px 8px', 
                        fontSize: '1rem', 
                        lineHeight: '1.6', 
                        resize: 'vertical',
                        outline: 'none'
                    }}
                />
                
                <div style={{ marginTop: '15px', color: '#94a3b8', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span></span>
                    <span>Words: {notes.trim().split(/\s+/).filter(Boolean).length}</span>
                </div>
            </div>
        </div>
    );
};

export default AssistantClinicalNotes;
