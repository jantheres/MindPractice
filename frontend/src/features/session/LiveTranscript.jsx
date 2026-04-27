import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, StopCircle, Trash2 } from 'lucide-react';
import axios from 'axios';
import Waveform from './Waveform';
import StreamingText from './StreamingText';
import './LiveTranscript.css';
import { API_URL } from '../../config';

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
            await axios.delete(`${API_URL}/api/session/${sessionId}/transcript`);
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
                const response = await fetch(`${API_URL}/api/session/${sessionId}/transcript`);
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
            const response = await fetch(`${API_URL}/api/session/transcript/${id}`, {
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
        <div className="chat-container">
            {/* Session Header */}
            <div className="session-header">
                <div className="date-badge">
                    {getFormattedDate()}
                </div>
                {!readOnly && (
                    <button 
                        onClick={handleClearChat}
                        className="clear-btn-header"
                        title="Clear Chat"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="message-area">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div 
                            key={msg.id}
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="bubble-wrapper"
                            style={{
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
                                className="bubble"
                                style={{
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
                                        className="edit-input"
                                    />
                                ) : (
                                    <>
                                        <p className="message-text">{msg.text}</p>
                                        <div className="bubble-meta">
                                            <span className="timestamp">{msg.timestamp}</span>
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
                            className="bubble-wrapper"
                            style={{
                                alignSelf: sender === 'therapist' ? 'flex-start' : 'flex-end'
                            }}
                        >
                            <div 
                                className="active-bubble"
                                style={{
                                    background: sender === 'therapist' ? 'var(--bubble-therapist)' : 'var(--bubble-client)',
                                    borderRadius: sender === 'therapist' ? '0 12px 12px 12px' : '12px 0 12px 12px'
                                }}
                            >
                                <div className="active-header">
                                    <div className="recording-status">
                                        <div className="pulse-dot" />
                                        <span>{formatDuration(data.duration)}</span>
                                    </div>
                                    <Waveform isRecording={true} color={sender === 'therapist' ? 'var(--text-muted)' : 'var(--accent)'} />
                                </div>
                                
                                <div className="live-text-container">
                                    {data.text ? (
                                        <StreamingText text={data.text} />
                                    ) : (
                                        <span className="listening-placeholder">Listening...</span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Bottom Controls - Hidden in Read-Only mode */}
            {!readOnly && (
                <div className="control-panel">
                    <div className="controls-grid">
                        {/* Therapist Control */}
                        <div className="mic-section">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    if (isRecording && role !== 'therapist') return;
                                    window.dispatchEvent(new CustomEvent('change_role', {detail: 'therapist'}));
                                    setIsRecording(!isRecording);
                                }}
                                className="mic-button"
                                style={{
                                    background: isRecording && role === 'therapist' ? '#ea4335' : '#2a3942',
                                    boxShadow: isRecording && role === 'therapist' ? '0 0 20px rgba(234,67,53,0.4)' : 'none'
                                }}
                            >
                                {isRecording && role === 'therapist' ? <StopCircle color="white" /> : <Mic color={role === 'therapist' ? "#fff" : "#8696a0"} />}
                            </motion.button>
                            <span className="mic-label">Therapist</span>
                        </div>
    
                        {/* Client Control */}
                        <div className="mic-section">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    if (isRecording && role !== 'client') return;
                                    window.dispatchEvent(new CustomEvent('change_role', {detail: 'client'}));
                                    setIsRecording(!isRecording);
                                }}
                                className="mic-button"
                                style={{
                                    background: isRecording && role === 'client' ? '#ea4335' : '#005c4b',
                                    boxShadow: isRecording && role === 'client' ? '0 0 20px rgba(234,67,53,0.4)' : 'none'
                                }}
                            >
                                {isRecording && role === 'client' ? <StopCircle color="white" /> : <Mic color={role === 'client' ? "#fff" : "#00a884"} />}
                            </motion.button>
                            <span className="mic-label">Client</span>
                        </div>

                        {/* Clear Chat Button */}
                        {!readOnly && (
                            <div className="mic-section">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleClearChat}
                                    className="mic-button"
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)'
                                    }}
                                >
                                    <Trash2 size={24} color="#ef4444" />
                                </motion.button>
                                <span className="mic-label" style={{color: '#ef4444'}}>Clear</span>
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

export default LiveTranscript;

