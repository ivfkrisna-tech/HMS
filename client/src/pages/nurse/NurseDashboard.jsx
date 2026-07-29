import React, { useState, useMemo } from 'react';
import { Search, User, Phone, Activity, Heart, Thermometer, Droplet, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const mockPatients = [
  { id: 'PT-1001', name: 'Rahul Sharma', age: 45, gender: 'Male', phone: '9876543210', status: 'Awaiting Prescription', priority: 'Urgent' },
  { id: 'PT-1002', name: 'Priya Patel', age: 32, gender: 'Female', phone: '9876543211', status: 'Awaiting Prescription', priority: 'Routine' },
  { id: 'PT-1003', name: 'Amit Kumar', age: 28, gender: 'Male', phone: '9876543212', status: 'Awaiting Prescription', priority: 'Follow-up' },
  { id: 'PT-1004', name: 'Sneha Gupta', age: 50, gender: 'Female', phone: '9876543213', status: 'Admitted', priority: 'Routine' },
];

const NurseDashboard = () => {
  // --- Section 1: Patient Queue State ---
  const [queueSearchTerm, setQueueSearchTerm] = useState('');
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [selectedPatientForPrescription, setSelectedPatientForPrescription] = useState(null);

  // --- Section 2: Nursing Notes State ---
  const [notesSearchTerm, setNotesSearchTerm] = useState('');
  const [selectedPatientForNotes, setSelectedPatientForNotes] = useState(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [vitals, setVitals] = useState({ bp: '', pulse: '', temp: '', spo2: '' });
  const [comments, setComments] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  // --- Memoized Filters (Optimized Search) ---
  const filteredQueue = useMemo(() => {
    const term = queueSearchTerm.toLowerCase();
    // Show ALL patients regardless of status (removed awaiting limit)
    return mockPatients.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term) ||
      p.phone.includes(term)
    );
  }, [queueSearchTerm]);

  const filteredForNotes = useMemo(() => {
    const term = notesSearchTerm.toLowerCase();
    return mockPatients.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term) ||
      p.phone.includes(term)
    );
  }, [notesSearchTerm]);

  // --- Handlers ---
  const handleGivePrescription = (patient) => {
    setSelectedPatientForPrescription(patient);
    setShowPrescriptionModal(true);
  };

  const handleSelectPatientForNotes = (patient) => {
    setSelectedPatientForNotes(patient);
    setNotesSearchTerm(''); // Clear search term after selection
    setShowPatientDropdown(false);
    setSaveMessage('');
  };

  const handleSaveNotes = () => {
    if (!selectedPatientForNotes) return;
    
    // Trigger Save Action (Simulated API Call)
    console.log("Saving notes for", selectedPatientForNotes.name, vitals, comments);
    setSaveMessage('Notes saved successfully!');
    
    // Clear the selection & show success message temporarily
    setTimeout(() => {
      setSelectedPatientForNotes(null);
      setVitals({ bp: '', pulse: '', temp: '', spo2: '' });
      setComments('');
      setSaveMessage('');
    }, 3000);
  };

  // Helper for priority badges
  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'Urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'Routine': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Follow-up': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Nurse Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage patient queue and clinical notes efficiently.</p>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
            <User className="text-emerald-600 w-5 h-5" />
            <span className="font-semibold text-slate-700">Staff Nurse</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ========================================================= */}
          {/* SECTION 1: Patient Queue & Prescription Search */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[700px]">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  All Patients Queue
                </h2>
                <span className="bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-bold">
                  {filteredQueue.length} Patients
                </span>
              </div>
              
              {/* Live Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search by Name, Phone, or ID..."
                  value={queueSearchTerm}
                  onChange={(e) => setQueueSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-700 shadow-sm placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                  <AlertCircle className="w-12 h-12 text-slate-300" />
                  <p className="text-lg">No patients found</p>
                </div>
              ) : (
                filteredQueue.map(patient => (
                  <div key={patient.id} className="group p-4 bg-white border border-slate-200 hover:border-indigo-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 text-lg">{patient.name}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getPriorityColor(patient.priority)}`}>
                            {patient.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1 font-medium"><User className="w-4 h-4" /> {patient.id}</span>
                          <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {patient.phone}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleGivePrescription(patient)}
                        className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm border border-indigo-200 hover:border-indigo-600"
                      >
                        Give Prescription
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: Nursing Notes */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[700px]">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-emerald-500" />
                Nursing Notes
              </h2>

              {/* Patient Lookup Dropdown */}
              {!selectedPatientForNotes && (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Search patient to add notes..."
                      value={notesSearchTerm}
                      onChange={(e) => {
                        setNotesSearchTerm(e.target.value);
                        setShowPatientDropdown(true);
                      }}
                      onFocus={() => setShowPatientDropdown(true)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-700 shadow-sm"
                    />
                  </div>
                  
                  {showPatientDropdown && notesSearchTerm && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {filteredForNotes.length === 0 ? (
                        <div className="p-4 text-slate-500 text-center">No matching patients</div>
                      ) : (
                        filteredForNotes.map(patient => (
                          <div 
                            key={patient.id} 
                            onClick={() => handleSelectPatientForNotes(patient)}
                            className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors"
                          >
                            <div>
                              <p className="font-bold text-slate-800">{patient.name}</p>
                              <p className="text-xs text-slate-500">{patient.id} • {patient.age}y {patient.gender}</p>
                            </div>
                            <span className="text-emerald-600 text-sm font-semibold opacity-0 group-hover:opacity-100">Select</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Locked Patient Details */}
              {selectedPatientForNotes && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-lg">
                      {selectedPatientForNotes.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{selectedPatientForNotes.name}</p>
                      <p className="text-sm text-slate-600">{selectedPatientForNotes.id} • {selectedPatientForNotes.age} yrs • {selectedPatientForNotes.gender}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedPatientForNotes(null)}
                    className="text-slate-400 hover:text-red-500 transition-colors text-sm font-medium"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Notes Form */}
            <div className="flex-1 overflow-y-auto p-6 bg-white relative">
              {!selectedPatientForNotes ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                  <Activity className="w-16 h-16 text-slate-200 mb-4" />
                  <p className="text-lg font-medium text-slate-500">Select a patient to begin</p>
                  <p className="text-sm">Search and select a patient from the input above.</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  
                  {/* Vitals Grid */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Vitals Record</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Heart className="w-4 h-4 text-rose-500"/> Blood Pressure</label>
                        <div className="relative">
                          <input type="text" placeholder="120/80" value={vitals.bp} onChange={e=>setVitals({...vitals, bp: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none pr-12" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">mmHg</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Activity className="w-4 h-4 text-orange-500"/> Pulse Rate</label>
                        <div className="relative">
                          <input type="number" placeholder="72" value={vitals.pulse} onChange={e=>setVitals({...vitals, pulse: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none pr-10" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">bpm</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Thermometer className="w-4 h-4 text-red-500"/> Temperature</label>
                        <div className="relative">
                          <input type="number" placeholder="98.6" value={vitals.temp} onChange={e=>setVitals({...vitals, temp: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none pr-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">°F</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Droplet className="w-4 h-4 text-blue-500"/> SpO2</label>
                        <div className="relative">
                          <input type="number" placeholder="98" value={vitals.spo2} onChange={e=>setVitals({...vitals, spo2: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none pr-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* General Comments */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Nursing Observations</h3>
                    <textarea 
                      rows="4" 
                      placeholder="Enter clinical notes, patient complaints, or general observations..."
                      value={comments}
                      onChange={e=>setComments(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    ></textarea>
                  </div>

                  {/* Actions & Feedback */}
                  <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                    {saveMessage ? (
                      <div className="flex items-center gap-2 text-emerald-600 font-semibold animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-5 h-5" />
                        {saveMessage}
                      </div>
                    ) : <div></div>}
                    
                    <button 
                      onClick={handleSaveNotes}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Save Notes
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>

      {/* Prescription Modal Placeholder */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Add Prescription Details</h2>
              <button onClick={() => setShowPrescriptionModal(false)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4">Prescription form for <span className="font-bold text-slate-800">{selectedPatientForPrescription?.name}</span> ({selectedPatientForPrescription?.id})</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Medication Name</label>
                  <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Paracetamol" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Dosage</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 500mg" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Frequency</label>
                    <select className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                      <option>1-0-1 (BD)</option>
                      <option>1-1-1 (TDS)</option>
                      <option>1-0-0 (OD)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowPrescriptionModal(false)} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => setShowPrescriptionModal(false)} className="px-6 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NurseDashboard;
