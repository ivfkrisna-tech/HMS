import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../store/hooks';
import { packageServicesAPI } from '../../utils/api';
import {
    FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiSearch,
    FiLayers, FiDollarSign, FiCalendar, FiClock, FiFileText,
    FiUser, FiTag, FiEye, FiAlertCircle, FiCheckCircle, FiChevronDown
} from 'react-icons/fi';
import './HospitalAdminPackages.css';

const HospitalAdminPackages = () => {
    const { user } = useAuth();
    const hospitalId = user?.hospitalId || user?._id;

    // Tabs: 'services' | 'packages'
    const [activeTab, setActiveTab] = useState('services');

    // ─── SERVICE MASTER STATE ────────────────────────────────────────────────
    const [servicesList, setServicesList] = useState([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [serviceModalOpen, setServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [serviceForm, setServiceForm] = useState({
        serviceName: '',
        price: '',
        description: '',
        status: 'Active'
    });
    const [serviceError, setServiceError] = useState('');
    const [serviceSuccess, setServiceSuccess] = useState('');

    // ─── TREATMENT PACKAGES STATE ────────────────────────────────────────────
    const [packagesList, setPackagesList] = useState([]);
    const [loadingPackages, setLoadingPackages] = useState(false);

    // Form state
    const [registeredPatients, setRegisteredPatients] = useState([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);

    const [packageTitle, setPackageTitle] = useState('');
    const [packageDescription, setPackageDescription] = useState('');

    const [serviceSearch, setServiceSearch] = useState('');
    const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
    const [selectedServices, setSelectedServices] = useState([]);

    const [discountPercent, setDiscountPercent] = useState('');
    const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [totalDuration, setTotalDuration] = useState('30');

    const [editingPackageId, setEditingPackageId] = useState(null);
    const [packageError, setPackageError] = useState('');
    const [packageSuccess, setPackageSuccess] = useState('');

    // View package modal
    const [viewingPackage, setViewingPackage] = useState(null);

    const patientDropdownRef = useRef(null);
    const serviceDropdownRef = useRef(null);

    // ─── LOAD INITIAL DATA ───────────────────────────────────────────────────
    useEffect(() => {
        fetchServices();
        fetchPackages();
        fetchRegisteredPatients();
    }, [hospitalId]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target)) {
                setPatientDropdownOpen(false);
            }
            if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(e.target)) {
                setServiceDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchServices = async () => {
        setLoadingServices(true);
        try {
            const res = await packageServicesAPI.getServices({ hospitalId });
            if (res.success) setServicesList(res.services || []);
        } catch (err) {
            console.error('Fetch services err:', err);
        } finally {
            setLoadingServices(false);
        }
    };

    const fetchPackages = async () => {
        setLoadingPackages(true);
        try {
            const res = await packageServicesAPI.getPackages();
            if (res.success) setPackagesList(res.packages || []);
        } catch (err) {
            console.error('Fetch packages err:', err);
        } finally {
            setLoadingPackages(false);
        }
    };

    const fetchRegisteredPatients = async (q = '') => {
        try {
            const res = await packageServicesAPI.getRegisteredPatients(q);
            if (res.success) setRegisteredPatients(res.patients || []);
        } catch (err) {
            console.error('Fetch patients err:', err);
        }
    };

    // ─── SERVICE MASTER HANDLERS ─────────────────────────────────────────────
    const handleOpenServiceModal = (srv = null) => {
        setServiceError('');
        if (srv) {
            setEditingService(srv);
            setServiceForm({
                serviceName: srv.serviceName || '',
                price: srv.price !== undefined ? String(srv.price) : '',
                description: srv.description || '',
                status: srv.status || 'Active'
            });
        } else {
            setEditingService(null);
            setServiceForm({ serviceName: '', price: '', description: '', status: 'Active' });
        }
        setServiceModalOpen(true);
    };

    const handleSaveService = async (e) => {
        e.preventDefault();
        setServiceError('');
        if (!serviceForm.serviceName.trim() || !serviceForm.price) {
            setServiceError('Service Name and Price are required');
            return;
        }

        try {
            if (editingService) {
                const res = await packageServicesAPI.updateService(editingService._id, {
                    ...serviceForm,
                    hospitalId
                });
                if (res.success) {
                    setServiceSuccess('Service updated successfully');
                    setServiceModalOpen(false);
                    fetchServices();
                }
            } else {
                const res = await packageServicesAPI.createService({
                    ...serviceForm,
                    hospitalId
                });
                if (res.success) {
                    setServiceSuccess('Service created successfully');
                    setServiceModalOpen(false);
                    fetchServices();
                }
            }
            setTimeout(() => setServiceSuccess(''), 3000);
        } catch (err) {
            setServiceError(err.response?.data?.message || err.message);
        }
    };

    const handleToggleServiceStatus = async (srv) => {
        const newStatus = srv.status === 'Active' ? 'Inactive' : 'Active';
        try {
            const res = await packageServicesAPI.toggleServiceStatus(srv._id, newStatus);
            if (res.success) {
                setServicesList(prev => prev.map(item => item._id === srv._id ? { ...item, status: newStatus } : item));
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Error updating status');
        }
    };

    const handleDeleteService = async (srv) => {
        if (!window.confirm(`Are you sure you want to delete "${srv.serviceName}"?`)) return;
        try {
            const res = await packageServicesAPI.deleteService(srv._id);
            if (res.success) {
                setServicesList(prev => prev.filter(item => item._id !== srv._id));
                setSelectedServices(prev => prev.filter(item => item.serviceId !== srv._id));
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Error deleting service');
        }
    };

    // ─── TREATMENT PACKAGE CALCULATIONS ──────────────────────────────────────
    const activeServicesList = servicesList.filter(s => s.status === 'Active');

    const totalTreatmentAmount = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const discNum = Number(discountPercent) || 0;
    const discAmount = (totalTreatmentAmount * discNum) / 100;
    const finalPackagePrice = Math.max(0, totalTreatmentAmount - discAmount);

    // Filter patients dropdown
    const filteredPatients = registeredPatients.filter(p => {
        if (!patientSearch.trim()) return true;
        const q = patientSearch.toLowerCase();
        return (
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.mrn && p.mrn.toLowerCase().includes(q)) ||
            (p.coupleId && p.coupleId.toLowerCase().includes(q)) ||
            (p.phone && p.phone.includes(q))
        );
    });

    // Filter services dropdown
    const filteredServices = activeServicesList.filter(s => {
        if (!serviceSearch.trim()) return true;
        return s.serviceName.toLowerCase().includes(serviceSearch.toLowerCase());
    });

    const handleSelectPatient = (pat) => {
        setSelectedPatient(pat);
        setPatientDropdownOpen(false);
        setPatientSearch('');
    };

    const handleToggleService = (srv) => {
        const exists = selectedServices.some(item => item.serviceId === srv._id);
        if (exists) {
            setSelectedServices(prev => prev.filter(item => item.serviceId !== srv._id));
        } else {
            setSelectedServices(prev => [...prev, {
                serviceId: srv._id,
                serviceName: srv.serviceName,
                price: srv.price
            }]);
        }
    };

    const handleRemoveServiceChip = (serviceId) => {
        setSelectedServices(prev => prev.filter(item => item.serviceId !== serviceId));
    };

    const handleSavePackage = async (e) => {
        e.preventDefault();
        setPackageError('');
        setPackageSuccess('');

        if (!selectedPatient) {
            setPackageError('Please select a registered patient');
            return;
        }
        if (!packageTitle.trim()) {
            setPackageError('Package / Plan Title is required');
            return;
        }
        if (selectedServices.length === 0) {
            setPackageError('Please select at least one treatment service');
            return;
        }

        const payload = {
            hospitalId,
            patientId: selectedPatient._id || selectedPatient.patientId,
            mrn: selectedPatient.mrn || '',
            coupleId: selectedPatient.coupleId || '',
            packageName: packageTitle.trim(),
            description: packageDescription,
            selectedServices,
            originalAmount: totalTreatmentAmount,
            discountPercent: discNum,
            finalAmount: finalPackagePrice,
            startDate,
            totalDuration: Number(totalDuration) || 0,
            status: 'Active'
        };

        try {
            if (editingPackageId) {
                const res = await packageServicesAPI.updatePackage(editingPackageId, payload);
                if (res.success) {
                    setPackageSuccess('Treatment Package updated successfully');
                    handleResetPackageForm();
                    fetchPackages();
                }
            } else {
                const res = await packageServicesAPI.createPackage(payload);
                if (res.success) {
                    setPackageSuccess('Treatment Package assigned and saved successfully');
                    handleResetPackageForm();
                    fetchPackages();
                }
            }
            setTimeout(() => setPackageSuccess(''), 4000);
        } catch (err) {
            setPackageError(err.response?.data?.message || err.message);
        }
    };

    const handleEditPackage = (pkg) => {
        setEditingPackageId(pkg._id);
        setSelectedPatient({
            _id: pkg.patientId,
            name: pkg.patientName || 'Patient',
            mrn: pkg.mrn || '',
            coupleId: pkg.coupleId || '',
            phone: pkg.phone || ''
        });
        setPackageTitle(pkg.packageName || '');
        setPackageDescription(pkg.description || '');
        setSelectedServices(pkg.selectedServices || []);
        setDiscountPercent(pkg.discountPercent !== undefined ? String(pkg.discountPercent) : '');
        setStartDate(pkg.startDate ? pkg.startDate.split('T')[0] : new Date().toISOString().split('T')[0]);
        setTotalDuration(pkg.totalDuration !== undefined ? String(pkg.totalDuration) : '30');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeletePackage = async (pkg) => {
        if (!window.confirm(`Are you sure you want to delete package "${pkg.packageName}" for ${pkg.patientName}?`)) return;
        try {
            const res = await packageServicesAPI.deletePackage(pkg._id);
            if (res.success) {
                setPackagesList(prev => prev.filter(item => item._id !== pkg._id));
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Error deleting package');
        }
    };

    const handleResetPackageForm = () => {
        setEditingPackageId(null);
        setSelectedPatient(null);
        setPackageTitle('');
        setPackageDescription('');
        setSelectedServices([]);
        setDiscountPercent('');
        setStartDate(new Date().toISOString().split('T')[0]);
        setTotalDuration('30');
        setPackageError('');
    };

    return (
        <div className="pkg-container">
            {/* Header Banner */}
            <div className="pkg-header-banner">
                <div className="pkg-header-title">
                    <h1><FiLayers /> Package Services</h1>
                    <p>Manage clinical service master catalog and build customizable IVF treatment plans</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="pkg-tabs-bar">
                <button
                    className={`pkg-tab-btn ${activeTab === 'services' ? 'active' : ''}`}
                    onClick={() => setActiveTab('services')}
                >
                    <FiTag /> 1. Service Master
                </button>
                <button
                    className={`pkg-tab-btn ${activeTab === 'packages' ? 'active' : ''}`}
                    onClick={() => setActiveTab('packages')}
                >
                    <FiLayers /> 2. Treatment Packages
                </button>
            </div>

            {/* Global feedback messages */}
            {serviceSuccess && <div className="pkg-alert success"><FiCheckCircle /> {serviceSuccess}</div>}
            {packageSuccess && <div className="pkg-alert success"><FiCheckCircle /> {packageSuccess}</div>}

            {/* ─── TAB 1: SERVICE MASTER ────────────────────────────────────────── */}
            {activeTab === 'services' && (
                <div className="pkg-tab-content">
                    <div className="pkg-card-top-bar">
                        <div className="pkg-card-title">
                            <h3>Service Catalog Master</h3>
                            <span>({servicesList.length} total services)</span>
                        </div>
                        <button className="pkg-btn primary" onClick={() => handleOpenServiceModal()}>
                            <FiPlus /> Add Service
                        </button>
                    </div>

                    <div className="pkg-table-wrapper">
                        <table className="pkg-data-table">
                            <thead>
                                <tr>
                                    <th>Service Name</th>
                                    <th>Price (₹)</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingServices ? (
                                    <tr><td colSpan="5" className="pkg-empty">Loading hospital services...</td></tr>
                                ) : servicesList.length === 0 ? (
                                    <tr><td colSpan="5" className="pkg-empty">No clinical services created yet. Click "Add Service" to start.</td></tr>
                                ) : (
                                    servicesList.map(srv => (
                                        <tr key={srv._id} className={srv.status === 'Inactive' ? 'inactive-row' : ''}>
                                            <td className="srv-name-cell"><strong>{srv.serviceName}</strong></td>
                                            <td className="srv-price-cell">₹{Number(srv.price).toLocaleString('en-IN')}</td>
                                            <td className="srv-desc-cell">{srv.description || <span className="text-muted">No description</span>}</td>
                                            <td>
                                                <span className={`pkg-badge ${srv.status === 'Active' ? 'active' : 'inactive'}`}>
                                                    {srv.status}
                                                </span>
                                            </td>
                                            <td className="pkg-actions-cell" style={{ textAlign: 'right' }}>
                                                <button
                                                    className={`pkg-btn-sm ${srv.status === 'Active' ? 'warning' : 'success'}`}
                                                    onClick={() => handleToggleServiceStatus(srv)}
                                                    title={srv.status === 'Active' ? 'Click to Disable' : 'Click to Enable'}
                                                >
                                                    {srv.status === 'Active' ? 'Disable' : 'Enable'}
                                                </button>
                                                <button className="pkg-btn-icon edit" onClick={() => handleOpenServiceModal(srv)} title="Edit Service">
                                                    <FiEdit2 />
                                                </button>
                                                <button className="pkg-btn-icon delete" onClick={() => handleDeleteService(srv)} title="Delete Service">
                                                    <FiTrash2 />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── TAB 2: TREATMENT PACKAGES ────────────────────────────────────── */}
            {activeTab === 'packages' && (
                <div className="pkg-tab-content">
                    {/* Create / Edit Package Form Card */}
                    <div className="pkg-form-card">
                        <div className="pkg-form-header">
                            <h3>{editingPackageId ? 'Edit Treatment Package Plan' : 'Create New Treatment Package'}</h3>
                            {editingPackageId && (
                                <button className="pkg-btn-sm neutral" onClick={handleResetPackageForm}>Cancel Edit</button>
                            )}
                        </div>

                        {packageError && <div className="pkg-alert error"><FiAlertCircle /> {packageError}</div>}

                        <form onSubmit={handleSavePackage} className="pkg-form-grid">
                            {/* Patient Searchable Dropdown */}
                            <div className="pkg-field-col full">
                                <label>Patient <span className="req">*</span></label>
                                <div className="pkg-dropdown-container" ref={patientDropdownRef}>
                                    <div
                                        className="pkg-dropdown-trigger"
                                        onClick={() => setPatientDropdownOpen(!patientDropdownOpen)}
                                    >
                                        <FiUser className="trigger-icon" />
                                        <span className={selectedPatient ? 'selected-text' : 'placeholder-text'}>
                                            {selectedPatient
                                                ? `${selectedPatient.name} ${selectedPatient.mrn !== 'N/A' ? `(${selectedPatient.mrn})` : ''} ${selectedPatient.coupleId !== 'N/A' ? `[${selectedPatient.coupleId}]` : ''}`
                                                : 'Search registered patient by MRN, Couple ID, Name or Mobile...'
                                            }
                                        </span>
                                        <FiChevronDown className="chevron-icon" />
                                    </div>

                                    {patientDropdownOpen && (
                                        <div className="pkg-dropdown-menu">
                                            <div className="pkg-dropdown-search">
                                                <FiSearch />
                                                <input
                                                    type="text"
                                                    placeholder="Search MRN, Couple ID, Name, Phone..."
                                                    value={patientSearch}
                                                    onChange={(e) => setPatientSearch(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="pkg-dropdown-options">
                                                {filteredPatients.length === 0 ? (
                                                    <div className="pkg-dropdown-empty">No registered patients found. Only registered patients can be assigned packages.</div>
                                                ) : (
                                                    filteredPatients.map(pat => (
                                                        <div
                                                            key={pat._id}
                                                            className={`pkg-dropdown-option ${selectedPatient?._id === pat._id ? 'selected' : ''}`}
                                                            onClick={() => handleSelectPatient(pat)}
                                                        >
                                                            <div className="opt-main">
                                                                <strong>{pat.name}</strong>
                                                                {pat.coupleId !== 'N/A' && <span className="opt-cpl">Couple ID: {pat.coupleId}</span>}
                                                            </div>
                                                            <div className="opt-sub">
                                                                <span>MRN: {pat.mrn || 'N/A'}</span>
                                                                {pat.phone && <span>📞 {pat.phone}</span>}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Package Title */}
                            <div className="pkg-field-col full">
                                <label>Package / Plan Title <span className="req">*</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. IVF Basic Package, Complete IVF Cycle, Fertility Package..."
                                    value={packageTitle}
                                    onChange={(e) => setPackageTitle(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Description / Notes */}
                            <div className="pkg-field-col full">
                                <label>Description / Notes</label>
                                <textarea
                                    rows="2"
                                    placeholder="Enter clinical notes or package inclusion summary..."
                                    value={packageDescription}
                                    onChange={(e) => setPackageDescription(e.target.value)}
                                />
                            </div>

                            {/* Services Searchable Multi-Select */}
                            <div className="pkg-field-col full">
                                <label>Services <span className="req">*</span></label>
                                <div className="pkg-dropdown-container" ref={serviceDropdownRef}>
                                    <div
                                        className="pkg-dropdown-trigger"
                                        onClick={() => setServiceDropdownOpen(!serviceDropdownOpen)}
                                    >
                                        <FiTag className="trigger-icon" />
                                        <span className="placeholder-text">
                                            Click to search and select Active services created in Service Master...
                                        </span>
                                        <FiChevronDown className="chevron-icon" />
                                    </div>

                                    {serviceDropdownOpen && (
                                        <div className="pkg-dropdown-menu">
                                            <div className="pkg-dropdown-search">
                                                <FiSearch />
                                                <input
                                                    type="text"
                                                    placeholder="Search service catalog name..."
                                                    value={serviceSearch}
                                                    onChange={(e) => setServiceSearch(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="pkg-dropdown-options">
                                                {filteredServices.length === 0 ? (
                                                    <div className="pkg-dropdown-empty">No active services match. Go to Tab 1 to create Active services.</div>
                                                ) : (
                                                    filteredServices.map(srv => {
                                                        const isSelected = selectedServices.some(item => item.serviceId === srv._id);
                                                        return (
                                                            <div
                                                                key={srv._id}
                                                                className={`pkg-dropdown-option multi ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => handleToggleService(srv)}
                                                            >
                                                                <div className="opt-checkbox">
                                                                    {isSelected ? <FiCheck className="chk-icon checked" /> : <div className="chk-box-empty" />}
                                                                </div>
                                                                <div className="opt-main">
                                                                    <span>{srv.serviceName}</span>
                                                                </div>
                                                                <div className="opt-price">
                                                                    ₹{Number(srv.price).toLocaleString('en-IN')}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Removable Selected Services Chips */}
                            <div className="pkg-field-col full">
                                <label className="sub-lbl">Selected Services ({selectedServices.length}):</label>
                                <div className="pkg-chips-wrapper">
                                    {selectedServices.length === 0 ? (
                                        <div className="pkg-no-chips">No treatment services selected yet.</div>
                                    ) : (
                                        selectedServices.map(item => (
                                            <div key={item.serviceId} className="pkg-service-chip">
                                                <FiCheck className="chip-chk" />
                                                <span className="chip-title">{item.serviceName}</span>
                                                <span className="chip-price">(₹{Number(item.price).toLocaleString('en-IN')})</span>
                                                <button
                                                    type="button"
                                                    className="chip-remove-btn"
                                                    onClick={() => handleRemoveServiceChip(item.serviceId)}
                                                    title="Remove Service"
                                                >
                                                    <FiX />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Pricing Row: Total Amount | Discount | Final Price */}
                            <div className="pkg-field-col third">
                                <label>Total Treatment Amount (₹)</label>
                                <input
                                    type="text"
                                    className="readonly-input bold-amt"
                                    value={`₹${totalTreatmentAmount.toLocaleString('en-IN')}`}
                                    readOnly
                                />
                            </div>

                            <div className="pkg-field-col third">
                                <label>Discount (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    placeholder="e.g. 10"
                                    value={discountPercent}
                                    onChange={(e) => setDiscountPercent(e.target.value)}
                                />
                            </div>

                            <div className="pkg-field-col third">
                                <label>Final Package Price (₹)</label>
                                <input
                                    type="text"
                                    className="readonly-input final-amt"
                                    value={`₹${finalPackagePrice.toLocaleString('en-IN')}`}
                                    readOnly
                                />
                            </div>

                            {/* Dates Row: Start Date | Total Duration */}
                            <div className="pkg-field-col half">
                                <label>Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>

                            <div className="pkg-field-col half">
                                <label>Total Duration (Days)</label>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="e.g. 30"
                                    value={totalDuration}
                                    onChange={(e) => setTotalDuration(e.target.value)}
                                />
                            </div>

                            {/* Save Package Button */}
                            <div className="pkg-field-col full form-actions">
                                {editingPackageId && (
                                    <button type="button" className="pkg-btn neutral" onClick={handleResetPackageForm}>
                                        Cancel Edit
                                    </button>
                                )}
                                <button type="submit" className="pkg-btn primary large">
                                    <FiCheckCircle /> {editingPackageId ? 'Update Treatment Package' : 'Save & Assign Package'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* ─── PACKAGE LISTING TABLE ──────────────────────────────────────── */}
                    <div className="pkg-listing-card">
                        <div className="pkg-card-title">
                            <h3>Treatment Packages Listing</h3>
                            <span>({packagesList.length} assigned packages)</span>
                        </div>

                        <div className="pkg-table-wrapper">
                            <table className="pkg-data-table">
                                <thead>
                                    <tr>
                                        <th>Patient Name</th>
                                        <th>Couple Name</th>
                                        <th>MRN</th>
                                        <th>Couple ID</th>
                                        <th>Package Name</th>
                                        <th>Original Amt</th>
                                        <th>Discount</th>
                                        <th>Final Amt</th>
                                        <th>Status</th>
                                        <th>Created Date</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingPackages ? (
                                        <tr><td colSpan="11" className="pkg-empty">Loading treatment packages...</td></tr>
                                    ) : packagesList.length === 0 ? (
                                        <tr><td colSpan="11" className="pkg-empty">No treatment packages assigned yet. Use the form above to assign a package.</td></tr>
                                    ) : (
                                        packagesList.map(pkg => (
                                            <tr key={pkg._id}>
                                                <td><strong>{pkg.patientName || 'Patient'}</strong></td>
                                                <td>{pkg.coupleName || '-'}</td>
                                                <td><span className="code-badge">{pkg.mrn || 'N/A'}</span></td>
                                                <td><span className="code-badge accent">{pkg.coupleId || 'N/A'}</span></td>
                                                <td><strong>{pkg.packageName}</strong></td>
                                                <td>₹{Number(pkg.originalAmount || 0).toLocaleString('en-IN')}</td>
                                                <td>{pkg.discountPercent || 0}%</td>
                                                <td className="final-txt">₹{Number(pkg.finalAmount || 0).toLocaleString('en-IN')}</td>
                                                <td>
                                                    <span className={`pkg-badge ${pkg.status === 'Active' ? 'active' : pkg.status === 'Completed' ? 'success' : 'inactive'}`}>
                                                        {pkg.status}
                                                    </span>
                                                </td>
                                                <td>{pkg.createdAt ? new Date(pkg.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                                                <td className="pkg-actions-cell" style={{ textAlign: 'right' }}>
                                                    <button className="pkg-btn-icon view" onClick={() => setViewingPackage(pkg)} title="View Details">
                                                        <FiEye />
                                                    </button>
                                                    <button className="pkg-btn-icon edit" onClick={() => handleEditPackage(pkg)} title="Edit Package">
                                                        <FiEdit2 />
                                                    </button>
                                                    <button className="pkg-btn-icon delete" onClick={() => handleDeletePackage(pkg)} title="Delete Package">
                                                        <FiTrash2 />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── ADD / EDIT SERVICE MODAL ────────────────────────────────────── */}
            {serviceModalOpen && (
                <div className="pkg-modal-overlay">
                    <div className="pkg-modal-card">
                        <div className="pkg-modal-header">
                            <h3>{editingService ? 'Edit Service Catalog Item' : 'Add New Hospital Service'}</h3>
                            <button className="modal-close" onClick={() => setServiceModalOpen(false)}><FiX /></button>
                        </div>

                        {serviceError && <div className="pkg-alert error"><FiAlertCircle /> {serviceError}</div>}

                        <form onSubmit={handleSaveService} className="pkg-modal-form">
                            <div className="pkg-field-col full">
                                <label>Service Name <span className="req">*</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. Consultation, Ultrasound, Blood Test, Embryo Transfer..."
                                    value={serviceForm.serviceName}
                                    onChange={(e) => setServiceForm({ ...serviceForm, serviceName: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="pkg-field-col full">
                                <label>Price (₹) <span className="req">*</span></label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="e.g. 500, 1500, 12000"
                                    value={serviceForm.price}
                                    onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="pkg-field-col full">
                                <label>Description (Optional)</label>
                                <textarea
                                    rows="2"
                                    placeholder="Enter clinical service summary..."
                                    value={serviceForm.description}
                                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                                />
                            </div>

                            <div className="pkg-field-col full">
                                <label>Status</label>
                                <select
                                    value={serviceForm.status}
                                    onChange={(e) => setServiceForm({ ...serviceForm, status: e.target.value })}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>

                            <div className="pkg-modal-actions">
                                <button type="button" className="pkg-btn neutral" onClick={() => setServiceModalOpen(false)}>Cancel</button>
                                <button type="submit" className="pkg-btn primary"><FiCheck /> Save Service</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── VIEW PACKAGE DETAILS MODAL ──────────────────────────────────── */}
            {viewingPackage && (
                <div className="pkg-modal-overlay">
                    <div className="pkg-modal-card large">
                        <div className="pkg-modal-header">
                            <h3>Treatment Package Details</h3>
                            <button className="modal-close" onClick={() => setViewingPackage(null)}><FiX /></button>
                        </div>

                        <div className="pkg-view-body">
                            <div className="view-grid">
                                <div><span className="v-lbl">Package Title:</span> <strong>{viewingPackage.packageName}</strong></div>
                                <div><span className="v-lbl">Status:</span> <span className={`pkg-badge ${viewingPackage.status === 'Active' ? 'active' : 'inactive'}`}>{viewingPackage.status}</span></div>
                                <div><span className="v-lbl">Patient Name:</span> {viewingPackage.patientName || '-'}</div>
                                <div><span className="v-lbl">Couple Name:</span> {viewingPackage.coupleName || '-'}</div>
                                <div><span className="v-lbl">MRN:</span> {viewingPackage.mrn || 'N/A'}</div>
                                <div><span className="v-lbl">Couple ID:</span> {viewingPackage.coupleId || 'N/A'}</div>
                                <div><span className="v-lbl">Start Date:</span> {viewingPackage.startDate || '-'}</div>
                                <div><span className="v-lbl">Duration:</span> {viewingPackage.totalDuration || 0} Days</div>
                            </div>

                            {viewingPackage.description && (
                                <div className="view-desc">
                                    <span className="v-lbl">Clinical Notes:</span>
                                    <p>{viewingPackage.description}</p>
                                </div>
                            )}

                            <div className="view-services-sec">
                                <h4>Included Services ({viewingPackage.selectedServices?.length || 0}):</h4>
                                <div className="view-srv-list">
                                    {(viewingPackage.selectedServices || []).map((srv, idx) => (
                                        <div key={idx} className="view-srv-item">
                                            <span>✓ {srv.serviceName}</span>
                                            <strong>₹{Number(srv.price || 0).toLocaleString('en-IN')}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="view-pricing-box">
                                <div className="p-row"><span>Original Treatment Amount:</span> <strong>₹{Number(viewingPackage.originalAmount || 0).toLocaleString('en-IN')}</strong></div>
                                <div className="p-row"><span>Discount Applied:</span> <strong>{viewingPackage.discountPercent || 0}%</strong></div>
                                <div className="p-row total"><span>Final Package Price:</span> <strong className="final-txt">₹{Number(viewingPackage.finalAmount || 0).toLocaleString('en-IN')}</strong></div>
                            </div>
                        </div>

                        <div className="pkg-modal-actions">
                            <button type="button" className="pkg-btn primary" onClick={() => setViewingPackage(null)}>Close Details</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HospitalAdminPackages;
