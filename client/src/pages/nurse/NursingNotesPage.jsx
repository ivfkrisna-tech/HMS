import React, { useState, useEffect, useMemo } from 'react';
import { nurseAPI } from '../../utils/api';
import { FiFileText, FiUser, FiSend, FiClock, FiSearch } from 'react-icons/fi';
import './NurseDashboard.css';
import './NursingNotesPage.css';

const NursingNotesPage = () => {
    const [patients, setPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredPatients = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) return patients;
        return patients.filter(p => 
            p.name?.toLowerCase().includes(query) ||
            p.mrn?.toLowerCase().includes(query) ||
            p.phone?.includes(query) ||
            p._id?.toLowerCase().includes(query)
        );
    }, [searchQuery, patients]);

    useEffect(() => {
        fetchPatients();
    }, []);

    useEffect(() => {
        if (selectedPatientId) {
            fetchNotes(selectedPatientId);
        }
    }, [selectedPatientId]);

    const fetchPatients = async () => {
        try {
            const res = await nurseAPI.getPatients();
            if (res && res.patients) {
                setPatients(res.patients);
                if (res.patients.length > 0) {
                    setSelectedPatientId(res.patients[0]._id);
                }
            }
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchNotes = async (pId) => {
        try {
            const res = await nurseAPI.getNotes(pId);
            if (res && res.notes) {
                setNotes(res.notes);
            } else {
                setNotes([]);
            }
        } catch (error) {
            console.error("Error fetching notes:", error);
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim() || !selectedPatientId) return;
        setSaving(true);
        try {
            await nurseAPI.addNote(selectedPatientId, { note: newNote });
            setNewNote('');
            fetchNotes(selectedPatientId);
        } catch (error) {
            alert("Error saving note: " + (error.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const selectedPatient = patients.find(p => p._id === selectedPatientId);

    return (
        <div className="nn-dashboard-container">
            {/* Page Title Area */}
            <div className="nn-page-header">
                <div className="nn-title-block">
                    <h2><FiFileText className="nn-header-icon" /> Nursing Clinical Notes</h2>
                    <p className="nn-subtitle">Editable & version-safe shift logs accessible by doctors and lab staff</p>
                </div>
            </div>

            {/* Split Layout Section */}
            <div className="nn-layout-grid">
                
                {/* Left Sidebar: Patient Selector Panel */}
                <div className="nn-sidebar-card">
                    <label className="nn-sidebar-label">
                        <FiUser /> Active Patients Queue
                    </label>
                    <div className="nn-search-container" style={{ position: 'relative', margin: '0 0 12px 0' }}>
                        <FiSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search Name, ID, Phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '9px 10px 9px 32px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                outline: 'none',
                                fontSize: '13px',
                                color: '#1e293b',
                                backgroundColor: '#f8fafc',
                                transition: 'all 0.2s ease'
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#12b787'; e.target.style.backgroundColor = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(18, 183, 135, 0.1)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>
                    <div className="nn-patient-list-wrapper">
                        {filteredPatients.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>No matching patients found.</div>
                        ) : (
                            filteredPatients.map(p => (
                                <button
                                    key={p._id}
                                    onClick={() => setSelectedPatientId(p._id)}
                                    className={`nn-patient-btn ${selectedPatientId === p._id ? 'active' : ''}`}
                                >
                                    <span className="nn-patient-name">{p.name}</span>
                                    <span className="nn-patient-meta">{p.mrn} • {p.ward || 'General Ward'}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Area: Dynamic Notes Logs Panel */}
                <div className="nn-feed-card">
                    <div className="nn-feed-header">
                        <div className="nn-active-patient-details">
                            <h3>{selectedPatient ? selectedPatient.name : 'Select a patient'}</h3>
                            <p>
                                {selectedPatient ? `${selectedPatient.mrn} • Under care of Dr. ${selectedPatient.doctorName}` : 'No patient selected'}
                            </p>
                        </div>
                        <span className="nn-badge-safe">Version Safe Log</span>
                    </div>

                    {/* Central Notes Timeline Stream */}
                    <div className="nn-notes-stream">
                        {notes.length === 0 ? (
                            <div className="nn-empty-state">
                                No nursing notes recorded yet for this patient. Add observation below.
                            </div>
                        ) : (
                            notes.map((item, idx) => (
                                <div key={idx} className="nn-note-bubble">
                                    <div className="nn-note-meta-row">
                                        <span className="nn-note-author">{item.author || 'Priya Sharma (Nurse)'}</span>
                                        <span className="nn-note-time"><FiClock /> {new Date(item.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p className="nn-note-text">{item.note}</p>
                                </div>
								))
                        )}
                    </div>

                    {/* Footer Interactive Text Input Bar */}
                    <form onSubmit={handleAddNote} className="nn-input-action-bar">
                        <input
                            type="text"
                            placeholder="Type shift observation note..."
                            className="nn-note-input-field"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={saving || !newNote.trim()}
                            className="nn-btn-submit"
                        >
                            <FiSend /> {saving ? 'Saving...' : 'Add Note'}
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default NursingNotesPage;