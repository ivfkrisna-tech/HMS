import React, { useState, useEffect } from 'react';
import { questionLibraryAPI } from '../../utils/api';
import './AssistantDashboard.css';
import { FiFolder, FiFileText, FiList, FiCheckSquare, FiCalendar, FiType } from 'react-icons/fi';

const AssistantQuestionLibrary = () => {
    const [libraryData, setLibraryData] = useState({});
    const [loading, setLoading] = useState(true);
    const [departmentTab, setDepartmentTab] = useState('');
    const [activeCategory, setActiveCategory] = useState('');
    const [newCatName, setNewCatName] = useState('');

    // Add Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [editIndex, setEditIndex] = useState(null);
    const [saving, setSaving] = useState(false);
    const [newQ, setNewQ] = useState({
        q: '',
        type: 'text',
        options: '', // comma-separated
        extra: '',
        parentQ: '',
        condition: ''
    });

    useEffect(() => {
        fetchLibrary();
    }, []);

    const fetchLibrary = async () => {
        try {
            const res = await questionLibraryAPI.getLibrary();
            let data = res.data?.data || {};

            setLibraryData(data);

            const visibleDepts = res.allowedDepartments ? Object.keys(data).filter(d => res.allowedDepartments.includes(d)) : Object.keys(data);
            
            if (visibleDepts.length > 0) {
                const defaultDept = visibleDepts[0];
                setDepartmentTab(defaultDept);
                const firstDeptCats = Object.keys(data[defaultDept] || {});
                if (firstDeptCats.length > 0) {
                    setActiveCategory(firstDeptCats[0]);
                }
            }
        } catch (err) {
            console.error('Error fetching question library:', err);
        } finally {
            setLoading(false);
        }
    };

    const getIconForType = (type) => {
        switch (type) {
            case 'text':
            case 'textarea': return <FiType />;
            case 'select':
            case 'gender-toggle':
            case 'yes-no': return <FiList />;
            case 'checkbox-group':
            case 'checkbox-date-group':
            case 'checkbox-text-group': return <FiCheckSquare />;
            case 'date': return <FiCalendar />;
            default: return <FiFileText />;
        }
    };

    const resetModalState = () => {
        setShowAddModal(false);
        setEditIndex(null);
        setNewQ({ q: '', type: 'text', options: '', extra: '', parentQ: '', condition: '' });
    };

    const handleAddCategory = () => {
        const cat = newCatName.trim();
        if (!cat) return;
        if (libraryData[departmentTab] && libraryData[departmentTab][cat]) {
            alert("Category already exists for " + departmentTab);
            return;
        }

        const newLib = { ...libraryData };
        if (!newLib[departmentTab]) newLib[departmentTab] = {};
        newLib[departmentTab][cat] = [];

        setLibraryData(newLib);
        setActiveCategory(cat);
        setNewCatName('');
        
        setSaving(true);
        questionLibraryAPI.updateLibrary(newLib)
            .then(res => {
                if (res.success) alert("Category added successfully!");
            })
            .catch(err => {
                console.error(err);
                alert("Error saving new category.");
            })
            .finally(() => setSaving(false));
    };

    const renderQuestionPreview = (item) => {
        let inputHtml = null;

        if (item.type === "gender-toggle") {
            inputHtml = (
                <select disabled style={{ width: '160px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b' }}>
                    <option>Female</option>
                    <option>Male</option>
                </select>
            );
        } else if (item.type === "select") {
            inputHtml = (
                <select disabled style={{ width: '160px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b' }}>
                    <option>Select...</option>
                    {(item.options || []).map(o => <option key={o}>{o}</option>)}
                </select>
            );
        } else if (item.type === "yes-no") {
            inputHtml = (
                <select disabled style={{ width: '160px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b' }}>
                    <option>Select...</option>
                    <option>Yes</option>
                    <option>No</option>
                </select>
            );
        } else if (item.type === "date") {
            inputHtml = <input type="date" disabled style={{ width: '200px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b' }} />;
        } else if (item.type === "checkbox-group") {
            inputHtml = (
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    {(item.options || []).map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                            <input type='checkbox' disabled /> {opt}
                        </label>
                    ))}
                </div>
            );
        } else if (item.type === "textarea") {
            inputHtml = <textarea disabled rows="3" placeholder="Long text area..." style={{ width: '100%', resize: 'vertical', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b' }} />;
        } else if (item.type === "checkbox-date-group" || item.type === "checkbox-text-group") {
            inputHtml = (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    {(item.options || []).map(opt => (
                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: '500', minWidth: '120px' }}>
                                <input type='checkbox' disabled /> {opt}
                            </label>
                            {opt !== 'None' && <input type={item.type === 'checkbox-date-group' ? 'date' : 'text'} disabled placeholder="Input..." style={{ width: '160px', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }} />}
                        </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>{item.extra || 'Remarks'}:</span>
                        <input type="text" disabled placeholder="Details..." style={{ flex: 1, padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }} />
                    </div>
                </div>
            );
        } else if (item.type === "row") {
            inputHtml = (
                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    {(item.fields || []).map(field => (
                        <div style={{ flex: 1 }} key={field.q}>
                            <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'block', fontWeight: '600' }}>{field.q}</label>
                            <input type={field.type || 'text'} disabled style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b' }} />
                        </div>
                    ))}
                </div>
            );
        } else {
            inputHtml = <input type={item.type || 'text'} disabled placeholder="Short Text Input" style={{ width: '100%', padding: '10px', boxSizing: 'border-box', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b' }} />;
        }
        return inputHtml;
    };

    const handleAddQuestion = async () => {
        const qText = newQ.q.trim();
        if (!qText) {
            alert("Please enter a question.");
            return;
        }

        const finalQuestion = {
            q: qText,
            type: newQ.type
        };

        if (['select', 'checkbox-group', 'checkbox-date-group', 'checkbox-text-group'].includes(newQ.type)) {
            finalQuestion.options = newQ.options.split(',').map(s => s.trim()).filter(s => s);
        }

        if (['checkbox-date-group', 'checkbox-text-group'].includes(newQ.type)) {
            finalQuestion.extra = newQ.extra.trim() || 'Remarks';
        }

        if (newQ.parentQ.trim() && newQ.condition.trim()) {
            finalQuestion.parentQ = newQ.parentQ.trim();
            finalQuestion.condition = newQ.condition.trim();
        }

        const newLib = { ...libraryData };
        if (!newLib[departmentTab]) newLib[departmentTab] = {};
        if (!newLib[departmentTab][activeCategory]) {
            newLib[departmentTab][activeCategory] = [];
        }

        if (editIndex !== null) {
            newLib[departmentTab][activeCategory][editIndex] = finalQuestion;
        } else {
            newLib[departmentTab][activeCategory] = [
                ...newLib[departmentTab][activeCategory],
                finalQuestion
            ];
        }

        setSaving(true);
        try {
            const res = await questionLibraryAPI.updateLibrary(newLib);
            if (res.success) {
                setLibraryData(newLib);
                resetModalState();
                alert(editIndex !== null ? "Question updated successfully!" : "Question added successfully!");
            } else {
                throw new Error("Failed to save");
            }
        } catch (err) {
            console.error(err);
            alert("Error saving question.");
        } finally {
            setSaving(false);
        }
    };

    const handleEditQuestion = (index) => {
        const qToEdit = libraryData[departmentTab][activeCategory][index];
        setNewQ({
            q: qToEdit.q || '',
            type: qToEdit.type || 'text',
            options: qToEdit.options ? qToEdit.options.join(', ') : '',
            extra: qToEdit.extra || '',
            parentQ: qToEdit.parentQ || '',
            condition: qToEdit.condition || ''
        });
        setEditIndex(index);
        setShowAddModal(true);
    };

    const handleDeleteQuestion = async (index) => {
        if (!window.confirm("Are you sure you want to delete this question?")) return;
        
        const newLib = { ...libraryData };
        newLib[departmentTab][activeCategory].splice(index, 1);
        
        setSaving(true);
        try {
            const res = await questionLibraryAPI.updateLibrary(newLib);
            if (res.success) {
                setLibraryData(newLib);
                alert("Question deleted successfully!");
            } else {
                throw new Error("Failed to save");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting question.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="assistant-dashboard"><div className="loading-spinner">Loading Library...</div></div>;

    const currentDeptData = libraryData[departmentTab] || {};
    const categories = Object.keys(currentDeptData);
    const currentQuestions = currentDeptData[activeCategory] || [];

    return (
        <div className="assistant-dashboard">
            <header className="dashboard-header">
                <div>
                    <h1><FiFolder style={{ marginRight: '8px', verticalAlign: 'middle', color: '#3b82f6' }} /> Question Library Reference</h1>
                    <p>Browse standardized questions configured by the Hospital Administration.</p>
                </div>
            </header>

            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                
                {/* Sidebar */}
                <div style={{ width: '280px', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: '700' }}>Departments</h3>
                    </div>
                    
                    {/* Department Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', background: 'white' }}>
                        {Object.keys(libraryData).map(dept => (
                            <button 
                                key={dept}
                                onClick={() => {
                                    setDepartmentTab(dept);
                                    const cats = Object.keys(libraryData[dept] || {});
                                    if(cats.length > 0) setActiveCategory(cats[0]);
                                    else setActiveCategory('');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px 10px',
                                    border: 'none',
                                    background: departmentTab === dept ? '#eff6ff' : 'transparent',
                                    color: departmentTab === dept ? '#2563eb' : '#64748b',
                                    fontWeight: departmentTab === dept ? '700' : '500',
                                    borderBottom: departmentTab === dept ? '2px solid #2563eb' : '2px solid transparent',
                                    cursor: 'pointer',
                                    fontFamily: 'Outfit',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {dept}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: '15px 15px 0 15px' }}>
                        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '6px', borderRadius: '8px' }}>
                            <input 
                                type="text" 
                                placeholder="New category name..." 
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory() }}
                                style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                            />
                            <button 
                                onClick={handleAddCategory}
                                style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', padding: '0 12px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}
                                title="Add Category"
                            >+</button>
                        </div>
                    </div>

                    <div style={{ padding: '16px 0', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                        {categories.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>No categories found.</div>
                        ) : categories.map(cat => (
                            <div 
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                style={{
                                    padding: '12px 20px',
                                    margin: '4px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: activeCategory === cat ? '#3b82f6' : 'transparent',
                                    color: activeCategory === cat ? 'white' : '#475569',
                                    fontWeight: activeCategory === cat ? '600' : '500',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                <FiList style={{ opacity: activeCategory === cat ? 1 : 0.6 }} /> {cat}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', overflow: 'hidden' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: '700' }}>
                                {activeCategory || 'Select a Category'}
                            </h2>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                                {currentQuestions.length} Questions in this category
                            </p>
                        </div>
                        {activeCategory && (
                            <button
                                onClick={() => { setEditIndex(null); setNewQ({ q: '', type: 'text', options: '', extra: '', parentQ: '', condition: '' }); setShowAddModal(true); }}
                                style={{
                                    background: '#1e293b', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none',
                                    fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                + Add Question
                            </button>
                        )}
                    </div>

                    <div style={{ padding: '24px', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                        {currentQuestions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                                <FiFileText style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }} />
                                <h3>No Questions Configured</h3>
                                <p>There are no questions in this category yet.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {currentQuestions.map((q, idx) => (
                                    <div key={idx} style={{ position: 'relative', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                                        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 10 }}>
                                            <button 
                                                onClick={() => handleEditQuestion(idx)} 
                                                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteQuestion(idx)} 
                                                style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}
                                            >
                                                🗑️ Del
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingRight: '120px' }}>
                                            <div style={{ background: '#eff6ff', color: '#3b82f6', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                                                {getIconForType(q.type)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: '#0f172a', fontWeight: '600', lineHeight: 1.4 }}>
                                                    {q.q}
                                                </h4>
                                                
                                                {q.parentQ && (
                                                    <div style={{ fontSize: '12px', color: '#ea580c', background: '#ffedd5', padding: '6px 12px', borderRadius: '6px', marginBottom: '14px', display: 'inline-block', fontWeight: '600', border: '1px solid #fdba74' }}>
                                                        Only shown if <b>"{q.parentQ}"</b> equals <b>"{q.condition}"</b>
                                                    </div>
                                                )}
                                                
                                                <div className="input-preview-group" style={{ marginTop: '8px' }}>
                                                    {renderQuestionPreview(q)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal for adding questions */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', color: '#0f172a' }}>{editIndex !== null ? 'Edit Question Details' : 'Add Detailed Question'}</h3>

                        <div>
                            <label className="modal-label">Question Text</label>
                            <textarea className="modal-input" rows="3" placeholder="e.g. Do you smoke? (Enter full details)" value={newQ.q} onChange={(e) => setNewQ({ ...newQ, q: e.target.value })} style={{ resize: 'vertical' }} />
                        </div>

                        <div>
                            <label className="modal-label">Input Type</label>
                            <select className="modal-input" value={newQ.type} onChange={(e) => setNewQ({ ...newQ, type: e.target.value })}>
                                <option value="text">Short Text</option>
                                <option value="number">Numeric Range / Value</option>
                                <option value="yes-no">Yes / No Question</option>
                                <option value="date">Calendar Date Selection</option>
                                <option value="textarea">Long Text / Clinical Note</option>
                                <option value="select">Dropdown Select</option>
                                <option value="checkbox-group">Multiple Choice (Checkboxes)</option>
                                <option value="checkbox-date-group">Checkboxes + Calendar Date Pickers</option>
                                <option value="checkbox-text-group">Checkboxes + Free Form Text Inputs</option>
                            </select>
                        </div>

                        {['select', 'checkbox-group', 'checkbox-date-group', 'checkbox-text-group'].includes(newQ.type) && (
                            <div>
                                <label className="modal-label">Options (Comma separated)</label>
                                <input className="modal-input" placeholder="Option A, Option B, Option C, None" value={newQ.options} onChange={(e) => setNewQ({ ...newQ, options: e.target.value })} />
                            </div>
                        )}

                        {['checkbox-date-group', 'checkbox-text-group'].includes(newQ.type) && (
                            <div>
                                <label className="modal-label">Extra Field Label (Optional Note at the bottom)</label>
                                <input className="modal-input" placeholder="e.g. Physician Notes" value={newQ.extra} onChange={(e) => setNewQ({ ...newQ, extra: e.target.value })} />
                            </div>
                        )}

                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                            <label className="modal-label" style={{ color: '#475569', marginBottom: '8px' }}>Conditional Logic (Optional)</label>
                            <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b' }}>Only display this question if a previous question has a specific answer.</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input className="modal-input" placeholder="Parent Question Title (Exact)" title="Must match the exact text of the parent question" value={newQ.parentQ} onChange={(e) => setNewQ({ ...newQ, parentQ: e.target.value })} />
                                <input className="modal-input" placeholder="Required Answer Value" title="If parent question answer is this, me shows up" value={newQ.condition} onChange={(e) => setNewQ({ ...newQ, condition: e.target.value })} />
                            </div>
                        </div>

                        <div className="modal-actions" style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
                            <button className="modal-btn modal-btn-cancel" onClick={resetModalState} disabled={saving}>Discard</button>
                            <button className="modal-btn modal-btn-submit" onClick={handleAddQuestion} disabled={saving}>{saving ? '⏳ Saving...' : (editIndex !== null ? 'Update Question' : 'Save Question to Logic Tree')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssistantQuestionLibrary;
