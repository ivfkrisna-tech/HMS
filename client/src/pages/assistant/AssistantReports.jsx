import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiUpload, FiEye, FiTrash2, FiFileText, FiArrowLeft } from 'react-icons/fi';
import { assistantAPI, uploadAPI } from '../../utils/api';
import './AssistantDashboard.css';

const AssistantReports = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [appointment, setAppointment] = useState(null);
    const [reports, setReports] = useState([]);
    
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (appointmentId) fetchAppointment();
    }, [appointmentId]);

    const fetchAppointment = async () => {
        try {
            const res = await assistantAPI.getAppointmentDetails(appointmentId);
            if (res.success) {
                setAppointment(res.appointment);
                setReports(res.appointment.prescriptions || []);
            }
        } catch (error) {
            console.error("Failed to load appointment details", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('images', files[i]);
            }

            const uploadRes = await uploadAPI.uploadImages(formData);
            
            if (uploadRes.success && uploadRes.files && uploadRes.files.length > 0) {
                const newReports = uploadRes.files.map(f => ({
                    name: f.name || f.originalName || 'Report',
                    url: f.url,
                    fileId: f.fileId,
                    type: 'Laboratory', // default type
                    uploadedAt: new Date().toISOString()
                }));

                const saveRes = await assistantAPI.saveReports(appointmentId, newReports);
                if (saveRes.success) {
                    alert('Report uploaded successfully');
                    setReports(saveRes.prescriptions);
                }
            } else {
                alert('Upload failed');
            }
        } catch (error) {
            console.error('Upload error', error);
            alert('Error uploading file');
        } finally {
            setUploading(false);
            e.target.value = null; // reset input
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
                        <h1>Patient Reports</h1>
                        <p>{appointment?.userId?.name} • {appointment?.userId?.mrn || appointment?.userId?.patientId}</p>
                    </div>
                </div>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleFileChange}
                    multiple
                    accept="image/*,application/pdf"
                />

                <button 
                    onClick={handleUploadClick}
                    disabled={uploading}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}
                >
                    <FiUpload /> {uploading ? 'Uploading...' : 'Upload Report'}
                </button>
            </header>

            <div className="table-container" style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                            <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: '600' }}>File Name</th>
                            <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: '600' }}>Type</th>
                            <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: '600' }}>Date Added</th>
                            <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((report, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '16px', fontWeight: '500', color: '#334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <FiFileText style={{ color: '#94a3b8' }} /> {report.name || `Report ${index + 1}`}
                                </td>
                                <td style={{ padding: '16px', color: '#475569' }}>{report.type || 'Document'}</td>
                                <td style={{ padding: '16px', color: '#475569' }}>{new Date(report.uploadedAt).toLocaleDateString()}</td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                        <a href={report.url} target="_blank" rel="noreferrer" style={{ padding: '6px', background: '#eff6ff', color: '#3b82f6', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex' }} title="Preview Report">
                                            <FiEye />
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {reports.length === 0 && (
                            <tr>
                                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                    No reports uploaded yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssistantReports;
