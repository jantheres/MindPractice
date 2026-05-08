import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, Clock, CheckCircle, AlertCircle, Eye, Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

const TherapistDashboard = ({ onSelectSession }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/dashboard/sessions`);
                setSessions(res.data);
                setLoading(false);
            } catch (err) {
                console.error("Failed to fetch sessions", err);
                setError("Failed to load sessions.");
                setLoading(false);
            }
        };

        fetchSessions();
    }, []);

    if (loading) return (
        <div className="loading-container">
            <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            <p>Loading your dashboard...</p>
        </div>
    );

    if (error) return (
        <div className="glass error-box">
            <AlertCircle size={32} style={{marginBottom: '16px', opacity: 0.5}} />
            <h3>Error</h3>
            <p>{error}</p>
        </div>
    );

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="dashboard-container"
        >
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2>Therapist Dashboard</h2>
                    <p className="subtitle">Manage your sessions and documentation.</p>
                </div>
                <button className="btn btn-primary" onClick={() => onSelectSession(null)}>
                    Start New Session
                </button>
            </div>


            <div className="sessions-list">
                {sessions.length === 0 ? (
                    <div className="glass empty-state">
                        <Calendar size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No sessions found.</p>
                    </div>
                ) : (
                    sessions.map((session) => (
                        <div key={session.session_id} className="glass session-card">
                            <div className="card-left">
                                <div className="patient-info">
                                    <User size={20} color="var(--primary)" />
                                    <h3>{session.patient_name}</h3>
                                </div>
                                <div className="session-meta">
                                    <div className="meta-item">
                                        <Calendar size={14} />
                                        <span>{session.date}</span>
                                    </div>
                                    <div className="meta-item">
                                        <Clock size={14} />
                                        <span className={`status-badge ${session.status}`}>
                                            {session.status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="card-right">
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => onSelectSession(session)}
                                >
                                    <Eye size={16} style={{marginRight: '8px'}} />
                                    View Notes
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style>{`
                .dashboard-container {
                    padding: 20px;
                    max-width: 1000px;
                    margin: 0 auto;
                }
                .dashboard-header {
                    margin-bottom: 30px;
                }
                .dashboard-header h2 {
                    font-size: 28px;
                    margin-bottom: 8px;
                }
                .subtitle {
                    color: var(--text-muted);
                }
                .sessions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .session-card {
                    padding: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 16px;
                    border: 1px solid var(--card-border);
                    background: var(--card-bg);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .session-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
                }
                .patient-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .patient-info h3 {
                    font-size: 18px;
                    margin: 0;
                }
                .session-meta {
                    display: flex;
                    gap: 20px;
                    color: var(--text-muted);
                    font-size: 14px;
                }
                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-badge {
                    font-weight: 700;
                    font-size: 11px;
                    padding: 3px 8px;
                    border-radius: 12px;
                }
                .status-badge.completed {
                    background: rgba(34, 197, 94, 0.1);
                    color: #4ade80;
                }
                .status-badge.active {
                    background: rgba(234, 179, 8, 0.1);
                    color: #facc15;
                }
                .empty-state {
                    padding: 60px;
                    text-align: center;
                    color: var(--text-muted);
                    border-radius: 16px;
                }
                @media (max-width: 600px) {
                    .session-card {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 20px;
                    }
                    .card-right {
                        width: 100%;
                    }
                    .card-right button {
                        width: 100%;
                    }
                }
            `}</style>
        </motion.div>
    );
};

export default TherapistDashboard;
