import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingAPI, admissionAPI } from '../../utils/api';
import './PatientBillingProfile.css';

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
    const [paying, setPaying] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [dischargingId, setDischargingId] = useState(null);
    const [searchResults, setSearchResults] = useState([]);

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
        (billing.labReports || []).filter(l => isPending(l.paymentStatus)).forEach(l => t += (l.amount || l.price || 0));
        (billing.pharmacyOrders || []).filter(p => isPending(p.paymentStatus)).forEach(p => t += (p.totalAmount || 0));
        (billing.facilityCharges || []).filter(f => isPending(f.paymentStatus)).forEach(f => t += (f.totalAmount || 0));
        (billing.admissions || []).filter(a => isPending(a.paymentStatus)).forEach(a => t += (a.totalAmount || 0));
        (billing.packages || []).filter(p => isPending(p.paymentStatus)).forEach(p => t += (p.finalAmount || p.totalAmount || 0));
        return t;
    };

    const paidTotal = () => {
        if (!billing) return 0;
        let t = 0;
        (billing.appointments || []).filter(a => isPaid(a.paymentStatus)).forEach(a => t += (a.amount || 0));
        (billing.labReports || []).filter(l => isPaid(l.paymentStatus)).forEach(l => t += (l.amount || l.price || 0));
        (billing.pharmacyOrders || []).filter(p => isPaid(p.paymentStatus)).forEach(p => t += (p.totalAmount || 0));
        (billing.facilityCharges || []).filter(f => isPaid(f.paymentStatus)).forEach(f => t += (f.totalAmount || 0));
        (billing.admissions || []).filter(a => isPaid(a.paymentStatus)).forEach(a => t += (a.totalAmount || 0));
        (billing.packages || []).filter(p => isPaid(p.paymentStatus)).forEach(p => t += (p.finalAmount || p.totalAmount || 0));
        return t;
    };

    const totalSelected = () => {
        if (!billing) return 0;
        let t = 0;
        (billing.appointments || []).filter(a => selected.appointments.includes(a._id)).forEach(a => t += (a.amount || 0));
        (billing.labReports || []).filter(l => selected.labReports.includes(l._id)).forEach(l => t += (l.amount || l.price || 0));
        (billing.pharmacyOrders || []).filter(p => selected.pharmacyOrders.includes(p._id)).forEach(p => t += (p.totalAmount || 0));
        (billing.facilityCharges || []).filter(f => selected.facilityCharges.includes(f._id)).forEach(f => t += (f.totalAmount || 0));
        (billing.admissions || []).filter(a => selected.admissions.includes(a._id)).forEach(a => t += (a.totalAmount || 0));
        (billing.packages || []).filter(p => selected.packages.includes(p._id)).forEach(p => t += (p.finalAmount || p.totalAmount || 0));
        return t;
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
                pharmacyOrderIds: selected.pharmacyOrders,
                facilityChargeIds: selected.facilityCharges,
                admissionIds: selected.admissions,
                packageIds: selected.packages,
                paymentMode,
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
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <div style={{ fontSize: '0.78rem' }}>
                                        <span style={{ opacity: 0.75 }}>Paid: </span>
                                        <span style={{ color: '#86efac', fontWeight: 700 }}>{fmt(paidTotal())}</span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem' }}>
                                        <span style={{ opacity: 0.75 }}>Balance: </span>
                                        <span style={{ color: '#fca5a5', fontWeight: 700 }}>{fmt(pendingTotal())}</span>
                                    </div>
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
                    {billing.labReports.length > 0 && (
                        <div className="billing-section">
                            <div className="section-header">
                                <h3>
                                    Lab Tests
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
                                <thead><tr><th></th><th>Date</th><th>Tests</th><th>Status</th><th>Amount</th></tr></thead>
                                <tbody>
                                    {billing.labReports.map(l => (
                                        <tr key={l._id} style={isPaid(l.paymentStatus) ? { background: '#f0fdf4' } : selected.labReports.includes(l._id) ? { background: '#eff6ff' } : {}}>
                                            <td>
                                                {isPaid(l.paymentStatus)
                                                    ? <span className="paid-badge">PAID</span>
                                                    : <input type="checkbox" checked={selected.labReports.includes(l._id)} onChange={() => toggle('labReports', l._id)} />
                                                }
                                            </td>
                                            <td>{fmtDate(l.createdAt)}</td>
                                            <td>{Array.isArray(l.testNames) ? l.testNames.join(', ') : (l.testName || '—')}</td>
                                            <td><span className="status-badge">{l.testStatus || l.status || 'Pending'}</span></td>
                                            <td className="amount-cell" style={isPaid(l.paymentStatus) ? { color: '#16a34a' } : {}}>{fmt(l.amount || l.price)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pharmacy Orders */}
                    {billing.pharmacyOrders.length > 0 && (
                        <div className="billing-section">
                            <div className="section-header">
                                <h3>
                                    Pharmacy Orders
                                    {pendingPharmacy.length > 0 && <span style={{ color: '#dc2626', fontSize: '0.82rem', marginLeft: 8 }}>{pendingPharmacy.length} pending</span>}
                                    {billing.pharmacyOrders.length - pendingPharmacy.length > 0 && <span style={{ color: '#16a34a', fontSize: '0.82rem', marginLeft: 8 }}>{billing.pharmacyOrders.length - pendingPharmacy.length} paid</span>}
                                </h3>
                                {pendingPharmacy.length > 0 && (
                                    <button className="btn-select-all" onClick={() => toggleAll('pharmacyOrders', pendingPharmacy.map(p => p._id))}>
                                        {pendingPharmacy.every(p => selected.pharmacyOrders.includes(p._id)) ? 'Deselect All' : 'Select All Pending'}
                                    </button>
                                )}
                            </div>
                            <table className="billing-table">
                                <thead><tr><th></th><th>Date</th><th>Medicines</th><th>Order Status</th><th>Amount</th></tr></thead>
                                <tbody>
                                    {billing.pharmacyOrders.map(p => (
                                        <tr key={p._id} style={isPaid(p.paymentStatus) ? { background: '#f0fdf4' } : selected.pharmacyOrders.includes(p._id) ? { background: '#eff6ff' } : {}}>
                                            <td>
                                                {isPaid(p.paymentStatus)
                                                    ? <span className="paid-badge">PAID</span>
                                                    : <input type="checkbox" checked={selected.pharmacyOrders.includes(p._id)} onChange={() => toggle('pharmacyOrders', p._id)} />
                                                }
                                            </td>
                                            <td>{fmtDate(p.createdAt)}</td>
                                            <td>{Array.isArray(p.items) ? p.items.map(i => i.medicineName || i.name).filter(Boolean).join(', ') : '—'}</td>
                                            <td><span className="status-badge">{p.orderStatus || 'Pending'}</span></td>
                                            <td className="amount-cell" style={isPaid(p.paymentStatus) ? { color: '#16a34a' } : {}}>{fmt(p.totalAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Hospitalization / Admissions */}
                    {billing.admissions && billing.admissions.length > 0 && (
                        <div className="billing-section">
                            <div className="section-header">
                                <h3>
                                    Hospitalization / Admissions
                                    {pendingAdmissions.length > 0 && <span style={{ color: '#dc2626', fontSize: '0.82rem', marginLeft: 8 }}>{pendingAdmissions.length} pending</span>}
                                    {billing.admissions.length - pendingAdmissions.length > 0 && <span style={{ color: '#16a34a', fontSize: '0.82rem', marginLeft: 8 }}>{billing.admissions.length - pendingAdmissions.length} paid</span>}
                                </h3>
                                {pendingAdmissions.length > 0 && (
                                    <button className="btn-select-all" onClick={() => toggleAll('admissions', pendingAdmissions.map(a => a._id))}>
                                        {pendingAdmissions.every(a => selected.admissions.includes(a._id)) ? 'Deselect All' : 'Select All Pending'}
                                    </button>
                                )}
                            </div>
                            {billing.admissions.map(adm => (
                                <div key={adm._id} className={`admission-card ${adm.status === 'Admitted' ? 'active' : 'past'}`} style={{ ...(isPaid(adm.paymentStatus) ? { background: '#f0fdf4' } : selected.admissions.includes(adm._id) ? { background: '#eff6ff' } : { background: '#f8fafc' }), border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                    <div className="admission-top" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {isPaid(adm.paymentStatus) ? (
                                                <span className="badge badge-paid">PAID</span>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={selected.admissions.includes(adm._id)}
                                                    onChange={() => toggle('admissions', adm._id)}
                                                    className="bill-checkbox"
                                                />
                                            )}
                                            <div>
                                                <strong style={{ color: adm.status === 'Admitted' ? '#2563eb' : '#475569' }}>{adm.status === 'Admitted' ? 'Currently Admitted' : 'Past Admission'}</strong>
                                                <br/>
                                                <span style={{ fontSize: '0.9rem', color: '#475569' }}>
                                                    <strong>In:</strong> {fmtDate(adm.admissionDate)} 
                                                    {adm.status === 'Discharged' && <span style={{ marginLeft: 8 }}><strong>Out:</strong> {fmtDate(adm.dischargeDate)}</span>}
                                                </span>
                                                {adm.ward && <span className="badge-ward" style={{ marginLeft: 8 }}> Ward: {adm.ward}</span>}
                                                {adm.bedNumber && <span className="badge-bed" style={{ marginLeft: 8 }}> Bed: {adm.bedNumber}</span>}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '8px' }}>Total: {fmt(adm.totalAmount)}</span>
                                            {adm.status === 'Admitted' && (
                                                <button
                                                    className="btn-discharge"
                                                    style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                                                    onClick={() => handleDischarge(adm._id)}
                                                    disabled={dischargingId === adm._id}
                                                >
                                                    {dischargingId === adm._id ? 'Discharging...' : 'Discharge'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {adm.selectedFacilities?.length > 0 && (
                                        <table className="billing-table" style={{ margin: 0, boxShadow: 'none', background: 'transparent' }}>
                                            <thead><tr><th>Facility / Service</th><th>Rate/Day</th><th>Days</th><th>Amount</th></tr></thead>
                                            <tbody>
                                                {adm.selectedFacilities.map((f, i) => (
                                                    <tr key={i}>
                                                        <td>{f.facilityName}</td>
                                                        <td>{fmt(f.pricePerDay)}</td>
                                                        <td>{f.days}</td>
                                                        <td>{fmt(f.totalAmount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Facility Charges */}
                    {billing.facilityCharges.length > 0 && (
                        <div className="billing-section">
                            <div className="section-header">
                                <h3>
                                    Facility Charges
                                    {pendingFacility.length > 0 && <span style={{ color: '#dc2626', fontSize: '0.82rem', marginLeft: 8 }}>{pendingFacility.length} pending</span>}
                                    {billing.facilityCharges.length - pendingFacility.length > 0 && <span style={{ color: '#16a34a', fontSize: '0.82rem', marginLeft: 8 }}>{billing.facilityCharges.length - pendingFacility.length} paid</span>}
                                </h3>
                                {pendingFacility.length > 0 && (
                                    <button className="btn-select-all" onClick={() => toggleAll('facilityCharges', pendingFacility.map(f => f._id))}>
                                        {pendingFacility.every(f => selected.facilityCharges.includes(f._id)) ? 'Deselect All' : 'Select All Pending'}
                                    </button>
                                )}
                            </div>
                            <table className="billing-table">
                                <thead><tr><th></th><th>Date</th><th>Facility</th><th>Rate/Day</th><th>Days</th><th>Amount</th></tr></thead>
                                <tbody>
                                    {billing.facilityCharges.map(f => (
                                        <tr key={f._id} style={isPaid(f.paymentStatus) ? { background: '#f0fdf4' } : selected.facilityCharges.includes(f._id) ? { background: '#eff6ff' } : {}}>
                                            <td>
                                                {isPaid(f.paymentStatus)
                                                    ? <span className="paid-badge">PAID</span>
                                                    : <input type="checkbox" checked={selected.facilityCharges.includes(f._id)} onChange={() => toggle('facilityCharges', f._id)} />
                                                }
                                            </td>
                                            <td>{fmtDate(f.createdAt)}</td>
                                            <td>{f.facilityName}</td>
                                            <td>{fmt(f.pricePerDay)}</td>
                                            <td>{f.days}</td>
                                            <td className="amount-cell" style={isPaid(f.paymentStatus) ? { color: '#16a34a' } : {}}>{fmt(f.totalAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}



                    {/* Empty state */}
                    {!hasPending && billing.appointments.length === 0 && billing.labReports.length === 0 &&
                        billing.pharmacyOrders.length === 0 && billing.facilityCharges.length === 0 &&
                        billing.admissions.length === 0 && (
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
                                    <span style={{ minWidth: 140 }}>Selected to Pay:</span>
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
                                    {paying ? 'Processing...' : `Pay ${fmt(totalSelected())}`}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PatientBillingProfile;
