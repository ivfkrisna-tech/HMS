import React, { useState, useEffect } from 'react';
import { pharmacyAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import { FiSearch, FiEye, FiTrash2, FiPlay, FiDownload } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import './PharmacyInventory.css';

const PurchaseInvoiceHistory = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'
    const { user } = useAuth();
    const navigate = useNavigate();

    const [showModal, setShowModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await pharmacyAPI.getPurchaseInvoices();
            if (res.success && res.data) {
                setInvoices(res.data);
            }
        } catch (error) {
            console.error("Error fetching invoices:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) return;
        try {
            const res = await pharmacyAPI.deletePurchaseInvoice(id);
            if (res.success) {
                setInvoices(invoices.filter(inv => inv._id !== id));
            }
        } catch (error) {
            alert(error.response?.data?.message || "Failed to delete invoice");
        }
    };

    const handleContinueImport = () => {
        navigate('/pharmacy/inventory');
    };

    const handleView = (invoice) => {
        setSelectedInvoice(invoice);
        setShowModal(true);
    };

    const filteredInvoices = invoices.filter(inv => {
        const vendorMatch = (inv.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const invoiceMatch = (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
        return vendorMatch || invoiceMatch;
    }).sort((a, b) => {
        const dateA = new Date(a.uploadDate || a.createdAt);
        const dateB = new Date(b.uploadDate || b.createdAt);
        if (sortOrder === 'newest') return dateB - dateA;
        return dateA - dateB;
    });

    return (
        <div className="erp-page-container" style={{ background: '#f8fafc', minHeight: '100vh', padding: '24px', fontFamily: '"Inter", sans-serif' }}>
            <div className="erp-page-header" style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '28px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.5px' }}>Purchase Invoice History</h2>
                    <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '15px' }}>Track, manage, and review all your pharmacy incoming purchase invoices.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', width: '300px', transition: 'all 0.3s ease' }}>
                        <FiSearch style={{ color: '#94a3b8', marginRight: '10px', fontSize: '18px' }} />
                        <input 
                            type="text" 
                            placeholder="Search invoice or vendor..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', background: 'transparent' }}
                        />
                    </div>
                    <select 
                        value={sortOrder} 
                        onChange={(e) => setSortOrder(e.target.value)}
                        style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '14px', color: '#334155', cursor: 'pointer', outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                    >
                        <option value="newest">Latest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoice Details</th>
                                <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vendor</th>
                                <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upload Info</th>
                                <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Progress</th>
                                <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</th>
                                <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                                <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                                        <div style={{ display: 'inline-block', width: '30px', height: '30px', border: '3px solid #e0f2fe', borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                        <p style={{ margin: '10px 0 0', color: '#64748b', fontSize: '14px' }}>Loading real-time invoice data...</p>
                                    </td>
                                </tr>
                            ) : filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '60px 20px' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>📄</div>
                                        <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>No Invoices Found</h3>
                                        <p style={{ margin: 0, color: '#64748b' }}>Try adjusting your search filters or upload a new invoice.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((inv, idx) => (
                                    <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', background: 'white' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>{inv.invoiceNumber || 'N/A'}</div>
                                            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No Date'}</div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #c7d2fe, #a5b4fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca', fontWeight: 'bold', fontSize: '14px' }}>
                                                    {(inv.vendorName || 'V')[0].toUpperCase()}
                                                </div>
                                                <span style={{ fontWeight: '600', color: '#334155', fontSize: '14px' }}>{inv.vendorName || 'Unknown Vendor'}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontSize: '14px', color: '#334155' }}>{inv.uploadDate ? new Date(inv.uploadDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'N/A'}</div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{inv.uploadTime || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600' }}>
                                                    <span style={{ color: '#059669' }}>{inv.importedMedicines || 0} Imported</span>
                                                    <span style={{ color: '#64748b' }}>{inv.totalMedicines || 0} Total</span>
                                                </div>
                                                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(100, ((inv.importedMedicines || 0) / (inv.totalMedicines || 1)) * 100)}%`, height: '100%', background: inv.status === 'Completed' ? '#10b981' : '#3b82f6', borderRadius: '3px' }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>₹{inv.grandTotal?.toLocaleString('en-IN') || 0}</div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{ 
                                                display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                                                background: inv.status === 'Completed' ? '#dcfce7' : inv.status === 'Cancelled' ? '#fee2e2' : '#fef3c7',
                                                color: inv.status === 'Completed' ? '#166534' : inv.status === 'Cancelled' ? '#991b1b' : '#92400e',
                                                border: `1px solid ${inv.status === 'Completed' ? '#bbf7d0' : inv.status === 'Cancelled' ? '#fecaca' : '#fde68a'}`
                                            }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', marginRight: '6px' }}></span>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => handleView(inv)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => {e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.borderColor = '#3b82f6';}} onMouseLeave={(e) => {e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0';}} title="View Details">
                                                    <FiEye size={16} />
                                                </button>
                                                {inv.status === 'Pending' && (
                                                    <button onClick={handleContinueImport} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }} title="Continue Import">
                                                        <FiPlay size={16} style={{ marginLeft: '2px' }} />
                                                    </button>
                                                )}
                                                {inv.uploadedPDF?.generatedName && (
                                                    <a href={`/uploads/invoices/${inv.uploadedPDF.generatedName}`} target="_blank" rel="noreferrer" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => {e.currentTarget.style.color = '#10b981'; e.currentTarget.style.borderColor = '#10b981';}} onMouseLeave={(e) => {e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0';}} title="Download PDF">
                                                        <FiDownload size={16} />
                                                    </a>
                                                )}
                                                {user?.role === 'admin' && (
                                                    <button onClick={() => handleDelete(inv._id)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => {e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5';}} onMouseLeave={(e) => {e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0';}} title="Delete Invoice">
                                                        <FiTrash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Premium View Modal */}
            {showModal && selectedInvoice && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
                    <div style={{ background: 'white', borderRadius: '24px', width: '90%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', animation: 'slideUp 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>Invoice Details</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '24px', color: '#64748b', cursor: 'pointer' }}>&times;</button>
                        </div>
                        <div style={{ padding: '32px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Vendor</p>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{selectedInvoice.vendorName}</p>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Invoice Number</p>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{selectedInvoice.invoiceNumber}</p>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Invoice Date</p>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{selectedInvoice.invoiceDate ? new Date(selectedInvoice.invoiceDate).toLocaleDateString() : 'N/A'}</p>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Total Amount</p>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#10b981' }}>₹{selectedInvoice.grandTotal?.toLocaleString('en-IN') || 0}</p>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Status</p>
                                    <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: selectedInvoice.status === 'Completed' ? '#dcfce7' : '#fef3c7', color: selectedInvoice.status === 'Completed' ? '#166534' : '#92400e' }}>{selectedInvoice.status}</span>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Progress</p>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{selectedInvoice.importedMedicines || 0} / {selectedInvoice.totalMedicines || 0}</p>
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '20px 32px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}>Close</button>
                            {selectedInvoice.uploadedPDF?.generatedName && (
                                <a href={`/uploads/invoices/${selectedInvoice.uploadedPDF.generatedName}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                                    <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'white', color: '#10b981', border: '1px solid #10b981', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                                        <FiDownload /> PDF
                                    </button>
                                </a>
                            )}
                            {selectedInvoice.status === 'Pending' && (
                                <button onClick={() => { setShowModal(false); handleContinueImport(); }} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    Continue Import
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseInvoiceHistory;
