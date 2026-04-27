import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Save, CheckCircle, XCircle, Loader2, Lock, Eye } from 'lucide-react';
import axios from 'axios';

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
        <div style={styles.loadingContainer}>
            <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            <p>Processing clinical notes...</p>
        </div>
    );

    if (error) return (
        <div className="glass" style={styles.errorBox}>
            <Lock size={32} style={{marginBottom: '16px', opacity: 0.5}} />
            <h3>Access Restricted</h3>
            <p>{error}</p>
        </div>
    );

    const isApproved = soapData?.status === 'approved';
    const isRejected = soapData?.status === 'rejected';
    const canEdit = role === 'therapist' && !isApproved;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass" 
            style={styles.container}
        >
            <div style={styles.header}>
                <div style={styles.titleGroup}>
                    <div style={styles.mainTitle}>
                        <h2>Clinical SOAP Note</h2>
                        <span style={styles.badge(soapData.status)}>
                            {soapData.status === 'approved' ? '🟢 Approved' : 
                             soapData.status === 'rejected' ? '🔴 Rejected' : '🟡 Pending Review'}
                        </span>
                    </div>
                    <p style={styles.subtitle}>
                        {isApproved ? "This note has been reviewed and approved for the client's record." : 
                         "Generated draft from session transcript. Review required."}
                    </p>
                </div>
                
                {role === 'therapist' && (
                    <div style={styles.actions}>
                        <button 
                            className="btn" 
                            style={{...styles.saveBtn, background: validating ? 'rgba(59, 130, 246, 0.1)' : 'transparent'}}
                            onClick={handleValidate} 
                            disabled={isApproved || validating}
                        >
                            {validating ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />} 
                            Validate & Fact Check
                        </button>

                        <button 
                            className="btn" 
                            style={styles.saveBtn}
                            onClick={handleSaveEdits} 
                            disabled={isApproved || saving}
                        >
                            <Save size={18} /> Save Edits
                        </button>
                        
                        {!isApproved && (
                            <button 
                                className="btn btn-primary" 
                                style={styles.approveBtn}
                                onClick={() => handleUpdateStatus('approved')} 
                                disabled={saving}
                            >
                                <CheckCircle size={18} /> Approve & Share
                            </button>
                        )}
                        
                        {!isRejected && !isApproved && (
                            <button 
                                className="btn" 
                                style={styles.rejectBtn}
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
                <div style={styles.accuracyBanner}>
                   <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <Sparkles size={20} color="var(--primary)" />
                      <strong>Evidence-Based Accuracy: {validationData.overall_accuracy_score}%</strong>
                   </div>
                   <button className="btn" onClick={applyVerified} style={styles.applyBtn}>
                      Apply 100% Verified Version
                   </button>
                </div>
            )}

            <div style={styles.editorGrid}>
                {['subjective', 'objective', 'assessment', 'plan'].map((field) => (
                    <div key={field} style={styles.fieldGroup}>
                        <label style={styles.label}>{field.toUpperCase()}</label>
                        <div style={styles.inputWrapper}>
                            <textarea
                                readOnly={!canEdit}
                                value={soapData[field] || ''}
                                onChange={(e) => setSoapData({ ...soapData, [field]: e.target.value })}
                                style={{
                                    ...styles.textarea, 
                                    cursor: canEdit ? 'text' : 'default',
                                    borderColor: canEdit ? 'var(--card-border)' : 'transparent'
                                }}
                            />
                            {validationData?.validations[field] && (
                                <div style={styles.validationStack}>
                                    {validationData.validations[field].map((v, i) => (
                                        <div key={i} style={styles.validationItem(v.status)}>
                                            <div style={styles.vLabel}>
                                                {v.status === 'supported' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                                {v.status.toUpperCase()}
                                            </div>
                                            <p style={styles.vClaim}>"{v.claim}"</p>
                                            {v.citation && <p style={styles.vCitation}>Source: {v.citation}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {role === 'client' && isApproved && (
                <div style={styles.clientFooter}>
                    <Eye size={16} />
                    <span>This note is verified by your clinician.</span>
                </div>
            )}
        </motion.div>
    );
};

const styles = {
    container: { padding: '40px', marginTop: '24px', borderRadius: '24px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' },
    mainTitle: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' },
    titleGroup: { flex: 1 },
    subtitle: { fontSize: '14px', color: 'rgba(255,255,255,0.5)' },
    actions: { display: 'flex', gap: '12px' },
    badge: (status) => ({
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: '700',
        backgroundColor: status === 'approved' ? 'rgba(34, 197, 94, 0.1)' : 
                         status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
        color: status === 'approved' ? '#4ade80' : 
               status === 'rejected' ? '#f87171' : '#facc15',
        border: `1px solid ${status === 'approved' ? 'rgba(34, 197, 94, 0.2)' : 
                               status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`
    }),
    accuracyBanner: {
        marginBottom: '30px',
        padding: '16px 24px',
        background: 'var(--card-bg)',
        borderRadius: '16px',
        border: '1px solid var(--primary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    applyBtn: { 
        fontSize: '13px', 
        padding: '8px 16px', 
        background: 'var(--primary)', 
        color: 'white',
        borderRadius: '10px'
    },
    editorGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' },
    fieldGroup: { display: 'flex', flexDirection: 'column', gap: '12px' },
    inputWrapper: { position: 'relative' },
    label: { fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' },
    textarea: {
        backgroundColor: 'var(--input-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '16px',
        padding: '20px',
        color: 'var(--text-main)',
        minHeight: '220px',
        width: '100%',
        fontSize: '15px',
        lineHeight: '1.6',
        resize: 'none',
        outline: 'none',
        transition: 'all 0.3s ease'
    },
    validationStack: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
    validationItem: (status) => ({
        padding: '10px 14px',
        borderRadius: '12px',
        fontSize: '12px',
        background: status === 'supported' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
        border: `1px solid ${status === 'supported' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`,
    }),
    vLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', marginBottom: '4px', fontSize: '10px' },
    vClaim: { color: 'var(--text-main)', marginBottom: '4px' },
    vCitation: { color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' },
    saveBtn: { backgroundColor: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)' },
    approveBtn: { background: 'var(--primary)', boxShadow: 'var(--shadow)' },
    rejectBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' },
    loadingContainer: { padding: '100px', textAlign: 'center', color: 'var(--text-muted)' },
    errorBox: { padding: '60px', textAlign: 'center', margin: '40px auto', maxWidth: '500px', borderRadius: '30px', color: 'var(--text-main)' },
    clientFooter: { 
        marginTop: '30px', 
        padding: '20px', 
        backgroundColor: 'var(--accent-soft)', 
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        color: 'var(--accent)',
        fontSize: '13px'
    }
};

export default SOAPEditor;
