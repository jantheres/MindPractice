import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Save, CheckCircle, XCircle, Loader2, Lock, Eye } from 'lucide-react';
import axios from 'axios';
import './SOAPEditor.css';

const SOAPEditor = ({ appointmentId, role = 'therapist', onStatusChange, patientName = "Ajay", sessionId }) => {
    const [soapData, setSoapData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [validationData, setValidationData] = useState(null);
    const [validating, setValidating] = useState(false);

    const handleValidate = async () => {
        setValidating(true);
        try {
            const res = await axios.post(`http://localhost:8000/api/session/${appointmentId}/soap/validate`);
            setValidationData(res.data);
        } catch (err) {
            console.error("Validation failed", err);
        } finally {
            setValidating(false);
        }
    };

    const applyVerified = () => {
        if (validationData?.verified_version) {
            setSoapData({ ...soapData, ...validationData.verified_version });
            setValidationData(null);
        }
    };

    const fetchSoap = async (retryCount = 0) => {
        try {
            const url = sessionId 
                ? `http://localhost:8000/api/session/${appointmentId}/soap?role=${role}&session_id=${sessionId}`
                : `http://localhost:8000/api/session/${appointmentId}/soap?role=${role}`;
            const res = await axios.get(url);
            setSoapData(res.data);
            setError(null);
            setLoading(false);
        } catch (err) {
            if (err.response?.status === 404 && retryCount < 3) {
                // If not found, wait 2 seconds and retry (to allow auto-generation to finish)
                console.log(`SOAP not found, retrying... (${retryCount + 1}/3)`);
                setTimeout(() => fetchSoap(retryCount + 1), 2000);
                return;
            }

            if (err.response?.status === 403) {
                setError("SOAP notes are not yet available. Please wait for therapist approval.");
            } else if (err.response?.status === 404) {
                if (role === 'therapist') {
                    handleGenerate();
                } else {
                    setError("SOAP notes have not been generated yet.");
                }
            } else {
                setError("An error occurred loading the notes.");
            }
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const url = sessionId 
                ? `http://localhost:8000/api/session/${appointmentId}/soap/generate?patient_name=${patientName}&session_id=${sessionId}`
                : `http://localhost:8000/api/session/${appointmentId}/soap/generate?patient_name=${patientName}`;
            const res = await axios.post(url);
            setSoapData(res.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.detail || "Generation failed.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSoap();
    }, [appointmentId, role]);

    const handleUpdateStatus = async (status) => {
        setSaving(true);
        try {
            const url = sessionId 
                ? `http://localhost:8000/api/session/${appointmentId}/soap?session_id=${sessionId}`
                : `http://localhost:8000/api/session/${appointmentId}/soap`;
            await axios.patch(url, {
                ...soapData,
                status: status
            });
            await fetchSoap();
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
                ? `http://localhost:8000/api/session/${appointmentId}/soap?session_id=${sessionId}`
                : `http://localhost:8000/api/session/${appointmentId}/soap`;
            await axios.patch(url, soapData);
            alert("Changes saved successfully.");
        } catch (err) {
            console.error("Save failed", err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
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

    const isApproved = soapData?.status === 'approved';
    const isRejected = soapData?.status === 'rejected';
    const canEdit = role === 'therapist' && !isApproved;

    const getStatusBadgeClass = (status) => {
        if (status === 'approved') return 'soap-badge approved';
        if (status === 'rejected') return 'soap-badge rejected';
        return 'soap-badge pending';
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass soap-container"
        >
            <div className="soap-header">
                <div className="soap-title-group">
                    <div className="soap-main-title">
                        <h2>Clinical SOAP Note</h2>
                        <span className={getStatusBadgeClass(soapData.status)}>
                            {soapData.status === 'approved' ? '🟢 Approved' : 
                             soapData.status === 'rejected' ? '🔴 Rejected' : '🟡 Pending Review'}
                        </span>
                    </div>
                    <p className="soap-subtitle">
                        {isApproved ? "This note has been reviewed and approved for the client's record." : 
                         "Generated draft from session transcript. Review required."}
                    </p>
                </div>
                
                {role === 'therapist' && (
                    <div className="soap-actions">
                        <button 
                            className="btn action-btn-secondary" 
                            style={{background: validating ? 'rgba(59, 130, 246, 0.1)' : 'transparent'}}
                            onClick={handleValidate} 
                            disabled={isApproved || validating}
                        >
                            {validating ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />} 
                            Validate
                        </button>

                        <button 
                            className="btn action-btn-secondary"
                            onClick={handleSaveEdits} 
                            disabled={isApproved || saving}
                        >
                            <Save size={18} /> Save
                        </button>
                        
                        {!isApproved && (
                            <button 
                                className="btn btn-primary" 
                                onClick={() => handleUpdateStatus('approved')} 
                                disabled={saving}
                            >
                                <CheckCircle size={18} /> Approve
                            </button>
                        )}
                        
                        {!isRejected && !isApproved && (
                            <button 
                                className="btn action-btn-secondary"
                                style={{backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)'}}
                                onClick={() => handleUpdateStatus('rejected')} 
                                disabled={saving}
                            >
                                <XCircle size={18} /> Reject
                            </button>
                        )}

                        {isRejected && (
                            <button 
                                className="btn btn-primary" 
                                onClick={handleGenerate} 
                                disabled={saving}
                            >
                                <Sparkles size={18} /> Re-generate
                            </button>
                        )}
                    </div>
                )}
            </div>

            {validationData?.overall_accuracy_score !== undefined && (
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
                {['subjective', 'objective', 'assessment', 'plan'].map((field) => (
                    <div key={field} className="field-group">
                        <label className="field-label">{field.toUpperCase()}</label>
                        <div className="input-wrapper">
                            <textarea
                                readOnly={!canEdit}
                                value={soapData[field] || ''}
                                onChange={(e) => setSoapData({ ...soapData, [field]: e.target.value })}
                                className="soap-textarea"
                                style={{
                                    cursor: canEdit ? 'text' : 'default',
                                    borderColor: canEdit ? 'var(--card-border)' : 'transparent'
                                }}
                            />
                            {validationData?.validations[field] && (
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

            {role === 'client' && isApproved && (
                <div className="client-footer">
                    <Eye size={16} />
                    <span>This note is verified by your clinician.</span>
                </div>
            )}
        </motion.div>
    );
};

export default SOAPEditor;
