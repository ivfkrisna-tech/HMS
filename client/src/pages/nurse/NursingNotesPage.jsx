import React, { useState, useEffect } from 'react';
import { nurseAPI } from '../../utils/api';
import { FiFileText, FiUser, FiSend, FiClock } from 'react-icons/fi';
import './NurseDashboard.css';

const NursingNotesPage = () => {
    const [patients, setPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
        <div className="nurse-dashboard-container">
            <div className="nurse-page-header">
                <div>
                    <h2><FiFileText className="text-yellow-600" /> Nursing Clinical Notes</h2>
                    <p className="nurse-subtitle">Editable & version-safe shift logs accessible by doctors and lab staff</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left column: Patient selector */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-3">
                        <FiUser /> Select Active Patient
                    </label>
                    <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                        {patients.map(p => (
                            <button
                                key={p._id}
                                onClick={() => setSelectedPatientId(p._id)}
                                className={`text-left p-3 rounded-xl border transition flex flex-col gap-1 ${selectedPatientId === p._id ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-sm' : 'border-slate-100 hover:bg-slate-50 text-slate-700'}`}
                            >
                                <span className="text-sm font-semibold">{p.name}</span>
                                <span className="text-xs text-slate-500">{p.mrn} • {p.ward || 'General Ward'}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right column: Notes Feed & Input */}
                <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-[600px]">
                    <div>
                        <div className="pb-4 mb-4 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-slate-800 m-0">
                                    {selectedPatient ? selectedPatient.name : 'Select a patient'}
                                </h3>
                                <p className="text-xs text-slate-500 m-0 mt-1">
                                    {selectedPatient ? `${selectedPatient.mrn} • Under care of ${selectedPatient.doctorName}` : ''}
                                </p>
                            </div>
                            <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-bold">
                                Version Safe Log
                            </span>
                        </div>

                        {/* Notes feed */}
                        <div className="overflow-y-auto max-h-[380px] flex flex-col gap-4 pr-2">
                            {notes.length === 0 ? (
                                <div className="text-center py-16 text-slate-400 italic">
                                    No nursing notes recorded yet for this patient. Add observation below.
                                </div>
                            ) : (
                                notes.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-2">
                                        <div className="flex justify-between items-center text-xs text-slate-500">
                                            <span className="font-bold text-slate-700">{item.author || 'Priya Sharma (Nurse)'}</span>
                                            <span className="flex items-center gap-1"><FiClock /> {new Date(item.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-slate-800 text-sm m-0 leading-relaxed font-medium">{item.note}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Note input */}
                    <form onSubmit={handleAddNote} className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
                        <input
                            type="text"
                            placeholder="Type shift observation note..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={saving || !newNote.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition disabled:opacity-50 shadow-md shadow-blue-600/20"
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
