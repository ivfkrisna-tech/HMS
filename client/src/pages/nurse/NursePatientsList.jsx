import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nurseAPI } from '../../utils/api';
import { FiUsers, FiSearch } from 'react-icons/fi';
import './NurseDashboard.css';

const NursePatientsList = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const res = await nurseAPI.getPatients();
            if (res && res.patients) {
                setPatients(res.patients);
            } else if (Array.isArray(res)) {
                setPatients(res);
            }
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPatients = patients
        .filter(p => p && (p.status === 'admitted' || p.isAdmitted || p.hasActiveMedication)) // ── CLINICAL SAFETY GUARDRAIL ──
        .filter(p => {
            const query = searchTerm.toLowerCase();
            return (p.name || '').toLowerCase().includes(query) ||
                   (p.mrn || '').toLowerCase().includes(query) ||
                   (p.coupleId || '').toLowerCase().includes(query) ||
                   (p.doctorName || '').toLowerCase().includes(query) ||
                   (p.ward || '').toLowerCase().includes(query);
        });

    return (
        <div className="nurse-dashboard-container">
            {/* Page Header */}
            <div className="nurse-page-header">
                <div>
                    <h2><FiUsers className="text-blue-600" /> My Patients</h2>
                    <p className="nurse-subtitle">
                        {loading ? 'Loading patients...' : `${filteredPatients.length} Patients under your care today`}
                    </p>
                </div>
                <div className="nurse-search-bar">
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by Name, MRN or Couple ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Patients List */}
            {loading ? (
                <div className="p-8 text-center text-gray-500">Loading active patient queue...</div>
            ) : filteredPatients.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-500 font-medium">No active patients found matching your query.</p>
                </div>
            ) : (
                <div className="nurse-patients-list">
                    {filteredPatients.map((patient) => (
                        <div
                            key={patient._id}
                            className="nurse-patient-card"
                            onClick={() => navigate(`/nurse/patient/${patient._id}`)}
                        >
                            <div className="patient-card-left">
                                <div className="patient-avatar-circle">
                                    {patient.name ? patient.name.charAt(0).toUpperCase() : 'P'}
                                </div>
                                <div className="patient-info">
                                    <h4>{patient.name}</h4>
                                    <p>
                                        <span className="font-semibold text-gray-700">{patient.mrn}</span> {patient.coupleId && patient.coupleId !== 'N/A' ? `• Couple ID: ${patient.coupleId}` : ''} • {patient.doctorName || 'Assigned Doctor'} • <span className="text-blue-600 font-medium">{patient.ward || 'General Ward'} / {patient.bed || 'Unassigned'}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="patient-card-right">
                                <span className={`badge-pill ${patient.vitalsStatus === 'Critical' ? 'badge-critical' : 'badge-stable'}`}>
                                    {patient.vitalsStatus || 'Stable'}
                                </span>
                                {!patient.hasPrescription ? (
                                    <span className="badge-pill bg-slate-100 text-slate-500 border border-slate-200 font-medium">
                                        No Prescription Yet
                                    </span>
                                ) : patient.pendingDosesCount > 0 ? (
                                    <span className="badge-pill badge-pending">
                                        Pending Doses: {patient.pendingDosesCount}
                                    </span>
                                ) : (
                                    <span className="badge-pill badge-given">
                                        All Given
                                    </span>
                                )}
                                <span className="card-arrow">&rsaquo;</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NursePatientsList;
