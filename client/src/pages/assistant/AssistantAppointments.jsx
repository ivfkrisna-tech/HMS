import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiCalendar, FiClock } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { assistantAPI } from '../../utils/api';
import './AssistantDashboard.css';

const AssistantAppointments = () => {
    const navigate = useNavigate();
    const [activeFilter, setActiveFilter] = useState('All');
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchPatient, setSearchPatient] = useState('');
    const [searchDoctor, setSearchDoctor] = useState('');

    useEffect(() => {
        fetchAppointments();
    }, []);

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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const nextDay = new Date(tomorrow);
        nextDay.setDate(nextDay.getDate() + 1);

        return appointments.filter(apt => {
            // Text Search
            const pMatch = (apt.userId?.name || '').toLowerCase().includes(searchPatient.toLowerCase());
            const dMatch = (apt.doctorId?.name || apt.doctorName || '').toLowerCase().includes(searchDoctor.toLowerCase());
            if (!pMatch || !dMatch) return false;

            // Date & Status filter
            const aptDate = new Date(apt.appointmentDate);
            aptDate.setHours(0, 0, 0, 0);

            if (activeFilter === 'Completed') {
                return apt.status === 'completed' || apt.consultationStatus === 'Consultation Completed';
            }
            if (activeFilter === 'Waiting') {
                return aptDate.getTime() === today.getTime() && (apt.consultationStatus === 'Patient Checked In' || apt.consultationStatus === 'Waiting For Assistant' || !apt.consultationStatus);
            }
            if (activeFilter === 'Preparing') {
                return aptDate.getTime() === today.getTime() && apt.consultationStatus === 'Preparation In Progress';
            }
            if (activeFilter === 'Ready') {
                return aptDate.getTime() === today.getTime() && apt.consultationStatus === 'Ready For Doctor';
            }
            if (activeFilter === 'Consulting') {
                return aptDate.getTime() === today.getTime() && (apt.consultationStatus === 'Doctor Reviewing' || apt.consultationStatus === 'Prescription Completed');
            }
            if (activeFilter === 'All') {
                return true;
            }
            
            return true;
        });
    };

    const filteredAppointments = getFilteredAppointments();

    const handlePrepare = (appointmentId) => {
        navigate(`/assistant/preparation/${appointmentId}`);
    };

    return (
        <div className="assistant-dashboard">
            <header className="dashboard-header">
                <div>
                    <h1>Appointments</h1>
                    <p>View and manage all appointments for assigned doctors.</p>
                </div>
            </header>

            <div className="filters-section" style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div className="search-group" style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}>
                        <FiSearch style={{ color: '#94a3b8', marginRight: '8px' }} />
                        <input type="text" placeholder="Search Patient..." value={searchPatient} onChange={e => setSearchPatient(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}>
                        <FiSearch style={{ color: '#94a3b8', marginRight: '8px' }} />
                        <input type="text" placeholder="Search Doctor..." value={searchDoctor} onChange={e => setSearchDoctor(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%' }} />
                    </div>
                </div>

                <div className="filter-buttons" style={{ display: 'flex', gap: '10px', background: 'white', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                    {['All', 'Waiting', 'Preparing', 'Ready', 'Consulting', 'Completed'].map(filter => (
                        <button 
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            style={{ 
                                padding: '8px 16px', 
                                border: 'none', 
                                borderRadius: '6px',
                                background: activeFilter === filter ? '#eff6ff' : 'transparent',
                                color: activeFilter === filter ? '#2563eb' : '#64748b',
                                fontWeight: activeFilter === filter ? '600' : '500',
                                cursor: 'pointer'
                            }}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            <div className="appointments-grid">
                {loading ? (
                    <div style={{ padding: '20px', color: '#64748b' }}>Loading appointments...</div>
                ) : filteredAppointments.length === 0 ? (
                    <div style={{ padding: '20px', color: '#94a3b8' }}>No appointments found.</div>
                ) : filteredAppointments.map(apt => (
                    <div key={apt._id} className="appointment-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                            <div>
                                <h3 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '1.1rem' }}>{apt.userId?.name || 'Unknown Patient'}</h3>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>{apt.serviceName || 'Consultation'}</p>
                            </div>
                            <span style={{ 
                                padding: '4px 10px', 
                                borderRadius: '999px', 
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                backgroundColor: apt.status === 'completed' || apt.consultationStatus === 'Consultation Completed' ? '#dcfce7' : 
                                               apt.consultationStatus === 'Ready For Doctor' ? '#dbeafe' : 
                                               apt.consultationStatus === 'Preparation In Progress' ? '#fef3c7' : '#f1f5f9',
                                color: apt.status === 'completed' || apt.consultationStatus === 'Consultation Completed' ? '#166534' : 
                                       apt.consultationStatus === 'Ready For Doctor' ? '#1e40af' : 
                                       apt.consultationStatus === 'Preparation In Progress' ? '#92400e' : '#475569'
                            }}>
                                {apt.consultationStatus || 'Patient Checked In'}
                            </span>
                        </div>
                        
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.95rem' }}>
                                <FiCalendar style={{ color: '#94a3b8' }} /> {new Date(apt.appointmentDate).toLocaleDateString()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.95rem' }}>
                                <FiClock style={{ color: '#94a3b8' }} /> {apt.appointmentTime || 'N/A'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.95rem', fontWeight: '500' }}>
                                👨‍⚕️ {apt.doctorId?.name || apt.doctorName}
                            </div>
                        </div>
                        
                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                            <button onClick={() => handlePrepare(apt._id)} style={{ flex: 1, padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer' }}>Prepare Patient</button>
                            <button style={{ flex: 1, padding: '8px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: '500', cursor: 'pointer' }}>View Details</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AssistantAppointments;
