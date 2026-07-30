import React, { useState, useEffect } from 'react';
import { pharmacyAPI } from '../../utils/api';
import './PharmacyInventory.css';

const PharmacyInventory = () => {
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
                // Edit & View states
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [selectedMedicine, setSelectedMedicine] = useState(null);

    const initialFormState = {
        name: '', salt: '', category: '', stock: '', unit: 'Tablets',
        minStockAlertLevel: 50, rackLocation: '', vendorId: '',
        buyingPrice: '', sellingPrice: '', vendor: '',
        sgst: '', cgst: '', cgstPercent: '', sgstPercent: '',
        batchNumber: '', expiryDate: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        isMultiDose: false, packVolume: '', volumeUnit: 'IU', billingType: 'FULL_UNIT'
    };

    const [newMedicine, setNewMedicine] = useState(initialFormState);

    const [vendors, setVendors] = useState([]);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [vendorForm, setVendorForm] = useState({ vendorName: '', contactPerson: '', phone: '', gstin: '' });
    const [vendorErrors, setVendorErrors] = useState({});
    const [savingVendor, setSavingVendor] = useState(false);

    useEffect(() => { 
        fetchInventory(); 
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        try {
            const res = await pharmacyAPI.getVendors();
            if (res.success) setVendors(res.data);
        } catch (error) { console.error("Error fetching vendors", error); }
    };

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const response = await pharmacyAPI.getInventory();
            if (response.success) setMedicines(response.data);
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally { setLoading(false); }
    };

    const validateVendor = () => {
        let errs = {};
        if (!vendorForm.vendorName || !vendorForm.vendorName.trim()) errs.vendorName = 'Vendor name is required';
        if (vendorForm.phone && !/^\d{10}$/.test(vendorForm.phone)) errs.phone = 'Phone number must be exactly 10 digits';
        if (vendorForm.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(vendorForm.gstin.trim())) {
            errs.gstin = 'Invalid GSTIN format';
        }
        setVendorErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSaveVendor = async (e) => {
        e.preventDefault();
        if (!validateVendor()) return;
        setSavingVendor(true);
        try {
            const res = await pharmacyAPI.addVendor(vendorForm);
            if (res.success) {
                fetchVendors();
                setShowVendorModal(false);
                setVendorForm({ vendorName: '', contactPerson: '', phone: '', gstin: '' });
                setVendorErrors({});
                alert("Vendor added successfully");
            }
        } catch (error) {
            alert(error.response?.data?.message || "Failed to add vendor");
        } finally {
            setSavingVendor(false);
        }
    };

    const handleAddMedicine = async (e) => {
        e.preventDefault();

        const cleanedData = {
            ...newMedicine,
            salt: newMedicine.salt || '',
            stock: Number(newMedicine.stock),
            minStockAlertLevel: Number(newMedicine.minStockAlertLevel) || 50,
            buyingPrice: Number(newMedicine.buyingPrice),
            sellingPrice: Number(newMedicine.sellingPrice),
            sgst: Number(newMedicine.sgst) || 0,
            cgst: Number(newMedicine.cgst) || 0,
            cgstPercent: Number(newMedicine.cgstPercent) || 0,
            sgstPercent: Number(newMedicine.sgstPercent) || 0,
            vendorId: newMedicine.vendorId || null,
            expiryDate: new Date(newMedicine.expiryDate),
            purchaseDate: new Date(newMedicine.purchaseDate),
            isMultiDose: Boolean(newMedicine.isMultiDose),
            packVolume: Number(newMedicine.packVolume) || 1
        };

        console.log("UPDATE PAYLOAD SENT:", cleanedData);

        try {
            let response;
            if (isEditing) {
                response = await pharmacyAPI.updateMedicine(editId, cleanedData);
            } else {
                response = await pharmacyAPI.addMedicine(cleanedData);
            }

            if (response.success) {
                setIsEditing(false);
                setEditId(null);
                fetchInventory();
                setNewMedicine(initialFormState);
            }
        } catch (error) {
            const msg = error.response?.data?.message || "Check fields";
            console.error("Validation Error:", msg);
            alert("Error: " + msg);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this item?")) {
            try {
                await pharmacyAPI.deleteMedicine(id);
                fetchInventory();
            } catch (error) { alert("Delete failed."); }
        }
    };

    const handleEdit = (med) => {
        setNewMedicine({
            name: med.name,
            category: med.category,
            stock: med.stock,
            minStockAlertLevel: med.minStockAlertLevel || 50,
            rackLocation: med.rackLocation || '',
            unit: med.unit || 'Tablets',
            buyingPrice: med.buyingPrice,
            sellingPrice: med.sellingPrice,
            sgst: med.sgst || '',
            cgst: med.cgst || '',
            cgstPercent: med.cgstPercent || '',
            sgstPercent: med.sgstPercent || '',
            vendor: med.vendor || '',
            vendorId: med.vendorId || '',
            batchNumber: med.batchNumber || '',
            expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '',
            purchaseDate: med.purchaseDate ? new Date(med.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            isMultiDose: med.isMultiDose || false,
            packVolume: med.packVolume || '',
            volumeUnit: med.volumeUnit || 'ml',
            billingType: med.billingType || 'FULL_UNIT'
        });
        setIsEditing(true);
        setEditId(med._id);
    };

    const handleViewDetails = (med) => {
        setSelectedMedicine(med);
        setShowDetailsModal(true);
    };

    const filteredMedicines = medicines.filter(med =>
        med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.category.toLowerCase().includes(searchTerm.toLowerCase())
    );


    return (
        <div className="pharmacy-management-container">
            <div className="admin-card" style={{ marginBottom: '20px', background: 'var(--glass-bg)', padding: '24px', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h2 style={{ margin: '0', fontSize: '1.8rem', color: 'var(--text-dark)' }}>💊 Medicine Inventory</h2>
                        <p style={{ color: 'var(--text-light)', fontSize: '14px', margin: '4px 0 0' }}>Manage your hospital's medicine stock, pricing, and expiry tracking</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => setShowVendorModal(true)}
                            className="btn-add"
                            style={{ padding: '8px 20px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', boxShadow: 'none' }}
                        >
                            👥 Manage Vendors
                        </button>
                    </div>
                </div>

                <form onSubmit={handleAddMedicine} className="pharma-form" style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', marginTop: '20px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#334155' }}>{isEditing ? 'Edit Medicine' : 'Add New Medicine'}</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>MEDICINE NAME *</label>
                                <input required type="text" value={newMedicine.name} onChange={(e) => setNewMedicine({ ...newMedicine, name: e.target.value })} placeholder="e.g. Gonal-F 900 IU Pen / Menopur 75 IU" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>SALT / COMPOSITION</label>
                                <input type="text" value={newMedicine.salt || ''} onChange={(e) => setNewMedicine({ ...newMedicine, salt: e.target.value })} placeholder="e.g. Acetaminophen" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>CATEGORY *</label>
                                <input required type="text" value={newMedicine.category} onChange={(e) => setNewMedicine({ ...newMedicine, category: e.target.value })} placeholder="General" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                        </div>

                        <div style={{ background: '#e0f2fe', padding: '15px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #bae6fd' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', fontWeight: 'bold', color: '#0369a1', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newMedicine.isMultiDose} onChange={(e) => setNewMedicine({ ...newMedicine, isMultiDose: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                Enable Partial/Dosage Tracking (Multi-Dose items like Syrups, IV Fluids, Vials)
                            </label>
                            
                            {newMedicine.isMultiDose && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#0284c7', marginBottom: '6px' }}>VOLUME / DOSAGE PER UNIT *</label>
                                        <input required={newMedicine.isMultiDose} type="number" min="1" step="any" value={newMedicine.packVolume} onChange={(e) => setNewMedicine({ ...newMedicine, packVolume: e.target.value })} placeholder="e.g. 900" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #7dd3fc' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#0284c7', marginBottom: '6px' }}>VOLUME UNIT *</label>
                                        <select value={newMedicine.volumeUnit} onChange={(e) => setNewMedicine({ ...newMedicine, volumeUnit: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #7dd3fc', background: 'white' }}>
                                            <option value="IU">IU (International Units)</option>
                                            <option value="IU/ml">IU/ml</option>
                                            <option value="Units">Units</option>
                                            <option value="ml">ml</option>
                                            <option value="mcg">mcg</option>
                                            <option value="mg">mg</option>
                                            <option value="pills">Pills / Tablets</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#0284c7', marginBottom: '6px' }}>BILLING TYPE *</label>
                                        <select value={newMedicine.billingType} onChange={(e) => setNewMedicine({ ...newMedicine, billingType: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #7dd3fc', background: 'white' }}>
                                            <option value="FULL_UNIT">Charge Full Unit (Vial/Bottle)</option>
                                            <option value="PROPORTIONAL">Charge Proportionally (by used volume)</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                                        <div style={{ padding: '8px 12px', background: '#0284c7', color: 'white', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', width: '100%' }}>
                                            Total Initial Vol: {(newMedicine.stock || 0) * (newMedicine.packVolume || 0)} {newMedicine.volumeUnit}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>SEALED STOCK QTY (PACKS/BOTTLES) *</label>
                                <input required type="number" min="0" value={newMedicine.stock} onChange={(e) => setNewMedicine({ ...newMedicine, stock: e.target.value })} placeholder="e.g. 500" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>UNIT</label>
                                <select value={newMedicine.unit} onChange={(e) => setNewMedicine({ ...newMedicine, unit: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white' }}>
                                    {['Tablets', 'Capsules', 'Syrup', 'Injection', 'Ointment', 'Others'].map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>BATCH NUMBER</label>
                                <input type="text" value={newMedicine.batchNumber} onChange={(e) => setNewMedicine({ ...newMedicine, batchNumber: e.target.value })} placeholder="e.g. BT-2026-001" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>COST PRICE (₹) *</label>
                                <input required type="number" min="0" step="any" value={newMedicine.buyingPrice} onChange={(e) => setNewMedicine({ ...newMedicine, buyingPrice: e.target.value })} placeholder="e.g. 30" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>SELLING PRICE (₹) *</label>
                                <input required type="number" min="0" step="any" value={newMedicine.sellingPrice} onChange={(e) => setNewMedicine({ ...newMedicine, sellingPrice: e.target.value })} placeholder="e.g. 50" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>PROFIT MARGIN</label>
                                <input type="text" readOnly value={newMedicine.buyingPrice && newMedicine.sellingPrice ? `${(((Number(newMedicine.sellingPrice) - Number(newMedicine.buyingPrice)) / (Number(newMedicine.buyingPrice) || 1)) * 100).toFixed(1)}%` : '--'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f1f5f9', fontWeight: '700', color: Number(newMedicine.sellingPrice) > Number(newMedicine.buyingPrice) ? '#059669' : '#dc2626' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>CGST (%)</label>
                                <input type="number" min="0" step="any" value={newMedicine.cgstPercent} onChange={(e) => setNewMedicine({ ...newMedicine, cgstPercent: e.target.value })} placeholder="e.g. 5" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>SGST (%)</label>
                                <input type="number" min="0" step="any" value={newMedicine.sgstPercent} onChange={(e) => setNewMedicine({ ...newMedicine, sgstPercent: e.target.value })} placeholder="e.g. 5" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group"></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>EXPIRY DATE *</label>
                                <input required type="date" value={newMedicine.expiryDate} onChange={(e) => setNewMedicine({ ...newMedicine, expiryDate: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>VENDOR / SUPPLIER</label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <select value={newMedicine.vendorId || ''} onChange={(e) => {
                                        const selId = e.target.value;
                                        const v = vendors.find(v => v._id === selId);
                                        setNewMedicine({ ...newMedicine, vendorId: selId, vendor: v ? v.vendorName : '' });
                                    }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white' }}>
                                        <option value="">-- Select Vendor --</option>
                                        {vendors.map(v => (
                                            <option key={v._id} value={v._id}>{v.vendorName}</option>
                                        ))}
                                    </select>
                                    <button type="button" onClick={() => setShowVendorModal(true)} style={{ padding: '0 15px', background: '#e0e7ff', border: '1px solid #c7d2fe', borderRadius: '8px', cursor: 'pointer', color: '#4338ca', fontWeight: 'bold' }}>+</button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>RACK LOCATION</label>
                                <input type="text" value={newMedicine.rackLocation} onChange={(e) => setNewMedicine({ ...newMedicine, rackLocation: e.target.value })} placeholder="e.g. Rack A-3" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>MIN STOCK ALERT LEVEL</label>
                                <input type="number" value={newMedicine.minStockAlertLevel} onChange={(e) => setNewMedicine({ ...newMedicine, minStockAlertLevel: e.target.value })} placeholder="50" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div className="form-group"></div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            {isEditing && (
                                <button type="button" onClick={() => { setIsEditing(false); setEditId(null); setNewMedicine(initialFormState); }} className="btn-cancel" style={{ padding: '10px 24px', width: 'auto', boxShadow: 'none', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel Edit</button>
                            )}
                            <button type="submit" className="btn-save" style={{ padding: '10px 24px', width: 'auto', boxShadow: 'none' }}>{isEditing ? 'Update Medicine' : 'Add Medicine'}</button>
                            {!isEditing && (
                                <button type="button" onClick={() => setNewMedicine(initialFormState)} className="btn-cancel" style={{ padding: '10px 24px', width: 'auto', boxShadow: 'none', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#64748b' }}>Clear Form</button>
                            )}
                        </div>
                    </form>
            </div>

            <div className="inventory-controls" style={{ marginBottom: '20px' }}>
                <div className="search-bar" style={{ maxWidth: '400px' }}>
                    <span className="search-icon">🔍</span>
                    <input type="text" placeholder="Search medicines..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>
            <div className="inventory-table-wrapper">
                {loading ? <div className="loader">Loading...</div> : (
                    <table className="inventory-table">
                        <thead>
                            <tr>
                                <th>Batch #</th>
                                <th>Medicine Name</th>
                                <th>Category</th>
                                <th>Stock</th>
                                <th>Buying (₹)</th>
                                <th>Selling (₹)</th>
                                <th>Vendor</th>
                                <th>Expiry</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMedicines.map((med) => (
                                <tr key={med._id}>
                                    <td><small>#{med.batchNumber}</small></td>
                                    <td className="med-name">{med.name}</td>
                                    <td><span className="category-tag">{med.category}</span></td>
                                    <td>
                                        {med.isMultiDose ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div className={med.stock < (med.minStockAlertLevel || 50) ? 'low-stock' : 'good-stock'} style={{ fontWeight: 'bold' }}>
                                                    {med.stock} {med.unit || 'Vials'} <span style={{ fontSize: '0.85em', color: '#475569', fontWeight: 'normal' }}>({med.openUnitVolume || 0}/{med.packVolume} {med.volumeUnit} open)</span>
                                                </div>
                                                {med.openUnitVolume > 0 && (
                                                    <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${((med.openUnitVolume / med.packVolume) * 100) || 0}%`, height: '100%', background: '#3b82f6' }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className={med.stock < (med.minStockAlertLevel || 50) ? 'low-stock' : 'good-stock'}>{med.stock} {med.unit}</div>
                                        )}
                                    </td>
                                    <td>₹{med.buyingPrice}</td>
                                    <td><strong>₹{med.sellingPrice}</strong></td>
                                    <td>{med.vendor || 'N/A'}</td>
                                    <td>{new Date(med.expiryDate).toLocaleDateString()}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button 
                                                title="View Details"
                                                onClick={() => handleViewDetails(med)} 
                                                style={{ padding: '6px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                👁️
                                            </button>
                                            <button 
                                                title="Edit Medicine"
                                                onClick={() => {
                                                    handleEdit(med);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }} 
                                                style={{ padding: '6px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                ✏️
                                            </button>
                                            <button 
                                                title="Delete Item"
                                                onClick={() => handleDelete(med._id)} 
                                                style={{ padding: '6px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content inventory-modal">
                        <div className="modal-header">
                            <div>
                                <h2>{isEditing ? 'Edit Medication' : 'Add New Medication'}</h2>
                                <p className="modal-subtitle">Enter details to update your stock levels</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
                        </div>

                        <form onSubmit={handleAddMedicine} className="pharma-form">
                            {/* Section 1: Basic Information */}
                            <div className="form-section">
                                <h3 className="section-title">General Information</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Medicine Name <span className="required">*</span></label>
                                        <input required type="text" value={newMedicine.name} onChange={(e) => setNewMedicine({ ...newMedicine, name: e.target.value })} placeholder="e.g. Paracetamol 500mg" />
                                    </div>
                                    <div className="form-group">
                                        <label>Category <span className="required">*</span></label>
                                        <input required type="text" value={newMedicine.category} onChange={(e) => setNewMedicine({ ...newMedicine, category: e.target.value })} placeholder="e.g. Analgesic" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label>Vendor / Supplier</label>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <select value={newMedicine.vendorId || ''} onChange={(e) => {
                                                const selId = e.target.value;
                                                const v = vendors.find(v => v._id === selId);
                                                setNewMedicine({ ...newMedicine, vendorId: selId, vendor: v ? v.vendorName : '' });
                                            }} style={{ flex: 1, padding: '8px' }}>
                                                <option value="">-- Select Vendor --</option>
                                                {vendors.map(v => (
                                                    <option key={v._id} value={v._id}>{v.vendorName}</option>
                                                ))}
                                            </select>
                                            <button type="button" onClick={() => setShowVendorModal(true)} style={{ padding: '8px', background: '#e0e7ff', border: '1px solid #c7d2fe', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Batch Number</label>
                                        <input required type="text" value={newMedicine.batchNumber} onChange={(e) => setNewMedicine({ ...newMedicine, batchNumber: e.target.value })} placeholder="e.g. BT-9921" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Rack Location</label>
                                        <input type="text" value={newMedicine.rackLocation} onChange={(e) => setNewMedicine({ ...newMedicine, rackLocation: e.target.value })} placeholder="e.g. Rack A-3" />
                                    </div>
                                    <div className="form-group">
                                        <label>Min Stock Alert Level</label>
                                        <input type="number" value={newMedicine.minStockAlertLevel} onChange={(e) => setNewMedicine({ ...newMedicine, minStockAlertLevel: e.target.value })} placeholder="50" />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Stock & Pricing */}
                            <div className="form-section">
                                <h3 className="section-title">Inventory & Pricing</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Quantity</label>
                                        <input required type="number" value={newMedicine.stock} onChange={(e) => setNewMedicine({ ...newMedicine, stock: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="form-group">
                                        <label>Unit</label>
                                        <select value={newMedicine.unit} onChange={(e) => setNewMedicine({ ...newMedicine, unit: e.target.value })}>
                                            <option value="Tablets">Tablets</option>
                                            <option value="Capsules">Capsules</option>
                                            <option value="Bottles">Bottles</option>
                                            <option value="Strips">Strips</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Purchase Price (₹)</label>
                                        <div className="input-with-icon">
                                            <input required type="number" step="any" value={newMedicine.buyingPrice} onChange={(e) => setNewMedicine({ ...newMedicine, buyingPrice: e.target.value })} placeholder="0.00" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Selling Price (₹)</label>
                                        <div className="input-with-icon">
                                            <input required type="number" step="any" value={newMedicine.sellingPrice} onChange={(e) => setNewMedicine({ ...newMedicine, sellingPrice: e.target.value })} placeholder="0.00" />
                                        </div>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>SGST (%)</label>
                                        <div className="input-with-icon">
                                            <input required type="number" step="any" value={newMedicine.sgstPercent} onChange={(e) => setNewMedicine({ ...newMedicine, sgstPercent: e.target.value })} placeholder="0" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>CGST (%)</label>
                                        <div className="input-with-icon">
                                            <input required type="number" step="any" value={newMedicine.cgstPercent} onChange={(e) => setNewMedicine({ ...newMedicine, cgstPercent: e.target.value })} placeholder="0" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Dates */}
                            <div className="form-section">
                                <h3 className="section-title">Tracking Dates</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Purchase Date</label>
                                        <input required type="date" value={newMedicine.purchaseDate} onChange={(e) => setNewMedicine({ ...newMedicine, purchaseDate: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Expiry Date</label>
                                        <input required type="date" value={newMedicine.expiryDate} onChange={(e) => setNewMedicine({ ...newMedicine, expiryDate: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>Discard</button>
                                <button type="submit" className="btn-save">{isEditing ? 'Update Inventory' : 'Save to Inventory'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDetailsModal && selectedMedicine && (
                <div className="modal-overlay">
                    <div className="modal-content inventory-modal" style={{ maxWidth: '600px', width: '95%' }}>
                        <div className="modal-header">
                            <div>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>👁️</span> Medicine Details
                                </h2>
                                <p className="modal-subtitle" style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a8a', marginTop: '5px' }}>{selectedMedicine.name}</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowDetailsModal(false)}>×</button>
                        </div>
                        <div className="pharma-form" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <h3 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', marginTop: 0 }}>Stock & Inventory</h3>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: '#475569' }}>Total Stock:</span>
                                        <strong style={{ color: selectedMedicine.stock < (selectedMedicine.minStockAlertLevel || 50) ? '#dc2626' : '#059669' }}>{selectedMedicine.stock} {selectedMedicine.unit || 'Tablets'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: '#475569' }}>Min Alert Level:</span>
                                        <strong>{selectedMedicine.minStockAlertLevel || 50}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#475569' }}>Rack Location:</span>
                                        <strong>{selectedMedicine.rackLocation || 'Unassigned'}</strong>
                                    </div>
                                </div>

                                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <h3 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', marginTop: 0 }}>Batch & Tracking</h3>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: '#475569' }}>Batch Number:</span>
                                        <strong>{selectedMedicine.batchNumber || 'N/A'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: '#475569' }}>Purchase Date:</span>
                                        <strong>{selectedMedicine.purchaseDate ? new Date(selectedMedicine.purchaseDate).toLocaleDateString() : 'N/A'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#475569' }}>Expiry Date:</span>
                                        <strong style={{ color: new Date(selectedMedicine.expiryDate) < new Date() ? '#dc2626' : '#0f172a' }}>
                                            {selectedMedicine.expiryDate ? new Date(selectedMedicine.expiryDate).toLocaleDateString() : 'N/A'}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <h3 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', marginTop: 0 }}>Vendor & Category</h3>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#475569' }}>Category:</span>
                                    <strong>{selectedMedicine.category}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#475569' }}>Salt/Composition:</span>
                                    <strong>{selectedMedicine.salt || 'N/A'}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#475569' }}>Vendor/Supplier:</span>
                                    <strong>{selectedMedicine.vendor || 'N/A'}</strong>
                                </div>
                            </div>

                            <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                                <h3 style={{ fontSize: '13px', color: '#0369a1', textTransform: 'uppercase', marginBottom: '10px', marginTop: 0 }}>Pricing & Taxes</h3>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#0c4a6e' }}>Purchase Price (excl. GST):</span>
                                    <strong>₹{selectedMedicine.buyingPrice || 0}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#0c4a6e' }}>Selling Price:</span>
                                    <strong style={{ color: '#059669', fontSize: '16px' }}>₹{selectedMedicine.sellingPrice || 0}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#0c4a6e' }}>CGST:</span>
                                    <strong>{selectedMedicine.cgstPercent || 0}%</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ color: '#0c4a6e' }}>SGST:</span>
                                    <strong>{selectedMedicine.sgstPercent || 0}%</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1em', borderTop: '1px solid #7dd3fc', paddingTop: '10px' }}>
                                    <span style={{ color: '#082f49' }}><strong>Final Purchase Cost (incl. GST):</strong></span>
                                    <strong style={{ color: '#1d4ed8', fontSize: '18px' }}>
                                        ₹{(Number(selectedMedicine.buyingPrice || 0) + 
                                          Number(selectedMedicine.buyingPrice || 0) * (Number(selectedMedicine.sgstPercent || 0) + Number(selectedMedicine.cgstPercent || 0)) / 100).toFixed(2)}
                                    </strong>
                                </div>
                            </div>

                        </div>
                        <div className="modal-actions" style={{ padding: '15px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button 
                                type="button" 
                                className="btn-add" 
                                style={{ background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', padding: '8px 16px', boxShadow: 'none' }}
                                onClick={() => {
                                    setShowDetailsModal(false);
                                    handleEdit(selectedMedicine);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            >
                                ✏️ Edit Medicine
                            </button>
                            <button type="button" className="btn-cancel" onClick={() => setShowDetailsModal(false)} style={{ padding: '8px 16px' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showVendorModal && (
                <div className="modal-overlay">
                    <div className="modal-content inventory-modal" style={{maxWidth: '500px'}}>
                        <div className="modal-header">
                            <div>
                                <h2>Manage Vendors</h2>
                                <p className="modal-subtitle">Add a new supplier</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowVendorModal(false)}>×</button>
                        </div>
                        <div className="pharma-form" style={{padding: '20px'}}>
                            <form onSubmit={handleSaveVendor}>
                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label>Vendor Name *</label>
                                    <input required type="text" value={vendorForm.vendorName} onChange={(e) => setVendorForm({ ...vendorForm, vendorName: e.target.value })} placeholder="Enter vendor name" />
                                    {vendorErrors.vendorName && <span className="error-text" style={{color: 'red', fontSize: '12px'}}>{vendorErrors.vendorName}</span>}
                                </div>
                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label>Contact Person</label>
                                    <input type="text" value={vendorForm.contactPerson} onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })} placeholder="Contact Person" />
                                </div>
                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label>Phone Number *</label>
                                    <input type="text" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="Phone Number" />
                                    {vendorErrors.phone && <span className="error-text" style={{color: 'red', fontSize: '12px'}}>{vendorErrors.phone}</span>}
                                </div>
                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label>GSTIN</label>
                                    <input type="text" value={vendorForm.gstin} onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value.toUpperCase().slice(0, 15) })} placeholder="GST Number" />
                                    {vendorErrors.gstin && <span className="error-text" style={{color: 'red', fontSize: '12px'}}>{vendorErrors.gstin}</span>}
                                </div>
                                <div className="modal-actions" style={{ marginTop: '20px' }}>
                                    <button type="button" className="btn-cancel" onClick={() => setShowVendorModal(false)}>Cancel</button>
                                    <button type="submit" disabled={savingVendor} className="btn-save">{savingVendor ? 'Saving...' : 'Save Vendor'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PharmacyInventory;