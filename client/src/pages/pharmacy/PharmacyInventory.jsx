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
        name: '', category: '', stock: '', unit: 'Tablets',
        buyingPrice: '', sellingPrice: '', vendor: '',
        sgst: '', cgst: '',
        batchNumber: '', expiryDate: '',
        purchaseDate: new Date().toISOString().split('T')[0]
    };

    const [newMedicine, setNewMedicine] = useState(initialFormState);

    useEffect(() => { fetchInventory(); }, []);

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const response = await pharmacyAPI.getInventory();
            if (response.success) setMedicines(response.data);
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally { setLoading(false); }
    };

    const handleAddMedicine = async (e) => {
        e.preventDefault();

        const cleanedData = {
            ...newMedicine,
            stock: Number(newMedicine.stock),
            buyingPrice: Number(newMedicine.buyingPrice),
            sellingPrice: Number(newMedicine.sellingPrice),
            sgst: Number(newMedicine.sgst) || 0,
            cgst: Number(newMedicine.cgst) || 0,
            expiryDate: new Date(newMedicine.expiryDate),
            purchaseDate: new Date(newMedicine.purchaseDate)
        };

        try {
            let response;
            if (isEditing) {
                response = await pharmacyAPI.updateMedicine(editId, cleanedData);
            } else {
                response = await pharmacyAPI.addMedicine(cleanedData);
            }

            if (response.success) {
                setShowAddModal(false);
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
            unit: med.unit || 'Tablets',
            buyingPrice: med.buyingPrice,
            sellingPrice: med.sellingPrice,
            sgst: med.sgst || '',
            cgst: med.cgst || '',
            vendor: med.vendor || '',
            batchNumber: med.batchNumber || '',
            expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '',
            purchaseDate: med.purchaseDate ? new Date(med.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        });
        setIsEditing(true);
        setEditId(med._id);
        setShowAddModal(true);
    };

    const handleViewDetails = (med) => {
        setSelectedMedicine(med);
        setShowDetailsModal(true);
    };

    const openAddModal = () => {
        setNewMedicine(initialFormState);
        setIsEditing(false);
        setEditId(null);
        setShowAddModal(true);
    };

    const filteredMedicines = medicines.filter(med =>
        med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="pharmacy-management-container">
            <div className="pharmacy-header">
                <h1>Medicine Inventory</h1>
                <p>Track stock, vendors, and profit margins.</p>
            </div>

            <div className="inventory-controls">
                <div className="search-bar">
                    <span className="search-icon">🔍</span>
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <button className="btn-add" onClick={openAddModal}>+ Add Stock</button>
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
                                    <td><div className={med.stock < 50 ? 'low-stock' : 'good-stock'}>{med.stock} {med.unit}</div></td>
                                    <td>₹{med.buyingPrice}</td>
                                    <td><strong>₹{med.sellingPrice}</strong></td>
                                    <td>{med.vendor}</td>
                                    <td>{new Date(med.expiryDate).toLocaleDateString()}</td>
                                    <td>
                                        <button className="action-btn view" onClick={() => handleViewDetails(med)} style={{marginRight: '5px'}}>👁</button>
                                        <button className="action-btn edit" onClick={() => handleEdit(med)} style={{marginRight: '5px'}}>✎</button>
                                        <button className="action-btn delete" onClick={() => handleDelete(med._id)}>🗑</button>
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
                                    <div className="form-group">
                                        <label>Vendor / Supplier</label>
                                        <input required type="text" value={newMedicine.vendor} onChange={(e) => setNewMedicine({ ...newMedicine, vendor: e.target.value })} placeholder="e.g. Acme Pharma Ltd." />
                                    </div>
                                    <div className="form-group">
                                        <label>Batch Number</label>
                                        <input required type="text" value={newMedicine.batchNumber} onChange={(e) => setNewMedicine({ ...newMedicine, batchNumber: e.target.value })} placeholder="e.g. BT-9921" />
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
                                            <input required type="number" step="any" value={newMedicine.sgst} onChange={(e) => setNewMedicine({ ...newMedicine, sgst: e.target.value })} placeholder="0" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>CGST (%)</label>
                                        <div className="input-with-icon">
                                            <input required type="number" step="any" value={newMedicine.cgst} onChange={(e) => setNewMedicine({ ...newMedicine, cgst: e.target.value })} placeholder="0" />
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
                    <div className="modal-content inventory-modal" style={{maxWidth: '500px'}}>
                        <div className="modal-header">
                            <div>
                                <h2>Stock Details</h2>
                                <p className="modal-subtitle">{selectedMedicine.name}</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowDetailsModal(false)}>×</button>
                        </div>
                        <div className="pharma-form" style={{padding: '20px'}}>
                            <div className="form-section">
                                <h3 className="section-title">Pricing & GST Info</h3>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                        <span>Purchase Price:</span>
                                        <strong>₹{selectedMedicine.buyingPrice || 0}</strong>
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                        <span>SGST:</span>
                                        <strong>{selectedMedicine.sgst || 0}%</strong>
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                        <span>CGST:</span>
                                        <strong>{selectedMedicine.cgst || 0}%</strong>
                                    </div>
                                    <hr />
                                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '1.1em'}}>
                                        <span><strong>Final Purchase Cost:</strong></span>
                                        <strong style={{color: '#2e7d32'}}>
                                            ₹{(Number(selectedMedicine.buyingPrice || 0) + 
                                              Number(selectedMedicine.buyingPrice || 0) * (Number(selectedMedicine.sgst || 0) + Number(selectedMedicine.cgst || 0)) / 100).toFixed(2)}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn-save" onClick={() => setShowDetailsModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PharmacyInventory;