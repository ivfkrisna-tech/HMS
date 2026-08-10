import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiSearch, FiPlus, FiCheckCircle, FiClock, FiArrowLeft } from 'react-icons/fi';
import { assistantAPI } from '../../utils/api';
import './AssistantDashboard.css';

const AssistantInvestigations = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [appointment, setAppointment] = useState(null);
    const [labTests, setLabTests] = useState([]);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [newTest, setNewTest] = useState('');

    useEffect(() => {
        if (appointmentId) fetchAppointment();
    }, [appointmentId]);

    const fetchAppointment = async () => {
        try {
            const res = await assistantAPI.getAppointmentDetails(appointmentId);
            if (res.success) {
                setAppointment(res.appointment);
                setLabTests(res.appointment.labTests || []);
            }
        } catch (error) {
            console.error("Failed to load appointment details", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTest = async () => {
        if (!newTest.trim()) return;
        setSaving(true);
        try {
            const res = await assistantAPI.addInvestigation(appointmentId, newTest.trim());
            if (res.success) {
                setLabTests(res.labTests);
                setNewTest('');
            }
        } catch (error) {
            console.error("Failed to add investigation", error);
            alert("Error adding investigation");
        } finally {
            setSaving(false);
        }
    };

    const filteredTests = labTests.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (loading) return <div className="assistant-dashboard"><div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div></div>;

    return (
        <div className="assistant-dashboard">
            <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer', display: 'flex' }} title="Back">
                        <FiArrowLeft />
                    </button>
                    <div>
                        <h1>Investigations</h1>
                        <p>{appointment?.userId?.name} • {appointment?.userId?.mrn || appointment?.userId?.patientId}</p>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                        type="text" 
                        value={newTest}
                        onChange={(e) => setNewTest(e.target.value)}
                        placeholder="e.g. Complete Blood Count"
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
                        onKeyPress={(e) => { if(e.key === 'Enter') handleAddTest() }}
                    />
                    <button 
                        onClick={handleAddTest}
                        disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                    >
                        <FiPlus /> Add
                    </button>
                </div>
            </header>

            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <FiSearch style={{ color: '#94a3b8', marginRight: '8px' }} />
                        <input 
                            type="text" 
                            placeholder="Search tests..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ border: 'none', outline: 'none', background: 'transparent' }} 
                        />
                    </div>
                </div>

                <div className="investigations-list">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {filteredTests.map((test, index) => (
                            <div key={index} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>{test}</h4>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Ordered for this appointment</p>
                                </div>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: '600' }}>
                                    <FiClock /> Pending
                                </span>
                            </div>
                        ))}
                        {filteredTests.length === 0 && (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                No investigations found.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssistantInvestigations;
