import React from 'react';

const DynamicQuestionForm = ({ categoryName, questions, intakeData, setIntakeData, readOnly = false, theme = 'light', hideHeader = false }) => {
    const isDark = theme === 'dark';

    const handleAnswer = (q, val) => {
        if (readOnly) return;
        setIntakeData(prev => ({ ...prev, [q]: val }));
    };

    const handleCheckbox = (q, opt, isChecked) => {
        if (readOnly) return;
        setIntakeData(prev => {
            let current = prev[q] || [];
            if (!Array.isArray(current)) current = [];

            if (isChecked) {
                current = [...current, opt];
            } else {
                current = current.filter(i => i !== opt);
            }
            return { ...prev, [q]: current };
        });
    };

    const S = {
        card: {
            marginBottom: '16px',
            padding: '20px',
            borderRadius: '16px',
            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            boxSizing: 'border-box'
        },
        label: {
            display: 'block',
            fontWeight: '700',
            marginBottom: '10px',
            fontSize: '0.95rem',
            color: isDark ? '#e2e8f0' : '#1e293b'
        },
        input: {
            width: '100%',
            padding: '12px 14px',
            borderRadius: '10px',
            border: isDark ? '2px solid #334155' : '2px solid #e2e8f0',
            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
            color: isDark ? '#f8fafc' : '#0f172a',
            fontSize: '0.95rem',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease',
            opacity: readOnly ? 0.7 : 1,
            cursor: readOnly ? 'not-allowed' : 'text'
        },
        select: {
            width: '100%',
            padding: '12px 14px',
            borderRadius: '10px',
            border: isDark ? '2px solid #334155' : '2px solid #e2e8f0',
            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
            color: isDark ? '#f8fafc' : '#0f172a',
            fontSize: '0.95rem',
            outline: 'none',
            boxSizing: 'border-box',
            cursor: readOnly ? 'not-allowed' : 'pointer',
            appearance: 'auto'
        },
        checkboxGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px'
        },
        checkboxCard: (isChecked) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            border: isChecked
                ? (isDark ? '2px solid #3b82f6' : '2px solid #3b82f6')
                : (isDark ? '2px solid #334155' : '2px solid #e2e8f0'),
            borderRadius: '10px',
            backgroundColor: isChecked
                ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff')
                : (isDark ? '#1e293b' : '#ffffff'),
            color: isChecked
                ? (isDark ? '#93c5fd' : '#1e40af')
                : (isDark ? '#cbd5e1' : '#475569'),
            fontWeight: isChecked ? '600' : '500',
            cursor: readOnly ? 'default' : 'pointer',
            transition: 'all 0.2s',
            userSelect: 'none',
            boxSizing: 'border-box'
        }),
        checkboxInput: {
            width: '18px',
            height: '18px',
            cursor: readOnly ? 'default' : 'pointer',
            accentColor: '#3b82f6',
            flexShrink: 0
        },
        complexCheckboxWrapper: {
            padding: '20px',
            borderRadius: '16px',
            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            backgroundColor: isDark ? '#0f172a' : '#f8fafc'
        },
        complexGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
        },
        flexCol: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        },
        extraWrapper: {
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        },
        extraLabel: {
            fontSize: '0.9rem',
            fontWeight: '600',
            color: isDark ? '#94a3b8' : '#64748b',
            whiteSpace: 'nowrap'
        },
        rowGrid: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px'
        },
        rowItem: {
            flex: '1 1 150px'
        },
        rowLabel: {
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: '600',
            marginBottom: '6px',
            color: isDark ? '#94a3b8' : '#64748b'
        },
        container: {
            marginBottom: '24px',
            padding: hideHeader ? '0' : '24px',
            borderRadius: '20px',
            backgroundColor: hideHeader ? 'transparent' : (isDark ? '#0f172a' : '#ffffff'),
            border: hideHeader ? 'none' : (isDark ? '1px solid #334155' : '1px solid #e2e8f0'),
            boxShadow: hideHeader ? 'none' : '0 10px 25px rgba(0,0,0,0.05)',
            boxSizing: 'border-box'
        },
        header: {
            fontSize: '1.25rem',
            fontWeight: '700',
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            color: isDark ? '#f8fafc' : '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: 0
        },
        subHeader: {
            fontSize: '1.1rem',
            fontWeight: '600',
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            color: isDark ? '#cbd5e1' : '#334155',
            margin: 0
        },
        groupCard: {
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
            marginBottom: '20px'
        },
        stack: {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        }
    };

    const isGrouped = questions && !Array.isArray(questions);

    const renderQuestionList = (qList) => {
        return (qList || [])
            .filter(item => item && typeof item === 'object' && item.q && String(item.q).trim() !== '')
            .map((item, idx) => {
                if (item.condition && item.parentQ) {
                    const normalize = (val) => String(val || '').toLowerCase().trim();
                    let isConditionMet = false;
                    const parentValue = intakeData[item.parentQ];
                    const targetCondition = normalize(item.condition);

                    if (Array.isArray(parentValue)) {
                        isConditionMet = parentValue.some(v => normalize(v) === targetCondition);
                    } else {
                        isConditionMet = normalize(parentValue) === targetCondition;
                    }

                    if (!isConditionMet) return null;
                }

                const savedVal = intakeData[item.q] || "";

                return (
                    <div key={idx} style={S.card}>
                        <label style={S.label}>{item.q}</label>

                        {(item.type === 'text' || item.type === 'number' || item.type === 'date') && (
                            <input
                                type={item.type}
                                value={savedVal}
                                onChange={(e) => handleAnswer(item.q, e.target.value)}
                                disabled={readOnly}
                                style={S.input}
                            />
                        )}

                        {item.type === 'select' && (
                            <select
                                value={savedVal}
                                onChange={(e) => handleAnswer(item.q, e.target.value)}
                                disabled={readOnly}
                                style={S.select}
                            >
                                <option value="">Select...</option>
                                {(item.options || []).map(o => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </select>
                        )}

                        {item.type === 'yes-no' && (
                            <select
                                value={savedVal}
                                onChange={(e) => handleAnswer(item.q, e.target.value)}
                                disabled={readOnly}
                                style={S.select}
                            >
                                <option value="">Select...</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </select>
                        )}

                        {item.type === 'textarea' && (
                            <textarea
                                value={savedVal}
                                rows={4}
                                onChange={(e) => handleAnswer(item.q, e.target.value)}
                                disabled={readOnly}
                                style={{ ...S.input, minHeight: '80px', resize: 'vertical' }}
                            />
                        )}

                        {item.type === 'checkbox-group' && (
                            <div style={S.checkboxGrid}>
                                {(item.options || []).map(opt => {
                                    const isChecked = Array.isArray(intakeData[item.q]) && intakeData[item.q].includes(opt);
                                    return (
                                        <label key={opt} style={S.checkboxCard(isChecked)}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                disabled={readOnly}
                                                onChange={(e) => handleCheckbox(item.q, opt, e.target.checked)}
                                                style={S.checkboxInput}
                                            />
                                            <span>{opt}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {(item.type === 'checkbox-date-group' || item.type === 'checkbox-text-group') && (() => {
                            let dynamicOptions = item.options || [];
                            let count = 0;

                            if (item.parentQ && intakeData[item.parentQ]) {
                                const pVal = parseInt(String(intakeData[item.parentQ]).replace(/[^0-9]/g, ''), 10);
                                if (!isNaN(pVal)) count = pVal;
                            } else {
                                const countKey = Object.keys(intakeData).find(key =>
                                    key.toLowerCase().includes('kitni baar') ||
                                    key.toLowerCase().includes('how many') ||
                                    key.toLowerCase().includes('baar') ||
                                    key.toLowerCase().includes('count')
                                );
                                if (countKey && intakeData[countKey]) {
                                    const cVal = parseInt(String(intakeData[countKey]).replace(/[^0-9]/g, ''), 10);
                                    if (!isNaN(cVal)) count = cVal;
                                }
                            }

                            if (count > 0) {
                                const prefix = item.optionPrefix || (item.q.toLowerCase().includes('pregn') ? 'Pregnancy' : 'Instance');
                                dynamicOptions = Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);
                            }

                            return (
                                <div style={S.complexCheckboxWrapper}>
                                    <div style={S.complexGrid}>
                                        {dynamicOptions.map(opt => {
                                            const isChecked = Array.isArray(intakeData[item.q]) && intakeData[item.q].includes(opt);
                                            const dateVal = intakeData[`${item.q}_date_${opt}`] || "";

                                            return (
                                                <div key={opt} style={S.flexCol}>
                                                    <label style={S.checkboxCard(isChecked)}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            disabled={readOnly}
                                                            onChange={(e) => handleCheckbox(item.q, opt, e.target.checked)}
                                                            style={S.checkboxInput}
                                                        />
                                                        <span>{opt}</span>
                                                    </label>
                                                    {opt !== 'None' && isChecked && (
                                                        <input
                                                            type={item.type === 'checkbox-date-group' ? 'date' : 'text'}
                                                            value={dateVal}
                                                            onChange={(e) => handleAnswer(`${item.q}_date_${opt}`, e.target.value)}
                                                            disabled={readOnly}
                                                            placeholder={item.type === 'checkbox-text-group' ? 'Details...' : ''}
                                                            style={{ ...S.input, padding: '8px 12px' }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {item.extra && (
                                        <div style={S.extraWrapper}>
                                            <span style={S.extraLabel}>{item.extra}:</span>
                                            <input
                                                type="text"
                                                value={intakeData[`${item.q}_extra`] || ""}
                                                onChange={(e) => handleAnswer(`${item.q}_extra`, e.target.value)}
                                                disabled={readOnly}
                                                placeholder="Enter details..."
                                                style={S.input}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {item.type === 'row' && (
                            <div style={S.rowGrid}>
                                {(item.fields || []).map(field => {
                                    const val = intakeData[field.q] || "";
                                    return (
                                        <div key={field.q} style={S.rowItem}>
                                            <label style={S.rowLabel}>{field.q}</label>
                                            <input
                                                type={field.type || 'text'}
                                                value={val}
                                                onChange={(e) => handleAnswer(field.q, e.target.value)}
                                                disabled={readOnly}
                                                style={S.input}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            });
    };

    return (
        <div style={S.container}>
            {!hideHeader && (
                <h3 style={S.header}>
                    📋 {categoryName}
                </h3>
            )}

            {isGrouped ? (
                <div style={S.stack}>
                    {Object.keys(questions).map(subCat => (
                        <div key={subCat} style={S.groupCard}>
                            {!hideHeader && (
                                <h4 style={S.subHeader}>
                                    {subCat}
                                </h4>
                            )}
                            <div style={S.stack}>
                                {renderQuestionList(questions[subCat])}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={S.stack}>
                    {renderQuestionList(questions)}
                </div>
            )}
        </div>
    );
};

export default DynamicQuestionForm;