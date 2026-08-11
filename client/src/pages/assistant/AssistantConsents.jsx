import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiFileText, FiDownload, FiUpload, FiEye, FiCheck, FiArrowLeft, FiSearch, FiExternalLink, FiUsers, FiShield } from 'react-icons/fi';
import { assistantAPI, consentAPI, uploadAPI } from '../../utils/api';
import './AssistantDashboard.css';

const AssistantConsents = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const [appointment, setAppointment] = useState(null);
    const [patient, setPatient] = useState(null);
    const [templates, setTemplates] = useState([]);
    
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [consentNameInput, setConsentNameInput] = useState('');
    
    const fileInputRef = useRef(null);

    const [allAppointments, setAllAppointments] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (appointmentId) {
            fetchData();
        } else {
            fetchAllAppointments();
        }
    }, [appointmentId]);

    const fetchAllAppointments = async () => {
        try {
            const res = await assistantAPI.getAppointments({ tab: 'All' });
            if (res.success) {
                // Filter only today's appointments for consents by default
                const today = new Date().toISOString().split('T')[0];
                const todaysApts = (res.data || []).filter(apt => {
                    const aptDate = apt.date ? apt.date.split('T')[0] : '';
                    return aptDate === today;
                });
                setAllAppointments(todaysApts);
            }
        } catch (error) {
            console.error("Failed to load appointments", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            const aptRes = await assistantAPI.getAppointmentDetails(appointmentId);
            if (aptRes.success) {
                setAppointment(aptRes.appointment);
                
                // Fetch patient profile for consents
                const patRes = await assistantAPI.getPatientProfile(aptRes.appointment.userId._id);
                if (patRes.success) setPatient(patRes.patient);
            }

            const tmplRes = await consentAPI.getTemplates({ status: 'active', limit: 100 });
            if (tmplRes.success) {
                setTemplates(tmplRes.data || []);
            }
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!selectedTemplateId) return alert('Please select a template');
        if (!patient || !patient._id) return alert('Patient not found');
        
        setGenerating(true);
        try {
            const url = consentAPI.getGeneratePdfUrl(selectedTemplateId, patient._id);
            window.open(url, '_blank');
            
            const selectedTemplate = templates.find(t => t._id === selectedTemplateId);
            const tmplName = selectedTemplate ? (selectedTemplate.title || selectedTemplate.name) : 'Generated Consent';
            
            const newConsent = {
                consentName: tmplName,
                fileUrl: url,
                fileType: 'application/pdf',
                uploadedAt: new Date().toISOString(),
                status: 'Pending',
                signedDate: null,
                appointmentId: appointmentId || null
            };
            
            const updatedConsents = [...(patient.consents || []), newConsent];
            const res = await assistantAPI.updatePatientProfile(patient._id, { consents: updatedConsents });
            if (res.success) {
                setPatient(prev => ({ ...prev, consents: updatedConsents }));
            }
        } catch (error) {
            console.error("Generate error", error);
        } finally {
            setGenerating(false);
        }
    };

    const handleUploadClick = () => {
        if (!consentNameInput.trim()) {
            return alert('Please enter a name for the consent form before uploading.');
        }
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('images', file);

            const uploadRes = await uploadAPI.uploadImages(formData);
            
            if (uploadRes.success && uploadRes.files && uploadRes.files.length > 0) {
                const newConsent = {
                    consentName: consentNameInput.trim(),
                    fileUrl: uploadRes.files[0].url,
                    fileType: uploadRes.files[0].mimetype || 'document',
                    uploadedAt: new Date().toISOString(),
                    status: 'Signed',
                    signedDate: new Date().toISOString(),
                    appointmentId: appointmentId || null
                };
                
                const updatedConsents = [...(patient.consents || []), newConsent];
                const res = await assistantAPI.updatePatientProfile(patient._id, { consents: updatedConsents });
                
                if (res.success) {
                    setPatient(prev => ({ ...prev, consents: updatedConsents }));
                    setConsentNameInput('');
                    alert("Consent uploaded successfully!");
                } else {
                    alert(res.message || "Failed to save consent.");
                }
            } else {
                alert('Upload failed');
            }
        } catch (error) {
            console.error('Upload error', error);
            alert('Error uploading file');
        } finally {
            setUploading(false);
            e.target.value = null; 
        }
    };

    if (loading) return <div className="assistant-dashboard"><div className="loading-spinner">Loading...</div></div>;

    if (!appointmentId) {
        const filteredAppointments = allAppointments.filter(apt => {
            const searchStr = searchTerm.toLowerCase();
            return (apt.userId?.name || '').toLowerCase().includes(searchStr) || 
                   (apt.userId?.mrn || '').toLowerCase().includes(searchStr);
        });

        return (
            <div className="assistant-dashboard">
                <header className="dashboard-header" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1><FiShield style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Consent Forms</h1>
                        <p>Select a patient to generate or upload consent forms.</p>
                    </div>
                    <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', flex: 1, maxWidth: '400px' }}>
                        <FiSearch style={{ color: '#94a3b8', marginRight: '8px' }} />
                        <input 
                            type="text" 
                            placeholder="Search patient by name or MRN..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontFamily: 'Outfit' }} 
                        />
                    </div>
                </header>

                <div className="table-container">
                    <table className="patients-table">
                        <thead>
                            <tr>
                                <th>Patient Name</th>
                                <th>MRN / UHID</th>
                                <th>Doctor</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.length === 0 ? (
                                <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No patients found for today.</td></tr>
                            ) : filteredAppointments.map(apt => (
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
                                    <td style={{ color: '#475569', fontWeight: '500' }}>{apt.doctorId?.name || apt.doctorName}</td>
                                    <td>
                                        <span className={`status-badge ${apt.status === 'completed' ? 'completed' : apt.status === 'pending' ? 'pending' : 'ready'}`}>
                                            {apt.status === 'pending' && !apt.readyForDoctor ? 'Waiting' : apt.readyForDoctor && apt.status !== 'completed' ? 'Ready for Doctor' : apt.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button 
                                            className="btn-prepare"
                                            onClick={() => navigate(`/assistant/consents/${apt._id}`)}
                                        >
                                            Manage Consents <FiArrowLeft style={{ transform: 'rotate(180deg)' }} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    const consentsList = patient?.consents || [];

    return (
        <div className="assistant-dashboard">
            <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer', display: 'flex' }} title="Back">
                        <FiArrowLeft />
                    </button>
                    <div>
                        <h1>Consent Forms</h1>
                        <p>{appointment?.userId?.name} • {appointment?.userId?.mrn || appointment?.userId?.patientId}</p>
                    </div>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                
                {/* Generate New Consent Card */}
                <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '24px' }}>
                            <FiFileText />
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Generate Consent</h3>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Create a new consent form from templates</p>
                        </div>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label className="staff-label">Select Template</label>
                        <select 
                            className="staff-input" 
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                        >
                            <option value="">-- Choose Procedure Template --</option>
                            {templates.map(tmpl => (
                                <option key={tmpl._id} value={tmpl._id}>{tmpl.title || tmpl.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <button 
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating || !selectedTemplateId}
                        style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: (generating || !selectedTemplateId) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (generating || !selectedTemplateId) ? 0.6 : 1 }}
                    >
                        <FiFileText /> {generating ? 'Generating...' : 'Generate Document'}
                    </button>
                </div>

                {/* Upload Signed Consent Card */}
                <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '24px' }}>
                            <FiUpload />
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Upload Signed Consent</h3>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Upload physical copies signed by patient</p>
                        </div>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label className="staff-label">Consent Name</label>
                        <input 
                            type="text" 
                            className="staff-input" 
                            placeholder="e.g. Surgery Consent Signed"
                            value={consentNameInput}
                            onChange={(e) => setConsentNameInput(e.target.value)}
                        />
                    </div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                    />
                    
                    <button 
                        type="button"
                        onClick={handleUploadClick}
                        disabled={uploading}
                        style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: uploading ? 0.7 : 1 }}
                    >
                        <FiUpload /> {uploading ? 'Uploading...' : 'Upload File'}
                    </button>
                </div>
            </div>

            <h2 style={{ marginTop: '40px', marginBottom: '20px', color: '#1e293b', fontSize: '1.2rem' }}>Patient Consent History</h2>
            
            <div className="table-container" style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                            <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: '600' }}>Form Name</th>
                            <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: '600' }}>Date Added</th>
                            <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: '600' }}>Status</th>
                            <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {consentsList.map((consent, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '16px', fontWeight: '500', color: '#334155' }}>{consent.consentName}</td>
                                <td style={{ padding: '16px', color: '#475569' }}>{new Date(consent.uploadedAt).toLocaleDateString()}</td>
                                <td style={{ padding: '16px' }}>
                                    {consent.status === 'Pending' ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '500' }}>
                                            Pending Signature
                                        </span>
                                    ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '500' }}>
                                            <FiCheck /> Signed & Uploaded
                                        </span>
                                    )}
                                </td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                        <a href={consent.fileUrl} target="_blank" rel="noreferrer" style={{ padding: '6px', background: '#eff6ff', color: '#3b82f6', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex' }} title={consent.status === 'Pending' ? "Preview Document" : "View Uploaded Consent"}
                                           onClick={(e) => { e.preventDefault(); window.open(consent.fileUrl, '_blank'); }}
                                        >
                                            <FiEye />
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {consentsList.length === 0 && (
                            <tr>
                                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                    No consent forms uploaded yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssistantConsents;
