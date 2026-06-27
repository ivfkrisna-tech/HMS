import React, { useState, useEffect } from 'react';
import { nurseAPI } from '../../utils/api';
import { FiActivity, FiUser, FiSave, FiCheckCircle } from 'react-icons/fi';
import './NurseDashboard.css';

const NurseVitalsEntry = () => {
    const [patients, setPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [vitalsForm, setVitalsForm] = useState({
        weight: '', height: '', bmi: '', bp: '', pulse: '', temp: '', spo2: '', respRate: '', chiefComplaint: '', nurseNotes: ''
    });

    useEffect(() => {
        fetchPatients();
    }, []);

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
            console.error("Error fetching patients for vitals:", error);
        } finally {
            setLoading(false);
        }
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
            alert("Vitals & shift observations recorded successfully into patient database!");
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
        <div className="nurse-dashboard-container">
            <div className="nurse-page-header">
                <div>
                    <h2><FiActivity className="text-red-500" /> Clinical Vitals Entry</h2>
                    <p className="nurse-subtitle">Record active shift vitals & observations directly into patient history</p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto bg-slate-900 text-slate-100 rounded-2xl p-8 shadow-xl border border-slate-800">
                <div className="flex justify-between items-center pb-6 mb-6 border-b border-slate-800">
                    <div>
                        <h3 className="text-xl font-extrabold flex items-center gap-2 m-0 text-white">
                            🩺 Record Patient Vitals
                        </h3>
                        <p className="text-xs text-slate-400 m-0 mt-1">
                            Select patient and enter standard measurement parameters
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-8 text-slate-400">Loading active patients...</div>
                ) : (
                    <form onSubmit={handleSaveVitals}>
                        <div className="vitals-form-group mb-6">
                            <label className="text-slate-300"><FiUser /> Select Patient</label>
                            <select
                                className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-white font-medium outline-none focus:border-blue-500"
                                value={selectedPatientId}
                                onChange={(e) => setSelectedPatientId(e.target.value)}
                            >
                                {patients.map(p => (
                                    <option key={p._id} value={p._id}>
                                        {p.name} ({p.mrn}) — {p.ward || 'General Ward'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedPatient && (
                            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 mb-6 text-xs flex justify-between text-slate-300">
                                <span>Doctor: <strong className="text-white">{selectedPatient.doctorName}</strong></span>
                                <span>Age/Gender: <strong className="text-white">{selectedPatient.age} yrs / {selectedPatient.gender}</strong></span>
                                <span>Location: <strong className="text-blue-400">{selectedPatient.ward} / {selectedPatient.bed}</strong></span>
                            </div>
                        )}

                        <div className="vitals-grid-2">
                            <div className="vitals-form-group">
                                <label>Weight (kg)</label>
                                <input
                                    type="number" step="0.1"
                                    placeholder="e.g. 65"
                                    value={vitalsForm.weight}
                                    onChange={(e) => handleVitalsChange('weight', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Height (cm)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 165"
                                    value={vitalsForm.height}
                                    onChange={(e) => handleVitalsChange('height', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>BMI (auto-calc)</label>
                                <input
                                    type="text" readOnly
                                    value={vitalsForm.bmi}
                                    placeholder="23.9"
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Blood Pressure</label>
                                <input
                                    type="text"
                                    placeholder="120/80"
                                    value={vitalsForm.bp}
                                    onChange={(e) => handleVitalsChange('bp', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Pulse Rate (bpm)</label>
                                <input
                                    type="number"
                                    placeholder="74"
                                    value={vitalsForm.pulse}
                                    onChange={(e) => handleVitalsChange('pulse', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Temperature (°F)</label>
                                <input
                                    type="text"
                                    placeholder="98.6"
                                    value={vitalsForm.temp}
                                    onChange={(e) => handleVitalsChange('temp', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>SpO₂ Oxygen (%)</label>
                                <input
                                    type="text"
                                    placeholder="98%"
                                    value={vitalsForm.spo2}
                                    onChange={(e) => handleVitalsChange('spo2', e.target.value)}
                                />
                            </div>
                            <div className="vitals-form-group">
                                <label>Respiratory Rate</label>
                                <input
                                    type="text"
                                    placeholder="18"
                                    value={vitalsForm.respRate}
                                    onChange={(e) => handleVitalsChange('respRate', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="vitals-form-group my-4">
                            <label>Chief Complaint / Symptoms</label>
                            <input
                                type="text"
                                placeholder="Patient reporting headache or fatigue..."
                                value={vitalsForm.chiefComplaint}
                                onChange={(e) => handleVitalsChange('chiefComplaint', e.target.value)}
                            />
                        </div>

                        <div className="vitals-form-group mb-6">
                            <label>Nursing Shift Observations</label>
                            <textarea
                                rows={3}
                                placeholder="Enter clinical shift notes..."
                                value={vitalsForm.nurseNotes}
                                onChange={(e) => handleVitalsChange('nurseNotes', e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-800">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-blue-600/20"
                            >
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
