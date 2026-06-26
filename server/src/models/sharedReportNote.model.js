const mongoose = require('mongoose');

const sharedReportNoteSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    index: true
  },
  patientId: {
    type: String, // Stores MRN string or User ObjectId string
    required: true,
    index: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabReport',
    required: true,
    unique: true
  },
  notes: {
    type: String,
    default: ''
  },
  updatedBy: {
    type: String,
    default: ''
  },
  updatedRole: {
    type: String,
    default: ''
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const SharedReportNote = mongoose.model('SharedReportNote', sharedReportNoteSchema);

module.exports = SharedReportNote;
