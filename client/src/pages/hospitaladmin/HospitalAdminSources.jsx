import React, { useState, useEffect } from 'react';
import { sourceAPI } from '../../utils/api';
import { 
    FiPlus, FiEdit2, FiTrash2, FiUser, FiCalendar, 
    FiActivity, FiEye, FiX, FiCheckCircle, FiInfo 
} from 'react-icons/fi';
import './HospitalAdminSources.css';

const HospitalAdminSources = () => {
    const [activeTab, setActiveTab] = useState('B2C');
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingSource, setEditingSource] = useState(null);
    const [formData, setFormData] = useState({ sourceName: '', status: 'Active' });
    const [modalError, setModalError] = useState('');
    const [saving, setSaving] = useState(false);

    // Patient list sub-view states
    const [selectedSource, setSelectedSource] = useState(null);
    const [patients, setPatients] = useState([]);
    const [loadingPatients, setLoadingPatients] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchSources();
        // Reset sub-view when tab changes
        setSelectedSource(null);
        setPatients([]);
        setSearchQuery('');
    }, [activeTab]);

    const fetchSources = async () => {
        setLoading(true);
        try {
            const res = await sourceAPI.getSources({ type: activeTab });
            if (res.success) {
                setSources(res.data || []);
            }
        } catch (err) {
            console.error('Error fetching sources:', err);
            alert('Failed to load sources.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingSource(null);
        setFormData({ sourceName: '', status: 'Active' });
        setModalError('');
        setShowModal(true);
    };

    const handleOpenEditModal = (source) => {
        setEditingSource(source);
        setFormData({ sourceName: source.sourceName, status: source.status });
        setModalError('');
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setFormData({ sourceName: '', status: 'Active' });
    };

    const handleSaveSource = async (e) => {
        e.preventDefault();
        if (!formData.sourceName.trim()) {
            setModalError('Source Name is required.');
            return;
        }

        setSaving(true);
        setModalError('');
        try {
            if (editingSource) {
                // Update
                const res = await sourceAPI.updateSource(editingSource._id, {
                    sourceName: formData.sourceName,
                    status: formData.status
                });
                if (res.success) {
                    // Update active view if it's the currently viewed source
                    if (selectedSource && selectedSource._id === editingSource._id) {
                        setSelectedSource(res.data);
                    }
                    fetchSources();
                    handleCloseModal();
                }
            } else {
                // Create
                const res = await sourceAPI.createSource({
                    sourceType: activeTab,
                    sourceName: formData.sourceName,
                    status: formData.status
                });
                if (res.success) {
                    fetchSources();
                    handleCloseModal();
                }
            }
        } catch (err) {
            setModalError(err.response?.data?.message || 'Failed to save source.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSource = async (sourceId) => {
        if (!window.confirm('Are you sure you want to delete this source? This action cannot be undone.')) {
            return;
        }

        try {
            const res = await sourceAPI.deleteSource(sourceId);
            if (res.success) {
                if (selectedSource && selectedSource._id === sourceId) {
                    setSelectedSource(null);
                    setPatients([]);
                }
                fetchSources();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete source.');
        }
    };

    const handleSelectSource = async (source) => {
        setSelectedSource(source);
        setSearchQuery('');
        setLoadingPatients(true);
        try {
            const res = await sourceAPI.getSourcePatients(source._id);
            if (res.success) {
                setPatients(res.patients || []);
            }
        } catch (err) {
            console.error('Error fetching patients for source:', err);
            alert('Failed to load registered patients.');
        } finally {
            setLoadingPatients(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatCoupleIdForUI = (coupleId) => {
        if (!coupleId) return '';
        const match = coupleId.match(/^(CPL-?)0*(\d+)$/i);
        if (match) {
            return `${match[1]}${parseInt(match[2], 10)}`;
        }
        return coupleId;
    };

    return (
        <div className="source-mgmt-body">
            {/* Header section with gradient */}
            <div className="source-mgmt-header">
                <div>
                    <h1>Source Management</h1>
                    <p>Configure dynamic B2B and B2C patient referral channels for registration and analytics.</p>
                </div>
                <button className="btn-add-source" onClick={handleOpenAddModal}>
                    <FiPlus /> Add Source
                </button>
            </div>

            {/* Tab navigation */}
            <div className="source-tab-navbar">
                <button 
                    className={`source-tab-btn ${activeTab === 'B2C' ? 'active' : ''}`}
                    onClick={() => setActiveTab('B2C')}
                >
                    B2C Sources
                </button>
                <button 
                    className={`source-tab-btn ${activeTab === 'B2B' ? 'active' : ''}`}
                    onClick={() => setActiveTab('B2B')}
                >
                    B2B Sources
                </button>
            </div>

            <div className="source-mgmt-container">
                {/* Main Source List Table */}
                <div className="source-table-card">
                    {loading ? (
                        <div className="source-loading">
                            <div className="spinner"></div>
                            <span>Loading referral sources...</span>
                        </div>
                    ) : sources.length === 0 ? (
                        <div className="source-empty-state">
                            <FiInfo size={32} />
                            <span>No dynamic {activeTab} sources registered yet.</span>
                            <button className="btn-secondary-link" onClick={handleOpenAddModal}>+ Add First Source</button>
                        </div>
                    ) : (
                        <table className="sources-data-table">
                            <thead>
                                <tr>
                                    <th>Source Name</th>
                                    <th>Status</th>
                                    <th>Total Patients</th>
                                    <th>Created Date</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sources.map((source) => (
                                    <tr 
                                        key={source._id}
                                        className={selectedSource && selectedSource._id === source._id ? 'row-selected' : ''}
                                    >
                                        <td className="source-clickable-name" onClick={() => handleSelectSource(source)}>
                                            {source.sourceName}
                                        </td>
                                        <td>
                                            <span className={`status-pill ${source.status.toLowerCase()}`}>
                                                {source.status}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="patient-count-badge">
                                                {source.totalPatients || 0} Patients
                                            </span>
                                        </td>
                                        <td>{formatDate(source.createdAt)}</td>
                                        <td className="source-action-cell">
                                            <button 
                                                className="btn-action-icon edit" 
                                                title="Edit Source"
                                                onClick={() => handleOpenEditModal(source)}
                                            >
                                                <FiEdit2 />
                                            </button>
                                            <button 
                                                className="btn-action-icon delete" 
                                                title="Delete Source"
                                                onClick={() => handleDeleteSource(source._id)}
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Patient Listing Sub-view */}
                {selectedSource && (() => {
                    const deDuplicatedPatients = [];
                    const seenCouples = new Set();
                    for (const pat of patients) {
                        if (pat.coupleId) {
                            const normalizedId = pat.coupleId.trim().toUpperCase();
                            if (seenCouples.has(normalizedId)) {
                                continue;
                            }
                            seenCouples.add(normalizedId);
                        }
                        deDuplicatedPatients.push(pat);
                    }

                    // Apply real-time search filtering on Couple ID
                    const filteredPatients = deDuplicatedPatients.filter(pat => {
                        if (!searchQuery.trim()) return true;
                        if (!pat.coupleId) return false;
                        const query = searchQuery.trim().toUpperCase();
                        const formattedCoupleId = formatCoupleIdForUI(pat.coupleId).toUpperCase();
                        const rawCoupleId = pat.coupleId.toUpperCase();
                        return formattedCoupleId.includes(query) || rawCoupleId.includes(query);
                    });

                    return (
                        <div className="patient-list-container">
                            <div className="patient-list-header">
                                <div>
                                    <h2>Patients Registered From: <span>{selectedSource.sourceName}</span></h2>
                                    <p className="subtitle">Displaying all patients registered under this referral channel.</p>
                                </div>
                                <button className="btn-close-view" onClick={() => setSelectedSource(null)}>
                                    <FiX />
                                </button>
                            </div>

                            {loadingPatients ? (
                                <div className="patient-loading">
                                    <div className="spinner"></div>
                                    <span>Retrieving patient profiles...</span>
                                </div>
                            ) : deDuplicatedPatients.length === 0 ? (
                                <div className="patient-empty-state">
                                    <FiUser size={30} style={{ opacity: 0.5 }} />
                                    <span>No patients registered under this source yet.</span>
                                </div>
                            ) : (
                                <>
                                    <div className="patient-search-container">
                                        <input
                                            type="text"
                                            className="patient-search-input"
                                            placeholder="Search by Couple ID..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    {filteredPatients.length === 0 ? (
                                        <div className="patient-empty-state">
                                            <FiUser size={30} style={{ opacity: 0.5 }} />
                                            <span>No matching couple found.</span>
                                        </div>
                                    ) : (
                                        <div className="patient-table-wrapper">
                                            <table className="patients-data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Couple Name</th>
                                                        <th>Couple ID</th>
                                                        <th>Registration Date</th>
                                                        <th>Source Type</th>
                                                        <th>Source</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredPatients.map((pat) => (
                                                        <tr key={pat._id}>
                                                            <td className="patient-couple-cell">
                                                                <FiUser className="user-icon" />
                                                                <span className="couple-name">{pat.coupleName}</span>
                                                            </td>
                                                            <td>
                                                                {pat.coupleId ? (
                                                                    <span className="couple-id-badge">{formatCoupleIdForUI(pat.coupleId)}</span>
                                                                ) : (
                                                                    <span className="single-badge">Single</span>
                                                                )}
                                                            </td>
                                                            <td>{formatDate(pat.registrationDate)}</td>
                                                            <td>{pat.sourceType}</td>
                                                            <td>{pat.source}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Premium Dialog/Modal for Add/Edit Source */}
            {showModal && (
                <div className="source-modal-overlay">
                    <div className="source-modal-card">
                        <div className="source-modal-header">
                            <h3>{editingSource ? 'Edit Source' : `Add ${activeTab} Source`}</h3>
                            <button className="btn-close-modal" onClick={handleCloseModal}>
                                <FiX />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSource}>
                            <div className="source-modal-body">
                                {modalError && (
                                    <div className="modal-error-banner">
                                        {modalError}
                                    </div>
                                )}
                                <div className="source-form-group">
                                    <label htmlFor="sourceName">Source Name *</label>
                                    <input 
                                        type="text" 
                                        id="sourceName"
                                        placeholder={activeTab === 'B2C' ? 'e.g. Instagram, Facebook' : 'e.g. Corporate, Insurance'}
                                        value={formData.sourceName}
                                        onChange={(e) => setFormData({ ...formData, sourceName: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="source-form-group">
                                    <label htmlFor="sourceStatus">Status</label>
                                    <select 
                                        id="sourceStatus"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="source-modal-footer">
                                <button 
                                    type="button" 
                                    className="btn-modal-cancel" 
                                    onClick={handleCloseModal}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-modal-save" 
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HospitalAdminSources;
