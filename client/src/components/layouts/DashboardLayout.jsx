import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useAppDispatch } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { useBranding } from '../../context/BrandingContext';
import {
    FiHome, FiUsers, FiCalendar, FiActivity, FiPackage,
    FiSettings, FiLogOut, FiPieChart, FiClipboard,
    FiFileText, FiPlusSquare, FiShield, FiShare2, FiLayers, FiRefreshCcw, FiShoppingCart, FiCornerUpLeft,
    FiHeart, FiCheckSquare, FiEdit, FiClock, FiBell
} from 'react-icons/fi';
import { notificationAPI } from '../../utils/api';
import './DashboardLayout.css';

const DashboardSidebar = ({ isOpen, setOpen }) => {
    const { user } = useAuth();
    const { branding, hospitalName } = useBranding();
    const role = (user?.role || '').toLowerCase();
    
    // Categorized Menus
    const getMenu = () => {
        if (role === 'centraladmin' || role === 'superadmin') {
            return [
                { label: 'System Overview', path: '/supremeadmin', icon: <FiPieChart /> },
                { label: 'Question Library', path: '/admin/question-library', icon: <FiFileText /> },
                { label: 'Role & Permissions', path: '/admin/roles', icon: <FiShield /> },
                { label: 'Manage All Staff', path: '/admin/users', icon: <FiUsers /> },
            ];
        }
        if (role === 'hospitaladmin') {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            if (u.clinicType === 'clinic') {
                // Simple clinic — single hub page with built-in role switcher
                return [
                    { label: 'Clinic Hub', path: '/hospitaladmin', icon: <FiHome /> },
                ];
            }
            return [
                { label: 'Hospital Overview', path: '/hospitaladmin', icon: <FiPieChart /> },
                { label: 'Clinical Questions', path: '/hospitaladmin/question-library', icon: <FiFileText /> },
                { label: 'Staff Management', path: '/admin/users', icon: <FiUsers /> },
                { label: 'Doctors Feed', path: '/admin/doctors', icon: <FiActivity /> },
                { label: 'Pharma Inventory', path: '/pharmacy/inventory', icon: <FiPackage /> },
                { label: 'Source Management', path: '/hospitaladmin/sources', icon: <FiShare2 /> },
                { label: 'Package Services', path: '/hospitaladmin/packages', icon: <FiLayers /> },
            ];
        }
        if (role === 'doctor') {
            return [
                { label: 'My Patients', path: '/doctor/dashboard', icon: <FiUsers /> },
                { label: 'All Appointments', path: '/doctor/patients?tab=all', icon: <FiCalendar /> },
            ];
        }
        if (role.includes('doctor assistant') || role.includes('doctorassistant')) {
            return [
                { label: 'Dashboard', path: '/assistant/dashboard', icon: <FiHome /> },
                { label: "Today's Patients", path: '/assistant/patients', icon: <FiUsers /> },
                { label: 'Appointments', path: '/assistant/appointments', icon: <FiCalendar /> },
                { label: 'Patient Preparation', path: '/assistant/preparation', icon: <FiPlusSquare /> },
                { label: 'Vitals', path: '/assistant/vitals', icon: <FiHeart /> },
                { label: 'Reports', path: '/assistant/reports', icon: <FiFileText /> },
                { label: 'Investigations', path: '/assistant/investigations', icon: <FiActivity /> },
                { label: 'Consent Forms', path: '/assistant/consents', icon: <FiShield /> },
                { label: 'Clinical Notes', path: '/assistant/clinical-notes', icon: <FiEdit /> },
                { label: 'Follow-up', path: '/assistant/follow-up', icon: <FiClock /> },
                { label: 'Tasks', path: '/assistant/tasks', icon: <FiCheckSquare /> },
                { label: 'Question Library', path: '/assistant/question-library', icon: <FiFileText /> },
            ];
        }
        if (role.includes('reception')) {
            return [
                { label: 'Reception Dashboard', path: '/my-dashboard', icon: <FiHome /> },
                { label: 'Patient Registration', path: '/reception/dashboard?mode=intake', icon: <FiPlusSquare /> },
                { label: 'Patient Billing', path: '/billing/patient', icon: <FiFileText /> },
            ];
        }
        if (role === 'lab') {
            return [
                { label: 'Lab Dashboard', path: '/lab/dashboard', icon: <FiActivity /> },
                { label: 'Assigned Tests', path: '/lab/tests', icon: <FiFileText /> },
            ];
        }
        if (role === 'pharmacy') {
            return [
                { label: 'Inventory', path: '/pharmacy/inventory', icon: <FiPackage /> },
                { label: 'Pharmacy Orders', path: '/pharmacy/orders', icon: <FiClipboard /> },
                { label: 'Return & Exchange', path: '/pharmacy/returns', icon: <FiRefreshCcw /> },
                { label: 'Vendor Returns', path: '/pharmacy/vendor-returns', icon: <FiCornerUpLeft /> },
                { label: 'Departments & Transfer', path: '/pharmacy/departments', icon: <FiActivity /> },
            ];
        }
        if (role === 'accountant') {
            return [
                { label: 'Finance Dashboard', path: '/accountant/dashboard', icon: <FiPieChart /> },
            ];
        }
        if (role === 'cashier') {
            return [
                { label: 'Billing/Payments', path: '/billing/patient', icon: <FiFileText /> },
            ];
        }
        if (role === 'nurse' || role.includes('nurse')) {
            return [
                { label: 'Nurse Dashboard', path: '/my-dashboard', icon: <FiClipboard /> },
                { label: 'My Patients', path: '/nurse/patients', icon: <FiUsers /> },
                { label: 'Vitals Entry', path: '/nurse/vitals', icon: <FiActivity /> },
                { label: 'Nursing Notes', path: '/nurse/notes', icon: <FiFileText /> },
            ];
        }
        if (role.includes('billing')) {
            return [
                { label: 'Patient Billing', path: '/cashier/billing', icon: <FiFileText /> },
            ];
        }
        if (user?.navLinks && user.navLinks.length > 0) {
            const links = user.navLinks.map(link => {
                let icon = <FiFileText />;
                if (link.path === '/pharmacy/orders') icon = <FiClipboard />;
                if (link.path === '/pharmacy/inventory') icon = <FiPackage />;
                return {
                    label: link.label,
                    path: link.path,
                    icon
                };
            });
            
            // Unconditionally add Returns & Billing if ANY pharmacy permission exists
            const hasPharmacyAccess = links.some(l => l.path.includes('/pharmacy'));
            if (hasPharmacyAccess) {
                if (!links.some(l => l.path === '/pharmacy/orders')) {
                    links.push({ label: 'Pharmacy Orders', path: '/pharmacy/orders', icon: <FiClipboard /> });
                }
                if (!links.some(l => l.path === '/pharmacy/returns')) {
                    links.push({ label: 'Pharmacy Returns', path: '/pharmacy/returns', icon: <FiRefreshCcw /> });
                }
                if (!links.some(l => l.path === '/pharmacy/vendor-returns')) {
                    links.push({ label: 'Vendor Returns', path: '/pharmacy/vendor-returns', icon: <FiCornerUpLeft /> });
                }
                if (!links.some(l => l.path === '/pharmacy/departments')) {
                    links.push({ label: 'Departments & Transfer', path: '/pharmacy/departments', icon: <FiActivity /> });
                }
            }
            
            return [
                { label: 'Home Dashboard', path: '/my-dashboard', icon: <FiHome /> },
                ...links
            ];
        }

        return [
            { label: 'My Dashboard', path: '/my-dashboard', icon: <FiHome /> },
        ];
    };

    const menuItems = getMenu();

    return (
        <aside className={`erp-sidebar ${isOpen ? 'open' : 'collapsed'}`}>
            <div className="sidebar-brand">
                {branding.logoUrl ? (
                    <img
                        src={branding.logoUrl}
                        alt={hospitalName}
                        style={{ height: '32px', maxWidth: '120px', objectFit: 'contain', borderRadius: '4px' }}
                    />
                ) : (
                    <>
                        <div className="brand-dot" />
                        <span>{hospitalName !== 'Hospital Portal' ? hospitalName : 'Hospital Portal'}</span>
                    </>
                )}
            </div>
            
            <nav className="sidebar-nav">
                {menuItems.map((item, idx) => (
                    <NavLink 
                        key={idx} 
                        to={item.path} 
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        <span className="sidebar-link-icon">{item.icon}</span>
                        <span className="sidebar-link-text">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-link settings-item">
                    <span className="sidebar-link-icon"><FiSettings /></span>
                    <span className="sidebar-link-text">Profile Settings</span>
                </div>
            </div>
        </aside>
    );
};

const TopBar = ({ toggleSidebar, sidebarOpen }) => {
    const { user } = useAuth();
    const { branding, hospitalName } = useBranding();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Notifications State
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const unreadCount = notifications.filter(n => n.status === 'Unread').length;

    useEffect(() => {
        if (!user) return;
        const fetchNotifications = async () => {
            try {
                const res = await notificationAPI.getNotifications();
                if (res.success) setNotifications(res.data);
            } catch (err) { console.error('Failed to fetch notifications', err); }
        };
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [user]);

    const handleMarkAsRead = async (id) => {
        try {
            await notificationAPI.markAsRead(id);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, status: 'Read' } : n));
        } catch (err) {}
    };

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    // Helper to get initials
    const getInitials = (name) => {
        return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const userRole = (user?.role || '').toLowerCase();
    const isCentralAdmin = userRole === 'centraladmin' || userRole === 'superadmin';

    return (
        <header className="erp-topbar">
            <div className="topbar-left">
                <button className="sidebar-toggle" onClick={toggleSidebar}>
                    <div className={`hamburger ${sidebarOpen ? 'active' : ''}`}>
                        <span />
                        <span />
                        <span />
                    </div>
                </button>
                {branding.logoUrl && (
                    <img
                        src={branding.logoUrl}
                        alt={hospitalName}
                        style={{ height: '28px', maxWidth: '100px', objectFit: 'contain', borderRadius: '3px', marginRight: '8px' }}
                    />
                )}
                <div className="breadcrumb-wrap">
                    <span className="curr-page-name">
                        {location.pathname.split('/').pop().replace(/-/g, ' ') || 'Dashboard'}
                    </span>
                    <span className="path-slash">/</span>
                    <span className="path-user-role">{user?.role}</span>
                </div>
            </div>

            <div className="topbar-right">
                {!isCentralAdmin && (
                    <button
                        className="topbar-home-btn"
                        onClick={() => navigate(user?.dashboardPath || '/my-dashboard')}
                        title="Go to Home Dashboard"
                    >
                        <FiHome size={16} />
                        <span>Home</span>
                    </button>
                )}
                
                {/* Notification Bell */}
                <div className="notification-widget" style={{ position: 'relative', marginRight: '16px', cursor: 'pointer' }}>
                    <div onClick={() => setShowNotifications(!showNotifications)} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <FiBell size={20} color="#64748b" />
                        {unreadCount > 0 && (
                            <span style={{ position: 'absolute', top: '-6px', right: '-8px', background: '#ef4444', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    {showNotifications && (
                        <div style={{ position: 'absolute', top: '35px', right: '-10px', width: '320px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 1000, maxHeight: '400px', overflowY: 'auto' }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '14px', color: '#0f172a' }}>Notifications</strong>
                            </div>
                            <div style={{ padding: '8px' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No notifications</div>
                                ) : (
                                    notifications.map(n => (
                                        <div key={n._id} onClick={() => handleMarkAsRead(n._id)} style={{ padding: '12px', background: n.status === 'Unread' ? '#f8fafc' : 'white', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', borderRadius: '4px' }}>
                                            <div style={{ fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>{n.message}</div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(n.createdAt).toLocaleTimeString()}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div className="user-profile-widget">
                    <div className="profile-text-info">
                        <span className="user-disp-name">{user?.role === 'doctor' ? 'DR. ' : ''}{user?.name || 'User'}</span>
                        <span className="user-disp-role">{user?.email}</span>
                    </div>
                    <div className="profile-avatar-wrap">
                        <div className="profile-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                            {user?.avatar
                                ? <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                                : getInitials(user?.name)
                            }
                        </div>
                        <div className="online-indicator" />
                        
                        <div className="profile-dropdown-content">
                            <div className="p-header">
                                <strong>{user?.name}</strong>
                                <span>{user?.email}</span>
                                <span className="p-role-badge">{user?.role}</span>
                            </div>
                            <div className="p-footer">
                                <button onClick={handleLogout} className="btn-p-logout">
                                    <FiLogOut size={14} /> Logout Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

const DashboardLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="erp-layout">
            <DashboardSidebar isOpen={sidebarOpen} />
            <div className={`erp-main-area ${sidebarOpen ? 'shifted' : 'full'}`}>
                <TopBar sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                <main className="erp-page-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
