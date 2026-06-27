import React, { useState, useEffect, useRef } from 'react';
import { labAPI } from '../../utils/api';
import './SharedReportNotesSection.css';

const SharedReportNotesSection = ({ reportId, patientId, appointmentId, hospitalId, readOnly = false }) => {
    const [noteObj, setNoteObj] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasExisting, setHasExisting] = useState(false);
    const editorRef = useRef(null);

    const fetchNotes = async () => {
        if (!reportId) return;
        try {
            const res = await labAPI.getSharedNotes(reportId);
            const noteData = res?.note || res;
            if (noteData && (noteData.notes || noteData.updatedAt)) {
                setNoteObj(noteData);
                setHasExisting(true);
                if (editorRef.current && editorRef.current.innerHTML !== noteData.notes) {
                    editorRef.current.innerHTML = noteData.notes || '';
                }
            } else {
                setHasExisting(false);
                if (noteData) setNoteObj(noteData);
            }
        } catch (err) {
            console.error("Error fetching shared notes:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();

        // Auto sync on window refocus
        const handleFocus = () => {
            fetchNotes();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [reportId]);

    // Ensure editor DOM populates after loading transitions from true -> false on page refresh
    useEffect(() => {
        if (!loading && editorRef.current && noteObj !== null) {
            const targetContent = noteObj.notes || '';
            if (editorRef.current.innerHTML !== targetContent) {
                editorRef.current.innerHTML = targetContent;
            }
        }
    }, [loading, noteObj]);

    const handleExec = (command, value = null) => {
        if (readOnly) return;
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
        }
    };

    const handleSave = async () => {
        if (!reportId || readOnly) return;
        const currentHtml = editorRef.current ? editorRef.current.innerHTML : '';
        setSaving(true);
        try {
            const res = await labAPI.saveSharedNotes(reportId, {
                notes: currentHtml,
                patientId,
                appointmentId,
                hospitalId,
                _hasExisting: hasExisting
            });
            const noteData = res?.note || res;
            if (noteData) {
                setNoteObj(noteData);
                setHasExisting(true);
                alert(res?.message || (hasExisting ? "Notes updated successfully." : "Notes saved successfully."));
            }
        } catch (err) {
            alert(err?.response?.data?.message || "Unable to save notes. Please try again.");
            console.error("Save error:", err);
        } finally {
            setSaving(false);
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${datePart} | ${timePart}`;
    };

    if (loading) {
        return <div className="shared-notes-loading">Loading report notes...</div>;
    }

    return (
        <div className="shared-report-notes-container">
            <div className="shared-notes-header">
                <h3>📝 Report Analysis &amp; Notes</h3>
                {readOnly && <span className="shared-notes-readonly-badge">View Only</span>}
            </div>

            <div className="shared-notes-divider" />

            <div className="shared-notes-body">
                <label className="shared-notes-label">Observation Notes</label>

                {!readOnly && (
                    <div className="shared-notes-toolbar">
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleExec('bold'); }} title="Bold"><b>B</b></button>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleExec('italic'); }} title="Italic"><i>I</i></button>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleExec('insertUnorderedList'); }} title="Bullet List">• List</button>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); handleExec('insertOrderedList'); }} title="Numbered List">1. List</button>
                    </div>
                )}

                <div
                    ref={editorRef}
                    className={`shared-notes-editor-box ${readOnly ? 'is-readonly' : ''}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning={true}
                    placeholder="Enter multi-line analysis, bullet points, or clinical observations here..."
                />

                {noteObj && noteObj.updatedAt && (
                    <div className="shared-notes-metadata-section">
                        <div className="shared-notes-meta-item">
                            <span className="meta-lbl">Last Updated</span>
                            <span className="meta-val">{formatDateTime(noteObj.updatedAt)}</span>
                        </div>
                        <div className="shared-notes-meta-item">
                            <span className="meta-lbl">Updated By</span>
                            <span className="meta-val">{noteObj.updatedRole || 'Staff'}{noteObj.updatedBy ? ` (${noteObj.updatedBy})` : ''}</span>
                        </div>
                    </div>
                )}
            </div>

            {!readOnly && (
                <>
                    <div className="shared-notes-divider" />
                    <div className="shared-notes-footer">
                        <button className="shared-notes-save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : (hasExisting ? 'Update Notes' : 'Save Notes')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default SharedReportNotesSection;
