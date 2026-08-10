import React, { useState, useEffect } from 'react';
import { questionLibraryAPI } from '../../utils/api';
import './AssistantDashboard.css';
import { FiFolder, FiFileText, FiList, FiCheckSquare, FiCalendar, FiType } from 'react-icons/fi';

const AssistantQuestionLibrary = () => {
    const [libraryData, setLibraryData] = useState({});
    const [loading, setLoading] = useState(true);
    const [departmentTab, setDepartmentTab] = useState('');
    const [activeCategory, setActiveCategory] = useState('');

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
                                    <div key={idx} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <div style={{ background: '#eff6ff', color: '#3b82f6', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                                                {getIconForType(q.type)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#0f172a', fontWeight: '600', lineHeight: 1.4 }}>
                                                    {q.q}
                                                </h4>
                                                
                                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>
                                                        <span style={{ color: '#94a3b8' }}>Type:</span> {q.type}
                                                    </div>
                                                    
                                                    {q.options && q.options.length > 0 && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>
                                                            <span style={{ color: '#94a3b8' }}>Options:</span> {q.options.join(', ')}
                                                        </div>
                                                    )}

                                                    {q.parentQ && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', color: '#92400e', fontWeight: '500' }}>
                                                            <span style={{ color: '#d97706' }}>Depends On:</span> "{q.parentQ}" {q.condition ? `(if ${q.condition})` : ''}
                                                        </div>
                                                    )}
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
        </div>
    );
};

export default AssistantQuestionLibrary;
