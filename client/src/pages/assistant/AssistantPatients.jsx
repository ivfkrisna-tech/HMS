import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiExternalLink, FiSearch, FiDownload } from 'react-icons/fi';
import { assistantAPI } from '../../utils/api';
import './AssistantDashboard.css';

const AssistantPatients = () => {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const res = await assistantAPI.getAppointments('today');
            if (res.success) {
                setAppointments(res.appointments);
            }
        } catch (error) {
            console.error("Failed to fetch today's patients", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpen = (appointmentId) => {
        navigate(`/assistant/preparation/${appointmentId}`);
    };

    const filteredPatients = appointments.filter(apt => 
        (apt.userId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (apt.userId?.mrn || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleExportCSV = () => {
        if (filteredPatients.length === 0) return;
        
        const headers = ['Patient Name', 'MRN', 'Age', 'Gender', 'Doctor', 'Appointment Time', 'Status'];
        const csvRows = [headers.join(',')];
        
        filteredPatients.forEach(apt => {
            const row = [
                `"${apt.userId?.name || 'Unknown'}"`,
                `"${apt.userId?.mrn || '-'}"`,
                `"${apt.userId?.age || apt.userId?.dob || '-'}"`,
                `"${apt.userId?.gender || '-'}"`,
                `"${apt.doctorId?.name || apt.doctorName || '-'}"`,
                `"${apt.appointmentTime || '-'}"`,
                `"${apt.status}"`
            ];
            csvRows.push(row.join(','));
        });
        
        const csvData = csvRows.join('\n');
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Assistant_Patients_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="assistant-dashboard">
            <header className="dashboard-header" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Today's Patients</h1>
                    <p>Manage and prepare patients scheduled for today.</p>
                </div>
                <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, maxWidth: '400px' }}>
                    <FiSearch style={{ color: '#94a3b8', marginRight: '8px' }} />
                    <input 
                        type="text" 
                        placeholder="Search patients..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%' }} 
                    />
                </div>
                <button 
                    onClick={handleExportCSV}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                    <FiDownload /> Export CSV
                </button>
            </header>

            <div className="table-container">
                {loading ? (
                    <div className="loading-spinner">Loading patients...</div>
                ) : (
                <table className="patients-table">
                    <thead>
                        <tr>
                            <th>Patient Name</th>
                            <th>MRN / UHID</th>
                            <th>Doctor</th>
                            <th>Appointment Time</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPatients.length === 0 ? (
                            <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No patients found for today.</td></tr>
                        ) : filteredPatients.map(apt => (
                            <tr key={apt._id}>
                                <td>
                                    <div className="patient-name-cell">
                                        <div className="patient-avatar">
                                            {apt.userId?.name ? apt.userId.name.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div className="patient-info">
                                            <strong>{apt.userId?.name || 'Unknown'}</strong>
                                            <small>{apt.userId?.gender} • {apt.userId?.age || apt.userId?.dob || 'Age unknown'}</small>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {apt.userId?.mrn || '-'}<br/>
                                    <small style={{ color: '#94a3b8' }}>{apt.userId?.patientId || '-'}</small>
                                </td>
                                <td style={{ padding: '16px', color: '#475569' }}>{apt.doctorId?.name || apt.doctorName}</td>
                                <td style={{ padding: '16px', color: '#475569' }}>{apt.appointmentTime || 'N/A'}</td>
                                <td>
                                    <span className={`status-badge ${apt.status === 'completed' ? 'completed' : apt.status === 'pending' ? 'pending' : 'ready'}`}>
                                        {apt.status === 'pending' && !apt.readyForDoctor ? 'Waiting' : apt.readyForDoctor && apt.status !== 'completed' ? 'Ready for Doctor' : apt.status}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <button 
                                        className="btn-prepare"
                                        onClick={() => handleOpen(apt._id)}
                                    >
                                        <FiExternalLink /> Open
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
            </div>
        </div>
    );
};

export default AssistantPatients;
