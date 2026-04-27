import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, StopCircle, Trash2 } from 'lucide-react';
import axios from 'axios';
import Waveform from './Waveform';
import StreamingText from './StreamingText';

const LiveTranscript = ({ role, sessionId, isRecording, setIsRecording, readOnly = false }) => {
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState("");

    const [messages, setMessages] = useState([]);
    const [activeTranscripts, setActiveTranscripts] = useState({}); // role -> { text, duration }
    const scrollRef = useRef(null);
    const timerRef = useRef(null);

    const handleClearChat = async () => {
        if (!window.confirm("Are you sure you want to clear all messages? This cannot be undone.")) return;
        try {
            await axios.delete(`http://localhost:8000/api/session/${sessionId}/transcript`);
            setMessages([]);
            setActiveTranscripts({});
        } catch (err) {
            console.error("Failed to clear chat", err);
        }
    };

    // 1. Fetch History on join
    useEffect(() => {
        if (!sessionId) return;
        
        const fetchHistory = async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/session/${sessionId}/transcript`);
                if (response.ok) {
                    const data = await response.json();
                    setMessages(data);
                }
            } catch (err) {
                console.error("Failed to fetch history:", err);
            }
        };

        fetchHistory();
    }, [sessionId]);

    const handleSaveEdit = async (id, text) => {
        try {
            const response = await fetch(`http://localhost:8000/api/session/transcript/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            if (response.ok) {
                setMessages(prev => prev.map(m => m.id === id ? { ...m, text } : m));
                setEditingId(null);
            }
        } catch (err) {
            console.error("Failed to save edit:", err);
        }
    };

    // 2. Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, activeTranscripts]);

    // 3. Handle incoming broadcasts
    useEffect(() => {
        const handleTranscript = (event) => {
            const data = event.detail;
            if (data.type === 'transcript') {
                const { sender, text, is_final, id } = data;
                
                if (is_final) {
                    setMessages(prev => [...prev, { 
                        sender, 
                        text, 
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        id: id || `${Date.now()}-${Math.random()}`
                    }]);
                    setActiveTranscripts(prev => {
                        const next = { ...prev };
                        delete next[sender];
                        return next;
                    });
                } else {
                    setActiveTranscripts(prev => ({ 
                        ...prev, 
                        [sender]: { ...prev[sender], text } 
                    }));
                }
            }
        };

        window.addEventListener('transcript_update', handleTranscript);
        return () => window.removeEventListener('transcript_update', handleTranscript);
    }, []);

    // 4. Handle local recording timer
    useEffect(() => {
        if (isRecording) {
            let seconds = 0;
            timerRef.current = setInterval(() => {
                seconds++;
                setActiveTranscripts(prev => ({
                    ...prev,
                    [role]: { ...prev[role], duration: seconds }
                }));
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording, role]);

    const formatDuration = (s) => {
        if (!s) return "0:00";
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getFormattedDate = () => {
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        return new Date().toLocaleDateString('en-US', options);
    };

    return (
        <div style={styles.chatContainer}>
            {/* Session Header */}
            <div style={styles.sessionHeader}>
                <div style={styles.dateBadge}>
                    {getFormattedDate()}
                </div>
                {!readOnly && (
                    <button 
                        onClick={handleClearChat}
                        style={styles.clearBtn}
                        title="Clear Chat"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} style={styles.messageArea}>
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div 
                            key={msg.id}
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            style={{
                                ...styles.bubbleWrapper,
                                alignSelf: msg.sender === 'therapist' ? 'flex-start' : 'flex-end'
                            }}
                        >
                            <div 
                                onClick={() => {
                                    if (!readOnly) {
                                        setEditingId(msg.id);
                                        setEditText(msg.text);
                                    }
                                }}
                                style={{
                                    ...styles.bubble,
                                    background: msg.sender === 'therapist' ? 'var(--bubble-therapist)' : 'var(--bubble-client)',
                                    borderRadius: msg.sender === 'therapist' ? '0 12px 12px 12px' : '12px 0 12px 12px',
                                    cursor: readOnly ? 'default' : 'pointer'
                                }}
                            >
                                {editingId === msg.id ? (
                                    <textarea 
                                        autoFocus
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        onBlur={() => handleSaveEdit(msg.id, editText)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSaveEdit(msg.id, editText);
                                            }
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                        style={styles.editInput}
                                    />
                                ) : (
                                    <>
                                        <p style={styles.messageText}>{msg.text}</p>
                                        <div style={styles.bubbleMeta}>
                                            <span style={styles.timestamp}>{msg.timestamp}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    ))}

                    {/* Active Recording Bubbles (Live Streaming) */}
                    {Object.entries(activeTranscripts).map(([sender, data]) => (
                        <motion.div 
                            key={`active-${sender}`}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            style={{
                                ...styles.bubbleWrapper,
                                alignSelf: sender === 'therapist' ? 'flex-start' : 'flex-end'
                            }}
                        >
                            <div style={{
                                ...styles.activeBubble,
                                background: sender === 'therapist' ? 'var(--bubble-therapist)' : 'var(--bubble-client)',
                                borderRadius: sender === 'therapist' ? '0 12px 12px 12px' : '12px 0 12px 12px',
                                border: '1px solid var(--card-border)'
                            }}>
                                <div style={styles.activeHeader}>
                                    <div style={styles.recordingStatus}>
                                        <div className="pulse-dot" />
                                        <span>{formatDuration(data.duration)}</span>
                                    </div>
                                    <Waveform isRecording={true} color={sender === 'therapist' ? 'var(--text-muted)' : 'var(--accent)'} />
                                </div>
                                
                                <div style={styles.liveTextContainer}>
                                    {data.text ? (
                                        <StreamingText text={data.text} />
                                    ) : (
                                        <span style={styles.listeningPlaceholder}>Listening...</span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Bottom Controls - Hidden in Read-Only mode */}
            {!readOnly && (
                <div style={styles.controlPanel}>
                    <div style={styles.controlsGrid}>
                        {/* Therapist Control */}
                        <div style={styles.micSection}>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    if (isRecording && role !== 'therapist') return;
                                    window.dispatchEvent(new CustomEvent('change_role', {detail: 'therapist'}));
                                    setIsRecording(!isRecording);
                                }}
                                style={{
                                    ...styles.micButton,
                                    background: isRecording && role === 'therapist' ? '#ea4335' : '#2a3942',
                                    boxShadow: isRecording && role === 'therapist' ? '0 0 20px rgba(234,67,53,0.4)' : 'none'
                                }}
                            >
                                {isRecording && role === 'therapist' ? <StopCircle color="white" /> : <Mic color={role === 'therapist' ? "#fff" : "#8696a0"} />}
                            </motion.button>
                            <span style={styles.micLabel}>Therapist</span>
                        </div>
    
                        {/* Client Control */}
                        <div style={styles.micSection}>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    if (isRecording && role !== 'client') return;
                                    window.dispatchEvent(new CustomEvent('change_role', {detail: 'client'}));
                                    setIsRecording(!isRecording);
                                }}
                                style={{
                                    ...styles.micButton,
                                    background: isRecording && role === 'client' ? '#ea4335' : '#005c4b',
                                    boxShadow: isRecording && role === 'client' ? '0 0 20px rgba(234,67,53,0.4)' : 'none'
                                }}
                            >
                                {isRecording && role === 'client' ? <StopCircle color="white" /> : <Mic color={role === 'client' ? "#fff" : "#00a884"} />}
                            </motion.button>
                            <span style={styles.micLabel}>Client</span>
                        </div>

                        {/* Clear Chat Button */}
                        {!readOnly && (
                            <div style={styles.micSection}>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleClearChat}
                                    style={{
                                        ...styles.micButton,
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)'
                                    }}
                                >
                                    <Trash2 size={24} color="#ef4444" />
                                </motion.button>
                                <span style={{...styles.micLabel, color: '#ef4444'}}>Clear Chat</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .pulse-dot {
                    width: 6px;
                    height: 6px;
                    background: #ea4335;
                    border-radius: 50%;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

const styles = {
    chatContainer: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-main)',
        borderRadius: '24px',
        overflow: 'hidden',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--shadow)'
    },
    sessionHeader: {
        padding: '12px',
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--card-bg)',
        position: 'relative'
    },
    dateBadge: {
        background: 'var(--input-bg)',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        border: '1px solid var(--card-border)'
    },
    messageArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: 'var(--bg-main)',
    },
    bubbleWrapper: {
        maxWidth: '80%',
        display: 'flex',
        flexDirection: 'column'
    },
    bubble: {
        padding: '8px 12px 6px 12px',
        position: 'relative',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        minWidth: '60px',
        border: '1px solid var(--card-border)'
    },
    messageText: {
        margin: 0,
        fontSize: '16px',
        lineHeight: '1.4',
        color: 'var(--text-main)',
        fontFamily: 'Inter, sans-serif'
    },
    bubbleMeta: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '2px'
    },
    timestamp: {
        fontSize: '10px',
        color: 'var(--text-muted)',
        opacity: 0.6
    },
    activeBubble: {
        padding: '12px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: 'var(--shadow)',
        minWidth: '200px',
        border: '1px solid var(--card-border)'
    },
    activeHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--card-border)',
        paddingBottom: '6px',
        marginBottom: '4px'
    },
    recordingStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        color: '#ef4444',
        fontWeight: '600'
    },
    liveTextContainer: {
        fontSize: '15px',
        color: 'var(--text-main)',
        fontStyle: 'italic'
    },
    listeningPlaceholder: {
        color: 'var(--text-muted)',
        opacity: 0.3,
        fontSize: '14px'
    },
    clearBtn: {
        position: 'absolute',
        right: '24px',
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '8px',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        padding: 0
    },
    controlPanel: {
        padding: '20px 30px',
        background: '#202c33',
        borderTop: '1px solid rgba(255,255,255,0.05)'
    },
    controlsGrid: {
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center'
    },
    micSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
    },
    micLabel: {
        fontSize: '12px',
        color: '#8696a0',
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    micButton: {
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    editInput: {
        width: '100%',
        background: 'transparent',
        border: 'none',
        color: '#fff',
        fontSize: '16px',
        fontFamily: 'Inter, sans-serif',
        resize: 'none',
        outline: 'none',
        padding: '0',
        minHeight: '40px'
    }
};

export default LiveTranscript;
