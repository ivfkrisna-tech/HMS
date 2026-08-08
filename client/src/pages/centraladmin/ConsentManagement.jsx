import React, { useState, useEffect, useCallback } from 'react';
import { consentAPI } from '../../utils/api';
import './ConsentManagement.css';

const ConsentManagement = () => {
    // Section navigation
    const [section, setSection] = useState('dashboard'); // dashboard | categories | templates

    // Toasts
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Dashboard stats
    const [stats, setStats] = useState({ totalCategories: 0, totalTemplates: 0, activeTemplates: 0, inactiveTemplates: 0 });
    const [loadingStats, setLoadingStats] = useState(false);

    // Categories
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
    const [editCategory, setEditCategory] = useState(null);
    const [savingCategory, setSavingCategory] = useState(false);
    const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState(null);

    // Templates
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Template form modal
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editTemplate, setEditTemplate] = useState(null);
    const [templateForm, setTemplateForm] = useState({ name: '', categoryId: '', description: '', isActive: true, file: null });
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [fileError, setFileError] = useState('');

    // View modal
    const [viewTemplate, setViewTemplate] = useState(null);

    // Delete confirm
    const [deleteTemplateConfirm, setDeleteTemplateConfirm] = useState(null);

    // Auto-clear toasts
    useEffect(() => {
        if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); }
    }, [error]);
    useEffect(() => {
        if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }
    }, [success]);

    // ── Data Fetching ───────────────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        setLoadingStats(true);
        try {
            const res = await consentAPI.getStats();
            if (res.success) setStats(res.stats);
        } catch (err) { console.error('Failed to load consent stats:', err); }
        finally { setLoadingStats(false); }
    }, []);

    const fetchCategories = useCallback(async () => {
        setLoadingCategories(true);
        try {
            const res = await consentAPI.getCategories();
            if (res.success) setCategories(res.categories);
        } catch (err) { console.error('Failed to load categories:', err); }
        finally { setLoadingCategories(false); }
    }, []);

    const fetchTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        try {
            const params = {};
            if (searchQuery) params.search = searchQuery;
            if (filterCategory) params.categoryId = filterCategory;
            if (filterStatus) params.status = filterStatus;
            const res = await consentAPI.getTemplates(params);
            if (res.success) setTemplates(res.templates);
        } catch (err) { console.error('Failed to load templates:', err); }
        finally { setLoadingTemplates(false); }
    }, [searchQuery, filterCategory, filterStatus]);

    useEffect(() => { fetchStats(); fetchCategories(); }, [fetchStats, fetchCategories]);
    useEffect(() => { if (section === 'templates') fetchTemplates(); }, [section, fetchTemplates]);

    // ── Category Handlers ───────────────────────────────────────────────────
    const openCategoryForm = (cat = null) => {
        if (cat) {
            setEditCategory(cat);
            setCategoryForm({ name: cat.name, description: cat.description || '' });
        } else {
            setEditCategory(null);
            setCategoryForm({ name: '', description: '' });
        }
        setShowCategoryForm(true);
    };

    const closeCategoryForm = () => {
        setShowCategoryForm(false);
        setEditCategory(null);
        setCategoryForm({ name: '', description: '' });
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        if (!categoryForm.name.trim()) { setError('Category name is required'); return; }
        setSavingCategory(true);
        setError(''); setSuccess('');
        try {
            if (editCategory) {
                const res = await consentAPI.updateCategory(editCategory._id, categoryForm);
                if (res.success) { setSuccess(res.message || 'Category updated!'); closeCategoryForm(); fetchCategories(); fetchStats(); }
            } else {
                const res = await consentAPI.createCategory(categoryForm);
                if (res.success) { setSuccess(res.message || 'Category created!'); closeCategoryForm(); fetchCategories(); fetchStats(); }
            }
        } catch (err) { setError(err.response?.data?.message || 'Failed to save category'); }
        finally { setSavingCategory(false); }
    };

    const handleDeleteCategory = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await consentAPI.deleteCategory(id);
            if (res.success) { setSuccess(res.message || 'Category deleted!'); setDeleteCategoryConfirm(null); fetchCategories(); fetchStats(); }
        } catch (err) { setError(err.response?.data?.message || 'Failed to delete category'); setDeleteCategoryConfirm(null); }
    };

    const handleToggleCategory = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await consentAPI.toggleCategory(id);
            if (res.success) { setSuccess(res.message); fetchCategories(); }
        } catch (err) { setError(err.response?.data?.message || 'Failed to toggle category'); }
    };

    // ── Template Handlers ───────────────────────────────────────────────────
    const openTemplateModal = (tmpl = null) => {
        setFileError('');
        if (tmpl) {
            setEditTemplate(tmpl);
            setTemplateForm({
                name: tmpl.name,
                categoryId: tmpl.categoryId?._id || tmpl.categoryId || '',
                description: tmpl.description || '',
                isActive: tmpl.isActive,
                file: null,
            });
        } else {
            setEditTemplate(null);
            setTemplateForm({ name: '', categoryId: '', description: '', isActive: true, file: null });
        }
        setShowTemplateModal(true);
    };

    const closeTemplateModal = () => {
        setShowTemplateModal(false);
        setEditTemplate(null);
        setTemplateForm({ name: '', categoryId: '', description: '', isActive: true, file: null });
        setFileError('');
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFileError('');
        if (!file) { setTemplateForm(f => ({ ...f, file: null })); return; }

        const ext = file.name.split('.').pop().toLowerCase();
        const rejectedTypes = ['pdf', 'jpg', 'jpeg', 'png'];
        if (rejectedTypes.includes(ext)) {
            setFileError(`❌ .${ext} files are not allowed. Only .docx files are accepted.`);
            e.target.value = '';
            setTemplateForm(f => ({ ...f, file: null }));
            return;
        }
        if (ext !== 'docx') {
            setFileError(`❌ .${ext} files are not supported. Only .docx files are accepted.`);
            e.target.value = '';
            setTemplateForm(f => ({ ...f, file: null }));
            return;
        }
        setTemplateForm(f => ({ ...f, file }));
    };

    const handleSaveTemplate = async (e) => {
        e.preventDefault();
        if (!templateForm.name.trim()) { setError('Consent name is required'); return; }
        if (!templateForm.categoryId) { setError('Category is required'); return; }
        if (!editTemplate && !templateForm.file) { setError('Template file (.docx) is required'); return; }

        setSavingTemplate(true);
        setError(''); setSuccess('');
        try {
            const formData = new FormData();
            formData.append('name', templateForm.name.trim());
            formData.append('categoryId', templateForm.categoryId);
            formData.append('description', templateForm.description.trim());
            formData.append('isActive', String(templateForm.isActive));
            if (templateForm.file) formData.append('templateFile', templateForm.file);

            if (editTemplate) {
                const res = await consentAPI.updateTemplate(editTemplate._id, formData);
                if (res.success) { setSuccess(res.message || 'Template updated!'); closeTemplateModal(); fetchTemplates(); fetchStats(); }
            } else {
                const res = await consentAPI.createTemplate(formData);
                if (res.success) { setSuccess(res.message || 'Template created!'); closeTemplateModal(); fetchTemplates(); fetchStats(); }
            }
        } catch (err) { setError(err.response?.data?.message || 'Failed to save template'); }
        finally { setSavingTemplate(false); }
    };

    const handleDeleteTemplate = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await consentAPI.deleteTemplate(id);
            if (res.success) { setSuccess(res.message || 'Template deleted!'); setDeleteTemplateConfirm(null); fetchTemplates(); fetchStats(); }
        } catch (err) { setError(err.response?.data?.message || 'Failed to delete template'); setDeleteTemplateConfirm(null); }
    };

    const handleDownload = async (tmpl) => {
        try {
            const token = localStorage.getItem('token');
            const url = consentAPI.getDownloadUrl(tmpl._id);
            const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = tmpl.originalFileName || 'consent-template.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (err) { setError('Failed to download template file'); }
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const formatFileSize = (bytes) => {
        if (!bytes) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const sections = [
        { id: 'dashboard', label: '📊 Dashboard' },
        { id: 'categories', label: '📁 Categories' },
        { id: 'templates', label: '📄 Templates' },
    ];

    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div>
            {error && <div className="error-message">⚠️ {error}</div>}
            {success && <div className="success-message">✅ {success}</div>}

            {/* Section Tabs */}
            <div className="consent-section-tabs">
                {sections.map(s => (
                    <button
                        key={s.id}
                        className={`consent-section-tab ${section === s.id ? 'consent-section-tab-active' : ''}`}
                        onClick={() => setSection(s.id)}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* ═══════ DASHBOARD SECTION ═══════ */}
            {section === 'dashboard' && (
                <div>
                    <div className="consent-stats-grid">
                        {[
                            { icon: '📁', label: 'Total Categories', value: stats.totalCategories, bg: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' },
                            { icon: '📄', label: 'Total Templates', value: stats.totalTemplates, bg: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' },
                            { icon: '✅', label: 'Active Templates', value: stats.activeTemplates, bg: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' },
                            { icon: '⏸️', label: 'Inactive Templates', value: stats.inactiveTemplates, bg: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)' },
                        ].map((card, i) => (
                            <div key={i} className="consent-stat-card" style={{ background: card.bg }}>
                                <div className="consent-stat-icon">{card.icon}</div>
                                <div className="consent-stat-value">{loadingStats ? '...' : card.value}</div>
                                <div className="consent-stat-label">{card.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions */}
                    <div className="admin-card">
                        <h3>⚡ Quick Actions</h3>
                        <p style={{ color: '#888', fontSize: '13px', margin: '0 0 16px' }}>Jump to manage consent categories or templates.</p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button className="btn-save" style={{ padding: '10px 20px' }} onClick={() => setSection('categories')}>
                                📁 Manage Categories
                            </button>
                            <button className="btn-save" style={{ padding: '10px 20px' }} onClick={() => setSection('templates')}>
                                📄 Manage Templates
                            </button>
                            <button className="btn-edit" style={{ padding: '10px 20px' }} onClick={() => { setSection('templates'); setTimeout(() => openTemplateModal(), 100); }}>
                                + Add Consent Template
                            </button>
                        </div>
                    </div>

                    {/* Info Card */}
                    <div className="admin-card" style={{ border: '2px solid #e0f2fe', marginTop: '16px' }}>
                        <h3>ℹ️ About Consent Management</h3>
                        <div style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.8 }}>
                            <p style={{ margin: '0 0 12px' }}>
                                This module manages all IVF consent templates centrally. Only Super Admins can create, edit, or delete consent templates.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                    <strong style={{ color: '#16a34a' }}>✅ Current Phase</strong>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#166534' }}>Upload & store Word (.docx) consent templates with categories and metadata.</p>
                                </div>
                                <div style={{ background: '#fffbeb', padding: '12px 16px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                                    <strong style={{ color: '#d97706' }}>🔮 Future Phase</strong>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#92400e' }}>Auto-fill patient details into templates and generate signed PDFs.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ CATEGORIES SECTION ═══════ */}
            {section === 'categories' && (
                <div className="admin-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h2 style={{ margin: '0 0 4px', fontSize: '20px', color: '#1e293b' }}>📁 Consent Categories</h2>
                            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Organize consent templates by category</p>
                        </div>
                        <button
                            className={showCategoryForm ? 'btn-cancel' : 'btn-save'}
                            style={{ padding: '10px 18px' }}
                            onClick={() => showCategoryForm ? closeCategoryForm() : openCategoryForm()}
                        >
                            {showCategoryForm ? 'Cancel' : '+ Add Category'}
                        </button>
                    </div>

                    {/* Category Form */}
                    {showCategoryForm && (
                        <div className="ca-form-box" style={{ marginBottom: '24px' }}>
                            <h3>{editCategory ? '✏️ Edit Category' : '📁 Add New Category'}</h3>
                            <form onSubmit={handleSaveCategory} className="user-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="staff-label">Category Name *</label>
                                        <input
                                            type="text"
                                            className="staff-input"
                                            placeholder="e.g. IVF, Anaesthesia, General"
                                            value={categoryForm.name}
                                            onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="staff-label">Description (Optional)</label>
                                        <input
                                            type="text"
                                            className="staff-input"
                                            placeholder="Brief description of this category"
                                            value={categoryForm.description}
                                            onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <button type="submit" disabled={savingCategory} className="submit-button">
                                    {savingCategory ? 'Saving...' : editCategory ? '✅ Update Category' : '✅ Create Category'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Categories Table */}
                    {loadingCategories ? (
                        <div className="loading-message">Loading categories...</div>
                    ) : categories.length === 0 ? (
                        <div className="ca-empty">
                            <p>No categories yet. Click <strong>+ Add Category</strong> to create one.</p>
                        </div>
                    ) : (
                        <div className="users-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Category Name</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categories.map(cat => (
                                        <tr key={cat._id}>
                                            <td style={{ fontWeight: 600 }}>{cat.name}</td>
                                            <td style={{ color: '#64748b', fontSize: '13px' }}>{cat.description || '—'}</td>
                                            <td>
                                                <span className={`status-badge ${cat.isActive ? 'status-active' : 'status-inactive'}`}>
                                                    {cat.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px', color: '#64748b' }}>{formatDate(cat.createdAt)}</td>
                                            <td>
                                                <div className="consent-actions">
                                                    <button className="consent-action-edit" onClick={() => openCategoryForm(cat)}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        className={cat.isActive ? 'consent-action-delete' : 'consent-action-view'}
                                                        onClick={() => handleToggleCategory(cat._id)}
                                                        title={cat.isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {cat.isActive ? '⏸️ Deactivate' : '▶️ Activate'}
                                                    </button>
                                                    <button className="consent-action-delete" onClick={() => setDeleteCategoryConfirm(cat._id)}>
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════ TEMPLATES SECTION ═══════ */}
            {section === 'templates' && (
                <div className="admin-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h2 style={{ margin: '0 0 4px', fontSize: '20px', color: '#1e293b' }}>📄 Consent Templates</h2>
                            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Upload and manage consent form templates (.docx)</p>
                        </div>
                        <button className="btn-save" style={{ padding: '10px 18px' }} onClick={() => openTemplateModal()}>
                            + Add Consent
                        </button>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="consent-filter-bar">
                        <input
                            type="text"
                            className="consent-search-input"
                            placeholder="🔍 Search by consent name..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <select
                            className="consent-filter-select"
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat._id} value={cat._id}>{cat.name}</option>
                            ))}
                        </select>
                        <select
                            className="consent-filter-select"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    {/* Templates Table */}
                    {loadingTemplates ? (
                        <div className="loading-message">Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className="ca-empty">
                            <p>No consent templates found. Click <strong>+ Add Consent</strong> to upload one.</p>
                        </div>
                    ) : (
                        <div className="users-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Consent Name</th>
                                        <th>Category</th>
                                        <th>File Name</th>
                                        <th>File Type</th>
                                        <th>Status</th>
                                        <th>Created Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {templates.map(tmpl => (
                                        <tr key={tmpl._id}>
                                            <td style={{ fontWeight: 600 }}>{tmpl.name}</td>
                                            <td>
                                                <span className="role-badge">{tmpl.categoryId?.name || '—'}</span>
                                            </td>
                                            <td style={{ fontSize: '13px', color: '#64748b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {tmpl.originalFileName || '—'}
                                            </td>
                                            <td>
                                                <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                                    .docx
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${tmpl.isActive ? 'status-active' : 'status-inactive'}`}>
                                                    {tmpl.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px', color: '#64748b' }}>{formatDate(tmpl.createdAt)}</td>
                                            <td>
                                                <div className="consent-actions">
                                                    <button className="consent-action-view" onClick={() => setViewTemplate(tmpl)}>
                                                        👁️ View
                                                    </button>
                                                    <button className="consent-action-edit" onClick={() => openTemplateModal(tmpl)}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button className="consent-action-delete" onClick={() => setDeleteTemplateConfirm(tmpl._id)}>
                                                        🗑️
                                                    </button>
                                                    <button className="consent-action-download" onClick={() => handleDownload(tmpl)}>
                                                        ⬇️ Download
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════ ADD / EDIT TEMPLATE MODAL ═══════ */}
            {showTemplateModal && (
                <div className="modal-overlay">
                    <div className="modal-content consent-modal-wide">
                        <h3>{editTemplate ? '✏️ Edit Consent Template' : '📄 Add Consent Template'}</h3>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 20px' }}>
                            {editTemplate ? 'Update the consent template details. Optionally upload a new file.' : 'Upload a Word (.docx) consent template.'}
                        </p>

                        <form onSubmit={handleSaveTemplate}>
                            {/* Consent Name */}
                            <div style={{ marginBottom: '16px' }}>
                                <label className="staff-label">Consent Name *</label>
                                <input
                                    type="text"
                                    className="staff-input"
                                    placeholder="e.g. IVF Treatment Consent Form"
                                    value={templateForm.name}
                                    onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                                    required
                                />
                            </div>

                            {/* Category */}
                            <div style={{ marginBottom: '16px' }}>
                                <label className="staff-label">Category *</label>
                                <select
                                    className="staff-input"
                                    value={templateForm.categoryId}
                                    onChange={e => setTemplateForm(f => ({ ...f, categoryId: e.target.value }))}
                                    required
                                >
                                    <option value="">-- Select Category --</option>
                                    {categories.filter(c => c.isActive).map(cat => (
                                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: '16px' }}>
                                <label className="staff-label">Description (Optional)</label>
                                <input
                                    type="text"
                                    className="staff-input"
                                    placeholder="Brief description of this consent form"
                                    value={templateForm.description}
                                    onChange={e => setTemplateForm(f => ({ ...f, description: e.target.value }))}
                                />
                            </div>

                            {/* File Upload */}
                            <div style={{ marginBottom: '16px' }}>
                                <label className="staff-label">
                                    Upload Template {editTemplate ? '(Optional — upload to replace)' : '*'}
                                </label>
                                <input
                                    type="file"
                                    className="staff-input"
                                    accept=".docx"
                                    style={{ padding: '8px' }}
                                    onChange={handleFileChange}
                                />
                                {fileError && <div className="consent-file-reject" style={{ marginTop: '8px' }}>{fileError}</div>}
                                {templateForm.file && !fileError && (
                                    <div className="consent-file-info" style={{ marginTop: '8px' }}>
                                        📎 {templateForm.file.name} ({formatFileSize(templateForm.file.size)})
                                    </div>
                                )}
                                {editTemplate && !templateForm.file && (
                                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                                        Current file: <strong>{editTemplate.originalFileName}</strong>
                                    </div>
                                )}
                                <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                                    Only <strong>.docx</strong> files are allowed. PDF, JPG, PNG, JPEG files will be rejected.
                                </div>
                            </div>

                            {/* Status */}
                            <div style={{ marginBottom: '20px' }}>
                                <label className="staff-label" style={{ marginBottom: '8px', display: 'block' }}>Status</label>
                                <div className="consent-status-group">
                                    <div
                                        className={`consent-status-option ${templateForm.isActive ? 'active-selected' : ''}`}
                                        onClick={() => setTemplateForm(f => ({ ...f, isActive: true }))}
                                    >
                                        <span style={{ fontSize: '18px' }}>✅</span> Active
                                    </div>
                                    <div
                                        className={`consent-status-option ${!templateForm.isActive ? 'inactive-selected' : ''}`}
                                        onClick={() => setTemplateForm(f => ({ ...f, isActive: false }))}
                                    >
                                        <span style={{ fontSize: '18px' }}>⏸️</span> Inactive
                                    </div>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="modal-buttons">
                                <button type="submit" className="btn-save" disabled={savingTemplate} style={{ padding: '10px 24px' }}>
                                    {savingTemplate ? 'Saving...' : editTemplate ? '✅ Update Template' : '✅ Save Template'}
                                </button>
                                <button type="button" className="btn-cancel" onClick={closeTemplateModal}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════ VIEW TEMPLATE MODAL ═══════ */}
            {viewTemplate && (
                <div className="modal-overlay">
                    <div className="modal-content consent-modal-wide">
                        <h3>📄 {viewTemplate.name}</h3>
                        <div className="consent-view-detail" style={{ marginBottom: '20px' }}>
                            <div className="consent-view-row">
                                <span className="consent-view-label">Category</span>
                                <span className="consent-view-value">
                                    <span className="role-badge">{viewTemplate.categoryId?.name || '—'}</span>
                                </span>
                            </div>
                            <div className="consent-view-row">
                                <span className="consent-view-label">Description</span>
                                <span className="consent-view-value">{viewTemplate.description || '—'}</span>
                            </div>
                            <div className="consent-view-row">
                                <span className="consent-view-label">File Name</span>
                                <span className="consent-view-value">{viewTemplate.originalFileName}</span>
                            </div>
                            <div className="consent-view-row">
                                <span className="consent-view-label">File Size</span>
                                <span className="consent-view-value">{formatFileSize(viewTemplate.fileSize)}</span>
                            </div>
                            <div className="consent-view-row">
                                <span className="consent-view-label">File Type</span>
                                <span className="consent-view-value">
                                    <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>.docx</span>
                                </span>
                            </div>
                            <div className="consent-view-row">
                                <span className="consent-view-label">Status</span>
                                <span className="consent-view-value">
                                    <span className={`status-badge ${viewTemplate.isActive ? 'status-active' : 'status-inactive'}`}>
                                        {viewTemplate.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </span>
                            </div>
                            <div className="consent-view-row">
                                <span className="consent-view-label">Version</span>
                                <span className="consent-view-value">v{viewTemplate.version || 1}</span>
                            </div>
                            <div className="consent-view-row">
                                <span className="consent-view-label">Created By</span>
                                <span className="consent-view-value">{viewTemplate.createdBy?.name || '—'}</span>
                            </div>
                            <div className="consent-view-row">
                                <span className="consent-view-label">Created</span>
                                <span className="consent-view-value">{formatDate(viewTemplate.createdAt)}</span>
                            </div>
                            <div className="consent-view-row">
                                <span className="consent-view-label">Updated</span>
                                <span className="consent-view-value">{formatDate(viewTemplate.updatedAt)}</span>
                            </div>
                            {viewTemplate.placeholders?.length > 0 && (
                                <div className="consent-view-row" style={{ alignItems: 'flex-start' }}>
                                    <span className="consent-view-label">Placeholders</span>
                                    <span className="consent-view-value">
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {viewTemplate.placeholders.map((p, i) => (
                                                <span key={i} style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>
                                                    {`{{${p}}}`}
                                                </span>
                                            ))}
                                        </div>
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="modal-buttons">
                            <button className="consent-action-download" style={{ padding: '8px 16px' }} onClick={() => handleDownload(viewTemplate)}>
                                ⬇️ Download Original
                            </button>
                            <button className="btn-cancel" onClick={() => setViewTemplate(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ DELETE CATEGORY CONFIRM ═══════ */}
            {deleteCategoryConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>🗑️ Delete Category?</h3>
                        <p style={{ color: '#dc2626', fontWeight: 600 }}>
                            This will permanently delete this category. Categories with templates cannot be deleted.
                        </p>
                        <div className="modal-buttons">
                            <button className="btn-confirm-delete" onClick={() => handleDeleteCategory(deleteCategoryConfirm)}>
                                Delete
                            </button>
                            <button className="btn-cancel" onClick={() => setDeleteCategoryConfirm(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ DELETE TEMPLATE CONFIRM ═══════ */}
            {deleteTemplateConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>🗑️ Delete Consent Template?</h3>
                        <p style={{ color: '#dc2626', fontWeight: 600 }}>
                            This will permanently delete the consent template and its uploaded file. This action cannot be undone.
                        </p>
                        <div className="modal-buttons">
                            <button className="btn-confirm-delete" onClick={() => handleDeleteTemplate(deleteTemplateConfirm)}>
                                Delete
                            </button>
                            <button className="btn-cancel" onClick={() => setDeleteTemplateConfirm(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsentManagement;
