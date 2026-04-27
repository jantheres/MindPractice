import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Stethoscope, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

const ConsentModal = ({ appointmentId, therapistId, role, onConsentComplete }) => {
    const [loading, setLoading] = useState(false);

    const handleConsent = async (userType) => {
        if (userType !== role) return; // Only allow consent for current role
        
        setLoading(true);
        try {
            await axios.post(`http://localhost:8000/api/session/${appointmentId}/consent`, {
                user_type: userType,
                therapist_id: therapistId
            });

            // Call complete as soon as THIS user consents
            onConsentComplete();
        } catch (error) {
            console.error("Consent failed", error);
            alert("Failed to log consent. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass" 
                style={styles.modal}
            >
                <div style={styles.header}>
                    <ShieldCheck size={40} color="var(--accent)" />
                    <h2 style={styles.title}>Secure Session Access</h2>
                    <p style={styles.subtitle}>You are entering as <strong>{role.toUpperCase()}</strong>. Please provide your legal consent to proceed.</p>
                </div>

                <div style={styles.cardContainer}>
                    {role === 'therapist' ? (
                        <div className="glass" style={styles.activeCard}>
                            <div style={styles.iconCircle}>
                                <Stethoscope size={32} color="var(--accent)" />
                            </div>
                            <h3>Therapist Consent</h3>
                            <p style={styles.description}>
                                I hereby consent to the real-time transcription of this clinical session. 
                                I understand that this data is processed securely and will be used to generate clinical documentation.
                            </p>
                            <button 
                                className="btn-consent" 
                                onClick={() => handleConsent('therapist')}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : 'I Consent & Open Dashboard'}
                            </button>
                        </div>
                    ) : (
                        <div className="glass" style={styles.activeCard}>
                            <div style={styles.iconCircle}>
                                <UserCheck size={32} color="var(--accent)" />
                            </div>
                            <h3>Client Consent</h3>
                            <p style={styles.description}>
                                I understand that this session is being transcribed for clinical documentation purposes only. 
                                My privacy is protected, and audio is never stored on servers.
                            </p>
                            <button 
                                className="btn-consent" 
                                onClick={() => handleConsent('client')}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : 'I Consent & Join Session'}
                            </button>
                        </div>
                    )}
                </div>

                <div style={styles.footer}>
                    <div style={styles.securityNote}>
                        <Lock size={12} />
                        <span>HIPAA Compliant • End-to-End Encryption • No Audio Retention</span>
                    </div>
                </div>
            </motion.div>
            
            <style>{`
                .btn-consent {
                    background: var(--accent);
                    color: white;
                    border: none;
                    padding: 16px 32px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 16px;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(var(--accent-rgb), 0.3);
                }
                .btn-consent:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(var(--accent-rgb), 0.4);
                    filter: brightness(1.1);
                }
                .btn-consent:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 10, 15, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(10px)'
    },
    modal: {
        width: '90%',
        maxWidth: '500px',
        padding: '50px 40px',
        textAlign: 'center',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.02)'
    },
    header: {
        marginBottom: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
    },
    title: {
        margin: 0,
        fontSize: '28px',
        fontWeight: '800',
        letterSpacing: '-1px'
    },
    subtitle: {
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.5)',
        lineHeight: '1.6'
    },
    cardContainer: {
        marginBottom: '40px'
    },
    activeCard: {
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        borderRadius: '20px',
        background: 'rgba(255, 255, 255, 0.03)'
    },
    iconCircle: {
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    description: {
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.7)',
        lineHeight: '1.6',
        margin: '0 0 10px 0'
    },
    footer: {
        marginTop: '20px'
    },
    securityNote: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.3)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    }
};

export default ConsentModal;
