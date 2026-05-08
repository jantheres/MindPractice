import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, Mic, CheckCircle, ArrowRight, Sun, Moon, StopCircle } from 'lucide-react';
import LiveTranscript from './features/session/LiveTranscript';
import SessionAudioCapture from './features/session/AudioCapture';
import SOAPEditor from './features/session/SOAPEditor';
import TherapistDashboard from './pages/TherapistDashboard';
import './App.css';
import { API_URL } from './config';

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
      const response = await fetch(`${API_URL}/api/session/start/${APPOINTMENT_ID}?therapist_id=${THERAPIST_ID}&client_id=${THERAPIST_ID}`, {
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
    <div className="app-container">
      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">MP</div>
          <div>
            <h1 className="logo-text">MindPractice</h1>
            <p className="logo-subtext">SECURE CLINICAL WORKSPACE</p>
          </div>
        </div>
        
        {step === 'session' && (
          <div className="session-badge">
            <div className="pulse-dot" style={{marginRight: '8px'}} />
            <span style={{fontWeight: '600', fontSize: '13px'}}>Session Live</span>
          </div>
        )}
        {step === 'completed' && (
           <div className="completed-badge">
             <CheckCircle size={14} style={{marginRight: '6px'}} />
             <span style={{fontWeight: '600', fontSize: '13px'}}>Session Ended</span>
           </div>
        )}
      </header>

      <main className="app-main">
        <AnimatePresence mode="wait">
          {step === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="landing-container"
            >
              <div className="glass premium-card hero-card">
                <h2 className="hero-title">Welcome to Your Clinical Hub</h2>
                <p className="hero-subtitle">Choose your role to enter the secure session workspace.</p>
                
                <div className="role-grid">
                  <button 
                    className="btn glass role-card"
                    onClick={() => { setRole('therapist'); setStep('dashboard'); }}
                  >

                    <div className="role-icon-wrapper">
                      <Shield color="var(--primary)" size={28} />
                    </div>
                    <div style={{textAlign: 'left'}}>
                      <h3 style={{fontSize: '18px', marginBottom: '4px'}}>Therapist Portal</h3>
                      <p style={{fontSize: '13px', color: 'var(--text-muted)'}}>Manage session & documentation</p>
                    </div>
                    <ArrowRight size={20} color="var(--text-muted)" style={{marginLeft: 'auto'}} />
                  </button>

                  <button 
                    className="btn glass role-card"
                    onClick={() => { setRole('client'); setStep('consent'); }}
                  >
                    <div className="role-icon-wrapper">
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

          {step === 'dashboard' && (
            <TherapistDashboard onSelectSession={(session) => {
              if (session) {
                setSessionId(session.session_id);
                setStep('completed');
              } else {
                setStep('consent');
              }
            }} />
          )}


          {step === 'consent' && (

            <motion.div 
              key="consent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="consent-wrapper"
            >
              <div className="glass premium-card consent-card">
                <div className="consent-header">
                  <Shield color="var(--primary)" size={48} />
                  <h2 style={{fontSize: '28px', marginTop: '1rem'}}>Secure Clinical Consent</h2>
                  <p style={{color: 'var(--text-muted)', marginTop: '0.5rem'}}>Please review and confirm to proceed</p>
                </div>
                
                <div className="consent-content">
                  <p>I consent to the real-time transcription and analysis of this session for clinical documentation purposes.</p>
                  <ul className="consent-list">
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
              className="session-grid"
            >
              <div className="chat-area">
                <LiveTranscript 
                  sessionId={sessionId}
                  role={role} 
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                />
              </div>

              <div className="sidebar">
                <div className="glass premium-card info-card">
                  <div className="info-header">
                    <Shield size={20} color="var(--primary)" />
                    <h3 style={{fontSize: '16px'}}>Secure Session</h3>
                  </div>
                  <div className="info-row">
                    <span>Patient</span>
                    <span style={{color: 'var(--text-main)', fontWeight: '600'}}>Ajay</span>
                  </div>
                  <div className="info-row">
                    <span>Appointment</span>
                    <span style={{color: 'var(--text-main)', fontWeight: '600'}}>#MP-550e84</span>
                  </div>
                  <div className="info-row">
                    <span>Encryption</span>
                    <span style={{color: 'var(--accent)', fontWeight: '600'}}>Active AES-256</span>
                  </div>
                  <div className="info-divider" />
                  <div className="status-indicator">
                    <div className="pulse-dot" style={{width: '8px', height: '8px'}} />
                    <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>Session in progress. Your privacy is our priority.</span>
                  </div>
                </div>

                {role === 'therapist' && (
                   <button onClick={handleSessionEnd} className="end-btn">
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
              className="completed-layout"
            >
               <div className="glass tabs-bar">
                 <button 
                   onClick={() => setCompletedTab('soap')}
                   className={`tab-btn ${completedTab === 'soap' ? 'active' : ''}`}
                 >
                   SOAP Note
                   {completedTab === 'soap' && <motion.div layoutId="tab" className="tab-underline" />}
                 </button>
                 <button 
                   onClick={() => setCompletedTab('history')}
                   className={`tab-btn ${completedTab === 'history' ? 'active' : ''}`}
                 >
                   Chat History
                   {completedTab === 'history' && <motion.div layoutId="tab" className="tab-underline" />}
                 </button>
               </div>

               <div className="tab-content">
                 {completedTab === 'soap' ? (
                   <SOAPEditor appointmentId={APPOINTMENT_ID} role={role} patientName="Ajay" sessionId={sessionId} />
                 ) : (
                   <div className="glass history-container">
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
               
               <div className="post-session-actions">
                 <button 
                   className="btn glass"
                   onClick={() => setStep('consent')} 
                   style={{background: 'var(--accent-soft)', color: 'var(--accent)'}}
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

export default App;

