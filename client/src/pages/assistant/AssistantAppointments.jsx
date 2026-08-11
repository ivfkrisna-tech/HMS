import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assistantAPI } from '../../utils/api';

const AssistantAppointments = () => {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const res = await assistantAPI.getAppointments('all');
            if (res.success) {
                setAppointments(res.appointments);
            }
        } catch (error) {
            console.error("Failed to fetch appointments", error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredAppointments = () => {
        return appointments.filter(apt => {
            // Unified Search
            const term = searchTerm.toLowerCase();
            const pName = (apt.userId?.name || apt.patientId?.name || apt.patientName || '').toLowerCase();
            const pMrn = (apt.userId?.mrn || apt.userId?._id || apt.patientId?.mrn || apt.patientId?._id || '').toLowerCase();
            const pPhone = (apt.userId?.phone || apt.patientId?.phone || '').toLowerCase();

            if (!pName.includes(term) && !pMrn.includes(term) && !pPhone.includes(term)) {
                return false;
            }
            
            return true;
        });
    };

    const filteredAppointments = getFilteredAppointments();

    const handleAction = (path, appointmentId) => {
        localStorage.setItem('activeAppointmentId', appointmentId);
        navigate(`/assistant/${path}/${appointmentId}`);
    };

    const getStatusStyle = (status) => {
        const lower = status?.toLowerCase() || '';
        if (lower.includes('completed')) return { bg: '#dcfce7', color: '#166534' };
        if (lower.includes('ready')) return { bg: '#dbeafe', color: '#1e40af' };
        if (lower.includes('preparation')) return { bg: '#fef3c7', color: '#92400e' };
        return { bg: '#f1f5f9', color: '#475569' };
    };

    // ─── STYLES ─────────────────────────────────────────────────────
    const S = {
        page: { minHeight: '100vh', background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" },
        topbar: { background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', borderBottom: '1px solid #e2e8f0', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        topLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
        logo: { width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' },
        title: { margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em' },
        subtitle: { margin: 0, color: '#64748b', fontSize: '0.8rem', fontWeight: '500' },
        searchWrap: { position: 'relative', flex: 1, maxWidth: '280px' },
        searchInput: { width: '100%', padding: '11px 16px 11px 42px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#1e293b', fontSize: '0.88rem', outline: 'none', transition: 'border 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
        searchIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '1rem' },
        content: { padding: '0 28px 40px' },
        sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', marginTop: '10px' },
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
                    <div style={S.logo}>📅</div>
                    <div>
                        <h1 style={S.title}>Appointments</h1>
                        <p style={S.subtitle}>View and manage all appointments for assigned doctors</p>
                    </div>
                </div>
            </div>

            <div style={{ ...S.content, paddingTop: '20px' }}>
                <div style={S.sectionHeader}>
                    <h3 style={S.sectionTitle}>📁 Appointment Roster</h3>
                    <div style={{ ...S.searchWrap, maxWidth: '350px', flex: 'none' }}>
                        <span style={S.searchIcon}>🔍</span>
                        <input
                            type="text"
                            placeholder="Search by Patient Name, MRN, or Phone..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={S.searchInput}
                        />
                    </div>
                </div>

                {loading ? (
                    <div style={S.loadingWrap}>
                        <div style={{ width: '38px', height: '38px', border: '3px solid rgba(0,0,0,0.08)', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                        <p style={{ fontSize: '0.9rem' }}>Loading appointments...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    </div>
                ) : filteredAppointments.length === 0 ? (
                    <div style={S.empty}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📋</div>
                        <h4 style={{ color: '#1e293b', margin: '0 0 6px', fontWeight: '700' }}>No Appointments Found</h4>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '0.88rem' }}>
                            Try adjusting your search to find what you're looking for.
                        </p>
                    </div>
                ) : (
                    <div style={S.tableWrap}>
                            <table style={S.table}>
                                <thead>
                                    <tr>
                                        <th style={S.th}>#</th>
                                        <th style={S.th}>Patient</th>
                                        <th style={S.th}>Doctor</th>
                                        <th style={S.th}>Date & Time</th>
                                        <th style={S.th}>Status</th>
                                        <th style={S.th}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.map((apt, idx) => {
                                        const statusS = getStatusStyle(apt.consultationStatus || apt.status);
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
                                                            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{apt.serviceName || 'Consultation'}</div>
                                                        </div>
                                                    </div>
                                                </td>
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
                                                <td style={{ ...S.td, color: '#1e293b', fontWeight: '600', fontSize: '0.85rem' }}>
                                                    {new Date(apt.appointmentDate).toLocaleDateString()}
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '2px' }}>{apt.appointmentTime || '-'}</span>
                                                </td>
                                                <td style={S.td}>
                                                    <span style={{
                                                        background: statusS.bg, color: statusS.color,
                                                        padding: '4px 12px', borderRadius: '20px',
                                                        fontSize: '0.75rem', fontWeight: '700', textTransform: 'capitalize',
                                                        display: 'inline-block'
                                                    }}>
                                                        {apt.consultationStatus || 'Patient Checked In'}
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
                )}
            </div>
        </div>
    );
};

export default AssistantAppointments;
