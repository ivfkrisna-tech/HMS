import React, { useState, useEffect } from 'react';
import { FiUsers, FiClock, FiCheckCircle, FiFileText, FiShield, FiActivity, FiHeart } from 'react-icons/fi';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { assistantAPI } from '../../utils/api';
import './AssistantDashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const AssistantDashboard = () => {
    const [stats, setStats] = useState({
        totalPatients: 0,
        waiting: 0,
        completed: 0,
        reportsPending: 0,
        consentPending: 0,
        investigationsPending: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await assistantAPI.getDashboardStats();
            if (res.success) {
                setStats(res.stats);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard stats", error);
        } finally {
            setLoading(false);
        }
    };

    const displayStats = [
        { title: "Today's Patients", count: stats.totalPatients, icon: <FiUsers />, color: '#3b82f6', description: "Patients scheduled for today" },
        { title: 'Waiting Patients', count: stats.waiting, icon: <FiClock />, color: '#f59e0b', description: "Currently in the waiting room" },
        { title: 'Completed Patients', count: stats.completed, icon: <FiCheckCircle />, color: '#10b981', description: "Finished consultation" },
        { title: 'Pending Reports', count: stats.reportsPending, icon: <FiFileText />, color: '#8b5cf6', description: "Lab & scan results pending" },
        { title: 'Pending Consents', count: stats.consentPending, icon: <FiShield />, color: '#ef4444', description: "Consents requiring signatures" },
        { title: 'Pending Investigations', count: stats.investigationsPending, icon: <FiActivity />, color: '#06b6d4', description: "New investigations to log" },
    ];

    return (
        <div className="assistant-dashboard">
            <header className="dashboard-header">
                <div>
                    <h1>Doctor Assistant Dashboard</h1>
                    <p>Welcome back! Here is an overview of today's tasks.</p>
                </div>
            </header>

            <div className="stats-grid">
                {displayStats.map((stat, index) => (
                    <div className="stat-card" key={index} style={{ borderTop: `4px solid ${stat.color}` }}>
                        <div className="stat-icon-wrapper" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                            {stat.icon}
                        </div>
                        <div className="stat-content">
                            <h3>{stat.title}</h3>
                            <div className="stat-value">{stat.count}</div>
                            <p className="stat-desc">{stat.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-widgets" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '24px' }}>
                <div className="widget-card" style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>Weekly Patient Trend</h3>
                    <div style={{ height: '250px' }}>
                        <Line
                            data={{
                                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                                datasets: [{
                                    label: 'Patients Checked-In',
                                    data: [12, 19, 15, 22, 29, 14, 18],
                                    borderColor: '#3b82f6',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    fill: true,
                                    tension: 0.4
                                }]
                            }}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                        />
                    </div>
                </div>
                <div className="widget-card" style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>Average Preparation Time (mins)</h3>
                    <div style={{ height: '250px' }}>
                        <Bar
                            data={{
                                labels: ['Vitals', 'Clinical Notes', 'Consent', 'Reports', 'Total'],
                                datasets: [{
                                    label: 'Time (mins)',
                                    data: [3, 8, 4, 2, 17],
                                    backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#3b82f6'],
                                    borderRadius: 4
                                }]
                            }}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                        />
                    </div>
                </div>
                <div className="widget-card">
                    <h3><FiActivity /> Quick Actions</h3>
                    <div className="quick-actions-grid">
                        <button className="btn-quick-action"><FiUsers size={24} color="#3b82f6" /> <span>Register Patient</span></button>
                        <button className="btn-quick-action"><FiHeart size={24} color="#ef4444" /> <span>Add Vitals</span></button>
                        <button className="btn-quick-action"><FiShield size={24} color="#10b981" /> <span>Generate Consent</span></button>
                        <button className="btn-quick-action"><FiFileText size={24} color="#8b5cf6" /> <span>Upload Report</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssistantDashboard;
