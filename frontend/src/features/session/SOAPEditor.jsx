import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Save, CheckCircle, XCircle, Loader2, Lock, Eye } from 'lucide-react';
import axios from 'axios';
import './SOAPEditor.css';
import { API_URL } from '../../config';

const SOAPEditor = ({ appointmentId, role = 'therapist', onStatusChange, patientName = "Ajay", sessionId }) => {
    const [activeTab, setActiveTab] = useState('soap');
    const [allNotes, setAllNotes] = useState({ soap: null, dap: null, summary: null });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [validationData, setValidationData] = useState(null);
    const [validating, setValidating] = useState(false);

    const fieldsConfig = {
        soap: ['subjective', 'objective', 'assessment', 'plan'],
        dap: ['data', 'assessment', 'plan'],
        summary: ['summary', 'key_issues', 'progress', 'follow_up_plans']
    };

    const handleValidate = async () => {
        setValidating(true);
        try {
            const res = await axios.post(`${API_URL}/api/session/${appointmentId}/soap/validate`);
            setValidationData(res.data);
        } catch (err) {
            console.error("Validation failed", err);
        } finally {
            setValidating(false);
        }
    };

    const applyVerified = () => {
        if (validationData?.verified_version) {
            setAllNotes(prev => ({
                ...prev,
                soap: { ...prev.soap, ...validationData.verified_version }
            }));
            setValidationData(null);
        }
    };

    const fetchNotes = async (retryCount = 0) => {
        setLoading(true);
        try {
            const url = sessionId 
                ? `${API_URL}/api/session/${appointmentId}/soap?role=${role}&session_id=${sessionId}&note_type=${activeTab}`
                : `${API_URL}/api/session/${appointmentId}/soap?role=${role}&note_type=${activeTab}`;
            const res = await axios.get(url);
            
            // Map DB columns back to friendly keys for non-SOAP tabs
            let mappedData = {};
            if (activeTab === 'soap') {
                mappedData = res.data;
            } else if (activeTab === 'dap') {
                mappedData = {
                    data: res.data.subjective,
                    assessment: res.data.assessment,
                    plan: res.data.plan
                };
            } else if (activeTab === 'summary') {
                mappedData = {
                    summary: res.data.subjective,
                    key_issues: res.data.objective,
                    progress: res.data.assessment,
                    follow_up_plans: res.data.plan
                };
            }

            
            setAllNotes(prev => ({ ...prev, [activeTab]: mappedData }));
            setError(null);
        } catch (err) {
            if (err.response?.status === 404 && retryCount < 1 && activeTab === 'soap') {
                // Auto-generate SOAP only on first load if not found
                if (role === 'therapist') {
                    handleGenerate();
                } else {
                    setError("Notes have not been generated yet.");
                }
            } else if (err.response?.status === 404) {
                // For other tabs, just leave as null so they can generate
                setAllNotes(prev => ({ ...prev, [activeTab]: null }));
            } else if (err.response?.status === 403) {
                setError("Notes are not yet available. Please wait for therapist approval.");
            } else {
                setError("An error occurred loading the notes.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            let endpoint = activeTab;
            const url = sessionId 
                ? `${API_URL}/api/session/${appointmentId}/${endpoint}/generate?patient_name=${patientName}&session_id=${sessionId}`
                : `${API_URL}/api/session/${appointmentId}/${endpoint}/generate?patient_name=${patientName}`;
            const res = await axios.post(url);
            
            setAllNotes(prev => ({
                ...prev,
                [activeTab]: res.data
            }));
            setError(null);
        } catch (err) {
            setError(err.response?.data?.detail || "Generation failed.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();
    }, [appointmentId, role, activeTab]);

    const handleUpdateStatus = async (status) => {
        setSaving(true);
        try {
            const url = sessionId 
                ? `${API_URL}/api/session/${appointmentId}/soap?session_id=${sessionId}&note_type=${activeTab}`
                : `${API_URL}/api/session/${appointmentId}/soap?note_type=${activeTab}`;
            
            const currentData = allNotes[activeTab];
            let dataToSave = {};
            
            if (activeTab === 'soap') {
                dataToSave = { ...currentData, status };
            } else if (activeTab === 'dap') {
                dataToSave = { subjective: currentData.data, assessment: currentData.assessment, plan: currentData.plan, status };
            } else if (activeTab === 'summary') {
                dataToSave = { 
                    subjective: currentData.summary, 
                    objective: currentData.key_issues, 
                    assessment: currentData.progress,
                    plan: currentData.follow_up_plans,
                    status 
                };
            }

            
            await axios.patch(url, dataToSave);
            await fetchNotes();
            if (onStatusChange) onStatusChange(status);
        } catch (err) {
            console.error("Status update failed", err);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdits = async () => {
        setSaving(true);
        try {
            const url = sessionId 
                ? `${API_URL}/api/session/${appointmentId}/soap?session_id=${sessionId}&note_type=${activeTab}`
                : `${API_URL}/api/session/${appointmentId}/soap?note_type=${activeTab}`;
            
            let dataToSave = {};
            const currentData = allNotes[activeTab];
            
            if (activeTab === 'soap') {
                dataToSave = currentData;
            } else if (activeTab === 'dap') {
                dataToSave = {
                    subjective: currentData.data,
                    assessment: currentData.assessment,
                    plan: currentData.plan
                };
            } else if (activeTab === 'summary') {
                dataToSave = {
                    subjective: currentData.summary,
                    objective: currentData.key_issues,
                    assessment: currentData.progress,
                    plan: currentData.follow_up_plans
                };
            }

            
            await axios.patch(url, dataToSave);
            alert("Changes saved successfully.");
        } catch (err) {
            console.error("Save failed", err);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    if (loading && !allNotes[activeTab]) return (
        <div className="loading-container">
            <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            <p>Processing clinical notes...</p>
        </div>
    );

    if (error) return (
        <div className="glass error-box">
            <Lock size={32} style={{marginBottom: '16px', opacity: 0.5}} />
            <h3>Access Restricted</h3>
            <p>{error}</p>
        </div>
    );

    const currentNoteData = allNotes[activeTab];
    const isApproved = allNotes.soap?.status === 'approved';
    const canEdit = role === 'therapist' && !isApproved;

    const getStatusBadgeClass = (status) => {
        if (status === 'approved') return 'soap-badge approved';
        if (status === 'rejected') return 'soap-badge rejected';
        return 'soap-badge pending';
    };

    if (!currentNoteData && !loading) return (
        <div className="glass error-box">
            <Sparkles size={32} style={{marginBottom: '16px', opacity: 0.5}} />
            <h3>No {activeTab.toUpperCase()} Data</h3>
            <p>Click generate to create {activeTab.toUpperCase()} notes.</p>
            {role === 'therapist' && (
                <button className="btn btn-primary" onClick={handleGenerate} style={{marginTop: '1rem'}}>
                    Generate {activeTab.toUpperCase()}
                </button>
            )}
        </div>
    );

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass soap-container"
        >
            <div className="soap-header">
                <div className="soap-title-group">
                    <div className="soap-main-title">
                        <h2>Clinical Notes</h2>
                        {activeTab === 'soap' && allNotes.soap && (
                            <span className={getStatusBadgeClass(allNotes.soap.status)}>
                                {allNotes.soap.status === 'approved' ? '🟢 Approved' : 
                                 allNotes.soap.status === 'rejected' ? '🔴 Rejected' : '🟡 Pending Review'}
                            </span>
                        )}
                    </div>
                    <p className="soap-subtitle">
                        Generate and review SOAP, DAP, or Session Summaries.
                    </p>
                </div>
                
                {role === 'therapist' && (
                    <div className="soap-actions">
                        {activeTab === 'soap' && (
                            <button 
                                className="btn action-btn-secondary" 
                                style={{background: validating ? 'rgba(59, 130, 246, 0.1)' : 'transparent'}}
                                onClick={handleValidate} 
                                disabled={isApproved || validating}
                            >
                                {validating ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />} 
                                Validate
                            </button>
                        )}

                        <button 
                            className="btn action-btn-secondary"
                            onClick={handleSaveEdits} 
                            disabled={isApproved || saving}
                        >
                            <Save size={18} /> Save
                        </button>
                        
                        {activeTab === 'soap' && !isApproved && (
                            <button 
                                className="btn btn-primary" 
                                onClick={() => handleUpdateStatus('approved')} 
                                disabled={saving}
                            >
                                <CheckCircle size={18} /> Approve
                            </button>
                        )}
                        
                        {activeTab === 'soap' && allNotes.soap?.status !== 'rejected' && !isApproved && (
                            <button 
                                className="btn action-btn-secondary"
                                style={{backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)'}}
                                onClick={() => handleUpdateStatus('rejected')} 
                                disabled={saving}
                            >
                                <XCircle size={18} /> Reject
                            </button>
                        )}

                        <button 
                            className="btn btn-primary" 
                            onClick={handleGenerate} 
                            disabled={saving || loading}
                        >
                            <Sparkles size={18} /> Re-generate
                        </button>
                    </div>
                )}
            </div>

            <div className="soap-tabs">
                <button className={`tab-btn ${activeTab === 'soap' ? 'active' : ''}`} onClick={() => setActiveTab('soap')}>SOAP</button>
                <button className={`tab-btn ${activeTab === 'dap' ? 'active' : ''}`} onClick={() => setActiveTab('dap')}>DAP</button>
                <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
            </div>

            {activeTab === 'soap' && validationData?.overall_accuracy_score !== undefined && (
                <div className="accuracy-banner">
                   <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <Sparkles size={20} color="var(--primary)" />
                      <strong>Accuracy: {validationData.overall_accuracy_score}%</strong>
                   </div>
                   <button className="btn apply-btn" onClick={applyVerified}>
                      Apply Verified Version
                   </button>
                </div>
            )}

            <div className="editor-grid">
                {currentNoteData && fieldsConfig[activeTab].map((field) => (
                    <div key={field} className="field-group">
                        <label className="field-label">{field.toUpperCase()}</label>
                        <div className="input-wrapper">
                            <textarea
                                readOnly={!canEdit}
                                value={currentNoteData[field] || ''}
                                onChange={(e) => {
                                    setAllNotes(prev => ({
                                        ...prev,
                                        [activeTab]: { ...prev[activeTab], [field]: e.target.value }
                                    }));
                                }}
                                className="soap-textarea"
                                style={{
                                    cursor: canEdit ? 'text' : 'default',
                                    borderColor: canEdit ? 'var(--card-border)' : 'transparent'
                                }}
                            />
                            {activeTab === 'soap' && validationData?.validations[field] && (
                                <div className="validation-stack">
                                    {validationData.validations[field].map((v, i) => (
                                        <div key={i} className={`validation-item ${v.status === 'supported' ? 'supported' : 'unsupported'}`}>
                                            <div className="v-label">
                                                {v.status === 'supported' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                                {v.status.toUpperCase()}
                                            </div>
                                            <p className="v-claim">"{v.claim}"</p>
                                            {v.citation && <p className="v-citation">Source: {v.citation}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {role === 'client' && isApproved && activeTab === 'soap' && (
                <div className="client-footer">
                    <Eye size={16} />
                    <span>This note is verified by your clinician.</span>
                </div>
            )}
        </motion.div>
    );
};

export default SOAPEditor;
