import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiActivity, FiFileText, FiClipboard } from 'react-icons/fi';
import './NurseDashboard.css';

const NurseDashboardHome = ({ user }) => {
    const navigate = useNavigate();
    const nurseName = user?.name ? (user.name.startsWith('Nurse') ? user.name : `Nurse ${user.name}`) : 'Staff Nurse';

    return (
        <div className="nurse-dashboard-container">
            {/* Welcome Hero Card */}
            <div className="nurse-welcome-hero">
                <div className="nurse-welcome-header">
                    <span className="welcome-waving-hand">👋</span>
                    <span className="nurse-role-pill">NURSE</span>
                </div>
                <h1>Welcome back, <span>{nurseName}</span></h1>
                <p>Hospital Management System — Nurse Care Portal</p>
            </div>

            {/* Quick Access Grid */}
            <div className="nurse-section-title">
                <FiClipboard /> QUICK ACCESS
            </div>
            <div className="nurse-quick-grid">
                <div className="nurse-quick-card" onClick={() => navigate('/nurse/patients')}>
                    <div className="quick-icon-box quick-icon-patients">
                        <FiUsers />
                    </div>
                    <div className="quick-card-text">
                        <h3>My Patients</h3>
                        <p>View active patients & queue</p>
                    </div>
                </div>

                <div className="nurse-quick-card" onClick={() => navigate('/nurse/vitals')}>
                    <div className="quick-icon-box quick-icon-vitals">
                        <FiActivity />
                    </div>
                    <div className="quick-card-text">
                        <h3>Vitals Entry</h3>
                        <p>Record BP, Pulse, SpO₂, Wt, Ht</p>
                    </div>
                </div>

                <div className="nurse-quick-card" onClick={() => navigate('/nurse/notes')}>
                    <div className="quick-icon-box quick-icon-notes">
                        <FiFileText />
                    </div>
                    <div className="quick-card-text">
                        <h3>Nursing Notes</h3>
                        <p>Patient clinical shift logs</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NurseDashboardHome;
