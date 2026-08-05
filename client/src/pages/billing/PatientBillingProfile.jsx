import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingAPI, admissionAPI, financeAPI } from '../../utils/api';
import './PatientBillingProfile.css';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isPaid = (status) => (status || '').toLowerCase() === 'paid';
const isPending = (status) => !isPaid(status);

const PatientBillingProfile = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [patient, setPatient] = useState(null);
    const [billing, setBilling] = useState(null);
    const [selected, setSelected] = useState({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [], packages: [] });
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [labDiscounts, setLabDiscounts] = useState({});
    const [paying, setPaying] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [dischargingId, setDischargingId] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [discount, setDiscount] = useState(0);
    
    // Edit Facility Charge State
    const [editingCharge, setEditingCharge] = useState(null);
    const [editChargeForm, setEditChargeForm] = useState({ pricePerDay: '', days: '', facilityName: '' });

    // Financial Stats Dashboard State
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [datePreset, setDatePreset] = useState('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const fetchStats = async (preset = datePreset, start = customStartDate, end = customEndDate) => {
        try {
            setStatsLoading(true);
            let queryStart = '';
            let queryEnd = '';

            if (preset !== 'all' && preset !== 'custom') {
                const now = new Date();
                const endD = new Date(now);
                const startD = new Date(now);

                if (preset === 'today') {
                    startD.setHours(0, 0, 0, 0);
                    endD.setHours(23, 59, 59, 999);
                } else if (preset === '30') {
                    startD.setDate(startD.getDate() - 30);
                } else if (preset === '60') {
                    startD.setDate(startD.getDate() - 60);
                } else if (preset === '90') {
                    startD.setDate(startD.getDate() - 90);
                }

                queryStart = startD.toISOString();
                queryEnd = endD.toISOString();
            } else if (preset === 'custom') {
                if (start) queryStart = new Date(start).toISOString();
                if (end) queryEnd = new Date(end).toISOString();
            }

            const res = await financeAPI.getDashboardStats(queryStart, queryEnd);
            if (res.success) {
                setStats(res.data);
            }
        } catch (err) {
            console.error('Error fetching financial statistics', err);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        fetchStats('today');
    }, []);

    const handleDatePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            fetchStats(preset, customStartDate, customEndDate);
        }
    };

    const handleApplyCustomDate = () => {
        fetchStats('custom', customStartDate, customEndDate);
    };

    const handleSearchChange = async (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        if (val.length < 2) { setSearchResults([]); return; }
        try {
            const res = await billingAPI.searchPatients(val);
            if (res.success) setSearchResults(res.patients);
        } catch (err) { console.error(err); }
    };

    const calcDays = (adm) => {
        if (!adm.admissionDate && !adm.createdAt) return 1;
        const start = new Date(adm.admissionDate || adm.createdAt).getTime();
        const end = (adm.status === 'Discharged' && adm.dischargeDate) 
            ? new Date(adm.dischargeDate).getTime() 
            : Date.now();
        return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    };

    const enrichAdmissions = (admissions) => admissions.map(adm => {
        // Recalculate days and totals dynamically to prevent stale data
        if (isPending(adm.paymentStatus)) {
            const diffDays = calcDays(adm);
            let grandTotal = 0;
            adm.selectedFacilities = (adm.selectedFacilities || []).map(f => {
                // Check if a manual days field exists and is > 0. Use it directly! 
                // Only fall back to timestamp calculation if no manual days provided.
                const manualDays = Number(f.days || 0);
                const actualDays = manualDays > 0 ? manualDays : diffDays;
                
                const fTotal = actualDays * Number(f.pricePerDay || 0);
                grandTotal += fTotal;
                return { ...f, days: actualDays, totalAmount: fTotal };
            });
            adm.totalAmount = grandTotal;
        }
        return adm;
    });

    // For pending FacilityCharge records, recalculate total using actual admission days.
    // If patient is currently admitted, use days-since-admission; otherwise use stored days.
    const enrichFacilityCharges = (facilityCharges, enrichedAdmissions) => {
        const activeAdm = enrichedAdmissions.find(a => a.status === 'Admitted');
        if (!activeAdm) return facilityCharges;
        const admissionDays = calcDays(activeAdm);
        return facilityCharges.map(fc => {
            if (isPending(fc.paymentStatus)) {
                const manualDays = Number(fc.days || 0);
                const actualDays = manualDays > 0 ? manualDays : admissionDays;
                return { ...fc, days: actualDays, totalAmount: Number(fc.pricePerDay || 0) * actualDays };
            }
            return fc;
        });
    };

    const loadPatient = async (identifier) => {
        setLoading(true);
        setError('');
        setPatient(null);
        setBilling(null);
        setSelected({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [], packages: [] });
        setSuccessMsg('');
        try {
            const res = await billingAPI.getPatientBills(identifier);
            console.log('--- DIAGNOSTIC: FRONTEND BILLING FETCH ---');
            console.log('FULL BILLING API RESPONSE:', res);
            console.log('ADMISSIONS ARRAY:', res.billing?.admissions);
            
            if (res.success) {
                setPatient(res.patient);
                const enrichedAdmissions = enrichAdmissions(res.billing.admissions || []);
                const enrichedFacility = enrichFacilityCharges(res.billing.facilityCharges || [], enrichedAdmissions);
                setBilling({ ...res.billing, admissions: enrichedAdmissions, facilityCharges: enrichedFacility });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Patient not found');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPatient = (p) => {
        setSearchQuery(p.mrn || p.phone || p.name);
        setSearchResults([]);
        loadPatient(p._id);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearchResults([]);
        loadPatient(searchQuery.trim());
    };

    const toggle = (category, id) => {
        setSelected(prev => ({
            ...prev,
            [category]: prev[category].includes(id)
                ? prev[category].filter(x => x !== id)
                : [...prev[category], id]
        }));
    };

    const toggleAll = (category, ids) => {
        setSelected(prev => {
            const allSelected = ids.every(id => prev[category].includes(id));
            return { ...prev, [category]: allSelected ? [] : ids };
        });
    };

    const pendingTotal = () => {
        if (!billing) return 0;
        let t = 0;
        (billing.appointments || []).filter(a => isPending(a.paymentStatus)).forEach(a => t += (a.amount || 0));
        (billing.labReports || []).filter(l => isPending(l.paymentStatus)).forEach(l => t += ((l.amount || l.price || 0) + (l.sgst || 0) + (l.cgst || 0)));
        (billing.packages || []).filter(p => isPending(p.paymentStatus)).forEach(p => t += (p.finalAmount || p.totalAmount || 0));
        return t;
    };

    const paidTotal = () => {
        if (!billing) return 0;
        let t = 0;
        (billing.appointments || []).filter(a => isPaid(a.paymentStatus)).forEach(a => t += (a.amount || 0));
        (billing.labReports || []).filter(l => isPaid(l.paymentStatus)).forEach(l => t += ((l.amount || l.price || 0) + (l.sgst || 0) + (l.cgst || 0)));
        (billing.packages || []).filter(p => isPaid(p.paymentStatus)).forEach(p => t += (p.finalAmount || p.totalAmount || 0));
        return t;
    };

    const totalSelected = () => {
        if (!billing) return 0;
        let t = 0;
        (billing.appointments || []).filter(a => selected.appointments.includes(a._id)).forEach(a => t += (a.amount || 0));
        (billing.labReports || []).filter(l => selected.labReports.includes(l._id)).forEach(l => {
            const amount = (l.amount || l.price || 0) + (l.sgst || 0) + (l.cgst || 0);
            const discount = Number(labDiscounts[l._id]) || 0;
            t += Math.max(0, amount - discount);
        });
        (billing.packages || []).filter(p => selected.packages.includes(p._id)).forEach(p => t += (p.finalAmount || p.totalAmount || 0));
        return t;
    };

    const downloadReceipt = (itemsObj, isFull = false) => {
        if (!patient || !billing) return;
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text("Payment Receipt", 105, 20, { align: "center" });
        
        doc.setFontSize(12);
        doc.text(`Patient Name: ${patient.name}`, 14, 40);
        doc.text(`MRN: ${patient.mrn || patient.patientId || 'N/A'}`, 14, 48);
        doc.text(`Phone: ${patient.phone || 'N/A'}`, 14, 56);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 40);

        const tableBody = [];
        let totalAmt = 0;

        // Appointments
        (billing.appointments || []).forEach(a => {
            if (isFull ? isPaid(a.paymentStatus) : (itemsObj && itemsObj.appointments.includes(a._id))) {
                tableBody.push(['Consultation', `${fmtDate(a.appointmentDate)} - ${a.doctorName || 'N/A'}`, fmt(a.amount)]);
                totalAmt += (a.amount || 0);
            }
        });

        // Packages
        (billing.packages || []).forEach(p => {
            if (isFull ? isPaid(p.paymentStatus) : (itemsObj && itemsObj.packages.includes(p._id))) {
                tableBody.push(['Package', p.packageName, fmt(p.finalAmount || p.totalAmount)]);
                totalAmt += (p.finalAmount || p.totalAmount || 0);
            }
        });

        // Lab Reports
        (billing.labReports || []).forEach(l => {
            if (isFull ? isPaid(l.paymentStatus) : (itemsObj && itemsObj.labReports.includes(l._id))) {
                const amt = (l.amount || l.price || 0) + (l.sgst || 0) + (l.cgst || 0);
                const lDiscount = isFull ? (l.discount || 0) : (Number(labDiscounts[l._id]) || 0);
                const finalAmt = Math.max(0, amt - lDiscount);
                tableBody.push(['Lab Test', Array.isArray(l.testNames) ? l.testNames.join(', ') : (l.testName || 'N/A'), fmt(finalAmt)]);
                totalAmt += finalAmt;
            }
        });

        if (tableBody.length === 0) {
            if (isFull) alert("No paid bills available to download.");
            return;
        }

        autoTable(doc, {
            startY: 70,
            head: [['Category', 'Details', 'Amount']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [20, 184, 166] }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.text(`Total Paid: ${fmt(totalAmt)}`, 14, finalY);
        
        if (!isFull) {
            doc.text(`Payment Mode: ${paymentMode}`, 14, finalY + 8);
        }

        doc.save(`${patient.name.replace(/\s+/g, '_')}_Receipt.pdf`);
    };

    const handlePay = async () => {
        const total = totalSelected();
        if (total === 0) return alert('Select at least one pending item to pay.');
        if (!window.confirm(`Process payment of ${fmt(total)} via ${paymentMode}?`)) return;
        setPaying(true);
        try {
            await billingAPI.processPayment({
                appointmentIds: selected.appointments,
                labReportIds: selected.labReports,
                labDiscounts,
                packageIds: selected.packages,
                paymentMode
            });
            setSuccessMsg(`Payment of ${fmt(total)} processed successfully via ${paymentMode}.`);

            const res = await billingAPI.getPatientBills(patient._id);
            if (res.success) {
                const ea = enrichAdmissions(res.billing.admissions || []);
                setBilling({ ...res.billing, admissions: ea, facilityCharges: enrichFacilityCharges(res.billing.facilityCharges || [], ea) });
            }
            setSelected({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [], packages: [] });
        } catch (err) {
            alert(err.response?.data?.message || 'Payment failed');
        } finally {
            setPaying(false);
        }
    };

    const handleDischarge = async (admissionId) => {
        if (!window.confirm('Discharge this patient?')) return;
        setDischargingId(admissionId);
        try {
            await admissionAPI.dischargePatient(admissionId);
            const res = await billingAPI.getPatientBills(patient._id);
            if (res.success) {
                const ea = enrichAdmissions(res.billing.admissions || []);
                setBilling({ ...res.billing, admissions: ea, facilityCharges: enrichFacilityCharges(res.billing.facilityCharges || [], ea) });
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Discharge failed');
        } finally {
            setDischargingId(null);
        }
    };

    const handleEditCharge = async (e) => {
        e.preventDefault();
        if (!editingCharge) return;
        try {
            const res = await billingAPI.editFacilityCharge(editingCharge._id, {
                pricePerDay: editChargeForm.pricePerDay,
                days: editChargeForm.days,
                facilityName: editChargeForm.facilityName
            });
            if (res.success) {
                setEditingCharge(null);
                // Refresh billing data
                const refreshRes = await billingAPI.getPatientBills(patient._id);
                if (refreshRes.success) {
                    const ea = enrichAdmissions(refreshRes.billing.admissions || []);
                    setBilling({ ...refreshRes.billing, admissions: ea, facilityCharges: enrichFacilityCharges(refreshRes.billing.facilityCharges || [], ea) });
                }
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Error editing charge');
        }
    };

    const activeAdmissions = billing?.admissions?.filter(a => a.status === 'Admitted') || [];
    const pastAdmissions = billing?.admissions?.filter(a => a.status === 'Discharged') || [];
    const hasPending = pendingTotal() > 0;

    const pendingAppts = (billing?.appointments || []).filter(a => isPending(a.paymentStatus));
    const pendingLabs = (billing?.labReports || []).filter(l => isPending(l.paymentStatus));
    const pendingPharmacy = (billing?.pharmacyOrders || []).filter(p => isPending(p.paymentStatus));
    const pendingFacility = (billing?.facilityCharges || []).filter(f => isPending(f.paymentStatus));
    const pendingPkgs = (billing?.packages || []).filter(p => isPending(p.paymentStatus));
    const pendingAdmissions = (billing?.admissions || []).filter(a => isPending(a.paymentStatus));

    return (
        <div className="billing-profile-page">
            <div className="billing-header">
                <div>
                    <h1>Patient Billing Profile</h1>
                    <p>Search a patient to view and settle their bills</p>
                </div>
                <button className="btn-back" onClick={() => navigate(-1)}>Back</button>
            </div>

            {/* Financial Summary Dashboard */}
            <div className="billing-section" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#1e293b' }}>
                        📊 Financial Summary
                    </h3>
                    <div className="date-filter-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="preset-buttons" style={{ display: 'flex', gap: '4px' }}>
                            <button className={datePreset === 'all' ? 'preset-btn active' : 'preset-btn'} onClick={() => handleDatePresetChange('all')}>All Time</button>
                            <button className={datePreset === 'today' ? 'preset-btn active' : 'preset-btn'} onClick={() => handleDatePresetChange('today')}>Today</button>
                            <button className={datePreset === '30' ? 'preset-btn active' : 'preset-btn'} onClick={() => handleDatePresetChange('30')}>Last 30 Days</button>
                        </div>
                        <div className="custom-date-inputs" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input type="date" style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} value={customStartDate} onChange={(e) => { setDatePreset('custom'); setCustomStartDate(e.target.value); }} />
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>to</span>
                            <input type="date" style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} value={customEndDate} onChange={(e) => { setDatePreset('custom'); setCustomEndDate(e.target.value); }} />
                            <button onClick={handleApplyCustomDate} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' }}>Apply</button>
                        </div>
                    </div>
                </div>

                {statsLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>⏳ Loading financial data...</div>
                ) : stats ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                        <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '4px' }}>Total Revenue</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fmt(stats.totalRevenue)}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '4px' }}>Consultations</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(stats.consultations?.revenue || 0)}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>{stats.consultations?.count || 0} Appointments</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '4px' }}>Packages</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(stats.packages?.revenue || 0)}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>{stats.packages?.count || 0} Paid</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)', color: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '4px' }}>Lab Tests</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(stats.labTests?.revenue || 0)}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>{stats.labTests?.count || 0} Reports</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '4px' }}>Pharmacy</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(stats.medicines?.revenue || 0)}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>{stats.medicines?.count || 0} Orders</div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
                <form className="billing-search-bar" onSubmit={handleSearch}>
                    <input
                        type="text"
                        placeholder="Search by Name, Phone, MRN or Patient ID..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="billing-search-input"
                    />
                    <button type="submit" className="btn-search" disabled={loading}>
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>
                {searchResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000, maxHeight: '300px', overflowY: 'auto', borderRadius: '8px', marginTop: '4px' }}>
                        {searchResults.map(p => (
                            <div key={p._id} style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSelectPatient(p)}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{p.name} <span style={{ color: '#666', fontSize: '0.85rem' }}>({p.patientId || 'N/A'})</span></div>
                                    <div style={{ fontSize: '0.85rem', color: '#888' }}>📱 {p.phone}</div>
                                </div>
                                <button className="btn-search" style={{ padding: '4px 12px', fontSize: '0.85rem' }}>Select</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {error && <div className="billing-error">{error}</div>}
            {successMsg && <div className="billing-success">{successMsg}</div>}

            {patient && billing && (
                <>
                    {/* Patient Card */}
                    <div className="patient-info-card">
                        <div className="patient-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                            {patient.avatar
                                ? <img src={patient.avatar} alt={patient.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                                : patient.name?.charAt(0)?.toUpperCase()
                            }
                        </div>
                        <div className="patient-details">
                            <h2>{patient.name}</h2>
                            <div className="patient-meta">
                                <span>MRN: {patient.mrn || patient.patientId || '—'}</span>
                                <span>Phone: {patient.phone || '—'}</span>
                                {patient.gender && <span>Gender: {patient.gender}</span>}
                                {patient.dob && <span>DOB: {fmtDate(patient.dob)}</span>}
                            </div>
                        </div>
                        <div className="patient-outstanding">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Grand Total Bill</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(pendingTotal() + paidTotal())}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.78rem' }}>
                                        <span style={{ opacity: 0.75 }}>Paid: </span>
                                        <span style={{ color: '#86efac', fontWeight: 700 }}>{fmt(paidTotal())}</span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem' }}>
                                        <span style={{ opacity: 0.75 }}>Balance: </span>
                                        <span style={{ color: '#fca5a5', fontWeight: 700 }}>{fmt(pendingTotal())}</span>
                                    </div>
                                    {paidTotal() > 0 && (
                                        <button 
                                            onClick={() => downloadReceipt(null, true)} 
                                            style={{ marginLeft: '12px', padding: '6px 12px', fontSize: '0.8rem', background: '#2dd4bf', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            Download Receipt
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>



                    {/* OPD Consultations */}
                    {/* Treatment Packages */}
                    {billing.packages && billing.packages.length > 0 && (
                        <div className="billing-section">
                            <div className="section-header">
                                <h3>
                                    Active Treatment Packages
                                    {pendingPkgs.length > 0 && <span style={{ color: '#dc2626', fontSize: '0.82rem', marginLeft: 8 }}>{pendingPkgs.length} pending</span>}
                                    {billing.packages.length - pendingPkgs.length > 0 && <span style={{ color: '#16a34a', fontSize: '0.82rem', marginLeft: 8 }}>{billing.packages.length - pendingPkgs.length} paid</span>}
                                </h3>
                                {pendingPkgs.length > 0 && (
                                    <button className="btn-select-all" onClick={() => toggleAll('packages', pendingPkgs.map(p => p._id))}>
                                        {pendingPkgs.every(p => selected.packages.includes(p._id)) ? 'Deselect All' : 'Select All Pending'}
                                    </button>
                                )}
                            </div>
                            {billing.packages.map(pkg => (
                                <div key={pkg._id} style={{ ...(isPaid(pkg.paymentStatus) ? { background: '#f0fdf4' } : selected.packages.includes(pkg._id) ? { background: '#eff6ff' } : { background: '#f8fafc' }), border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {isPaid(pkg.paymentStatus) ? (
                                                <span className="badge badge-paid">PAID</span>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={selected.packages.includes(pkg._id)}
                                                    onChange={() => toggle('packages', pkg._id)}
                                                    className="bill-checkbox"
                                                />
                                            )}
                                            <h4 style={{ margin: 0, color: '#0f172a' }}>{pkg.packageName}</h4>
                                        </div>
                                        <span style={{ fontWeight: 'bold', color: '#334155' }}>Total: {fmt(pkg.finalAmount || pkg.totalAmount)}</span>
                                    </div>
                                    <table className="billing-table" style={{ margin: 0, boxShadow: 'none' }}>
                                        <thead><tr><th>Included Service</th><th>Original Price</th></tr></thead>
                                        <tbody>
                                            {pkg.selectedServices && pkg.selectedServices.map(srv => (
                                                <tr key={srv.serviceId || srv._id || Math.random()}>
                                                    <td>{srv.serviceName}</td>
                                                    <td>{fmt(srv.price)}</td>
                                                </tr>
                                            ))}
                                            {(!pkg.selectedServices || pkg.selectedServices.length === 0) && (
                                                <tr><td colSpan="2" style={{ textAlign: 'center', color: '#64748b' }}>No specific services listed</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Appointments */}
                    {billing.appointments.length > 0 && (
                        <div className="billing-section">
                            <div className="section-header">
                                <h3>
                                    OPD Consultations
                                    {pendingAppts.length > 0 && <span style={{ color: '#dc2626', fontSize: '0.82rem', marginLeft: 8 }}>{pendingAppts.length} pending</span>}
                                    {billing.appointments.length - pendingAppts.length > 0 && <span style={{ color: '#16a34a', fontSize: '0.82rem', marginLeft: 8 }}>{billing.appointments.length - pendingAppts.length} paid</span>}
                                </h3>
                                {pendingAppts.length > 0 && (
                                    <button className="btn-select-all" onClick={() => toggleAll('appointments', pendingAppts.map(a => a._id))}>
                                        {pendingAppts.every(a => selected.appointments.includes(a._id)) ? 'Deselect All' : 'Select All Pending'}
                                    </button>
                                )}
                            </div>
                            <table className="billing-table">
                                <thead><tr><th></th><th>Date</th><th>Doctor</th><th>Service</th><th>Status</th><th>Amount</th></tr></thead>
                                <tbody>
                                    {billing.appointments.map(a => (
                                        <tr key={a._id} style={isPaid(a.paymentStatus) ? { background: '#f0fdf4' } : selected.appointments.includes(a._id) ? { background: '#eff6ff' } : {}}>
                                            <td>
                                                {isPaid(a.paymentStatus)
                                                    ? <span className="paid-badge">PAID</span>
                                                    : <input type="checkbox" checked={selected.appointments.includes(a._id)} onChange={() => toggle('appointments', a._id)} />
                                                }
                                            </td>
                                            <td>{fmtDate(a.appointmentDate)}{a.appointmentTime && ` ${a.appointmentTime}`}</td>
                                            <td>{a.doctorName || '—'}</td>
                                            <td>{a.serviceName || 'Consultation'}</td>
                                            <td><span className={`status-badge status-${(a.status || '').toLowerCase()}`}>{a.status}</span></td>
                                            <td className="amount-cell" style={isPaid(a.paymentStatus) ? { color: '#16a34a' } : {}}>{fmt(a.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Lab Reports */}
                    {billing.labReports && (
                        <div className="billing-section">
                            <div className="section-header">
                                <h3>
                                    Lab Tests & Reports
                                    {pendingLabs.length > 0 && <span style={{ color: '#dc2626', fontSize: '0.82rem', marginLeft: 8 }}>{pendingLabs.length} pending</span>}
                                    {billing.labReports.length - pendingLabs.length > 0 && <span style={{ color: '#16a34a', fontSize: '0.82rem', marginLeft: 8 }}>{billing.labReports.length - pendingLabs.length} paid</span>}
                                </h3>
                                {pendingLabs.length > 0 && (
                                    <button className="btn-select-all" onClick={() => toggleAll('labReports', pendingLabs.map(l => l._id))}>
                                        {pendingLabs.every(l => selected.labReports.includes(l._id)) ? 'Deselect All' : 'Select All Pending'}
                                    </button>
                                )}
                            </div>
                            <table className="billing-table">
                                <thead><tr><th></th><th>Date</th><th>Tests</th><th>Status</th><th>GST Breakdown</th><th>Discount (₹)</th><th>Total Amount</th></tr></thead>
                                <tbody>
                                    {billing.labReports.length === 0 ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>No lab tests found for this patient.</td></tr>
                                    ) : (
                                        billing.labReports.map(l => {
                                            const baseAmount = l.amount || l.price || 0;
                                            const totalAmount = baseAmount + (l.sgst || 0) + (l.cgst || 0);
                                            const isLPaid = isPaid(l.paymentStatus);
                                            const lDiscount = isLPaid ? (l.discount || 0) : (labDiscounts[l._id] || '');
                                            return (
                                            <tr key={l._id} style={isLPaid ? { background: '#f0fdf4' } : selected.labReports.includes(l._id) ? { background: '#eff6ff' } : {}}>
                                                <td>
                                                    {isLPaid
                                                        ? <span className="paid-badge">PAID</span>
                                                        : <input type="checkbox" checked={selected.labReports.includes(l._id)} onChange={() => toggle('labReports', l._id)} />
                                                    }
                                                </td>
                                                <td>{fmtDate(l.createdAt)}</td>
                                                <td>{Array.isArray(l.testNames) ? l.testNames.join(', ') : (l.testName || '—')}</td>
                                                <td><span className="status-badge">{l.testStatus || l.status || 'Pending'}</span></td>
                                                <td>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        Base: {fmt(baseAmount)}<br/>
                                                        SGST: {fmt(l.sgst || 0)}<br/>
                                                        CGST: {fmt(l.cgst || 0)}
                                                    </div>
                                                </td>
                                                <td>
                                                    {isLPaid ? (
                                                        <span style={{ color: '#dc2626' }}>{lDiscount > 0 ? `-${fmt(lDiscount)}` : '—'}</span>
                                                    ) : (
                                                        <input 
                                                            type="number" 
                                                            value={lDiscount} 
                                                            onChange={(e) => setLabDiscounts(prev => ({ ...prev, [l._id]: e.target.value }))}
                                                            style={{ width: '80px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                                            min="0"
                                                            disabled={!selected.labReports.includes(l._id)}
                                                        />
                                                    )}
                                                </td>
                                                <td className="amount-cell" style={isLPaid ? { color: '#16a34a', fontWeight: 'bold' } : { fontWeight: 'bold' }}>
                                                    {isLPaid ? fmt(totalAmount - lDiscount) : fmt(totalAmount)}
                                                </td>
                                            </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Empty state */}
                    {!hasPending && billing.appointments.length === 0 && billing.labReports.length === 0 &&
                        (
                        <div className="no-bills">No billing records found for this patient.</div>
                    )}

                    {/* Payment Panel */}
                    {hasPending && (
                        <div className="payment-panel">
                            <div className="payment-summary">
                                <div className="payment-row">
                                    <span style={{ minWidth: 140 }}>Grand Total Bill:</span>
                                    <strong>{fmt(pendingTotal() + paidTotal())}</strong>
                                </div>
                                <div className="payment-row">
                                    <span style={{ minWidth: 140 }}>Already Paid:</span>
                                    <strong style={{ color: '#16a34a' }}>{fmt(paidTotal())}</strong>
                                </div>
                                <div className="payment-row">
                                    <span style={{ minWidth: 140 }}>Balance Due:</span>
                                    <strong style={{ color: '#dc2626', fontSize: '1.1rem' }}>{fmt(pendingTotal())}</strong>
                                </div>
                                <div className="payment-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 4 }}>
                                    <span style={{ minWidth: 140 }}>Payable Amount:</span>
                                    <strong className="selected-amount">{fmt(totalSelected())}</strong>
                                </div>
                            </div>
                            <div className="payment-controls">
                                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="payment-mode-select">
                                    <option value="Cash">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Card">Card</option>
                                    <option value="NetBanking">Net Banking</option>
                                    <option value="Insurance">Insurance</option>
                                </select>
                                <button className="btn-pay" onClick={handlePay} disabled={paying || totalSelected() === 0}>
                                    {paying ? 'Processing...' : `Pay ${fmt(Math.max(0, totalSelected() - (Number(discount) || 0)))}`}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Edit Facility Charge Modal */}
            {editingCharge && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="modal-content" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Edit Itemized Charge</h3>
                        <form onSubmit={handleEditCharge}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px' }}>Charge Name / Service</label>
                                <input required type="text" value={editChargeForm.facilityName} onChange={e => setEditChargeForm({...editChargeForm, facilityName: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px' }}>Unit Price / Rate per Day</label>
                                <input required type="number" min="0" step="0.01" value={editChargeForm.pricePerDay} onChange={e => setEditChargeForm({...editChargeForm, pricePerDay: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px' }}>Quantity / Days</label>
                                <input required type="number" min="1" step="0.01" value={editChargeForm.days} onChange={e => setEditChargeForm({...editChargeForm, days: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button type="button" onClick={() => setEditingCharge(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientBillingProfile;
