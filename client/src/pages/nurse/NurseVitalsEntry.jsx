import React, { useState, useEffect, useRef } from 'react';
import { nurseAPI } from '../../utils/api';
import { FiActivity, FiSave, FiSearch, FiX, FiUser, FiChevronDown } from 'react-icons/fi';
import './NurseDashboard.css';
import './NurseVitalsEntry.css';

const NurseVitalsEntry = () => {
    const [patients, setPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Smart search states
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef(null);

    const [vitalsForm, setVitalsForm] = useState({
        weight: '', height: '', bmi: '', bp: '', pulse: '', temp: '', spo2: '', respRate: '', chiefComplaint: '', nurseNotes: ''
    });

    useEffect(() => {
        fetchPatients();
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const fetchPatients = async () => {
        try {
            const res = await nurseAPI.getPatients();
            if (res && res.patients) {
                setPatients(res.patients);
                if (res.patients.length > 0) {
                    const first = res.patients[0];
                    setSelectedPatientId(first._id);
                    setSearchQuery(`${first.name} (${first.mrn || 'N/A'})`);
                }
            }
        } catch (error) {
            console.error("Error fetching patients for vitals:", error);
        } finally {
            setLoading(false);
        }
    };

    // Multi-field fuzzy filter: name, mrn, phone/mobile
    const filteredPatients = patients.filter(p => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const name     = (p.name || p.fullName || '').toLowerCase();
        const mrn      = (p.mrn || '').toLowerCase();
        const phone    = (p.phone || p.mobile || '').toLowerCase();
        return name.includes(q) || mrn.includes(q) || phone.includes(q);
    });

    const handleSelectPatient = (patient) => {
        setSelectedPatientId(patient._id);
        setSearchQuery(`${patient.name} (${patient.mrn || 'N/A'})`);
        setIsOpen(false);
    };

    const handleSearchInput = (e) => {
        setSearchQuery(e.target.value);
        setIsOpen(true);
        // Clear selection if user clears the field
        if (!e.target.value.trim()) setSelectedPatientId('');
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setSelectedPatientId('');
        setIsOpen(false);
    };

    const calculateBMI = (w, h) => {
        if (!w || !h) return '';
        const htInM = parseFloat(h) / 100;
        if (htInM <= 0) return '';
        const bmiVal = parseFloat(w) / (htInM * htInM);
        return isNaN(bmiVal) ? '' : bmiVal.toFixed(1);
    };

    const handleVitalsChange = (field, val) => {
        setVitalsForm(prev => {
            const updated = { ...prev, [field]: val };
            if (field === 'weight' || field === 'height') {
                updated.bmi = calculateBMI(updated.weight, updated.height);
            }
            return updated;
        });
    };

    const handleSaveVitals = async (e) => {
        e.preventDefault();
        if (!selectedPatientId) {
            alert("Please select a patient first.");
            return;
        }
        setSaving(true);
        try {
            await nurseAPI.recordVitals({
                patientId: selectedPatientId,
                ...vitalsForm
            });
            alert("Vitals recorded successfully!");
            setVitalsForm({
                weight: '', height: '', bmi: '', bp: '', pulse: '', temp: '', spo2: '', respRate: '', chiefComplaint: '', nurseNotes: ''
            });
        } catch (error) {
            alert("Error saving vitals: " + (error.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const selectedPatient = patients.find(p => p._id === selectedPatientId);

    return (
        <div className="nv-dashboard-container">
            <div className="nv-page-header">
                <div className="nv-header-title-area">
                    <h2><FiActivity className="nv-activity-icon" /> Clinical Vitals Entry</h2>
                    <p className="nv-subtitle">Record active shift vitals &amp; observations directly into patient history</p>
                </div>
            </div>

            <div className="nv-dark-card">
                <div className="nv-card-header">
                    <div>
                        <h3>🩺 Record Patient Vitals</h3>
                        <p className="nv-card-meta">Search patient by name, MRN, or phone — then enter standard measurements</p>
                    </div>
                </div>

                {loading ? (
                    <div className="nv-loading-text">Loading active patients...</div>
                ) : (
                    <form onSubmit={handleSaveVitals}>

                        {/* ── Smart Search Patient Selector ── */}
                        <div className="nv-form-group full-width mb-4" ref={searchRef} style={{ position: 'relative' }}>
                            <label className="nv-smart-search-label">
                                <FiUser style={{ color: '#12b787' }} />
                                SELECT PATIENT&nbsp;
                                <span style={{ color: '#475569', fontWeight: 400, textTransform: 'none', fontSize: '0.68rem' }}>
                                    — search by Name, MRN, or Phone
                                </span>
                            </label>
                            <div className="nv-search-field-wrap">
                                <FiSearch className="nv-search-icon-left" />
                                <input
                                    type="text"
                                    className="nv-smart-search-input"
                                    placeholder="Search patient name, MRN, phone..."
                                    value={searchQuery}
                                    onChange={handleSearchInput}
                                    onFocus={() => setIsOpen(true)}
                                    autoComplete="off"
                                />
                                {searchQuery ? (
                                    <button
                                        type="button"
                                        className="nv-search-clear-btn"
                                        onClick={handleClearSearch}
                                        title="Clear selection"
                                    >
                                        <FiX />
                                    </button>
                                ) : (
                                    <FiChevronDown className="nv-search-chevron" />
                                )}
                            </div>

                            {/* Custom dropdown overlay */}
                            {isOpen && (
                                <div className="nv-search-dropdown">
                                    {filteredPatients.length === 0 ? (
                                        <div className="nv-search-empty">
                                            <span>😕</span> No patients match "<strong>{searchQuery}</strong>"
                                        </div>
                                    ) : (
                                        filteredPatients.map(p => (
                                            <div
                                                key={p._id}
                                                className={`nv-search-item ${p._id === selectedPatientId ? 'nv-search-item--active' : ''}`}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleSelectPatient(p);
                                                }}
                                            >
                                                <div className="nv-search-item-avatar">
                                                    {(p.name || 'P').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="nv-search-item-info">
                                                    <div className="nv-search-item-name">{p.name}</div>
                                                    <div className="nv-search-item-meta">
                                                        <span className="nv-meta-pill nv-meta-mrn">MRN: {p.mrn || 'N/A'}</span>
                                                        {(p.phone || p.mobile) && (
                                                            <span className="nv-meta-pill nv-meta-phone">📞 {p.phone || p.mobile}</span>
                                                        )}
                                                        {p.ward && (
                                                            <span className="nv-meta-pill nv-meta-ward">🏥 {p.ward}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {p._id === selectedPatientId && (
                                                    <div className="nv-search-item-check">✓</div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected patient context badge */}
                        {selectedPatient && (
                            <div className="nv-patient-badge-row">
                                <span>Doctor: <strong>{selectedPatient.doctorName || '—'}</strong></span>
                                <span>Age/Gender: <strong>{selectedPatient.age} yrs / {selectedPatient.gender}</strong></span>
                                <span>Location: <strong className="nv-text-highlight">{selectedPatient.ward} / {selectedPatient.bed}</strong></span>
                            </div>
                        )}

                        {/* Vitals Grid */}
                        <div className="nv-vitals-grid">
                            <div className="nv-form-group">
                                <label>⚖️ WEIGHT (KG)</label>
                                <input type="number" step="0.1" placeholder="e.g. 65" value={vitalsForm.weight} onChange={(e) => handleVitalsChange('weight', e.target.value)} />
                            </div>
                            <div className="nv-form-group">
                                <label>📏 HEIGHT (CM)</label>
                                <input type="number" placeholder="e.g. 165" value={vitalsForm.height} onChange={(e) => handleVitalsChange('height', e.target.value)} />
                            </div>
                            <div className="nv-form-group">
                                <label>📊 BMI (AUTO-CALC)</label>
                                <input type="text" className="nv-readonly-field" readOnly value={vitalsForm.bmi} placeholder="23.9" />
                            </div>
                            <div className="nv-form-group">
                                <label>🩸 BLOOD PRESSURE</label>
                                <input type="text" placeholder="120/80" value={vitalsForm.bp} onChange={(e) => handleVitalsChange('bp', e.target.value)} />
                            </div>
                            <div className="nv-form-group">
                                <label>💓 PULSE RATE (BPM)</label>
                                <input type="number" placeholder="74" value={vitalsForm.pulse} onChange={(e) => handleVitalsChange('pulse', e.target.value)} />
                            </div>
                            <div className="nv-form-group">
                                <label>🌡️ TEMPERATURE (°F)</label>
                                <input type="text" placeholder="98.6" value={vitalsForm.temp} onChange={(e) => handleVitalsChange('temp', e.target.value)} />
                            </div>
                            <div className="nv-form-group">
                                <label>🫁 SPO₂ OXYGEN (%)</label>
                                <input type="text" placeholder="98%" value={vitalsForm.spo2} onChange={(e) => handleVitalsChange('spo2', e.target.value)} />
                            </div>
                            <div className="nv-form-group">
                                <label>😮 RESPIRATORY RATE</label>
                                <input type="text" placeholder="18" value={vitalsForm.respRate} onChange={(e) => handleVitalsChange('respRate', e.target.value)} />
                            </div>
                        </div>

                        {/* Full Width Notes */}
                        <div className="nv-form-group full-width mt-2">
                            <label>📋 CHIEF COMPLAINT / SYMPTOMS</label>
                            <textarea rows={2} placeholder="Patient reporting headache or fatigue..." value={vitalsForm.chiefComplaint} onChange={(e) => handleVitalsChange('chiefComplaint', e.target.value)} />
                        </div>

                        <div className="nv-form-group full-width mt-2 mb-3">
                            <label>📝 NURSING SHIFT OBSERVATIONS</label>
                            <textarea rows={2} placeholder="Enter clinical shift notes..." value={vitalsForm.nurseNotes} onChange={(e) => handleVitalsChange('nurseNotes', e.target.value)} />
                        </div>

                        <div className="nv-card-footer">
                            <button type="submit" disabled={saving} className="nv-btn-save">
                                <FiSave /> {saving ? 'Recording...' : 'Save Vitals into Database'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default NurseVitalsEntry;