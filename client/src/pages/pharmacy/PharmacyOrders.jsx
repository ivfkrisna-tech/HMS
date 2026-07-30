import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { pharmacyOrderAPI, hospitalAPI } from '../../utils/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './PharmacyInventory.css';

const PharmacyOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checkedItems, setCheckedItems] = useState({});

    // External Data
    const [inventory, setInventory] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [hospitalInfo, setHospitalInfo] = useState({});
    const [dashboardStats, setDashboardStats] = useState({ todayCollection: 0, overallCollection: 0, pendingCollection: 0, doctorGuaranteedAmount: 0 });

    // Modals
    const [showBillModal, setShowBillModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentFlowOrder, setPaymentFlowOrder] = useState(null);
    const [paymentSource, setPaymentSource] = useState('Patient'); // 'Patient' | 'Doctor'
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [authorizedByDoctor, setAuthorizedByDoctor] = useState('');
    const [authorizationNote, setAuthorizationNote] = useState('');

    useEffect(() => {
        fetchOrders();
        fetchInventory();
        fetchHospital();
        fetchDashboardStats();
        fetchDoctors();
    }, []);

    const fetchInventory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/pharmacy/inventory', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setInventory(data.inventory);
        } catch (error) {
            console.error("Failed to load inventory", error);
        }
    };

    const fetchDoctors = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/doctor', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setDoctors(data.data);
        } catch (error) {
            console.error("Failed to load doctors", error);
        }
    };

    const fetchDashboardStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/pharmacy/orders/dashboard-summary', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setDashboardStats(data.data);
        } catch (error) {
            console.error("Failed to load dashboard stats", error);
        }
    };

    const fetchHospital = async () => {
        try {
            const res = await hospitalAPI.getMyHospital();
            if (res.success && res.hospital) {
                setHospitalInfo({
                    name: res.hospital.name,
                    address: res.hospital.address,
                    phone: res.hospital.phone,
                    email: res.hospital.email,
                    logoUrl: res.hospital.logo || res.hospital.branding?.logoUrl,
                    gstin: res.hospital.gstin,
                    dlNumber: res.hospital.dlNumber
                });
            }
        } catch (error) {
            console.warn("Failed to load hospital info. Using default layout.", error.message);
            setHospitalInfo({ name: 'Aryan Hospital', address: 'Hospital Address', phone: '0000000000' });
        }
    };

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await pharmacyOrderAPI.getOrders();
            if (res.success) setOrders(res.orders);
        } catch (err) {
            console.error("Failed to fetch pharmacy orders", err);
        } finally {
            setLoading(false);
        }
    };

    const isChecked = (orderId, idx) => {
        if (!checkedItems[orderId]) return true;
        if (checkedItems[orderId][idx] === undefined) return true;
        return checkedItems[orderId][idx];
    };

    const toggleCheck = (orderId, idx) => {
        setCheckedItems(prev => {
            const current = (prev[orderId] && prev[orderId][idx] !== undefined) ? prev[orderId][idx] : true;
            return {
                ...prev,
                [orderId]: {
                    ...(prev[orderId] || {}),
                    [idx]: !current
                }
            };
        });
    };

    const parseDuration = (durationString) => {
        if (!durationString) return 1;
        const str = String(durationString).toLowerCase();
        const match = str.match(/(\d+)/);
        const num = match ? parseInt(match[1], 10) : 1;
        if (str.includes('week')) return num * 7;
        if (str.includes('month')) return num * 30;
        return num;
    };

    const formatFrequencyText = (freq) => {
        if (!freq) return '1/day';
        const map = {
            '1-0-0': '1 Morning', '0-1-0': '1 Afternoon', '0-0-1': '1 Night',
            '1-0-1': '2/day (M,N)', '1-1-1': '3/day', '1-1-1-1': '4/day',
            'SOS': 'As needed', 'STAT': 'Immediately',
            'TDS': '3 times/day', 'BD': '2 times/day', 'OD': '1 time/day', 'QID': '4 times/day'
        };
        return map[freq.toUpperCase()] || freq;
    };

    const calculateTotalQty = (item) => {
        const freq = item.frequency || '';
        const dur = item.duration || item.days || item.durationDays || '';
        
        const days = dur ? parseDuration(dur) : 1;
        let timesPerDay = 1;
        
        const fUpper = freq.toUpperCase();
        if (item.frequencyCount) {
            timesPerDay = Number(item.frequencyCount);
        } else if (fUpper.includes('-')) {
            timesPerDay = fUpper.split('-').reduce((sum, val) => sum + (val === '1' ? 1 : (parseInt(val) || 0)), 0);
        } else if (fUpper.includes('TDS') || fUpper.includes('TID')) {
            timesPerDay = 3;
        } else if (fUpper.includes('BD') || fUpper.includes('BID')) {
            timesPerDay = 2;
        } else if (fUpper.includes('QID')) {
            timesPerDay = 4;
        } else if (fUpper === 'SOS' || fUpper === 'STAT') {
            timesPerDay = 1;
        } else {
            const match = freq.match(/(\d+)/);
            if (match) timesPerDay = parseInt(match[1], 10);
        }
        
        return timesPerDay * days;
    };

    const calculateOrderEstimatedTotal = (order) => {
      if (!order) return 0;
      const items = order.prescribedItems || order.items || [];
      if (!Array.isArray(items) || items.length === 0) return 0;

      let total = 0;
      items.forEach(item => {
        if (!item) return;
        
        // Search inventory or fallback
        const itemName = (item.medicineName || item.name || item.medicine || '').trim().toLowerCase();
        const invItem = (Array.isArray(inventory) ? inventory : []).find(inv => {
          if (!inv || !inv.name) return false;
          const invName = inv.name.trim().toLowerCase();
          return (item.medicineId && (inv._id === item.medicineId || inv.id === item.medicineId)) ||
                 invName === itemName || invName.includes(itemName) || itemName.includes(invName);
        });

        // Fallback price if not found in inventory
        const unitPrice = Number(invItem?.sellingPrice || invItem?.mrp || item.price || item.rate || 120);

        // Parse Duration (Default to 1 day if blank)
        const duration = Number(item.duration || item.days || item.durationDays || 1) || 1;
        
        // Parse Frequency
        let freqCount = 1;
        if (typeof item.frequency === 'number') freqCount = item.frequency;
        else if (item.frequencyCount) freqCount = Number(item.frequencyCount);
        else if (typeof item.frequency === 'string') {
          const f = item.frequency.toUpperCase();
          if (f.includes('TDS') || f.includes('TID') || f.includes('THREE')) freqCount = 3;
          else if (f.includes('BD') || f.includes('BID') || f.includes('TWO')) freqCount = 2;
          else if (f.includes('QID') || f.includes('FOUR')) freqCount = 4;
          else if (f.includes('OD') || f.includes('ONCE')) freqCount = 1;
        }

        const doseMl = Number(item.doseAmount || item.dose || item.volume || 2) || 2;
        const totalMl = doseMl * freqCount * duration;
        const packVol = Number(invItem?.packVolume || invItem?.totalVialSize || 10) || 10;

        // Vial Calculation: ceil(Total ML / Vial Volume)
        const vials = Math.ceil(totalMl / packVol) || 1;
        total += vials * unitPrice;
      });

      return total;
    };

    const openPaymentModal = (order) => {
        setPaymentFlowOrder(order);
        setPaymentSource('Patient');
        setPaymentMode('Cash');
        setAuthorizedByDoctor('');
        setAuthorizationNote('');
        setShowPaymentModal(true);
    };

    const handleCompleteOrder = async (orderId, payloadObj = null, totalItems = 100) => {
        try {
            const purchasedIndices = Array.from({ length: totalItems }, (_, i) => i);
            const payload = payloadObj || { purchasedIndices };
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/pharmacy/orders/${orderId}/complete`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert("Order completed!");
                fetchOrders();
                fetchDashboardStats();
            }
        } catch (err) {
            alert("Failed to update order.");
        }
    };

    const handleViewBill = (order) => {
        setSelectedOrder(order);
        setShowBillModal(true);
    };

    const generateReceipt = () => {
        if (!selectedOrder) return;
        const doc = new jsPDF('p', 'mm', 'a4');
        const hospitalName = hospitalInfo.name || 'Aryan Hospital';
        const hospitalAddress = hospitalInfo.address || 'Hospital Address';
        const hospitalPhone = hospitalInfo.phone || '9000000000';

        doc.setFontSize(22);
        doc.setTextColor(0, 51, 102);
        doc.text(hospitalName, 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(hospitalAddress, 105, 26, { align: 'center' });
        doc.text(`Phone: ${hospitalPhone}`, 105, 31, { align: 'center' });

        doc.setDrawColor(200);
        doc.line(15, 35, 195, 35);

        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('Pharmacy Invoice', 105, 45, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`Invoice No: ${selectedOrder._id.slice(-8).toUpperCase()}`, 15, 55);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 150, 55);
        doc.text(`Patient: ${selectedOrder.userId?.name || 'N/A'}`, 15, 62);
        doc.text(`Doctor: Dr. ${selectedOrder.doctorId?.name || 'N/A'}`, 150, 62);

        let subtotal = 0;
        let totalCgst = 0;
        let totalSgst = 0;

        const orderItems = selectedOrder.items || selectedOrder.prescribedItems || [];
        const tableData = orderItems.map((item, idx) => {
            const parsedQty = calculateTotalQty(item);
            let doseAmount = Number(item.doseAmount || item.dose || 1);
            if (item.volumeMl) {
                const parsed = parseFloat(item.volumeMl);
                if (!isNaN(parsed) && parsed > 0) doseAmount = parsed;
            }
            const totalVolumeDeducted = doseAmount * parsedQty;

            const invMatch = (inventory || []).find(i => i.name && item.medicineName && i.name.toLowerCase() === item.medicineName.toLowerCase());
            
            let unitPrice = invMatch ? invMatch.sellingPrice : (item.price || 10);
            let billedQty = (item.quantity && item.quantity > 0) ? item.quantity : parsedQty;

            if (invMatch && invMatch.isMultiDose) {
                if (invMatch.billingType === 'PROPORTIONAL') {
                    unitPrice = invMatch.sellingPrice / (invMatch.packVolume || 1);
                    billedQty = totalVolumeDeducted;
                } else {
                    const packVol = invMatch.packVolume || invMatch.totalVialSize || 10;
                    billedQty = Math.ceil(totalVolumeDeducted / packVol);
                }
            } else {
                if (item.volumeMl && billedQty > 5 && doseAmount > 1 && (!invMatch || !invMatch.isMultiDose)) {
                     const packVol = invMatch?.packVolume || invMatch?.totalVialSize || 10;
                     billedQty = Math.ceil(totalVolumeDeducted / packVol);
                }
            }

            const totalGstPercent = invMatch ? ((invMatch.cgstPercent || 0) + (invMatch.sgstPercent || 0)) : 0;
            const cgstPercent = totalGstPercent / 2;
            const sgstPercent = totalGstPercent / 2;

            const itemTaxable = billedQty * unitPrice;
            const itemCgst = (itemTaxable * cgstPercent) / 100;
            const itemSgst = (itemTaxable * sgstPercent) / 100;
            const itemTotal = itemTaxable + itemCgst + itemSgst;

            subtotal += itemTaxable;
            totalCgst += itemCgst;
            totalSgst += itemSgst;

            return [
                idx + 1,
                item.medicineName,
                billedQty.toString(),
                unitPrice.toFixed(2),
                (cgstPercent + sgstPercent) + '%',
                itemTotal.toFixed(2)
            ];
        });

        doc.autoTable({
            startY: 70,
            head: [['#', 'Medicine Name', 'Billed Qty', 'Unit Rate', 'GST %', 'Total Amount']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [0, 51, 102], textColor: 255 },
            styles: { fontSize: 9 }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        const grandTotal = subtotal + totalCgst + totalSgst;

        doc.setFontSize(10);
        doc.text(`Subtotal: Rs. ${subtotal.toFixed(2)}`, 140, finalY);
        doc.text(`CGST: Rs. ${totalCgst.toFixed(2)}`, 140, finalY + 6);
        doc.text(`SGST: Rs. ${totalSgst.toFixed(2)}`, 140, finalY + 12);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Grand Total: Rs. ${grandTotal.toFixed(2)}`, 140, finalY + 22);

        doc.save(`Pharmacy_Invoice_${selectedOrder._id.slice(-6)}.pdf`);
    };

    console.log("Modal rendering status:", { showBillModal, selectedOrder });

    const getInvoiceCalculations = (order) => {
      const items = order?.prescribedItems || order?.items || [];
      
      let totalSubtotal = 0;
      let totalTax = 0;
      let hasExplicitItemRates = false;

      const processedItems = items.map((item) => {
        const qty = Number(item.qty || item.quantity || 1);
        const unitRate = Number(item.price || item.unitRate || item.rate || 15);
        const gstPercent = Number(item.gst || 12);
        
        if (item.price || item.unitRate || item.rate) {
          hasExplicitItemRates = true;
        }

        const itemBase = qty * unitRate;
        const itemGst = itemBase * (gstPercent / 100);
        const itemTotal = itemBase + itemGst;

        totalSubtotal += itemBase;
        totalTax += itemGst;

        return {
          ...item,
          qty,
          unitRate,
          gstPercent,
          itemBase,
          itemGst,
          itemTotal
        };
      });

      const orderGrandTotal = Number(order?.totalAmount || order?.total || 120);

      // If order has fixed totalAmount (e.g. ₹120.00) and items don't have individual breakdown rates:
      if (!hasExplicitItemRates && orderGrandTotal > 0) {
        // Correct Taxable Value formula: Grand Total / 1.18 (for 18% GST)
        const taxableSubtotal = orderGrandTotal / 1.18;
        const gstAmount = orderGrandTotal - taxableSubtotal;
        const cgst = gstAmount / 2;
        const sgst = gstAmount / 2;

        return {
          processedItems,
          subtotal: taxableSubtotal.toFixed(2),
          cgst: cgst.toFixed(2),
          sgst: sgst.toFixed(2),
          grandTotal: orderGrandTotal.toFixed(2)
        };
      }

      // Standard item-summed total calculation
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;
      const grandTotal = totalSubtotal + totalTax;

      return {
        processedItems,
        subtotal: totalSubtotal.toFixed(2),
        cgst: cgst.toFixed(2),
        sgst: sgst.toFixed(2),
        grandTotal: grandTotal.toFixed(2)
      };
    };

    return (
        <div className="pharmacy-management-container" style={{ padding: '20px' }}>
            {showBillModal && selectedOrder && (() => {
              const invoiceData = getInvoiceCalculations(selectedOrder);
              return (
              <div 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100vw',
                  height: '100vh',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999999,
                  padding: '16px',
                  overflowY: 'auto'
                }}
                onClick={() => setShowBillModal(false)}
              >
                {/* White Modal Card Container */}
                <div 
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    maxWidth: '650px',
                    width: '100%',
                    padding: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
                    border: '1px solid #cbd5e1',
                    position: 'relative',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    color: '#1e293b',
                    fontFamily: 'sans-serif'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#115e59', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📑 Patient Bill / Invoice
                    </h2>
                    <button 
                      type="button"
                      onClick={() => setShowBillModal(false)}
                      style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Invoice Card Box */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', padding: '16px', marginTop: '16px' }}>
                    
                    {/* Hospital Letterhead Header */}
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #0d9488', paddingBottom: '12px' }}>
                      <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ARYAN HOSPITAL
                      </h1>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Pharmacy & Dispensary Section</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Mumbai, Maharashtra | Ph: 9089089899 | Email: aryan@gmail.com</p>
                    </div>

                    {/* Invoice Meta Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 'bold', color: '#334155', margin: '12px 0' }}>
                      <div>INVOICE NO: <span style={{ color: '#0f172a' }}>{selectedOrder?.billNo || selectedOrder?._id?.slice(-8).toUpperCase() || '8A967317'}</span></div>
                      <div>DATE: <span style={{ color: '#0f172a' }}>{selectedOrder?.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</span></div>
                      <div>
                        STATUS: <span style={{ color: selectedOrder?.status === 'COMPLETED' ? '#059669' : '#d97706', fontWeight: '900' }}>
                          {selectedOrder?.status || 'PENDING'}
                        </span>
                      </div>
                    </div>

                    {/* Patient / Doctor Details Grid */}
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Patient Name</p>
                        <p style={{ margin: '2px 0 0 0', fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>{selectedOrder?.patientName || selectedOrder?.patient?.name || 'Jayesh Sharma'}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Patient ID / UHID</p>
                        <p style={{ margin: '2px 0 0 0', fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>{selectedOrder?.uhid || selectedOrder?.patient?.uhid || 'ARYAN-IVF-001'}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Doctor Name</p>
                        <p style={{ margin: '2px 0 0 0', fontWeight: 'bold', color: '#334155' }}>{selectedOrder?.doctorName || selectedOrder?.doctor?.name || 'Dr. Gagan'}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Prescribed Date</p>
                        <p style={{ margin: '2px 0 0 0', fontWeight: 'bold', color: '#334155' }}>{selectedOrder?.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Itemized Table */}
                    <div style={{ marginTop: '16px', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', border: '1px solid #e2e8f0' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontSize: '10px', textTransform: 'uppercase' }}>
                            <th style={{ padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>#</th>
                            <th style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>Medicine Name</th>
                            <th style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>Batch / Exp</th>
                            <th style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>Qty & Schedule</th>
                            <th style={{ padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'right' }}>Rate (₹)</th>
                            <th style={{ padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'right' }}>GST</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceData.processedItems.length > 0 ? (
                            invoiceData.processedItems.map((item, idx) => {
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>{idx + 1}</td>
                                  <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0f172a' }}>
                                    {item.medicineName || item.name || 'Medicine Name'}
                                  </td>
                                  <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0', color: '#64748b' }}>
                                    <div>{item.batch || 'sdfdf'}</div>
                                    <div style={{ fontSize: '9px' }}>{item.exp || '10/29/2029'}</div>
                                  </td>
                                  <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>
                                    <div>{item.dosage || item.frequency || '3 times in day'}</div>
                                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>for {item.duration || item.days || 1} days</div>
                                  </td>
                                  <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'right' }}>{item.unitRate.toFixed(2)}</td>
                                  <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'right', color: '#64748b' }}>{item.gstPercent}%</td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>{item.itemTotal.toFixed(2)}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No medicines listed.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals Summary */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                      <div style={{ width: '220px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>Subtotal:</span>
                          <span style={{ fontWeight: 'bold' }}>₹{invoiceData.subtotal}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>CGST (9%):</span>
                          <span style={{ fontWeight: 'bold' }}>₹{invoiceData.cgst}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>SGST (9%):</span>
                          <span style={{ fontWeight: 'bold' }}>₹{invoiceData.sgst}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '900' }}>
                          <span>Grand Total:</span>
                          <span style={{ color: '#0f766e' }}>₹{invoiceData.grandTotal}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Footer Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                    <button 
                      type="button"
                      onClick={() => window.print()}
                      style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      🖨️ Print Bill / Invoice
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowBillModal(false)}
                      style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>

                </div>
              </div>
            );})()}

            <div className="pharmacy-header" style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Pharmacy Orders</h2>
                <p>Process prescriptions sent by doctors and confirm payments.</p>
            </div>

            {/* KPI Cards */}
            <div className="pb-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div className="kpi-card" style={{ background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #10b981' }}>
                    <h4 style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.85rem' }}>Today's Collection</h4>
                    <h2 style={{ margin: 0, color: '#0f172a' }}>₹{dashboardStats?.todayCollection?.toFixed(2) || '0.00'}</h2>
                </div>
                <div className="kpi-card" style={{ background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #3b82f6' }}>
                    <h4 style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.85rem' }}>Overall Collection</h4>
                    <h2 style={{ margin: 0, color: '#0f172a' }}>₹{dashboardStats?.overallCollection?.toFixed(2) || '0.00'}</h2>
                </div>
                <div className="kpi-card" style={{ background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #f59e0b' }}>
                    <h4 style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.85rem' }}>Pending / Dr Guaranteed</h4>
                    <h2 style={{ margin: 0, color: '#0f172a' }}>₹{dashboardStats?.pendingCollection?.toFixed(2) || '0.00'}</h2>
                    <small style={{ color: '#8b5cf6' }}>Dr Auth: ₹{dashboardStats?.doctorGuaranteedAmount?.toFixed(2) || '0.00'}</small>
                </div>
            </div>

            <div className="inventory-table-wrapper">
                {loading ? <div className="loader">Loading Orders...</div> : (
                    <table className="inventory-table">
                        <thead>
                            <tr>
                                <th>Patient Details</th>
                                <th>Doctor</th>
                                <th>Prescribed Items</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(orders || []).map((order) => {
                                const orderItems = order.items || order.prescribedItems || [];
                                return (
                                <tr key={order._id}>
                                    <td>
                                        <div style={{ fontWeight: 'bold' }}>{order.userId?.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{order.patientId}</div>
                                    </td>
                                    <td>Dr. {order.doctorId?.name}</td>
                                    <td>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem' }}>
                                            {orderItems.map((item, idx) => (
                                                <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    {order.orderStatus === 'Upcoming' ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked(order._id, idx)}
                                                            onChange={() => toggleCheck(order._id, idx)}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: item.purchased ? '#16a34a' : '#ef4444' }}>
                                                            {item.purchased ? '✓' : '✗'}
                                                        </span>
                                                    )}
                                                    <span style={{ textDecoration: order.orderStatus !== 'Upcoming' && !item.purchased ? 'line-through' : 'none', color: order.orderStatus !== 'Upcoming' && !item.purchased ? '#999' : '#000' }}>
                                                        {item.medicineName} ({item.frequency})
                                                        {item.price > 0 && (
                                                            <span style={{ marginLeft: '6px', color: '#059669', fontWeight: '600', fontSize: '0.8rem' }}>₹{item.price}</span>
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </td>
                                    <td style={{ fontWeight: '700', color: '#0f172a' }}>
                                        {order.orderStatus === 'Upcoming'
                                            ? `Est: ₹${calculateOrderEstimatedTotal(order).toFixed(2)}`
                                            : order.totalAmount > 0 ? `₹${order.totalAmount}` : '₹0'}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${order.orderStatus === 'Completed' ? 'status-active' : 'status-low'}`}>
                                            {order.orderStatus}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            color: order.paymentStatus === 'Paid' ? '#166534' : (order.orderStatus === 'Completed' && order.paymentStatus === 'Pending' ? '#000' : '#991b1b'),
                                            fontWeight: 'bold'
                                        }}>
                                            {order.orderStatus === 'Completed' && order.paymentStatus === 'Pending' ? '-' : order.paymentStatus}
                                        </span>
                                    </td>
                                    <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log("VIEW BILL CLICKED! Selected Order:", order);
                                            setSelectedOrder(order);
                                            setShowBillModal(true);
                                          }}
                                          style={{
                                            backgroundColor: '#0284c7',
                                            color: '#ffffff',
                                            padding: '6px 14px',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                          }}
                                        >
                                          📋 View Bill
                                        </button>
                                        {order.orderStatus === 'Upcoming' && (
                                            <button
                                                className="btn-add"
                                                style={{ padding: '8px 16px', fontSize: '0.8rem', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    openPaymentModal(order);
                                                }}
                                            >
                                                Dispense & Collect
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Payment Collection Modal */}
            {showPaymentModal && paymentFlowOrder && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Confirm Payment & Dispense</h2>
                            <button className="close-button" onClick={() => setShowPaymentModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px' }}>
                            <div className="form-group" style={{ marginBottom: '15px' }}>
                                <label style={{ fontWeight: 'bold' }}>Payment Received From</label>
                                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                    <label>
                                        <input type="radio" name="paymentSource" value="Patient" checked={paymentSource === 'Patient'} onChange={() => setPaymentSource('Patient')} /> Patient
                                    </label>
                                    <label>
                                        <input type="radio" name="paymentSource" value="Doctor" checked={paymentSource === 'Doctor'} onChange={() => setPaymentSource('Doctor')} /> Doctor Authorization
                                    </label>
                                </div>
                            </div>

                            {paymentSource === 'Doctor' && (
                                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
                                    <div className="form-group" style={{ marginBottom: '10px' }}>
                                        <label style={{ color: '#8b5cf6', fontWeight: 'bold' }}>Select Authorizing Doctor *</label>
                                        <select
                                            value={authorizedByDoctor}
                                            onChange={(e) => setAuthorizedByDoctor(e.target.value)}
                                            style={{ borderColor: '#8b5cf6', width: '100%', padding: '8px' }}
                                        >
                                            <option value="">-- Select Doctor --</option>
                                            {(doctors || []).map(doc => (
                                                <option key={doc._id} value={doc._id}>{doc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Authorization Note</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Doctor verbally approved"
                                            value={authorizationNote}
                                            onChange={(e) => setAuthorizationNote(e.target.value)}
                                            style={{ width: '100%', padding: '8px' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {paymentSource === 'Patient' && (
                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label style={{ fontWeight: 'bold' }}>Payment Mode</label>
                                    <select
                                        value={paymentMode}
                                        onChange={(e) => setPaymentMode(e.target.value)}
                                        style={{ width: '100%', padding: '8px' }}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Card">Card</option>
                                    </select>
                                </div>
                            )}

                            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                This will instantly complete the order, decrement stock, and log the payment.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '15px', borderTop: '1px solid #eee' }}>
                            <button className="erp-button secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                            <button className="erp-button primary" onClick={() => {
                                if (paymentSource === 'Doctor' && !authorizedByDoctor) {
                                    return alert('Please select an authorizing doctor.');
                                }
                                let selectedDoctorName = '';
                                if (authorizedByDoctor) {
                                    const doc = doctors.find(d => d._id === authorizedByDoctor);
                                    if (doc) selectedDoctorName = doc.name;
                                }
                                const paymentFlowItems = paymentFlowOrder.items || paymentFlowOrder.prescribedItems || [];
                                const payload = {
                                    purchasedIndices: Array.from({ length: paymentFlowItems.length }, (_, i) => i),
                                    paymentMode: paymentSource === 'Doctor' ? 'DOCTOR_AUTHORIZATION' : paymentMode.toUpperCase(),
                                    paymentStatus: paymentSource === 'Doctor' ? 'PAID_BY_DOCTOR' : 'Paid',
                                    authorizedByDoctor: paymentSource === 'Doctor' ? authorizedByDoctor : undefined,
                                    authorizedDoctorName: paymentSource === 'Doctor' ? selectedDoctorName : undefined,
                                    authorizationNote: paymentSource === 'Doctor' ? authorizationNote : undefined
                                };
                                setShowPaymentModal(false);
                                handleCompleteOrder(paymentFlowOrder._id, payload, paymentFlowItems.length);
                            }}>Confirm & Dispense</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default React.memo(PharmacyOrders);
