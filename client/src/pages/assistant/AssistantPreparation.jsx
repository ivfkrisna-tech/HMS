import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiChevronDown, FiChevronUp, FiSave, FiArrowLeft } from 'react-icons/fi';
import { assistantAPI } from '../../utils/api';
import './AssistantDashboard.css';

const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div style={{ marginBottom: '16px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f8fafc', cursor: 'pointer' }}
            >
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{title}</h3>
                {isOpen ? <FiChevronUp /> : <FiChevronDown />}
            </div>
            {isOpen && (
                <div style={{ padding: '20px' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

const TaskItem = ({ label, completed }) => (
    <div style={{ 
        display: 'flex', alignItems: 'center', gap: '6px', 
        padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '500',
        background: completed ? '#dcfce7' : '#f1f5f9',
        color: completed ? '#166534' : '#475569',
        border: `1px solid ${completed ? '#bbf7d0' : '#e2e8f0'}`
    }}>
        {completed ? '✅' : '⏳'} {label}
    </div>
);

const AssistantPreparation = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [appointment, setAppointment] = useState(null);
    const [checklist, setChecklist] = useState(null);

    const [formData, setFormData] = useState({
        chiefComplaint: '',
        presentIllness: '',
        pastHistory: '',
        surgicalHistory: '',
        familyHistory: '',
        currentMedicines: '',
        allergies: '',
        lifestyle: '',
        remarks: ''
    });

    useEffect(() => {
        if (appointmentId) fetchAppointment();
    }, [appointmentId]);

    const fetchAppointment = async () => {
        try {
            const [res, clRes] = await Promise.all([
                assistantAPI.getAppointmentDetails(appointmentId),
                assistantAPI.getChecklist(appointmentId)
            ]);
            
            if (clRes.success) setChecklist(clRes.checklist);

            if (res.success) {
                setAppointment(res.appointment);
                if (res.appointment.preparation) {
                    setFormData({
                        chiefComplaint: res.appointment.preparation.chiefComplaint || '',
                        presentIllness: res.appointment.preparation.presentIllness || '',
                        pastHistory: res.appointment.preparation.pastHistory || '',
                        surgicalHistory: res.appointment.preparation.surgicalHistory || '',
                        familyHistory: res.appointment.preparation.familyHistory || '',
                        currentMedicines: res.appointment.preparation.currentMedicines || '',
                        allergies: res.appointment.preparation.allergies || '',
                        lifestyle: res.appointment.preparation.lifestyle || '',
                        remarks: res.appointment.preparation.remarks || ''
                    });
                }
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
            const res = await assistantAPI.savePreparation(appointmentId, formData);
            if (res.success) {
                alert('Preparation saved successfully');
            }
        } catch (error) {
            console.error("Failed to save preparation", error);
            alert('Error saving preparation');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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
                        <h1>Patient Preparation</h1>
                        <p>{appointment?.userId?.name} • {appointment?.userId?.mrn || appointment?.userId?.patientId}</p>
                    </div>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                    <FiSave /> {saving ? 'Saving...' : 'Save Preparation'}
                </button>
            </header>

            {/* Patient Alerts Panel */}
            {appointment && (
                <div style={{ maxWidth: '900px', margin: '0 auto', marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Check High BP */}
                    {appointment.vitals?.bp && parseInt(appointment.vitals.bp.split('/')[0]) >= 140 && (
                        <span style={{ padding: '6px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            ⚠️ High BP ({appointment.vitals.bp})
                        </span>
                    )}
                    {/* Check Allergies */}
                    {(appointment.preparation?.allergies || appointment.userId?.fertilityProfile?.allergies) && (
                        <span style={{ padding: '6px 12px', background: '#fef3c7', color: '#92400e', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            ⚠️ Has Allergies
                        </span>
                    )}
                    {/* Check Diabetes */}
                    {((appointment.preparation?.pastHistory || '').toLowerCase().includes('diabetes') || (appointment.userId?.fertilityProfile?.medicalHistory || '').toLowerCase().includes('diabetes')) && (
                        <span style={{ padding: '6px 12px', background: '#e0e7ff', color: '#3730a3', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🩸 Diabetic
                        </span>
                    )}
                </div>
            )}

            <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '40px' }}>
                {/* Smart Task Manager Checklist */}
                {checklist && (
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '15px', color: '#0f172a', margin: '0 0 12px 0' }}>📋 Smart Task Manager</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                            <TaskItem label="Vitals Completed" completed={checklist.vitalsCompleted} />
                            <TaskItem label="Clinical Notes" completed={checklist.preparationDone} />
                            <TaskItem label="Consents Generated" completed={checklist.consentGenerated} />
                            <TaskItem label="Reports Uploaded" completed={checklist.reportsUploaded} />
                            <TaskItem label="Investigations Added" completed={checklist.investigationAdded} />
                        </div>
                        
                        {/* Action Buttons to Navigate to Sub-Modules */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                            <button onClick={() => navigate(`/assistant/vitals/${appointmentId}`)} style={{ padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Add Vitals</button>
                            <button onClick={() => navigate(`/assistant/reports/${appointmentId}`)} style={{ padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Manage Reports</button>
                            <button onClick={() => navigate(`/assistant/investigations/${appointmentId}`)} style={{ padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Investigations</button>
                            <button onClick={() => navigate(`/assistant/consents/${appointmentId}`)} style={{ padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Consent Forms</button>
                            <button onClick={() => navigate(`/assistant/clinical-notes/${appointmentId}`)} style={{ padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Clinical Notes</button>
                            <button onClick={() => navigate(`/assistant/follow-up/${appointmentId}`)} style={{ padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Follow-up</button>
                        </div>
                    </div>
                )}
                <CollapsibleSection title="Chief Complaint" defaultOpen={true}>
                    <textarea 
                        name="chiefComplaint"
                        value={formData.chiefComplaint}
                        onChange={handleChange}
                        className="staff-input" 
                        placeholder="Enter the primary reason for the patient's visit..." 
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} 
                    />
                </CollapsibleSection>

                <CollapsibleSection title="History of Present Illness">
                    <textarea 
                        name="presentIllness"
                        value={formData.presentIllness}
                        onChange={handleChange}
                        className="staff-input" 
                        placeholder="Detailed progression of the chief complaint..." 
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} 
                    />
                </CollapsibleSection>

                <CollapsibleSection title="Past Medical History">
                    <textarea 
                        name="pastHistory"
                        value={formData.pastHistory}
                        onChange={handleChange}
                        className="staff-input" 
                        placeholder="Chronic conditions, past illnesses..." 
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} 
                    />
                </CollapsibleSection>

                <CollapsibleSection title="Surgical History">
                    <textarea 
                        name="surgicalHistory"
                        value={formData.surgicalHistory}
                        onChange={handleChange}
                        className="staff-input" 
                        placeholder="Previous surgeries and dates..." 
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} 
                    />
                </CollapsibleSection>

                <CollapsibleSection title="Family History">
                    <textarea 
                        name="familyHistory"
                        value={formData.familyHistory}
                        onChange={handleChange}
                        className="staff-input" 
                        placeholder="Relevant medical history in the family..." 
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} 
                    />
                </CollapsibleSection>

                <CollapsibleSection title="Current Medication">
                    <textarea 
                        name="currentMedicines"
                        value={formData.currentMedicines}
                        onChange={handleChange}
                        className="staff-input" 
                        placeholder="List of medications the patient is currently taking..." 
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} 
                    />
                </CollapsibleSection>

                <CollapsibleSection title="Allergy">
                    <textarea 
                        name="allergies"
                        value={formData.allergies}
                        onChange={handleChange}
                        className="staff-input" 
                        placeholder="Food, drug, or environmental allergies..." 
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} 
                    />
                </CollapsibleSection>

                <CollapsibleSection title="Lifestyle">
                    <textarea 
                        name="lifestyle"
                        value={formData.lifestyle}
                        onChange={handleChange}
                        className="staff-input" 
                        placeholder="Smoking, alcohol, diet, exercise habits..." 
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} 
                    />
                </CollapsibleSection>

                <CollapsibleSection title="Remarks">
                    <textarea 
                        name="remarks"
                        value={formData.remarks}
                        onChange={handleChange}
                        className="staff-input" 
                        placeholder="Any additional notes or observations..." 
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} 
                    />
                </CollapsibleSection>
            </div>
        </div>
    );
};

export default AssistantPreparation;
