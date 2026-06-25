import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { receptionAPI, publicAPI, hospitalAPI, uploadAPI, admissionAPI, patientAPI, sourceAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import { getSubdomain } from '../../utils/subdomain';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Webcam from 'react-webcam';
import './ReceptionDashboard.css';

const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30'
];

const ReceptionDashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const formatPatientName = (user) => {
        if (!user) return 'Walk-in';
        const getFirstName = (fullName) => {
            if (!fullName) return '';
            return fullName.trim().split(/\s+/)[0];
        };

        if (user.coupleId) {
            const currentIsMale = (user.gender && user.gender.toLowerCase() === 'male') || user.partnerRelation === 'Wife';
            
            let husbandName = '';
            let wifeName = '';
            
            if (currentIsMale) {
                husbandName = getFirstName(user.name);
                wifeName = user.partnerPatientId ? getFirstName(user.partnerPatientId.name) : '';
            } else {
                wifeName = getFirstName(user.name);
                husbandName = user.partnerPatientId ? getFirstName(user.partnerPatientId.name) : '';
            }
            
            if (husbandName && wifeName) {
                return `${husbandName} - ${wifeName}`;
            } else if (husbandName) {
                return husbandName;
            } else if (wifeName) {
                return wifeName;
            }
        }

        if (user.partnerPatientId && user.partnerPatientId.name) {
            return `${getFirstName(user.name)} - ${getFirstName(user.partnerPatientId.name)}`;
        }
        return user.name;
    };

    // VIEW STATE DRIVEN BY URL (The "Root Solution" for micro-paging/flickering)
    const viewMode = searchParams.get('mode') || 'dashboard';
    const patientIdParam = searchParams.get('patientId');
    const isEditOnly = searchParams.get('edit') === 'true';

    const [appointments, setAppointments] = useState([]);
    const [activeSources, setActiveSources] = useState([]);

    useEffect(() => {
        const fetchActiveSources = async () => {
            try {
                const res = await sourceAPI.getSources({ status: 'Active' });
                if (res.success) {
                    setActiveSources(res.data || []);
                }
            } catch (err) {
                console.error('Error loading dynamic sources:', err);
            }
        };
        fetchActiveSources();
    }, []);
    const [doctorsList, setDoctorsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [profilePatient, setProfilePatient] = useState(null);
    const [profileAppointments, setProfileAppointments] = useState([]);
    const [transactions, setTransactions] = useState([]);

    // Token mode — next token preview
    const [nextToken, setNextToken] = useState(null);

    // Payment confirm modal
    const [paymentModal, setPaymentModal] = useState({ open: false, appointment: null, method: 'Cash' });
    const [modalProof, setModalProof] = useState({ url: null, fileName: null, uploading: false });
    const [uploadingProof, setUploadingProof] = useState(false);

    const handlePaymentProofChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingProof(true);
        try {
            const formData = new FormData();
            formData.append('images', file);
            const res = await uploadAPI.uploadImages(formData);
            if (res.success && res.files && res.files.length > 0) {
                setIntakeForm(prev => ({
                    ...prev,
                    paymentProofUrl: res.files[0].url,
                    paymentProofFileName: file.name
                }));
            } else {
                alert("Upload failed.");
            }
        } catch (err) {
            console.error("Upload error", err);
            alert("Error uploading file.");
        } finally {
            setUploadingProof(false);
        }
    };

    const handleModalProofChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setModalProof(prev => ({ ...prev, uploading: true }));
        try {
            const formData = new FormData();
            formData.append('images', file);
            const res = await uploadAPI.uploadImages(formData);
            if (res.success && res.files && res.files.length > 0) {
                setModalProof({
                    url: res.files[0].url,
                    fileName: file.name,
                    uploading: false
                });
            } else {
                alert("Upload failed.");
                setModalProof(prev => ({ ...prev, uploading: false }));
            }
        } catch (err) {
            console.error("Upload error", err);
            alert("Error uploading file.");
            setModalProof(prev => ({ ...prev, uploading: false }));
        }
    };
    const [confirmingPayment, setConfirmingPayment] = useState(false);

    // Hospitalization modal
    const [hospitalizeModal, setHospitalizeModal] = useState({ open: false, appointment: null });
    const [hospitalizeForm, setHospitalizeForm] = useState({ ward: '', bedNumber: '', admissionDate: new Date().toISOString().split('T')[0], notes: '', facilityDays: {} });
    const [hospitalizingSaving, setHospitalizingSaving] = useState(false);

    // Availability
    const [availabilityCheck, setAvailabilityCheck] = useState({
        doctorId: '', date: new Date().toISOString().split('T')[0], bookedSlots: []
    });

    // SIMPLIFIED INTAKE STATE
    const [intakeForm, setIntakeForm] = useState({
        title: 'Mrs.', firstName: '', lastName: '',
        dob: '', age: '', gender: 'Female', mobile: '', email: '',
        address: '', aadhaar: '', isAadhaarVerified: false, avatar: '',
        houseNumber: '', street: '', city: '', state: '', pincode: '',
        sourceInformation: { sourceType: '', sourceName: '' },
        partnerTitle: 'Mr.', partnerFirstName: '', partnerLastName: '', partnerMobile: '', partnerRelation: 'Husband',
        height: '', weight: '', bmi: '', bloodGroup: '',
        consultationFee: '',
        department: 'IVF', doctor: '', visitDate: new Date().toISOString().split('T')[0], visitTime: '',
        referralType: '', reasonForVisit: '', paymentMethod: 'Cash',
        transactionId: '',
        paymentProofUrl: '',
        paymentProofFileName: ''
    });

    const [patientPhoto, setPatientPhoto] = useState(null);
    const [showWebcam, setShowWebcam] = useState(false);
    const webcamRef = React.useRef(null);
    const [verifyingAadhaar, setVerifyingAadhaar] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [aadhaarOtp, setAadhaarOtp] = useState('');
    const [hospitalContext, setHospitalContext] = useState(null);

    // ─── Linked Patient state ────────────────────────────────────────────────
    const [linkSearch, setLinkSearch] = useState('');
    const [linkSearchResults, setLinkSearchResults] = useState([]);
    const [linkedPatientSelection, setLinkedPatientSelection] = useState(null); // { _id, name, phone, patientId }
    const [linkRelation, setLinkRelation] = useState('Husband');
    const [profileLinkedPatients, setProfileLinkedPatients] = useState([]);
    const [profileLinkedRecords, setProfileLinkedRecords] = useState([]);
    const [linkedRecordsTab, setLinkedRecordsTab] = useState('appointments'); // 'appointments'|'labs'|'pharmacy'
    const [loadingLinkedRecords, setLoadingLinkedRecords] = useState(false);
    const linkSearchTimeout = React.useRef(null);
    const [followUpStatus, setFollowUpStatus] = useState(null);
    const [bookForPartnerAlso, setBookForPartnerAlso] = useState(true);
    const [linkedAppointment, setLinkedAppointment] = useState(null);

    // Initialize form when mode changes to intake or when patientId changes
    useEffect(() => {
        if (viewMode === 'intake') {
            if (patientIdParam && patientIdParam !== selectedPatientId) {
                const patient = appointments.find(a => (a.userId?._id || a.patientId) === patientIdParam)?.userId
                    || searchResults.find(p => p._id === patientIdParam);
                if (patient) {
                    handleEditPatient(patient, true);
                } else {
                    const fetchPatient = async () => {
                        try {
                            const res = await patientAPI.getFullHistory(patientIdParam);
                            if (res.success && res.user) {
                                handleEditPatient(res.user, true);
                            }
                        } catch (err) {
                            console.error("Error fetching patient for edit:", err);
                        }
                    };
                    fetchPatient();
                }
            } else if (!patientIdParam) {
                handleNewWalkIn(true);
            }
        }
    }, [viewMode, patientIdParam, appointments, searchResults]);

    useEffect(() => {
        if (viewMode === 'intake' && hospitalContext && !intakeForm.consultationFee) {
            setIntakeForm(prev => ({
                ...prev,
                consultationFee: hospitalContext.appointmentFee ?? '500'
            }));
        }
    }, [viewMode, hospitalContext]);

    // Load linked patients whenever a profile is viewed
    useEffect(() => {
        if (viewMode === 'profile' && profilePatient?._id) {
            fetchProfileLinkedPatients(profilePatient._id);
            fetchProfileLinkedRecords(profilePatient._id);
        }
    }, [viewMode, profilePatient?._id]);


    useEffect(() => {
        const fetchHospital = async () => {
            try {
                const sub = getSubdomain();
                const res = await hospitalAPI.resolveHospital(sub);
                if (res.success) setHospitalContext(res.hospital);
            } catch (err) { console.error('Error fetching hospital context:', err); }
        };
        fetchHospital();
        fetchAppointments();
        fetchDoctors();
    }, []);

    useEffect(() => {
        if (availabilityCheck.doctorId && availabilityCheck.date) {
            fetchBookedSlots(availabilityCheck.doctorId, availabilityCheck.date);
        }
    }, [availabilityCheck.doctorId, availabilityCheck.date]);

    useEffect(() => {
        if (intakeForm.doctor && intakeForm.visitDate) {
            if (intakeForm.doctor !== availabilityCheck.doctorId || intakeForm.visitDate !== availabilityCheck.date) {
                setAvailabilityCheck(prev => ({
                    ...prev, doctorId: intakeForm.doctor, date: intakeForm.visitDate
                }));
            }
        }
    }, [intakeForm.doctor, intakeForm.visitDate]);

    useEffect(() => {
        const isTokenMode = hospitalContext?.appointmentMode === 'token';
        if (!isTokenMode || !intakeForm.doctor || !intakeForm.visitDate || !hospitalContext?._id) {
            setNextToken(null);
            return;
        }
        hospitalAPI.getNextToken(hospitalContext._id, intakeForm.doctor, intakeForm.visitDate)
            .then(res => { if (res.success) setNextToken(res.nextToken); })
            .catch(() => setNextToken(null));
    }, [intakeForm.doctor, intakeForm.visitDate, hospitalContext]);

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const response = await receptionAPI.getAllAppointments();
            if (response.success) setAppointments(response.appointments);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const fetchTransactions = async () => {
        try {
            const res = await receptionAPI.getTransactions();
            if (res.success) setTransactions(res.transactions);
        } catch (err) { console.error(err); }
    };

    const fetchDoctors = async () => {
        try {
            const response = await publicAPI.getDoctors();
            if (response.success && Array.isArray(response.doctors)) setDoctorsList(response.doctors);
        } catch (err) { console.error(err); }
    };

    const fetchBookedSlots = async (doctorId, date) => {
        try {
            const hospitalId = hospitalContext?._id || '';
            const response = await receptionAPI.getBookedSlots(doctorId, date, hospitalId);
            if (response.success) setAvailabilityCheck(prev => ({ ...prev, bookedSlots: response.bookedSlots || [] }));
        } catch (err) { console.error(err); }
    };

    const capturePhoto = React.useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setPatientPhoto(imageSrc);
        setShowWebcam(false);
    }, [webcamRef]);

    const todayStr = new Date().toISOString().split('T')[0];

    const calculateAge = (dobString) => {
        if (!dobString) return '';
        const dobDate = new Date(dobString);
        if (isNaN(dobDate.getTime())) return '';
        const today = new Date();
        let age = today.getFullYear() - dobDate.getFullYear();
        const monthDiff = today.getMonth() - dobDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
            age--;
        }
        return age >= 0 ? `${age} Years` : '0 Years';
    };

    const isSlotInPast = (time) => {
        if (intakeForm.visitDate !== todayStr) return false;
        const now = new Date();
        const [h, m] = time.split(':').map(Number);
        const slotTime = new Date();
        slotTime.setHours(h, m, 0, 0);
        return slotTime <= now;
    };

    const handleSlotClick = (time) => {
        if (availabilityCheck.bookedSlots.includes(time)) return;
        setSearchParams({ mode: 'intake' });
        setIntakeForm(prev => ({
            ...prev, doctor: availabilityCheck.doctorId, visitDate: availabilityCheck.date, visitTime: time
        }));
    };

    const handleNewWalkIn = (skipNav = false) => {
        if (skipNav !== true) setSearchParams({ mode: 'intake' });
        setSelectedPatientId(null);
        setOtpSent(false);
        setAadhaarOtp('');
        setVerifyingAadhaar(false);
        setPatientPhoto(null);
        // Reset link state
        setLinkSearch('');
        setLinkSearchResults([]);
        setLinkedPatientSelection(null);
        setLinkedAppointment(null);
        setLinkRelation('Husband');
        setFollowUpStatus(null);
        setBookForPartnerAlso(true);
        setIntakeForm({
            title: 'Mrs.', firstName: '', lastName: '',
            dob: '', age: '', gender: 'Female', mobile: '', email: '',
            marriageDate: '',
            address: '', aadhaar: '', isAadhaarVerified: false, avatar: '',
            houseNumber: '', street: '', city: '', state: '', pincode: '',
            sourceInformation: { sourceType: '', sourceName: '' },
            partnerTitle: 'Mr.', partnerFirstName: '', partnerLastName: '', partnerMobile: '', partnerRelation: 'Husband',
            height: '', weight: '', bmi: '', bloodGroup: '',
            paymentStatus: 'Pending', consultationFee: hospitalContext?.appointmentFee ?? '500',
            department: 'IVF', doctor: '', visitDate: new Date().toISOString().split('T')[0], visitTime: '',
            referralType: '', reasonForVisit: '', paymentMethod: 'Cash', transactionId: '',
            paymentProofUrl: '', paymentProofFileName: ''
        });
    };

    const handleEditPatient = (patient, skipNav = false) => {
        if (!skipNav) setSearchParams({ mode: 'intake', patientId: patient._id });
        setSelectedPatientId(patient._id);
        setOtpSent(false);
        setAadhaarOtp('');
        setVerifyingAadhaar(false);
        setPatientPhoto(patient.avatar || null);
        // Reset link state for new edit session
        setLinkSearch('');
        setLinkSearchResults([]);
        setLinkedPatientSelection(null);
        setLinkRelation('Husband');
        setFollowUpStatus(null);
        setBookForPartnerAlso(true);
        setLinkedAppointment(null);

        // Fetch follow-up eligibility for existing patient
        (async () => {
            try {
                const fuRes = await receptionAPI.getFollowUpStatus(patient._id);
                if (fuRes.success) {
                    setFollowUpStatus(fuRes);
                    setIntakeForm(prev => {
                        const updated = {
                            ...prev,
                            doctor: fuRes.doctorId || prev.doctor || ''
                        };
                        if (fuRes.eligible) {
                            updated.consultationFee = 0;
                            updated.paymentMethod = 'Cash';
                            updated.paymentProofUrl = '';
                            updated.paymentProofFileName = '';
                            updated.transactionId = '';
                        } else {
                            updated.consultationFee = hospitalContext?.appointmentFee ?? '500';
                        }
                        return updated;
                    });
                }
            } catch (err) { console.error('Follow-up status error:', err); }
        })();

        const p = patient.fertilityProfile || {};
        const getVal = (val) => val || '';

        setIntakeForm(prev => ({
            ...prev,
            firstName: getVal(patient.name).split(' ')[0],
            lastName: getVal(patient.name).split(' ').slice(1).join(' '),
            mobile: getVal(patient.phone),
            email: getVal(patient.email),
            aadhaar: p.aadhaar || patient.aadhaarNumber || '',
            isAadhaarVerified: p.aadhaar || patient.isAadhaarVerified ? true : false,
            avatar: patient.avatar || '',
            houseNumber: patient.houseNumber || '',
            street: patient.street || '',
            city: patient.city || '',
            state: patient.state || '',
            pincode: patient.pincode || '',
            dob: p.dob || patient.dob || '',
            marriageDate: patient.marriageDate || p.marriageDate || '',
            gender: p.gender || patient.gender || 'Female',
            bloodGroup: p.bloodGroup || patient.bloodGroup || '',
            sourceInformation: patient.sourceInformation || { sourceType: '', sourceName: '' },
            ...p,
            age: calculateAge(p.dob || patient.dob || ''),
            consultationFee: hospitalContext?.appointmentFee ?? '500',
            department: 'IVF', doctor: '', visitDate: new Date().toISOString().split('T')[0], visitTime: '',
            transactionId: ''
        }));

        if (patient.partnerPatientId) {
            const partner = patient.partnerPatientId;
            setLinkedPatientSelection(partner);
            setLinkRelation(patient.partnerRelation || 'Husband');
            setLinkSearch(`${partner.name || ''} (${partner.patientId || partner.phone || ''})`);
            fetchLinkedAppointmentInfo(partner._id || partner);
        } else {
            setLinkedPatientSelection(null);
            setLinkedAppointment(null);
        }
    };

    // ─── Link search handler ─────────────────────────────────────────────────
    const handleLinkSearchChange = (e) => {
        const val = e.target.value;
        setLinkSearch(val);
        setLinkedPatientSelection(null);
        clearTimeout(linkSearchTimeout.current);
        if (val.length < 2) { setLinkSearchResults([]); return; }
        linkSearchTimeout.current = setTimeout(async () => {
            try {
                const res = await receptionAPI.searchPatients(val);
                if (res.success) {
                    // Exclude the currently-being-registered patient from results
                    setLinkSearchResults((res.patients || []).filter(p => p._id !== selectedPatientId));
                }
            } catch (err) { console.error(err); }
        }, 300);
    };



    const fetchLinkedAppointmentInfo = async (partnerId) => {
        try {
            const res = await patientAPI.getFullHistory(partnerId);
            if (res.success && res.timeline) {
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                const endOfToday = new Date();
                endOfToday.setHours(23, 59, 59, 999);
                
                const aptItem = res.timeline.find(t => 
                    t.type === 'appointment' && 
                    t.data?.status !== 'cancelled' &&
                    new Date(t.data?.appointmentDate) >= startOfToday &&
                    new Date(t.data?.appointmentDate) <= endOfToday
                );
                
                if (aptItem && aptItem.data) {
                    setLinkedAppointment(aptItem.data);
                    setIntakeForm(prev => ({
                        ...prev,
                        doctor: aptItem.data.doctorId?._id || aptItem.data.doctorId || '',
                        visitDate: new Date(aptItem.data.appointmentDate).toISOString().split('T')[0],
                        visitTime: aptItem.data.appointmentTime || '',
                        consultationFee: 0,
                        paymentMethod: 'Cash',
                        paymentStatus: 'Paid',
                        transactionId: '',
                        paymentProofUrl: '',
                        paymentProofFileName: '',
                    }));
                } else {
                    setLinkedAppointment(null);
                }

                if (res.user) {
                    const partnerMarriageDate = res.user.marriageDate || res.user.fertilityProfile?.marriageDate || '';
                    setIntakeForm(prev => ({
                        ...prev,
                        houseNumber: res.user.houseNumber || '',
                        street: res.user.street || '',
                        city: res.user.city || '',
                        state: res.user.state || '',
                        pincode: res.user.pincode || '',
                        address: res.user.address || '',
                        marriageDate: partnerMarriageDate ? partnerMarriageDate.split('T')[0] : prev.marriageDate || '',
                        sourceInformation: res.user.sourceInformation || { sourceType: '', sourceName: '' }
                    }));
                }
            }
        } catch (err) {
            console.error("Error fetching partner history:", err);
            setLinkedAppointment(null);
        }
    };

    const handleSelectLinkedPatient = (patient) => {
        setLinkedPatientSelection(patient);
        setLinkSearch(`${patient.name} (${patient.patientId || patient.phone})`);
        setLinkSearchResults([]);
        setBookForPartnerAlso(true);
        fetchLinkedAppointmentInfo(patient._id);
    };

    const handleClearLinkedPatient = () => {
        setLinkedPatientSelection(null);
        setLinkedAppointment(null);
        setLinkSearch('');
        setLinkSearchResults([]);
        setFollowUpStatus(null);
        setBookForPartnerAlso(true);
        setIntakeForm(prev => ({
            ...prev,
            houseNumber: '',
            street: '',
            city: '',
            state: '',
            pincode: '',
            address: '',
            sourceInformation: { sourceType: '', sourceName: '' },
            doctor: '',
            visitTime: '',
            paymentStatus: 'Pending',
            consultationFee: hospitalContext?.appointmentFee ?? '500',
            paymentMethod: 'Cash',
            transactionId: ''
        }));
    };

    // ─── Unlink from profile view ─────────────────────────────────────────────
    const handleUnlinkPatient = async (profileId, linkedId) => {
        if (!window.confirm('Remove the link between these patients?')) return;
        try {
            const res = await receptionAPI.unlinkPatients(profileId, linkedId);
            if (res.success) {
                setProfileLinkedPatients(prev => prev.filter(lp => String(lp.patientId?._id) !== String(linkedId)));
                // Also refresh merged records
                fetchProfileLinkedRecords(profileId);
                alert('✅ ' + res.message);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to unlink.');
        }
    };

    // ─── Fetch linked patients for profile view ───────────────────────────────
    const fetchProfileLinkedPatients = async (patientId) => {
        try {
            const res = await receptionAPI.getLinkedPatients(patientId);
            if (res.success) setProfileLinkedPatients(res.linkedPatients || []);
        } catch (err) { console.error(err); }
    };

    const fetchProfileLinkedRecords = async (patientId) => {
        setLoadingLinkedRecords(true);
        try {
            const res = await receptionAPI.getLinkedRecords(patientId);
            if (res.success) setProfileLinkedRecords(res.subjects || []);
        } catch (err) { console.error(err); } finally { setLoadingLinkedRecords(false); }
    };

    const handleViewProfile = (patient) => {
        navigate(`/patient/${patient._id}`);
    };

    const openHospitalizeModal = (apt) => {
        setHospitalizeForm({ ward: '', bedNumber: '', admissionDate: new Date().toISOString().split('T')[0], notes: '', facilityDays: {} });
        setHospitalizeModal({ open: true, appointment: apt });
    };

    const handleHospitalize = async () => {
        const { appointment } = hospitalizeModal;
        const facilities = hospitalContext?.facilities || [];
        const selectedFacilities = facilities
            .filter(f => hospitalizeForm.facilityDays[f.name] > 0)
            .map(f => ({
                facilityName: f.name,
                pricePerDay: f.pricePerDay,
                days: Number(hospitalizeForm.facilityDays[f.name]),
                totalAmount: f.pricePerDay * Number(hospitalizeForm.facilityDays[f.name]),
            }));

        setHospitalizingSaving(true);
        try {
            await admissionAPI.createAdmission({
                patientId: appointment.userId?._id || appointment.patientId,
                appointmentId: appointment._id,
                ward: hospitalizeForm.ward,
                bedNumber: hospitalizeForm.bedNumber,
                admissionDate: hospitalizeForm.admissionDate,
                notes: hospitalizeForm.notes,
                selectedFacilities,
            });
            alert(`Patient admitted successfully!`);
            setHospitalizeModal({ open: false, appointment: null });
            fetchAppointments();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to admit patient');
        } finally {
            setHospitalizingSaving(false);
        }
    };

    const handleCancelAppointment = async (appointmentId) => {
        if (!window.confirm('Cancel this appointment?')) return;
        try {
            const res = await receptionAPI.cancelAppointment(appointmentId);
            if (res.success) fetchAppointments();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to cancel appointment.');
        }
    };

    const generateReceiptPDF = (apt, paymentMethodOverride) => {
        const doc = new jsPDF();
        const hName = hospitalContext?.name || 'HOSPITAL';
        const hAddr = [hospitalContext?.address, hospitalContext?.city, hospitalContext?.state].filter(Boolean).join(', ');
        const hPhone = hospitalContext?.phone || '';
        const hEmail = hospitalContext?.email || '';
        const issuedBy = currentUser?.name || 'Reception Staff';
        let y = 18;

        doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
        doc.text(hName, 105, y, { align: 'center' }); y += 7;
        if (hAddr) {
            doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
            doc.text(hAddr, 105, y, { align: 'center' }); y += 5;
        }
        if (hPhone || hEmail) {
            const contact = [hPhone && `Ph: ${hPhone}`, hEmail && `Email: ${hEmail}`].filter(Boolean).join('  |  ');
            doc.setFontSize(9); doc.setTextColor(100);
            doc.text(contact, 105, y, { align: 'center' }); y += 5;
        }
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(41, 128, 185);
        doc.text('Consultation Receipt', 105, y, { align: 'center' }); y += 5;
        doc.setDrawColor(41, 128, 185); doc.setLineWidth(0.5);
        doc.line(14, y, 196, y); y += 8;
        doc.setTextColor(0); doc.setFont('helvetica', 'normal');

        const isToken = apt.tokenNumber != null;
        const dateDisplay = new Date(apt.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        autoTable(doc, {
            startY: y,
            body: [
                ['Patient Name', apt.userId?.name || 'Walk-in'],
                ['MRN / ID', apt.userId?.patientId || apt.patientId || 'N/A'],
                ['Phone', apt.userId?.phone || '-'],
                ['Doctor', `Dr. ${apt.doctorName || '-'}`],
                isToken
                    ? ['Date / Token', `${dateDisplay}  —  Token #${apt.tokenNumber}`]
                    : ['Date & Time', `${dateDisplay} @ ${apt.appointmentTime || '-'}`],
                ['Service', apt.serviceName || 'Consultation'],
                ['Consultation Fee', `Rs. ${Number(apt.amount || 0).toLocaleString('en-IN')}`],
                ['Payment Method', paymentMethodOverride || apt.paymentMethod || 'Cash'],
                ['Payment Status', 'PAID ✓'],
            ],
            theme: 'grid',
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 } },
            bodyStyles: { fontSize: 10 },
            alternateRowStyles: { fillColor: [245, 249, 255] },
        });

        y = doc.lastAutoTable.finalY + 10;
        doc.setDrawColor(200); doc.line(14, y, 196, y); y += 6;
        doc.setFontSize(8); doc.setTextColor(120);
        doc.text(`Issued by: ${issuedBy}`, 14, y);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 196, y, { align: 'right' });
        y += 5;
        doc.text(`Thank you for choosing ${hName}`, 105, y, { align: 'center' });
        const pid = apt.userId?.patientId || apt.patientId || 'Patient';
        doc.save(`Receipt_${pid}.pdf`);
    };

    const handleConfirmPayment = async () => {
        const needsProof = paymentModal.method !== 'Cash';
        if (needsProof && !modalProof.url) {
            const labelMap = {
                'UPI': 'Payment Screenshot',
                'Card': 'Payment Receipt',
                'NEFT/RTGS': 'Payment Proof'
            };
            const label = labelMap[paymentModal.method] || 'Payment Proof';
            alert(`Please upload the ${label} for ${paymentModal.method} payment.`);
            return;
        }

        setConfirmingPayment(true);
        const { appointment, method } = paymentModal;
        try {
            await receptionAPI.confirmPayment(appointment._id, method, appointment.amount, modalProof.url, modalProof.fileName);
            alert('Payment confirmed successfully. You can now download the receipt.');
            setPaymentModal({ open: false, appointment: null, method: 'Cash' });
            setModalProof({ url: null, fileName: null, uploading: false });
            fetchAppointments();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to confirm payment.');
        } finally {
            setConfirmingPayment(false);
        }
    };

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length > 2) {
            try {
                const res = await receptionAPI.searchPatients(query);
                if (res.success) setSearchResults(res.patients);
            } catch (err) { console.error(err); }
        } else {
            setSearchResults([]);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'mobile' || name === 'partnerMobile') {
            const numericValue = value.replace(/\D/g, '').slice(0, 10);
            setIntakeForm(prev => ({ ...prev, [name]: numericValue }));
            return;
        }

        if (name === 'source_sourceType') {
            setIntakeForm(prev => ({
                ...prev,
                sourceInformation: { sourceType: value, sourceName: '' }
            }));
            return;
        }

        if (name.startsWith('source_')) {
            const field = name.split('_')[1];
            setIntakeForm(prev => ({
                ...prev,
                sourceInformation: { ...prev.sourceInformation, [field]: value }
            }));
            return;
        }

        if (name === 'department' && hospitalContext) {
            const defaultFee = hospitalContext.departmentFees?.[value] ?? hospitalContext.appointmentFee ?? 500;
            setIntakeForm(prev => ({
                ...prev, [name]: value, consultationFee: defaultFee, doctor: '', visitTime: ''
            }));
            setAvailabilityCheck(prev => ({ ...prev, doctorId: '', bookedSlots: [] }));
            return;
        }

        if (name === 'visitDate') {
            if (value < todayStr) return;
            setIntakeForm(prev => ({ ...prev, visitDate: value, visitTime: '' }));
            return;
        }

        if (name === 'dob') {
            const calculatedAge = calculateAge(value);
            setIntakeForm(prev => ({
                ...prev,
                dob: value,
                age: calculatedAge
            }));
            return;
        }

        if (name === 'paymentMethod') {
            if (value === 'Free') {
                setIntakeForm(prev => ({
                    ...prev,
                    paymentMethod: value,
                    consultationFee: 0,
                    transactionId: '',
                    paymentProofUrl: '',
                    paymentProofFileName: ''
                }));
            } else {
                const defaultFee = hospitalContext?.appointmentFee ?? '500';
                setIntakeForm(prev => ({
                    ...prev,
                    paymentMethod: value,
                    consultationFee: defaultFee
                }));
            }
            return;
        }

        if (name === 'height' || name === 'weight') {
            const h = name === 'height' ? value : intakeForm.height;
            const w = name === 'weight' ? value : intakeForm.weight;
            if (h && w) {
                const hM = h / 100;
                const bmi = (w / (hM * hM)).toFixed(2);
                setIntakeForm(prev => ({ ...prev, [name]: value, bmi }));
                return;
            }
        }
        setIntakeForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSendOTP = async () => {
        if (!intakeForm.aadhaar || intakeForm.aadhaar.length !== 12) {
            alert("Please enter a valid 12-digit Aadhaar number.");
            return;
        }
        setVerifyingAadhaar(true);
        try {
            const res = await receptionAPI.sendAadhaarOTP(intakeForm.aadhaar);
            if (res.success) {
                setOtpSent(true);
                alert(res.message);
            }
        } catch (err) {
            alert(err.response?.data?.message || "Failed to send OTP");
            setOtpSent(false);
        } finally {
            setVerifyingAadhaar(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!aadhaarOtp) return alert("Please enter the OTP sent to mobile.");

        setVerifyingAadhaar(true);
        try {
            const res = await receptionAPI.verifyAadhaarOTP(intakeForm.aadhaar, aadhaarOtp);
            if (res.success && res.data) {
                const kyc = res.data;
                alert(`✅ Verification Successful: ${kyc.fullName}`);

                setIntakeForm(prev => {
                    const dobVal = kyc.dob || '';
                    const ageVal = calculateAge(dobVal);
                    return {
                        ...prev,
                        isAadhaarVerified: true,
                        firstName: kyc.fullName.split(' ')[0],
                        lastName: kyc.fullName.split(' ').slice(1).join(' '),
                        dob: dobVal,
                        age: ageVal,
                        gender: kyc.gender,
                        address: kyc.address
                    };
                });
                setOtpSent(false);
                setAadhaarOtp('');
            }
        } catch (err) {
            alert(err.response?.data?.message || "Invalid OTP");
        } finally {
            setVerifyingAadhaar(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);

        if (!intakeForm.firstName || !intakeForm.mobile) {
            alert("Name and Mobile are required.");
            setSaving(false); return;
        }

        if (!isEditOnly) {
            const isTokenMode = hospitalContext?.appointmentMode === 'token';
            const hasActiveAppointment = selectedPatientId && appointments.some(a =>
                (a.userId?._id ? String(a.userId._id) === String(selectedPatientId) : String(a.userId) === String(selectedPatientId)) &&
                a.status !== 'cancelled' &&
                a.status !== 'completed'
            );

            if (!hasActiveAppointment && !linkedAppointment) {
                if (!intakeForm.doctor) {
                    alert("Please select a Specialist (Doctor).");
                    setSaving(false); return;
                }
                if (!intakeForm.visitDate) {
                    alert("Please select an Appointment Date.");
                    setSaving(false); return;
                }
                if (!isTokenMode && !intakeForm.visitTime) {
                    alert("Please select a Time Slot.");
                    setSaving(false); return;
                }
            }

            const isFree = !!followUpStatus?.eligible || intakeForm.paymentMethod === 'Free' || !!linkedAppointment;
            if (!hasActiveAppointment && !isFree && !['Cash', 'Free'].includes(intakeForm.paymentMethod)) {
                if (!intakeForm.transactionId) {
                    alert(`Please enter a UPI ID / Transaction ID for ${intakeForm.paymentMethod} payment before booking.`);
                    setSaving(false); return;
                }
                if (!intakeForm.paymentProofUrl) {
                    const labelMap = {
                        'UPI': 'Payment Screenshot',
                        'Card': 'Payment Receipt',
                        'NEFT/RTGS': 'Payment Proof'
                    };
                    const label = labelMap[intakeForm.paymentMethod] || 'Payment Proof';
                    alert(`Please upload the ${label} for ${intakeForm.paymentMethod} payment before booking.`);
                    setSaving(false); return;
                }
            }
        }

        try {
            let userId = selectedPatientId;

            if (!userId) {
                const regPayload = {
                    name: `${intakeForm.firstName} ${intakeForm.lastName}`.trim(),
                    email: intakeForm.email,
                    phone: intakeForm.mobile,
                };

                // Attach linked patient info to registration payload if selected
                if (linkedPatientSelection) {
                    regPayload.linkedPatientId = linkedPatientSelection._id;
                    regPayload.relationLabel = linkRelation;
                }

                const regRes = await receptionAPI.registerPatient(regPayload);

                if (regRes.success && regRes.user) {
                    userId = regRes.user._id;
                } else {
                    throw new Error(regRes.message || "Registration failed.");
                }
            } else {
                // If editing existing patient, also apply symmetric link if selected
                if (linkedPatientSelection) {
                    await receptionAPI.linkPatients(userId, linkedPatientSelection._id, linkRelation);
                }
            }

            let finalAvatar = intakeForm.avatar;
            if (patientPhoto && patientPhoto.startsWith('data:image')) {
                try {
                    const parts = patientPhoto.split(';base64,');
                    const mime = parts[0].split(':')[1] || 'image/jpeg';
                    const binary = atob(parts[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const blob = new Blob([bytes], { type: mime });
                    const file = new File([blob], 'patient-photo.jpg', { type: mime });
                    const fd = new FormData();
                    fd.append('images', file);
                    const upRes = await uploadAPI.uploadImages(fd);
                    if (upRes.success && upRes.files?.length > 0) {
                        finalAvatar = upRes.files[0].url;
                    }
                } catch (e) {
                    console.error('Photo upload failed', e);
                }
            }

            const updatePayload = { ...intakeForm };
            if (finalAvatar) updatePayload.avatar = finalAvatar;
            if (linkedAppointment) {
                updatePayload.linkedAppointmentId = linkedAppointment._id;
            }

            await receptionAPI.updateIntake(userId, updatePayload);

            if (isEditOnly) {
                alert("Patient Profile Updated Successfully!");
                fetchAppointments();
                navigate(`/patient/${userId}`);
                setSaving(false);
                return;
            }

            const hasActiveAppointment = appointments.some(a =>
                (a.userId?._id ? String(a.userId._id) === String(userId) : String(a.userId) === String(userId)) &&
                a.status !== 'cancelled' &&
                a.status !== 'completed'
            );

            // strict enforcement of billing rules: only save/update without booking if not booking
            const isTokenMode = hospitalContext?.appointmentMode === 'token';

            let shouldBook = false;
            let bookingPayload = null;

            if (hasActiveAppointment) {
                alert(`✅ Patient Registered! Existing active appointment was preserved.`);
                fetchAppointments();
                setSearchParams({});
            } else {
                if (linkedAppointment) {
                    shouldBook = true;
                    bookingPayload = {
                        patientId: userId,
                        doctorId: linkedAppointment.doctorId?._id || linkedAppointment.doctorId,
                        date: linkedAppointment.appointmentDate,
                        time: linkedAppointment.appointmentTime || undefined,
                        notes: `Walk-in. Shared IVF slot with partner.`,
                        paymentMethod: 'Cash',
                        paymentStatus: 'Paid',
                        amount: 0,
                        bookForPartnerAlso: false
                    };
                } else if (intakeForm.doctor && intakeForm.visitDate && (intakeForm.visitTime || isTokenMode)) {
                    let textNote = '';
                    if (intakeForm.paymentMethod !== 'Cash' && intakeForm.transactionId) {
                        textNote = ` | Transaction ID: ${intakeForm.transactionId}`;
                    }

                    const isFree = !!followUpStatus?.eligible || intakeForm.paymentMethod === 'Free';
                    const finalAmount = isFree ? 0 : intakeForm.consultationFee;
                    const finalPaymentMethod = followUpStatus?.eligible ? 'Cash' : intakeForm.paymentMethod;
                    const finalNotes = `Walk-in. Vitals: ${intakeForm.height}cm/${intakeForm.weight}kg. Reason: ${intakeForm.reasonForVisit}${textNote}`;

                    shouldBook = true;
                    bookingPayload = {
                        patientId: userId,
                        doctorId: intakeForm.doctor,
                        date: intakeForm.visitDate,
                        time: isTokenMode ? undefined : intakeForm.visitTime,
                        notes: finalNotes,
                        paymentMethod: finalPaymentMethod,
                        paymentStatus: 'Paid',
                        amount: finalAmount,
                        transactionId: isFree ? undefined : intakeForm.transactionId,
                        paymentProofUrl: isFree ? null : (intakeForm.paymentProofUrl || null),
                        paymentProofFileName: isFree ? null : (intakeForm.paymentProofFileName || null),
                        bookForPartnerAlso: bookForPartnerAlso
                    };
                } else {
                    alert("Please select a Doctor and Time Slot to complete the registration.");
                }
            }

            if (shouldBook && bookingPayload) {
                const bookingRes = await receptionAPI.bookAppointment(bookingPayload);
                if (bookingRes.success) {
                    const tokenMsg = bookingRes.appointment?.tokenNumber
                        ? ` Token #${bookingRes.appointment.tokenNumber} assigned.` : '';
                    alert(`Patient Registered & Assigned to Doctor!${tokenMsg}\n\nYou can now download the receipt from the active queue.`);
                    fetchAppointments();
                    setSearchParams({});
                } else {
                    alert("Booking Failed: " + bookingRes.message);
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'An unexpected error occurred.';
            alert("❌ Error: " + msg);
        } finally {
            setSaving(false);
        }
    };

    const renderIntake = () => {
        const isInherited = linkedPatientSelection !== null;
        // Follow-Up mode: ONLY when editing an existing patient who has their own prior appointment, and NOT in edit-only mode
        const isFollowUpMode = !isEditOnly && !!selectedPatientId && !!followUpStatus && !!followUpStatus.hasOwnPriorAppointment;
        // Shared Appointment inheritance check for new registrations/first-time linked partners
        const isInheritingPartnerApt = linkedPatientSelection && linkedAppointment && !isFollowUpMode;

        return (
            <div className="intake-full-page">
                <div className="context-bar">
                    <h3>{selectedPatientId ? 'Edit Patient Details' : 'New Registration'}</h3>
                    <button className="btn-cancel" type="button" onClick={() => setSearchParams({})}>Close ✖</button>
                </div>
                <div className="intake-container">
                    <form onSubmit={handleSave}>
                        {/* Section 1: Patient Identity & KYC */}
                        <div className="form-section">
                            <h4>1. PATIENT IDENTITY & KYC</h4>
                            <div className="form-row">
                                <div className="field" style={{ flex: 1 }}>
                                    <label>Patient Photo</label>
                                    {showWebcam ? (
                                        <div style={{ position: 'relative', width: '200px', borderRadius: '8px', overflow: 'hidden' }}>
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                videoConstraints={{ facingMode: "user" }}
                                                style={{ width: '200px', height: '150px', objectFit: 'cover' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={capturePhoto}
                                                style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '15px', fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                            >
                                                📸 Capture
                                            </button>
                                        </div>
                                    ) : patientPhoto ? (
                                        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                                            <img src={patientPhoto} alt="Patient" style={{ width: '100px', height: '100px', borderRadius: '8px', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
                                            <button type="button" className="btn-edit" onClick={() => setShowWebcam(true)} style={{ padding: '6px 12px', fontSize: '12px' }}>Retake Photo</button>
                                        </div>
                                    ) : (
                                        <button type="button" className="btn-action" onClick={() => setShowWebcam(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content', background: '#f8fafc', color: '#475569', border: '1px dashed #cbd5e1' }}>
                                            📸 Open Camera
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Link to Existing Patient Lookup */}
                            <div style={{ margin: '14px 0', padding: '16px', background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', borderRadius: '10px', border: '2px dashed #6366f1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🔗</span>
                                    <span style={{ fontWeight: 700, color: '#4338ca', fontSize: '0.95rem' }}>Link to Existing Patient <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.82rem' }}>(Optional)</span></span>
                                </div>

                                {linkedPatientSelection ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#e0f2fe', borderRadius: '8px', padding: '10px 14px', border: '1.5px solid #38bdf8' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '1.4rem' }}>🔗</span>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.95rem' }}>
                                                    {linkedPatientSelection.name}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#0284c7' }}>
                                                    MRN: {linkedPatientSelection.patientId || 'N/A'} &nbsp;•&nbsp; 📱 {linkedPatientSelection.phone}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <select
                                                value={linkRelation}
                                                onChange={e => setLinkRelation(e.target.value)}
                                                style={{ padding: '6px 10px', border: '1.5px solid #38bdf8', borderRadius: '6px', fontSize: '0.85rem', background: 'white' }}
                                            >
                                                <option value="Husband">Husband</option>
                                                <option value="Wife">Wife</option>
                                                <option value="Father">Father</option>
                                                <option value="Mother">Mother</option>
                                                <option value="Son">Son</option>
                                                <option value="Daughter">Daughter</option>
                                                <option value="Brother">Brother</option>
                                                <option value="Sister">Sister</option>
                                                <option value="Sibling">Sibling</option>
                                                <option value="Child">Child</option>
                                                <option value="Parent">Parent</option>
                                                <option value="Related">Related</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handleClearLinkedPatient}
                                                style={{ padding: '6px 10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                                            >
                                                ✕ Remove
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            placeholder="🔍 Search by Name, Phone or MRN to link a patient..."
                                            value={linkSearch}
                                            onChange={handleLinkSearchChange}
                                            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #c7d2fe', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box', background: 'white' }}
                                        />
                                        {linkSearchResults.length > 0 && (
                                            <div style={{
                                                position: 'absolute', top: '42px', left: 0, right: 0, background: 'white',
                                                border: '1.5px solid #e0e7ff', boxShadow: '0 8px 24px rgba(99,102,241,0.12)',
                                                borderRadius: '8px', zIndex: 2000, maxHeight: '220px', overflowY: 'auto'
                                            }}>
                                                {linkSearchResults.map(p => (
                                                    <div
                                                        key={p._id}
                                                        onClick={() => handleSelectLinkedPatient(p)}
                                                        style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                                    >
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{p.name}</div>
                                                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>MRN: {p.patientId || 'N/A'} &nbsp;•&nbsp; 📱 {p.phone}</div>
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>Select →</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {linkSearch.length >= 2 && linkSearchResults.length === 0 && (
                                            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#94a3b8' }}>No matching patients found.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="form-row" style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px dashed #22c55e', margin: '14px 0' }}>
                                <div className="field">
                                    <label>Aadhaar Number</label>
                                    <input
                                        name="aadhaar"
                                        maxLength="12"
                                        placeholder="Enter 12-digit Aadhaar"
                                        value={intakeForm.aadhaar || ''}
                                        onChange={handleInputChange}
                                        style={{
                                            borderColor: intakeForm.aadhaar?.length === 12 ? 'green' : '#ccc',
                                            backgroundColor: intakeForm.aadhaar?.length === 12 ? '#e6fffa' : 'white',
                                            fontWeight: 'bold'
                                        }}
                                    />
                                    {intakeForm.aadhaar && intakeForm.aadhaar.length !== 12 && (
                                        <span style={{ color: '#d97706', fontSize: '11px', marginTop: '4px', display: 'block' }}>Enter 12 digits</span>
                                    )}
                                    {intakeForm.aadhaar?.length === 12 && (
                                        <span style={{ color: '#16a34a', fontSize: '11px', marginTop: '4px', display: 'block' }}>✅ Aadhaar recorded</span>
                                    )}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="field"><label>First Name</label><input name="firstName" value={intakeForm.firstName || ''} onChange={handleInputChange} /></div>
                                <div className="field"><label>Last Name</label><input name="lastName" value={intakeForm.lastName || ''} onChange={handleInputChange} /></div>
                                <div className="field">
                                    <label>
                                        Mobile
                                        {intakeForm.mobile && intakeForm.mobile.length !== 10 && (
                                            <span style={{ color: 'red', marginLeft: '5px', fontSize: '11px' }}>incorrect phone number</span>
                                        )}
                                    </label>
                                    <input name="mobile" value={intakeForm.mobile || ''} onChange={handleInputChange} maxLength="10" />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="field">
                                    <label>Date of Birth (DOB)</label>
                                    <input type="date" name="dob" value={intakeForm.dob || ''} onChange={handleInputChange} max={todayStr} />
                                </div>
                                <div className="field">
                                    <label>Age</label>
                                    <input name="age" value={intakeForm.age || ''} readOnly style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#475569', fontWeight: 'bold' }} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="field" style={{ flex: '0 0 calc(50% - 7px)', minWidth: '160px' }}>
                                    <label>Marriage Date</label>
                                    <input type="date" name="marriageDate" value={intakeForm.marriageDate || ''} onChange={handleInputChange} max={todayStr} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="field">
                                    <label>Guardian / Partner Name</label>
                                    <input name="partnerFirstName" value={intakeForm.partnerFirstName || ''} onChange={handleInputChange} placeholder="Name of accompanying person" />
                                </div>
                                <div className="field">
                                    <label>Relation to Patient</label>
                                    <select name="partnerRelation" value={intakeForm.partnerRelation || 'Husband'} onChange={handleInputChange}>
                                        <option value="Husband">Husband</option>
                                        <option value="Wife">Wife</option>
                                        <option value="Father">Father</option>
                                        <option value="Mother">Mother</option>
                                        <option value="Son">Son</option>
                                        <option value="Daughter">Daughter</option>
                                        <option value="Brother">Brother</option>
                                        <option value="Sister">Sister</option>
                                        <option value="Friend">Friend</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label>
                                        Mobile
                                        {intakeForm.partnerMobile && intakeForm.partnerMobile.length !== 10 && (
                                            <span style={{ color: 'red', marginLeft: '5px', fontSize: '11px' }}>incorrect phone number</span>
                                        )}
                                    </label>
                                    <input name="partnerMobile" value={intakeForm.partnerMobile || ''} onChange={handleInputChange} maxLength="10" />
                                </div>
                            </div>

                            {/* Section 2: Address Information */}
                            <h4 style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>2. ADDRESS INFORMATION</span>
                                {isInherited && <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '12px', padding: '2px 8px', fontWeight: 'bold' }}>Inherited from Linked Patient</span>}
                            </h4>
                            <div className="form-row">
                                <div className="field" style={{ flex: 2, minWidth: '240px' }}>
                                    <label>House No / Flat No / Building Name</label>
                                    <input
                                        name="houseNumber"
                                        placeholder={isInherited ? "Retrieved From Linked Patient" : "Enter House No, Flat No or Building Name"}
                                        value={intakeForm.houseNumber || ''}
                                        onChange={handleInputChange}
                                        disabled={isInherited}
                                        style={isInherited ? { backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                                <div className="field" style={{ flex: 1 }}>
                                    <label>Street / Area / Locality</label>
                                    <input
                                        name="street"
                                        placeholder={isInherited ? "Retrieved From Linked Patient" : "Enter Street, Area or Locality"}
                                        value={intakeForm.street || ''}
                                        onChange={handleInputChange}
                                        disabled={isInherited}
                                        style={isInherited ? { backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="field">
                                    <label>City</label>
                                    <input
                                        name="city"
                                        placeholder={isInherited ? "Retrieved From Linked Patient" : "Enter City"}
                                        value={intakeForm.city || ''}
                                        onChange={handleInputChange}
                                        disabled={isInherited}
                                        style={isInherited ? { backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                                <div className="field">
                                    <label>State</label>
                                    <input
                                        name="state"
                                        placeholder={isInherited ? "Retrieved From Linked Patient" : "Enter State"}
                                        value={intakeForm.state || ''}
                                        onChange={handleInputChange}
                                        disabled={isInherited}
                                        style={isInherited ? { backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                                <div className="field">
                                    <label>Pincode</label>
                                    <input
                                        name="pincode"
                                        placeholder={isInherited ? "Retrieved From Linked Patient" : "Enter Pincode"}
                                        value={intakeForm.pincode || ''}
                                        onChange={handleInputChange}
                                        disabled={isInherited}
                                        style={isInherited ? { backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                            </div>

                            {/* Section 3: Patient Source Information */}
                            <h4 style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>3. PATIENT SOURCE INFORMATION</span>
                                {isInherited && <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '12px', padding: '2px 8px', fontWeight: 'bold' }}>Inherited from Linked Patient</span>}
                            </h4>
                            <div className="form-row">
                                <div className="field">
                                    <label>Source Type *</label>
                                    <select
                                        name="source_sourceType"
                                        value={intakeForm.sourceInformation?.sourceType || ''}
                                        onChange={handleInputChange}
                                        disabled={isInherited}
                                        style={isInherited ? { backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed' } : {}}
                                    >
                                        <option value="">Select Source Type</option>
                                        <option value="B2B">B2B</option>
                                        <option value="B2C">B2C</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label>Source *</label>
                                    <select
                                        name="source_sourceName"
                                        value={intakeForm.sourceInformation?.sourceName || ''}
                                        onChange={handleInputChange}
                                        disabled={isInherited || !intakeForm.sourceInformation?.sourceType}
                                        style={(isInherited || !intakeForm.sourceInformation?.sourceType) ? { backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed' } : {}}
                                    >
                                        <option value="">Select Source</option>
                                        {activeSources
                                            .filter(src => src.sourceType === intakeForm.sourceInformation?.sourceType)
                                            .map(src => (
                                                <option key={src._id} value={src.sourceName}>{src.sourceName}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Vitals & Payment Details */}
                        {!isEditOnly && (
                            <div className="form-section">
                                <h4>4. VITALS & PAYMENT</h4>
                                {isInheritingPartnerApt ? (
                                    <>
                                        <div className="form-row">
                                            <div className="field"><label>Height (cm)</label><input name="height" value={intakeForm.height || ''} onChange={handleInputChange} /></div>
                                            <div className="field"><label>Weight (kg)</label><input name="weight" value={intakeForm.weight || ''} onChange={handleInputChange} /></div>
                                            <div className="field"><label>BMI</label><input name="bmi" value={intakeForm.bmi || ''} readOnly /></div>
                                        </div>
                                        <div style={{ marginTop: '12px', padding: '16px', background: 'linear-gradient(135deg, #f0fdf4, #e6fffa)', borderRadius: '8px', border: '1.5px solid #86efac', display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: '700', fontSize: '0.92rem' }}>
                                            <span>✅ Payment context inherited from partner's active appointment. Consultation fee is waived (₹0).</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="form-row">
                                            <div className="field"><label>Height (cm)</label><input name="height" value={intakeForm.height || ''} onChange={handleInputChange} /></div>
                                            <div className="field"><label>Weight (kg)</label><input name="weight" value={intakeForm.weight || ''} onChange={handleInputChange} /></div>
                                            <div className="field"><label>BMI</label><input name="bmi" value={intakeForm.bmi || ''} readOnly /></div>
                                            <div className="field">
                                                <label>Consultation Fee</label>
                                                <input
                                                    name="consultationFee"
                                                    value={
                                                        followUpStatus?.eligible 
                                                            ? '₹0 (Follow-Up)' 
                                                            : (intakeForm.paymentMethod === 'Free' ? '₹0 (Free Consultation)' : intakeForm.consultationFee)
                                                    }
                                                    readOnly
                                                    style={{
                                                        backgroundColor: '#f1f5f9',
                                                        color: (followUpStatus?.eligible || intakeForm.paymentMethod === 'Free') ? '#16a34a' : '#475569',
                                                        cursor: 'not-allowed',
                                                        fontWeight: (followUpStatus?.eligible || intakeForm.paymentMethod === 'Free') ? 700 : 400
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-row">
                                            <div className="field">
                                                <label>Payment Method</label>
                                                <select 
                                                    name="paymentMethod" 
                                                    value={
                                                        followUpStatus?.eligible ? 'Cash' : intakeForm.paymentMethod
                                                    } 
                                                    onChange={handleInputChange}
                                                    disabled={!!followUpStatus?.eligible}
                                                    style={followUpStatus?.eligible ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {}}
                                                >
                                                    <option value="Cash">Cash</option>
                                                    <option value="UPI">UPI</option>
                                                    <option value="Card">Card</option>
                                                    <option value="Cheque">Cheque</option>
                                                    <option value="NEFT/RTGS">NEFT / RTGS</option>
                                                    <option value="Free">Free</option>
                                                </select>
                                            </div>
                                            <div className="field">
                                                <label>Payment Status</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', height: '42px', boxSizing: 'border-box' }}>
                                                    <span style={{ fontSize: '18px' }}>✅</span>
                                                    <span style={{ fontWeight: 600, color: '#15803d', fontSize: '14px' }}>
                                                        {followUpStatus?.eligible 
                                                            ? 'Free Follow-Up — Paid' 
                                                            : (intakeForm.paymentMethod === 'Free' ? 'Consultation Fee Waived' : 'Payment Confirmed — Paid')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {!followUpStatus?.eligible && ['UPI', 'Card', 'Cheque', 'NEFT/RTGS'].includes(intakeForm.paymentMethod) && (
                                            <div className="form-row" style={{ marginTop: '12px' }}>
                                                <div className="field" style={{ flex: 1 }}>
                                                    <label>UPI ID / Transaction ID <span style={{ color: '#ef4444', fontSize: '12px' }}>*Required for {intakeForm.paymentMethod}</span></label>
                                                    <input
                                                        type="text"
                                                        name="transactionId"
                                                        placeholder="Enter UPI Reference / UTN / Txn ID"
                                                        value={intakeForm.transactionId}
                                                        onChange={handleInputChange}
                                                        style={{ padding: '10px', border: '1.5px solid #d1d5db', borderRadius: '8px', background: '#f5f3ff', width: '100%', boxSizing: 'border-box', fontWeight: '600' }}
                                                    />
                                                </div>

                                                <div className="field" style={{ flex: 1 }}>
                                                    <label style={{ fontWeight: '600' }}>
                                                        {intakeForm.paymentMethod === 'UPI' && 'Upload Payment Screenshot'}
                                                        {intakeForm.paymentMethod === 'Card' && 'Upload Payment Receipt'}
                                                        {['NEFT/RTGS', 'Cheque'].includes(intakeForm.paymentMethod) && 'Upload Payment Proof'}
                                                        <span style={{ color: '#ef4444', fontSize: '12px' }}> *Required</span>
                                                    </label>
                                                    <input
                                                        type="file"
                                                        accept=".jpg,.jpeg,.png,.pdf"
                                                        onChange={handlePaymentProofChange}
                                                        style={{
                                                            display: 'block',
                                                            marginTop: '6px',
                                                            padding: '8px 12px',
                                                            border: '1.5px solid #d1d5db',
                                                            borderRadius: '8px',
                                                            background: '#fff',
                                                            width: '100%',
                                                            boxSizing: 'border-box'
                                                        }}
                                                    />
                                                    {uploadingProof && <span style={{ fontSize: '13px', color: '#6366f1', marginTop: '4px', display: 'block' }}>Uploading proof...</span>}
                                                    {intakeForm.paymentProofUrl && (
                                                        <div style={{ fontSize: '13px', color: '#166534', fontWeight: '600', marginTop: '6px' }}>
                                                            Selected File: {intakeForm.paymentProofFileName || 'proof_file'}
                                                            <a href={intakeForm.paymentProofUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '10px', color: '#2563eb', textDecoration: 'underline' }}>[View Uploaded]</a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Section 4.5: Follow-Up Information Widget (Only in Follow-Up Mode) */}
                        {isFollowUpMode && (
                            <div className="form-section">
                                <h4>Follow-Up Status Information</h4>
                                <div style={{
                                    marginBottom: '16px',
                                    padding: '16px 20px',
                                    borderRadius: '12px',
                                    border: `2px solid ${followUpStatus.eligible ? '#22c55e' : '#ef4444'}`,
                                    background: followUpStatus.eligible
                                        ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                                        : 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                                }}>
                                    {(() => {
                                        const getDaysLeftText = (validTillStr) => {
                                            if (!validTillStr) return '';
                                            const dValid = new Date(validTillStr);
                                            dValid.setHours(0, 0, 0, 0);
                                            const dNow = new Date();
                                            dNow.setHours(0, 0, 0, 0);
                                            
                                            const msDiff = dValid.getTime() - dNow.getTime();
                                            const daysDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));
                                            
                                            if (daysDiff === 2) return "2 Days Left";
                                            if (daysDiff === 1) return "1 Day Left";
                                            if (daysDiff === 0) return "Expires Today";
                                            if (daysDiff < 0) return "Follow-Up Expired";
                                            return `${daysDiff} Days Left`;
                                        };
                                        const daysLeftText = getDaysLeftText(followUpStatus.followUpValidTill);

                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                <span style={{ fontSize: '1.4rem' }}>{followUpStatus.eligible ? '✅' : '⚠️'}</span>
                                                <span style={{
                                                    fontWeight: 800,
                                                    fontSize: '1rem',
                                                    color: followUpStatus.eligible ? '#166534' : '#991b1b'
                                                }}>
                                                    {followUpStatus.eligible ? 'Follow-Up Eligible' : 'Follow-Up Window Expired'}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    padding: '2px 10px',
                                                    borderRadius: '12px',
                                                    background: followUpStatus.eligible ? '#22c55e' : '#ef4444',
                                                    color: 'white',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {daysLeftText}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                                        {followUpStatus.lastConsultationDate && (
                                            <div style={{
                                                background: 'white',
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                border: `1px solid ${followUpStatus.eligible ? '#bbf7d0' : '#fecaca'}`
                                            }}>
                                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>Last Consultation</div>
                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>
                                                    {new Date(followUpStatus.lastConsultationDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                            </div>
                                        )}
                                        {followUpStatus.followUpValidTill && (
                                            <div style={{
                                                background: 'white',
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                border: `1px solid ${followUpStatus.eligible ? '#bbf7d0' : '#fecaca'}`
                                            }}>
                                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>
                                                    {followUpStatus.eligible ? 'Valid Until' : 'Expired On'}
                                                </div>
                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>
                                                    {new Date(followUpStatus.followUpValidTill).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                            </div>
                                        )}
                                        <div style={{
                                            background: 'white',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            border: `1px solid ${followUpStatus.eligible ? '#bbf7d0' : '#fecaca'}`
                                        }}>
                                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>Fee Required</div>
                                            <div style={{ fontWeight: 700, color: followUpStatus.eligible ? '#16a34a' : '#dc2626' }}>
                                                {followUpStatus.eligible ? 'No' : 'Yes'}
                                            </div>
                                        </div>
                                    </div>
                                    {followUpStatus.paidByPartner && followUpStatus.eligible && (
                                        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#15803d', fontStyle: 'italic' }}>
                                            🌸 Covered by partner's consultation within {followUpStatus.validityDays}-day window.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Section 5: Appointment Booking */}
                        {!isEditOnly && (
                            <div className="form-section" style={{ backgroundColor: '#e3f2fd' }}>
                                <h4>{isFollowUpMode ? "5. FOLLOW-UP APPOINTMENT BOOKING" : "5. APPOINTMENT BOOKING"}</h4>
                                {isInheritingPartnerApt ? (
                                    <div style={{ marginTop: '12px', padding: '16px', background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', borderRadius: '8px', border: '1.5px solid #bfdbfe' }}>
                                        <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: '8px', fontSize: '0.95rem' }}>Inherited IVF Appointment Context</div>
                                        <div className="form-row">
                                            <div className="field">
                                                <label>Specialist</label>
                                                <input type="text" value={doctorsList.find(d => d._id === intakeForm.doctor)?.name || 'Assigned Specialist'} readOnly style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', fontWeight: 'bold' }} />
                                            </div>
                                            <div className="field">
                                                <label>Date</label>
                                                <input type="text" value={intakeForm.visitDate} readOnly style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', fontWeight: 'bold' }} />
                                            </div>
                                            <div className="field">
                                                <label>Time Slot</label>
                                                <input type="text" value={intakeForm.visitTime} readOnly style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', fontWeight: 'bold' }} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="form-row">
                                            <div className="field">
                                                <label>Select Specialist</label>
                                                {isFollowUpMode && (followUpStatus?.doctorId || intakeForm.doctor) ? (
                                                    <input
                                                        type="text"
                                                        value={followUpStatus?.doctorName || (doctorsList.find(d => d._id === intakeForm.doctor)?.name) || 'Assigned Specialist'}
                                                        readOnly
                                                        style={{ backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed', fontWeight: 'bold' }}
                                                    />
                                                ) : (
                                                    <select
                                                        name="doctor"
                                                        value={intakeForm.doctor}
                                                        onChange={handleInputChange}
                                                    >
                                                        <option value="">-- Choose Specialist --</option>
                                                        {doctorsList.map(doc => (
                                                            <option key={doc._id} value={doc._id}>{doc.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                            <div className="field">
                                                <label>Date</label>
                                                <input type="date" name="visitDate" value={intakeForm.visitDate} min={todayStr} onChange={handleInputChange} disabled={!intakeForm.doctor} style={!intakeForm.doctor ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {}} />
                                            </div>
                                        </div>
                                        {isFollowUpMode && linkedPatientSelection && (
                                            <div style={{
                                                marginTop: '12px',
                                                padding: '12px 16px',
                                                background: '#eff6ff',
                                                borderRadius: '8px',
                                                border: '1.5px solid #bfdbfe',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    id="bookForPartnerAlso"
                                                    checked={bookForPartnerAlso}
                                                    onChange={(e) => setBookForPartnerAlso(e.target.checked)}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                />
                                                <label htmlFor="bookForPartnerAlso" style={{ fontWeight: 700, color: '#1e40af', cursor: 'pointer', margin: 0, userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    ☑ Book Follow-Up For Partner Also ({linkedPatientSelection.name})
                                                </label>
                                            </div>
                                        )}
                                        {intakeForm.doctor && (
                                            hospitalContext?.appointmentMode === 'token' ? (
                                                <div style={{ margin: '14px 0', padding: '18px 24px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: '12px', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '18px' }}>
                                                    <span style={{ fontSize: '2.5rem' }}>🎟️</span>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#78350f', marginBottom: '2px' }}>Token Queue Mode Active</div>
                                                        {nextToken !== null ? (
                                                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#92400e' }}>
                                                                Next Token: <span style={{ fontSize: '2rem', color: '#d97706' }}>#{nextToken}</span>
                                                            </div>
                                                        ) : (
                                                            <div style={{ color: '#92400e', fontSize: '0.9rem' }}>Select doctor and date to see next token</div>
                                                        )}
                                                        <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '4px', opacity: 0.8 }}>Tokens reset daily at midnight</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="slot-grid">
                                                    {timeSlots.map(time => {
                                                        const isBooked = availabilityCheck.bookedSlots.includes(time);
                                                        const isPast = isSlotInPast(time);
                                                        const isDisabled = isBooked || isPast;
                                                        return (
                                                            <button
                                                                key={time} type="button"
                                                                className={`slot-btn ${isBooked ? 'booked' : ''} ${isPast ? 'booked' : ''} ${intakeForm.visitTime === time ? 'selected' : ''}`}
                                                                onClick={() => !isDisabled && setIntakeForm({ ...intakeForm, visitTime: time })}
                                                                disabled={isDisabled}
                                                            >
                                                                {time}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        <div className="form-footer">
                            <button type="submit" className="btn-save" disabled={saving}>
                                {saving
                                    ? 'Saving...'
                                    : (() => {
                                        if (isEditOnly) return 'Update Profile';
                                        if (isInheritingPartnerApt) {
                                            return selectedPatientId ? 'Save & Share IVF Appointment' : 'Register & Share IVF Appointment';
                                        }
                                        if (isFollowUpMode && (linkedPatientSelection || followUpStatus?.paidByPartner)) {
                                            return 'Book Couple Follow-Up';
                                        }
                                        const isTokenMode = hospitalContext?.appointmentMode === 'token';
                                        const canBook = intakeForm.doctor && intakeForm.visitDate && (intakeForm.visitTime || isTokenMode);
                                        if (selectedPatientId) return canBook ? (isTokenMode ? 'Save & Issue Token' : 'Save & Book Appointment') : 'Save Patient Details';
                                        return canBook ? (isTokenMode ? 'Register & Issue Token' : 'Register & Book Appointment') : 'Save Patient Details';
                                    })()
                                }
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    if (viewMode === 'profile' && profilePatient) {
        const fp = profilePatient.fertilityProfile || {};
        return (
            <div className="reception-dashboard" style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div className="dashboard-header">
                    <button onClick={() => setSearchParams({})} style={{ padding: '8px 20px', background: '#f1f5f9', border: '2px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>← Back to Dashboard</button>
                    <button className="btn-save" onClick={() => handleEditPatient(profilePatient)} style={{ padding: '10px 24px', fontSize: '1rem' }}>📋 Book Appointment</button>
                </div>

                <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: '18px', padding: '28px', color: 'white', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '18px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: '800' }}>
                            {(profilePatient.name || 'P')[0].toUpperCase()}
                        </div>
                        <div>
                            <h2 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: '800' }}>{profilePatient.name}</h2>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(59,130,246,0.2)', color: '#93c5fd', fontSize: '0.8rem', fontWeight: '600' }}>MRN: {profilePatient.patientId || 'N/A'}</span>
                                <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(139,92,246,0.2)', color: '#c084fc', fontSize: '0.8rem', fontWeight: '600' }}>Couple ID: {formatCoupleId(profilePatient.coupleId || 'N/A')}</span>
                                {(profilePatient.marriageDate || fp.marriageDate) && (
                                    <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(236,72,153,0.2)', color: '#f472b6', fontSize: '0.8rem', fontWeight: '600' }}>
                                        Marriage Date: {new Date(profilePatient.marriageDate || fp.marriageDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                                <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', fontSize: '0.8rem', fontWeight: '600' }}>📱 {profilePatient.phone || '-'}</span>
                                {fp.bloodGroup && <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '0.8rem', fontWeight: '600' }}>🩸 {fp.bloodGroup}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#1e40af' }}>📋 Demographics & Vitals</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                        {[
                            ['Age', fp.age || '-'],
                            ['Gender', fp.gender || '-'],
                            ['Height', `${fp.height || '-'} cm`],
                            ['Weight', `${fp.weight || '-'} kg`],
                            ['BMI', fp.bmi || '-'],
                            ['Blood Group', fp.bloodGroup || '-'],
                            ['Email', profilePatient.email || '-'],
                            ['Address', fp.address || profilePatient.address || '-'],
                            ['Marriage Date', profilePatient.marriageDate ? new Date(profilePatient.marriageDate).toLocaleDateString('en-IN') : (fp.marriageDate ? new Date(fp.marriageDate).toLocaleDateString('en-IN') : '-')],
                        ].map(([label, val], i) => (
                            <div key={i} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>{label}</div>
                                <div style={{ fontSize: '0.92rem', fontWeight: '600', color: '#1e293b' }}>{val}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {(fp.partnerFirstName || fp.husbandAge) && (
                    <div style={{ background: '#f0fdf4', borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '1px solid #bbf7d0' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#166534' }}>👫 Spouse / Partner Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                            {[
                                ['Name', `${fp.partnerTitle || ''} ${fp.partnerFirstName || ''} ${fp.partnerLastName || ''}`.trim() || '-'],
                                ['Age', fp.partnerAge || fp.husbandAge || '-'],
                                ['Phone', fp.partnerMobile || '-'],
                                ['Blood Group', fp.partnerBloodGroup || '-'],
                            ].map(([label, val], i) => (
                                <div key={i} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '10px', padding: '12px' }}>
                                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#166534', fontWeight: '700', marginBottom: '4px' }}>{label}</div>
                                    <div style={{ fontSize: '0.92rem', fontWeight: '600', color: '#1e293b' }}>{val}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(fp.chiefComplaint || fp.medicalHistory) && (
                    <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#1e40af' }}>🏥 Clinical Summary</h3>
                        {fp.chiefComplaint && <div style={{ marginBottom: '12px' }}><strong>Chief Complaint:</strong> {fp.chiefComplaint}</div>}
                        {fp.medicalHistory && <div style={{ marginBottom: '12px' }}><strong>Medical History:</strong> {fp.medicalHistory}</div>}
                        {fp.surgicalHistory && <div style={{ marginBottom: '12px' }}><strong>Surgical History:</strong> {fp.surgicalHistory}</div>}
                        {fp.reasonForVisit && <div><strong>Reason for Visit:</strong> {fp.reasonForVisit}</div>}
                    </div>
                )}

                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#1e40af' }}>📅 Appointment History ({profileAppointments.length})</h3>
                    {profileAppointments.length === 0 ? (
                        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No appointment history found.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {profileAppointments.map(apt => (
                                <div key={apt._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{new Date(apt.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{apt.appointmentTime} • {apt.serviceName || 'Consultation'}</div>
                                    </div>
                                    <span style={{
                                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700', textTransform: 'capitalize',
                                        background: apt.status === 'confirmed' ? '#dcfce7' : apt.status === 'completed' ? '#dbeafe' : '#fef3c7',
                                        color: apt.status === 'confirmed' ? '#166534' : apt.status === 'completed' ? '#1e40af' : '#92400e'
                                    }}>{apt.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Linked Patients Panel ─────────────────────────────────── */}
                <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '2px solid #a5b4fc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🔗 Linked Patients
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, background: '#e0e7ff', color: '#4338ca', borderRadius: '12px', padding: '2px 10px' }}>
                                {profileLinkedPatients.length}
                            </span>
                        </h3>
                        <button
                            onClick={() => { setLinkedPatientSelection(null); handleEditPatient(profilePatient); }}
                            style={{ padding: '6px 14px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                        >
                            + Link Another Patient
                        </button>
                    </div>

                    {profileLinkedPatients.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.9rem' }}>
                            No linked patients yet. Use "+ Link Another Patient" to create a link.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {profileLinkedPatients.map((lp, i) => {
                                const lpData = lp.patientId;
                                if (!lpData) return null;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'white', borderRadius: '10px', padding: '12px 16px', border: '1.5px solid #c7d2fe' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>
                                                {(lpData.name || 'P')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{lpData.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>MRN: {lpData.patientId || 'N/A'} &nbsp;•&nbsp; 📱 {lpData.phone}</div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#e0e7ff', color: '#4338ca', borderRadius: '10px', padding: '2px 8px', display: 'inline-block', marginTop: '4px' }}>
                                                    {lp.relationLabel || 'Related'}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => navigate(`/patient/${lpData._id}`)}
                                                style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                                            >
                                                👁 View
                                            </button>
                                            <button
                                                onClick={() => handleEditPatient(lpData)}
                                                style={{ padding: '6px 12px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                                            >
                                                📋 Book
                                            </button>
                                            <button
                                                onClick={() => handleUnlinkPatient(profilePatient._id, String(lpData._id))}
                                                style={{ padding: '6px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                                            >
                                                🔓 Unlink
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ─── Merged Records (Linked Patients' History) ─────────────── */}
                {profileLinkedPatients.length > 0 && (
                    <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🗂️ Linked Patient Records
                            {loadingLinkedRecords && <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 400 }}>Loading...</span>}
                        </h3>

                        {/* Tab switcher */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            {[['appointments', '📅 Appointments'], ['labs', '🧪 Lab Reports'], ['pharmacy', '💊 Pharmacy']].map(([tab, label]) => (
                                <button
                                    key={tab}
                                    onClick={() => setLinkedRecordsTab(tab)}
                                    style={{
                                        padding: '6px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', border: 'none',
                                        background: linkedRecordsTab === tab ? '#1d4ed8' : '#f1f5f9',
                                        color: linkedRecordsTab === tab ? 'white' : '#475569',
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {profileLinkedRecords.length === 0 && !loadingLinkedRecords && (
                            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No records found.</p>
                        )}

                        {profileLinkedRecords.map((subj, si) => (
                            <div key={si} style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{subj.patient.name}</span>
                                    {subj.patient.relationLabel && (
                                        <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: '10px', padding: '1px 8px', fontWeight: 700, textTransform: 'capitalize' }}>
                                            {subj.patient.relationLabel}
                                        </span>
                                    )}
                                </div>

                                {linkedRecordsTab === 'appointments' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(subj.appointments || []).length === 0 ? (
                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '8px 0' }}>No appointments.</p>
                                        ) : (subj.appointments || []).map(apt => (
                                            <div key={apt._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{new Date(apt.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Dr. {apt.doctorName || '-'} • {apt.serviceName || 'Consultation'}</div>
                                                </div>
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize',
                                                    background: apt.status === 'confirmed' ? '#dcfce7' : apt.status === 'completed' ? '#dbeafe' : '#fef3c7',
                                                    color: apt.status === 'confirmed' ? '#166534' : apt.status === 'completed' ? '#1e40af' : '#92400e'
                                                }}>{apt.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {linkedRecordsTab === 'labs' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(subj.labs || []).length === 0 ? (
                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '8px 0' }}>No lab reports.</p>
                                        ) : (subj.labs || []).map(lr => (
                                            <div key={lr._id} style={{ padding: '10px 14px', background: '#fefce8', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{lr.testName || 'Lab Report'}</div>
                                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(lr.createdAt).toLocaleDateString('en-IN')} • {lr.status || 'Pending'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {linkedRecordsTab === 'pharmacy' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(subj.pharmacy || []).length === 0 ? (
                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '8px 0' }}>No pharmacy orders.</p>
                                        ) : (subj.pharmacy || []).map(po => (
                                            <div key={po._id} style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Pharmacy Order</div>
                                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(po.createdAt).toLocaleDateString('en-IN')} • {po.status || 'Pending'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const renderTransactions = () => {
        const totalCollected = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        return (
            <div className="intake-full-page" style={{ padding: '40px', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center' }}>
                <div className="reception-dashboard" style={{ maxWidth: '1000px', width: '100%', margin: '0', background: 'white', borderRadius: '12px', height: 'fit-content', maxHeight: '90vh', overflowY: 'auto' }}>
                    <div className="dashboard-header">
                        <button onClick={() => setSearchParams({})} style={{ padding: '8px 20px', background: '#f1f5f9', border: '2px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>← Back to Dashboard</button>
                        <h2>Transaction History</h2>
                    </div>

                    <div className="card" style={{ padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e0f2fe', border: '1px solid #bae6fd' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#0369a1' }}>Total Collected</h3>
                            <p style={{ margin: '5px 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#0284c7' }}>₹{totalCollected.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '20px' }}>
                        <table className="reception-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Patient</th>
                                    <th>Doctor</th>
                                    <th>Method</th>
                                    <th>Status</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr><td colSpan="6" style={{ textAlign: 'center', color: '#888' }}>No transactions found.</td></tr>
                                ) : (
                                    transactions.map(t => (
                                        <tr key={t._id}>
                                            <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                                            <td>{t.userId?.name || 'Walk-in'}</td>
                                            <td>{t.doctorName || '-'}</td>
                                            <td>
                                                {t.paymentMethod || 'Cash'}
                                                {t.paymentProofUrl && (
                                                    <span style={{ marginLeft: '6px' }}>
                                                        <a href={t.paymentProofUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600, textDecoration: 'underline' }}>[Proof]</a>
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold',
                                                    background: (t.paymentStatus || '').toLowerCase() === 'paid' ? '#dcfce7' : '#fef3c7',
                                                    color: (t.paymentStatus || '').toLowerCase() === 'paid' ? '#166534' : '#92400e'
                                                }}>
                                                    {t.paymentStatus || 'Pending'}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 'bold', color: '#16a34a' }}>₹{t.amount}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="reception-dashboard">
                <div className="dashboard-header">
                    <h1>Reception Desk</h1>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-cancel" onClick={() => { fetchTransactions(); setSearchParams({ mode: 'transactions' }); }} style={{ padding: '10px 20px', fontSize: '1rem', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }}>💰 Transactions</button>
                        <button className="btn-cancel" onClick={() => navigate('/billing/patient')} style={{ padding: '10px 20px', fontSize: '1rem', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }}>🧾 Patient Billing</button>
                        <button className="btn-save" onClick={handleNewWalkIn} style={{ padding: '10px 20px', fontSize: '1rem' }}>+ New Registration</button>
                    </div>
                </div>

                <div className="search-section card" style={{ padding: '20px', marginBottom: '20px', position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="🔍 Search Patient by Name, Mobile or MRN..."
                            value={searchQuery}
                            onChange={handleSearch}
                            style={{ flex: 1, padding: '12px', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ddd' }}
                        />
                    </div>
                    {searchResults.length > 0 && (
                        <div className="search-results-dropdown" style={{
                            position: 'absolute', top: '70px', left: '20px', right: '20px',
                            background: 'white', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 1000, maxHeight: '300px', overflowY: 'auto', borderRadius: '8px'
                        }}>
                            {searchResults.map(p => (
                                <div key={p._id} style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                                            {p.name} <span style={{ color: '#666', fontSize: '0.9rem' }}>({p.patientId || 'N/A'})</span>
                                        </div>
                                        {p.fertilityProfile?.partnerFirstName && (
                                            <div style={{ fontSize: '0.9rem', color: '#6366f1' }}>
                                                Guardian / Partner: {p.fertilityProfile.partnerFirstName} {p.fertilityProfile.partnerLastName || ''}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.9rem', color: '#888' }}>📱 {p.phone}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handleViewProfile(p)}
                                            style={{ padding: '6px 15px', fontSize: '0.9rem', background: '#f0f4ff', color: '#3b82f6', border: '2px solid #3b82f6', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                                        >
                                            👁 View Profile
                                        </button>
                                        <button
                                            onClick={() => handleEditPatient(p)}
                                            className="btn-save"
                                            style={{ padding: '6px 15px', fontSize: '0.9rem' }}
                                        >
                                            Select / Book
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="availability-widget card">
                    <h3>📅 Quick Check Availability</h3>
                    <div className="widget-controls">
                        <select className="avail-select" onChange={(e) => setAvailabilityCheck({ ...availabilityCheck, doctorId: e.target.value })}>
                            <option value="">Select Doctor</option>
                            {doctorsList.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                        <input type="date" value={availabilityCheck.date} onChange={(e) => setAvailabilityCheck({ ...availabilityCheck, date: e.target.value })} />
                    </div>
                    {availabilityCheck.doctorId && (
                        <div className="slot-grid">
                            {timeSlots.map(t => (
                                <button key={t} className={`slot-btn ${availabilityCheck.bookedSlots.includes(t) ? 'booked' : ''}`} onClick={() => handleSlotClick(t)}>{t}</button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="appointments-list">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>Active Queue</h3>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '3px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                            {appointments.length} patients
                        </span>
                        {hospitalContext?.appointmentMode === 'token' && (
                            <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '3px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                                🎟️ Token Queue Mode
                            </span>
                        )}
                    </div>
                    <div className="table-responsive">
                        <table className="reception-table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Assigned To</th>
                                    <th>{hospitalContext?.appointmentMode === 'token' ? 'Token #' : 'Time'}</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appointments.map(apt => (
                                    <tr key={apt._id} style={apt.isHospitalized ? { backgroundColor: '#fdf2f8' } : {}}>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{formatPatientName(apt.userId)}</div>
                                            <small style={{ color: '#64748b' }}>{apt.userId?.phone}</small>
                                        </td>
                                        <td>{apt.doctorName}</td>
                                        <td>
                                            {apt.tokenNumber != null
                                                ? <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#d97706' }}>#{apt.tokenNumber}</span>
                                                : apt.appointmentTime?.startsWith('token-')
                                                    ? <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#d97706' }}>#{apt.appointmentTime.replace('token-', '')}</span>
                                                    : apt.appointmentTime}
                                        </td>
                                        <td><span className={`status ${apt.status}`}>{apt.status}</span></td>
                                        <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {(apt.paymentStatus || '').toLowerCase() !== 'paid' && apt.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => setPaymentModal({ open: true, appointment: apt, method: apt.paymentMethod || 'Cash' })}
                                                    style={{ padding: '4px 10px', fontSize: '12px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
                                                >
                                                    💰 Confirm Payment
                                                </button>
                                            )}
                                            {(apt.paymentStatus || '').toLowerCase() === 'paid' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <button
                                                        onClick={() => generateReceiptPDF(apt)}
                                                        style={{ padding: '4px 10px', fontSize: '12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
                                                    >
                                                        🧾 Download Receipt
                                                    </button>
                                                    {apt.paymentProofUrl && (
                                                        <a
                                                            href={apt.paymentProofUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{ padding: '4px 10px', fontSize: '12px', background: '#f5f3ff', color: '#6d28d9', border: '1px solid #c084fc', borderRadius: '5px', textDecoration: 'none', fontWeight: '600' }}
                                                        >
                                                            👁 Proof
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                                                <>
                                                    <button
                                                        onClick={() => openHospitalizeModal(apt)}
                                                        style={{
                                                            padding: '4px 10px', fontSize: '12px',
                                                            background: apt.isHospitalized ? '#fecdd3' : '#dbeafe',
                                                            color: apt.isHospitalized ? '#be123c' : '#1d4ed8',
                                                            border: `1px solid ${apt.isHospitalized ? '#fb7185' : '#93c5fd'}`,
                                                            borderRadius: '5px', cursor: 'pointer', fontWeight: '600'
                                                        }}
                                                    >
                                                        {apt.isHospitalized ? '🏥 Hospitalized' : 'Hospitalize'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelAppointment(apt._id)}
                                                        style={{ padding: '4px 10px', fontSize: '12px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '5px', cursor: 'pointer', fontWeight: '600' }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {paymentModal.open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>💰 Confirm Payment</h2>
                                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                                    {paymentModal.appointment?.userId?.name} — Rs. {Number(paymentModal.appointment?.amount || 0).toLocaleString('en-IN')}
                                </p>
                            </div>
                            <button onClick={() => { setPaymentModal({ open: false, appointment: null, method: 'Cash' }); setModalProof({ url: null, fileName: null, uploading: false }); }} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        </div>
                        <div style={{ marginBottom: '18px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '7px' }}>Payment Method</label>
                            <select
                                value={paymentModal.method}
                                onChange={e => {
                                    setPaymentModal(p => ({ ...p, method: e.target.value }));
                                    setModalProof({ url: null, fileName: null, uploading: false });
                                }}
                                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem' }}
                            >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Card">Card</option>
                                <option value="Cheque">Cheque</option>
                                <option value="NEFT/RTGS">NEFT / RTGS</option>
                            </select>
                        </div>
                        {['UPI', 'Card', 'Cheque', 'NEFT/RTGS'].includes(paymentModal.method) && (
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '7px' }}>
                                    {paymentModal.method === 'UPI' && 'Upload Payment Screenshot'}
                                    {paymentModal.method === 'Card' && 'Upload Payment Receipt'}
                                    {['NEFT/RTGS', 'Cheque'].includes(paymentModal.method) && 'Upload Payment Proof'}
                                    <span style={{ color: '#ef4444', fontSize: '12px' }}> *Required</span>
                                </label>
                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={handleModalProofChange}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '8px',
                                        border: '1.5px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                {modalProof.uploading && <div style={{ fontSize: '12px', color: '#6366f1', marginTop: '4px' }}>Uploading proof...</div>}
                                {modalProof.url && (
                                    <div style={{ fontSize: '12px', color: '#166534', fontWeight: '600', marginTop: '6px' }}>
                                        Selected File: {modalProof.fileName}
                                        <a href={modalProof.url} target="_blank" rel="noreferrer" style={{ marginLeft: '8px', color: '#2563eb', textDecoration: 'underline' }}>[View Uploaded]</a>
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleConfirmPayment}
                                disabled={confirmingPayment}
                                style={{ flex: 1, padding: '11px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
                            >
                                {confirmingPayment ? 'Confirming...' : '✓ Confirm Payment'}
                            </button>
                            <button
                                onClick={() => { setPaymentModal({ open: false, appointment: null, method: 'Cash' }); setModalProof({ url: null, fileName: null, uploading: false }); }}
                                style={{ padding: '11px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {hospitalizeModal.open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Hospitalize Patient</h2>
                                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                    {hospitalizeModal.appointment?.userId?.name} — {hospitalizeModal.appointment?.doctorName}
                                </p>
                            </div>
                            <button onClick={() => setHospitalizeModal({ open: false, appointment: null })} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Ward / Room</label>
                                <input
                                    type="text"
                                    placeholder="e.g. General Ward, ICU"
                                    value={hospitalizeForm.ward}
                                    onChange={e => setHospitalizeForm(p => ({ ...p, ward: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Bed Number</label>
                                <input
                                    type="text"
                                    placeholder="e.g. B-12"
                                    value={hospitalizeForm.bedNumber}
                                    onChange={e => setHospitalizeForm(p => ({ ...p, bedNumber: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Admission Date</label>
                            <input
                                type="date"
                                value={hospitalizeForm.admissionDate}
                                onChange={e => setHospitalizeForm(p => ({ ...p, admissionDate: e.target.value }))}
                                style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem' }}
                            />
                        </div>

                        {(hospitalContext?.facilities?.length > 0) ? (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                                    Select Facilities &amp; Days
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {hospitalContext.facilities.map(f => (
                                        <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>₹{f.pricePerDay}/day</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <label style={{ fontSize: '0.82rem', color: '#475569' }}>Days:</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={hospitalizeForm.facilityDays[f.name] || ''}
                                                    onChange={e => setHospitalizeForm(p => ({ ...p, facilityDays: { ...p.facilityDays, [f.name]: e.target.value } }))}
                                                    style={{ width: '70px', padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: '7px', fontSize: '0.9rem', textAlign: 'center' }}
                                                />
                                            </div>
                                            {hospitalizeForm.facilityDays[f.name] > 0 && (
                                                <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '0.9rem', minWidth: '70px', textAlign: 'right' }}>
                                                    ₹{(f.pricePerDay * Number(hospitalizeForm.facilityDays[f.name])).toLocaleString('en-IN')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {Object.values(hospitalizeForm.facilityDays).some(d => d > 0) && (
                                    <div style={{ marginTop: '12px', padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                        <span>Total Facility Cost:</span>
                                        <span style={{ color: '#1d4ed8' }}>
                                            ₹{(hospitalContext.facilities.reduce((sum, f) => sum + (f.pricePerDay * (Number(hospitalizeForm.facilityDays[f.name]) || 0)), 0)).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: '12px 14px', background: '#fef9c3', borderRadius: '8px', fontSize: '0.88rem', color: '#92400e', marginBottom: '16px' }}>
                                No facilities configured. Hospital admin can add facilities from the Hospital Admin Dashboard.
                            </div>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Notes (optional)</label>
                            <textarea
                                placeholder="Any notes for admission..."
                                value={hospitalizeForm.notes}
                                onChange={e => setHospitalizeForm(p => ({ ...p, notes: e.target.value }))}
                                rows={2}
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setHospitalizeModal({ open: false, appointment: null })} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                                Cancel
                            </button>
                            <button
                                onClick={handleHospitalize}
                                disabled={hospitalizingSaving}
                                style={{ padding: '10px 24px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', opacity: hospitalizingSaving ? 0.6 : 1 }}
                            >
                                {hospitalizingSaving ? 'Admitting...' : 'Admit Patient'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {viewMode === 'intake' && renderIntake()}
            {viewMode === 'transactions' && renderTransactions()}
        </>
    );
};

export default ReceptionDashboard;