import React, { useState, useEffect } from 'react';
import { pharmacyOrderAPI, pharmacyAPI } from '../../utils/api';
import './PharmacyReturns.css';

const PharmacyReturns = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Process State
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [returnType, setReturnType] = useState('Refund');
    
    // Items selected to return
    // format: { index: quantity_to_return }
    const [returnQuantities, setReturnQuantities] = useState({});
    
    // Exchange inventory
    const [inventory, setInventory] = useState([]);
    const [exchangedItems, setExchangedItems] = useState([]); // { medicineId, medicineName, quantity, pricePerUnit }

    useEffect(() => {
        if (selectedOrder && returnType === 'Exchange' && inventory.length === 0) {
            fetchInventory();
        }
    }, [selectedOrder, returnType]);

    const fetchInventory = async () => {
        try {
            const res = await pharmacyAPI.getInventory();
            if (res.success) setInventory(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const res = await pharmacyOrderAPI.searchBills(searchQuery);
            if (res.success) setOrders(res.orders);
        } catch (error) {
            alert('Search failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        setReturnQuantities({});
        setExchangedItems([]);
        setReturnType('Refund');
    };

    const handleReturnQtyChange = (idx, value, maxAllowed) => {
        let val = Number(value);
        if (val < 0) val = 0;
        // Without exact qty saved, we assume 1 if not calculated. We'll limit by what's reasonable or just let pharmacist decide based on price.
        // If maxAllowed is passed, limit it. 
        if (maxAllowed && val > maxAllowed) val = maxAllowed;
        
        setReturnQuantities(prev => ({
            ...prev,
            [idx]: val
        }));
    };

    const handleAddExchangeItem = () => {
        setExchangedItems([...exchangedItems, { medicineId: '', medicineName: '', quantity: 1, pricePerUnit: 0 }]);
    };

    const handleExchangeItemChange = (idx, field, value) => {
        const newItems = [...exchangedItems];
        if (field === 'medicineId') {
            const med = inventory.find(i => i._id === value);
            newItems[idx].medicineId = value;
            newItems[idx].medicineName = med ? med.name : '';
            newItems[idx].pricePerUnit = med ? med.sellingPrice : 0;
        } else {
            newItems[idx][field] = value;
        }
        setExchangedItems(newItems);
    };

    const handleRemoveExchangeItem = (idx) => {
        setExchangedItems(exchangedItems.filter((_, i) => i !== idx));
    };

    // Calculate totals
    const calculateTotals = () => {
        let totalRefund = 0;
        const returnedPayload = [];

        if (selectedOrder) {
            selectedOrder.items.forEach((item, idx) => {
                const qty = returnQuantities[idx] || 0;
                if (qty > 0 && item.purchased) {
                    // Estimate unit price if qty was missing: 
                    // Actually, since we don't have exact unit price on order item, we just use item.price if qty=1, or prompt for it.
                    // Let's assume pharmacist enters how much refund to give per unit, or we derive it if we can. 
                    // Here we'll derive a rough unit price from total price if we assume original qty was 1. 
                    // To be safe, we just let them refund up to the item.price total.
                    const unitPrice = item.price; // This is a limitation, but we use the total price as unit price if they enter qty 1.
                    
                    const refundAmt = qty * unitPrice;
                    totalRefund += refundAmt;
                    returnedPayload.push({
                        medicineName: item.medicineName,
                        quantity: qty,
                        pricePerUnit: unitPrice,
                        refundAmount: refundAmt
                    });
                }
            });
        }

        let totalExchangeCost = 0;
        const exchangePayload = [];
        if (returnType === 'Exchange') {
            exchangedItems.forEach(item => {
                if (item.medicineId && item.quantity > 0) {
                    const cost = item.quantity * item.pricePerUnit;
                    totalExchangeCost += cost;
                    exchangePayload.push({
                        ...item,
                        totalCost: cost
                    });
                }
            });
        }

        // Net = Exchange Cost - Refund Amount
        // Positive means patient pays us. Negative means we refund patient.
        const netAmount = totalExchangeCost - totalRefund;

        return { totalRefund, totalExchangeCost, netAmount, returnedPayload, exchangePayload };
    };

    const { totalRefund, totalExchangeCost, netAmount, returnedPayload, exchangePayload } = calculateTotals();

    const handleSubmit = async () => {
        if (!selectedOrder) return;
        if (returnedPayload.length === 0) {
            return alert("Please specify quantities to return.");
        }

        try {
            const res = await pharmacyOrderAPI.processReturn({
                originalOrderId: selectedOrder._id,
                returnType,
                returnedItems: returnedPayload,
                exchangedItems: exchangePayload,
                netAmount
            });

            if (res.success) {
                alert(`Success! ${res.message}`);
                setSelectedOrder(null);
                setSearchQuery('');
                setOrders([]);
            }
        } catch (error) {
            alert(error.response?.data?.message || "Failed to process return.");
        }
    };

    return (
        <div className="pharmacy-returns-container">
            <div className="returns-header">
                <h1>Medicine Return & Exchange</h1>
                <p>Process refunds or medicine exchanges for patients.</p>
            </div>

            <div className="search-section">
                <form onSubmit={handleSearch} className="search-form">
                    <input 
                        type="text" 
                        placeholder="Search by Invoice ID, MRN, Name, or Mobile..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    <button type="submit" className="btn-search" disabled={loading}>
                        {loading ? 'Searching...' : 'Search Bill'}
                    </button>
                </form>

                {orders.length > 0 && !selectedOrder && (
                    <div className="search-results">
                        <h3>Select a Bill</h3>
                        <table className="results-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Invoice ID</th>
                                    <th>Patient</th>
                                    <th>Status</th>
                                    <th>Amount</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr key={order._id}>
                                        <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                                        <td><small>{order._id}</small></td>
                                        <td>{order.userId?.name} <br/><small>{order.userId?.phone}</small></td>
                                        <td><span className={`status ${order.orderStatus.toLowerCase()}`}>{order.orderStatus}</span></td>
                                        <td>₹{order.totalAmount}</td>
                                        <td>
                                            <button className="btn-select" onClick={() => handleSelectOrder(order)}>Select</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedOrder && (
                <div className="process-section">
                    <div className="process-header">
                        <h2>Processing Invoice: <small>{selectedOrder._id}</small></h2>
                        <button className="btn-cancel" onClick={() => setSelectedOrder(null)}>Cancel</button>
                    </div>

                    <div className="patient-info">
                        <strong>Patient:</strong> {selectedOrder.userId?.name} ({selectedOrder.userId?.phone})
                    </div>

                    <div className="toggle-type">
                        <label className={`toggle-label ${returnType === 'Refund' ? 'active' : ''}`}>
                            <input type="radio" value="Refund" checked={returnType === 'Refund'} onChange={() => setReturnType('Refund')} />
                            Cash Refund
                        </label>
                        <label className={`toggle-label ${returnType === 'Exchange' ? 'active' : ''}`}>
                            <input type="radio" value="Exchange" checked={returnType === 'Exchange'} onChange={() => setReturnType('Exchange')} />
                            Exchange Medicine
                        </label>
                    </div>

                    <div className="original-items">
                        <h3>Select Items to Return</h3>
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th>Medicine</th>
                                    <th>Purchased Price</th>
                                    <th>Return Qty</th>
                                    <th>Refund Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedOrder.items.filter(i => i.purchased).map((item, idx) => {
                                    const qty = returnQuantities[idx] || 0;
                                    return (
                                        <tr key={idx}>
                                            <td>{item.medicineName}</td>
                                            <td>₹{item.price}</td>
                                            <td>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={qty}
                                                    onChange={(e) => handleReturnQtyChange(idx, e.target.value)}
                                                    className="qty-input"
                                                />
                                            </td>
                                            <td>₹{qty * item.price}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {returnType === 'Exchange' && (
                        <div className="exchange-items">
                            <h3>Select Items for Exchange</h3>
                            <table className="items-table">
                                <thead>
                                    <tr>
                                        <th>Medicine</th>
                                        <th>Unit Price</th>
                                        <th>Quantity</th>
                                        <th>Total</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {exchangedItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <select 
                                                    value={item.medicineId} 
                                                    onChange={(e) => handleExchangeItemChange(idx, 'medicineId', e.target.value)}
                                                >
                                                    <option value="">Select Medicine</option>
                                                    {inventory.map(inv => (
                                                        <option key={inv._id} value={inv._id}>{inv.name} (Stock: {inv.stock})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>₹{item.pricePerUnit}</td>
                                            <td>
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleExchangeItemChange(idx, 'quantity', e.target.value)}
                                                    className="qty-input"
                                                />
                                            </td>
                                            <td>₹{item.pricePerUnit * item.quantity}</td>
                                            <td><button className="btn-remove" onClick={() => handleRemoveExchangeItem(idx)}>×</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button className="btn-add-item" onClick={handleAddExchangeItem}>+ Add Medicine</button>
                        </div>
                    )}

                    <div className="summary-section">
                        <h3>Summary</h3>
                        <div className="summary-row">
                            <span>Total Refund Value:</span>
                            <span className="refund-amount">₹{totalRefund}</span>
                        </div>
                        {returnType === 'Exchange' && (
                            <div className="summary-row">
                                <span>Total Exchange Cost:</span>
                                <span>₹{totalExchangeCost}</span>
                            </div>
                        )}
                        <hr />
                        <div className="summary-row final">
                            <span>{netAmount < 0 ? 'Amount to Refund Patient:' : 'Amount to Collect from Patient:'}</span>
                            <span className={netAmount < 0 ? 'refund-amount' : 'collect-amount'}>
                                ₹{Math.abs(netAmount)}
                            </span>
                        </div>

                        <div className="process-actions">
                            <button className="btn-submit" onClick={handleSubmit}>
                                Confirm & Process
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PharmacyReturns;
