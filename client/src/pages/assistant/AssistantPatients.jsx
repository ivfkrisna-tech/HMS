import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assistantAPI } from '../../utils/api';

const AssistantPatients = () => {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const res = await assistantAPI.getAppointments('today');
            if (res.success) {
                setAppointments(res.appointments);
            }
        } catch (error) {
            console.error("Failed to fetch today's patients", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (path, appointmentId) => {
        localStorage.setItem('activeAppointmentId', appointmentId);
        navigate(`/assistant/${path}/${appointmentId}`);
    };

    const handleExportCSV = () => {
        if (displayList.length === 0) return;
        
        const headers = ['Patient Name', 'MRN', 'Age', 'Gender', 'Doctor', 'Appointment Time', 'Status'];
        const csvRows = [headers.join(',')];
        
        displayList.forEach(apt => {
            const row = [
                `"${apt.userId?.name || 'Unknown'}"`,
                `"${apt.userId?.mrn || '-'}"`,
                `"${apt.userId?.age || apt.userId?.dob || '-'}"`,
                `"${apt.userId?.gender || '-'}"`,
                `"${apt.doctorId?.name || apt.doctorName || '-'}"`,
                `"${apt.appointmentTime || '-'}"`,
                `"${apt.status}"`
            ];
            csvRows.push(row.join(','));
        });
        
        const csvData = csvRows.join('\n');
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Assistant_Patients_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Filtering
    const q = searchQuery.toLowerCase();
    const displayList = appointments.filter(a => {
        if (!q) return true;
        return (
            (a.userId?.name || '').toLowerCase().includes(q) ||
            (a.userId?.phone || '').toLowerCase().includes(q) ||
            (a.userId?.patientId || a.userId?.mrn || '').toLowerCase().includes(q) ||
            (a.doctorName || '').toLowerCase().includes(q)
        );
    });

    const todayStr = new Date().toDateString();
    
    // Stat counts (assuming all these are today's anyway due to backend filter 'today')
    const totalPatientsUnique = new Set(appointments.map(a => a.userId?._id || a.patientId)).size;
    const upcomingAppointments = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length;
    const completedToday = appointments.filter(a => a.status === 'completed' || a.consultationStatus === 'Consultation Completed').length;

    const getStatusStyle = (status) => {
        const map = {
            confirmed: { bg: '#dcfce7', color: '#166534' },
            completed: { bg: '#dbeafe', color: '#1e40af' },
            cancelled: { bg: '#fee2e2', color: '#991b1b' },
            pending: { bg: '#fef3c7', color: '#92400e' },
        };
        return map[status?.toLowerCase()] || { bg: '#f1f5f9', color: '#475569' };
    };

    // ─── STYLES ─────────────────────────────────────────────────────
    const S = {
        page: { minHeight: '100vh', background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" },
        topbar: { background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', borderBottom: '1px solid #e2e8f0', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        topLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
        logo: { width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' },
        title: { margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em' },
        subtitle: { margin: 0, color: '#64748b', fontSize: '0.8rem', fontWeight: '500' },
        statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', padding: '20px 28px 0' },
        statCard: (gradient) => ({ background: '#ffffff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px', transition: 'transform 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }),
        statIcon: (gradient) => ({ width: '46px', height: '46px', borderRadius: '13px', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }),
        statNum: { color: '#1e293b', fontSize: '1.6rem', fontWeight: '800', lineHeight: 1.1 },
        statLabel: { color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' },
        controls: { padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' },
        searchWrap: { position: 'relative', flex: 1, maxWidth: '420px' },
        searchInput: { width: '100%', padding: '11px 16px 11px 42px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#1e293b', fontSize: '0.88rem', outline: 'none', transition: 'border 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
        searchIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '1rem' },
        content: { padding: '0 28px 40px' },
        sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
        sectionTitle: { color: '#1e293b', fontSize: '1rem', fontWeight: '700', margin: 0 },
        table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
        th: { padding: '13px 16px', textAlign: 'left', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0' },
        td: { padding: '13px 16px', borderBottom: '1px solid #e2e8f0' },
        tableWrap: { background: '#ffffff', borderRadius: '16px', overflowX: 'auto', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' },
        avatar: (color) => ({ width: '36px', height: '36px', borderRadius: '10px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '0.85rem', flexShrink: 0 }),
        btn: (bg) => ({ padding: '7px 18px', borderRadius: '9px', border: 'none', background: bg, color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }),
        empty: { textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px dashed #cbd5e1' },
        loadingWrap: { textAlign: 'center', padding: '60px 0', color: '#94a3b8' },
    };

    return (
        <div style={{ ...S.page, background: 'transparent', minHeight: 'auto' }}>
            
            <div style={S.topbar}>
                <div style={S.topLeft}>
                    <div style={S.logo}>🏥</div>
                    <div>
                        <h1 style={S.title}>Today's Patients</h1>
                        <p style={S.subtitle}>Manage and prepare patients scheduled for today</p>
                    </div>
                </div>
                <button 
                    onClick={handleExportCSV}
                    style={{ ...S.btn('linear-gradient(135deg, #10b981, #059669)'), display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                >
                    📥 Export CSV
                </button>
            </div>

            {/* ─── STATS ─── */}
            <div style={{ ...S.statsRow, padding: '20px 28px 20px' }}>
                {[
                    { label: "Total Patients Today", value: totalPatientsUnique, icon: '👥', g: 'linear-gradient(135deg, #3b82f6, #6366f1)' },
                    { label: 'Upcoming / Waiting', value: upcomingAppointments, icon: '⏳', g: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
                    { label: 'Completed Today', value: completedToday, icon: '✅', g: 'linear-gradient(135deg, #10b981, #059669)' },
                ].map((s, i) => (
                    <div key={i} style={S.statCard(s.g)}>
                        <div style={S.statIcon(s.g)}>{s.icon}</div>
                        <div>
                            <div style={S.statNum}>{s.value}</div>
                            <div style={S.statLabel}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── SEARCH ─── */}
            <div style={{ ...S.controls, padding: '0 28px 20px' }}>
                <div style={S.searchWrap}>
                    <span style={S.searchIcon}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search patient name, phone, MRN, or doctor..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={S.searchInput}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                    )}
                </div>
            </div>

            {/* ─── CONTENT ─── */}
            <div style={{ ...S.content }}>
                {loading ? (
                    <div style={S.loadingWrap}>
                        <div style={{ width: '38px', height: '38px', border: '3px solid rgba(0,0,0,0.08)', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                        <p style={{ fontSize: '0.9rem' }}>Loading patients...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    </div>
                ) : displayList.length === 0 ? (
                    <div style={S.empty}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📭</div>
                        <h4 style={{ color: '#1e293b', margin: '0 0 6px', fontWeight: '700' }}>No Patients in Today's Queue</h4>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '0.88rem' }}>
                            {searchQuery ? 'No results match your search. Try a different term.' : 'Patients will appear here when appointments are booked for today.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div style={S.sectionHeader}>
                            <h3 style={S.sectionTitle}>🏥 Today's Patient Queue</h3>
                        </div>

                        <div style={S.tableWrap}>
                            <table style={S.table}>
                                <thead>
                                    <tr>
                                        <th style={S.th}>#</th>
                                        <th style={S.th}>Patient</th>
                                        <th style={S.th}>Contact</th>
                                        <th style={S.th}>Doctor</th>
                                        <th style={S.th}>Time</th>
                                        <th style={S.th}>Status</th>
                                        <th style={S.th}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayList.map((apt, idx) => {
                                        const statusS = getStatusStyle(apt.status);
                                        return (
                                            <tr key={apt._id} style={{ transition: 'background 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <td style={{ ...S.td, color: '#475569', fontWeight: '600', fontSize: '0.82rem' }}>{idx + 1}</td>
                                                <td style={S.td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={S.avatar('linear-gradient(135deg, #6366f1, #8b5cf6)')}>
                                                            {(apt.userId?.name || 'W')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ color: '#1e293b', fontWeight: '700', fontSize: '0.88rem' }}>{apt.userId?.name || 'Unknown'}</div>
                                                            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>MRN: {apt.userId?.mrn || apt.userId?.patientId || 'N/A'} • {apt.userId?.gender}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ ...S.td, color: '#64748b', fontSize: '0.85rem' }}>{apt.userId?.phone || '-'}</td>
                                                <td style={S.td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={S.avatar('linear-gradient(135deg, #10b981, #059669)')}>
                                                            {(apt.doctorId?.name || apt.doctorName || 'D')[0].toUpperCase()}
                                                        </div>
                                                        <span style={{ color: '#1e293b', fontWeight: '600', fontSize: '0.85rem' }}>
                                                            {apt.doctorId?.name || apt.doctorName || 'Not Assigned'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ ...S.td, color: '#1e293b', fontWeight: '600', fontSize: '0.85rem' }}>{apt.appointmentTime || 'N/A'}</td>
                                                <td style={S.td}>
                                                    <span style={{
                                                        background: statusS.bg, color: statusS.color,
                                                        padding: '4px 12px', borderRadius: '20px',
                                                        fontSize: '0.75rem', fontWeight: '700', textTransform: 'capitalize'
                                                    }}>
                                                        {apt.status === 'pending' && !apt.readyForDoctor ? 'Waiting' : apt.readyForDoctor && apt.status !== 'completed' ? 'Ready for Doctor' : apt.status}
                                                    </span>
                                                </td>
                                                <td style={S.td}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => handleAction('vitals', apt._id)}
                                                            style={{
                                                                ...S.btn('linear-gradient(135deg, #3b82f6, #6366f1)'),
                                                                display: 'flex', alignItems: 'center', gap: '5px'
                                                            }}
                                                        >
                                                            💉 Vitals
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction('reports', apt._id)}
                                                            style={{
                                                                ...S.btn('linear-gradient(135deg, #f59e0b, #d97706)'),
                                                                display: 'flex', alignItems: 'center', gap: '5px'
                                                            }}
                                                        >
                                                            📁 Upload Report
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction('clinical-notes', apt._id)}
                                                            style={{
                                                                ...S.btn('linear-gradient(135deg, #8b5cf6, #d946ef)'),
                                                                display: 'flex', alignItems: 'center', gap: '5px'
                                                            }}
                                                        >
                                                            📝 Clinical Notes
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAction('consents', apt._id); }}
                                                            type="button"
                                                            style={{
                                                                ...S.btn('rgba(168, 85, 247, 0.1)'),
                                                                color: '#a855f7', border: '1px solid #a855f7',
                                                                display: 'flex', alignItems: 'center', gap: '5px'
                                                            }}
                                                        >
                                                            📄 Consent Form
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AssistantPatients;
