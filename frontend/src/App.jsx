import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, Mic, CheckCircle, ArrowRight, Sun, Moon, StopCircle } from 'lucide-react';
import LiveTranscript from './features/session/LiveTranscript';
import SessionAudioCapture from './features/session/AudioCapture';
import SOAPEditor from './features/session/SOAPEditor';

const APPOINTMENT_ID = "550e8400-e29b-41d4-a716-446655440000"; 
const THERAPIST_ID = "9971cc3d-a0a5-4c80-a43e-b77daac7f6a0"; 

const App = () => {
  const [step, setStep] = useState('landing'); // landing, consent, session, completed
  const [role, setRole] = useState('therapist');
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [completedTab, setCompletedTab] = useState('soap');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleConsentComplete = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/session/start/${APPOINTMENT_ID}?therapist_id=${THERAPIST_ID}&client_id=${THERAPIST_ID}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.session_id) {
        setSessionId(data.session_id);
        
        if (data.status === 'completed') {
          setStep('completed');
          setIsRecording(false);
          setCompletedTab('soap');
        } else {
          setStep('session');
          setIsRecording(true);
        }
      }
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  const handleSessionEnd = useCallback(() => {
    if (step === 'completed') return; 
    
    console.log("Ending session...");
    window.dispatchEvent(new CustomEvent('hard_stop_session'));
    setIsRecording(false);
    setStep('completed');
    setCompletedTab('soap');
  }, [step]);

  return (
    <div className="container">
      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <header style={styles.header}>
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>MP</div>
          <div>
            <h1 style={styles.logoText}>MindPractice</h1>
            <p style={styles.logoSubtext}>SECURE CLINICAL WORKSPACE</p>
          </div>
        </div>
        
        {step === 'session' && (
          <div style={styles.sessionBadge}>
            <div className="pulse-dot" style={{marginRight: '8px'}} />
            <span style={{fontWeight: '600', fontSize: '13px'}}>Session Live</span>
          </div>
        )}
        {step === 'completed' && (
           <div style={styles.completedBadge}>
             <CheckCircle size={14} style={{marginRight: '6px'}} />
             <span style={{fontWeight: '600', fontSize: '13px'}}>Session Ended</span>
           </div>
        )}
      </header>

      <main style={styles.main}>
        <AnimatePresence mode="wait">
          {step === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={styles.landingContainer}
            >
              <div className="glass premium-card" style={styles.heroCard}>
                <h2 style={styles.heroTitle}>Welcome to Your Clinical Hub</h2>
                <p style={styles.heroSubtitle}>Choose your role to enter the secure session workspace.</p>
                
                <div style={styles.roleGrid}>
                  <button 
                    className="btn glass"
                    onClick={() => { setRole('therapist'); setStep('consent'); }}
                    style={styles.roleCard}
                  >
                    <div style={styles.roleIconWrapper}>
                      <Shield color="var(--primary)" size={28} />
                    </div>
                    <div style={{textAlign: 'left'}}>
                      <h3 style={{fontSize: '18px', marginBottom: '4px'}}>Therapist Portal</h3>
                      <p style={{fontSize: '13px', color: 'var(--text-muted)'}}>Manage session & documentation</p>
                    </div>
                    <ArrowRight size={20} color="var(--text-muted)" style={{marginLeft: 'auto'}} />
                  </button>

                  <button 
                    className="btn glass"
                    onClick={() => { setRole('client'); setStep('consent'); }}
                    style={styles.roleCard}
                  >
                    <div style={styles.roleIconWrapper}>
                      <Users color="var(--accent)" size={28} />
                    </div>
                    <div style={{textAlign: 'left'}}>
                      <h3 style={{fontSize: '18px', marginBottom: '4px'}}>Client Portal</h3>
                      <p style={{fontSize: '13px', color: 'var(--text-muted)'}}>Secure communication & records</p>
                    </div>
                    <ArrowRight size={20} color="var(--text-muted)" style={{marginLeft: 'auto'}} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'consent' && (
            <motion.div 
              key="consent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={styles.consentWrapper}
            >
              <div className="glass premium-card" style={styles.consentCard}>
                <div style={styles.consentHeader}>
                  <Shield color="var(--primary)" size={48} />
                  <h2 style={{fontSize: '28px', marginTop: '1rem'}}>Secure Clinical Consent</h2>
                  <p style={{color: 'var(--text-muted)', marginTop: '0.5rem'}}>Please review and confirm to proceed</p>
                </div>
                
                <div style={styles.consentContent}>
                  <p>I consent to the real-time transcription and analysis of this session for clinical documentation purposes.</p>
                  <ul style={styles.consentList}>
                    <li>All data is encrypted end-to-end (AES-256).</li>
                    <li>Audio chunks are processed securely and deleted post-transcription.</li>
                    <li>Clinical notes are visible only to authorized providers.</li>
                  </ul>
                </div>

                <button className="btn btn-primary" onClick={handleConsentComplete} style={{width: '100%', marginTop: '2rem'}}>
                  I Agree, Start Session
                </button>
              </div>
            </motion.div>
          )}

          {step === 'session' && (
            <motion.div 
              key="session"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={styles.sessionGrid}
            >
              <div style={styles.chatArea}>
                <LiveTranscript 
                  sessionId={sessionId}
                  role={role} 
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                />
              </div>

              <div style={styles.sidebar}>
                <div className="glass premium-card" style={styles.infoCard}>
                  <div style={styles.infoHeader}>
                    <Shield size={20} color="var(--primary)" />
                    <h3 style={{fontSize: '16px'}}>Secure Session</h3>
                  </div>
                  <div style={styles.infoRow}>
                    <span>Patient</span>
                    <span style={{color: 'var(--text-main)', fontWeight: '600'}}>Ajay</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span>Appointment</span>
                    <span style={{color: 'var(--text-main)', fontWeight: '600'}}>#MP-550e84</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span>Encryption</span>
                    <span style={{color: 'var(--accent)', fontWeight: '600'}}>Active AES-256</span>
                  </div>
                  <div style={styles.infoDivider} />
                  <div style={styles.statusIndicator}>
                    <div className="pulse-dot" style={{width: '8px', height: '8px'}} />
                    <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>Session in progress. Your privacy is our priority.</span>
                  </div>
                </div>

                {role === 'therapist' && (
                   <button onClick={handleSessionEnd} className="btn" style={styles.endBtn}>
                     <StopCircle size={20} style={{marginRight: '8px'}} />
                     End & Finalize Session
                   </button>
                )}
              </div>
            </motion.div>
          )}

          {step === 'completed' && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={styles.completedLayout}
            >
               <div className="glass" style={styles.tabsBar}>
                 <button 
                   onClick={() => setCompletedTab('soap')}
                   style={{...styles.tabBtn, color: completedTab === 'soap' ? 'var(--primary)' : 'var(--text-muted)'}}
                 >
                   SOAP Note
                   {completedTab === 'soap' && <motion.div layoutId="tab" style={styles.tabUnderline} />}
                 </button>
                 <button 
                   onClick={() => setCompletedTab('history')}
                   style={{...styles.tabBtn, color: completedTab === 'history' ? 'var(--primary)' : 'var(--text-muted)'}}
                 >
                   Chat History
                   {completedTab === 'history' && <motion.div layoutId="tab" style={styles.tabUnderline} />}
                 </button>
               </div>

               <div style={styles.tabContent}>
                 {completedTab === 'soap' ? (
                   <SOAPEditor appointmentId={APPOINTMENT_ID} role={role} patientName="Ajay" sessionId={sessionId} />
                 ) : (
                   <div className="glass" style={styles.historyContainer}>
                      <LiveTranscript 
                        sessionId={sessionId}
                        role={role} 
                        isRecording={false}
                        setIsRecording={() => {}}
                        readOnly={true}
                      />
                   </div>
                 )}
               </div>
               
               <div style={styles.postSessionActions}>
                 <button 
                   className="btn glass"
                   onClick={() => setStep('consent')} 
                   style={{background: 'var(--accent-soft)', color: 'var(--accent)', marginRight: '12px'}}
                 >
                    Start New Session
                 </button>
                 <button className="btn glass" onClick={() => setStep('landing')}>
                    Back to Selection
                 </button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SessionAudioCapture 
        isRecording={isRecording}
        onControlMessage={(msg) => {
          if (msg.status === 'completed') handleSessionEnd();
        }}
        role={role}
        sessionId={sessionId}
      />
      
      <style>{`
        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: dot-pulse 2s infinite;
        }
        @keyframes dot-pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  header: {
    padding: '2rem 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: { display: 'flex', alignItems: 'center', gap: '1rem' },
  logoIcon: {
    width: '48px',
    height: '48px',
    background: 'var(--primary)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '800',
    fontSize: '20px',
    boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)'
  },
  logoText: { fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' },
  logoSubtext: { fontSize: '10px', letterSpacing: '2px', color: 'var(--text-muted)', marginTop: '-4px' },
  sessionBadge: {
    padding: '8px 16px',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    border: '1px solid rgba(16, 185, 129, 0.2)'
  },
  completedBadge: {
    padding: '8px 16px',
    background: 'rgba(59, 130, 246, 0.1)',
    color: 'var(--primary)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  main: { flex: 1, paddingBottom: '4rem' },
  landingContainer: { display: 'flex', justifyContent: 'center', paddingTop: '4rem' },
  heroCard: { width: '100%', maxWidth: '800px', textAlign: 'center' },
  heroTitle: { fontSize: '36px', fontWeight: '800', marginBottom: '1rem' },
  heroSubtitle: { color: 'var(--text-muted)', marginBottom: '3rem', fontSize: '18px' },
  roleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },
  roleCard: {
    width: '100%',
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.03)',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    border: '1px solid var(--card-border)'
  },
  roleIconWrapper: {
    width: '56px',
    height: '56px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  consentWrapper: { display: 'flex', justifyContent: 'center', paddingTop: '2rem' },
  consentCard: { maxWidth: '600px', textAlign: 'center' },
  consentContent: { 
    textAlign: 'left', 
    background: 'rgba(0,0,0,0.1)', 
    padding: '20px', 
    borderRadius: '16px', 
    marginTop: '1.5rem',
    fontSize: '15px'
  },
  consentList: { marginTop: '1rem', paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '14px' },
  sessionGrid: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', height: '800px' },
  chatArea: { height: '100%' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  infoCard: { padding: '24px' },
  infoHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '12px', color: 'var(--text-muted)' },
  infoDivider: { height: '1px', background: 'var(--card-border)', margin: '1.5rem 0' },
  statusIndicator: { display: 'flex', alignItems: 'center', gap: '12px' },
  endBtn: { background: '#ef4444', color: 'white', marginTop: 'auto', width: '100%', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: '700', cursor: 'pointer' },
  completedLayout: { maxWidth: '1000px', margin: '0 auto' },
  tabsBar: { 
    display: 'flex', 
    padding: '6px', 
    borderRadius: '18px', 
    marginBottom: '2rem',
    maxWidth: '300px',
    margin: '0 auto 2rem'
  },
  tabBtn: {
    flex: 1,
    padding: '12px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    position: 'relative'
  },
  tabUnderline: {
    position: 'absolute',
    bottom: '0',
    left: '20%',
    width: '60%',
    height: '3px',
    background: 'var(--primary)',
    borderRadius: '2px'
  },
  tabContent: { minHeight: '600px' },
  historyContainer: { borderRadius: '24px', overflow: 'hidden', height: '800px' },
  postSessionActions: { marginTop: '3rem', display: 'flex', justifyContent: 'center' }
};

export default App;
