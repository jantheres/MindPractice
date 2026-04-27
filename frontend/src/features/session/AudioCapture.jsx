import React, { useEffect, useRef } from 'react';
import { WS_URL } from '../../config';

const SessionAudioCapture = ({ 
    isRecording, 
    onControlMessage, 
    role, 
    sessionId,
    onSessionEnd // New prop to trigger session closure
}) => {
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const socketRef = useRef(null);

    // Manage WebSocket Connection (Session Level)
    useEffect(() => {
        if (sessionId) {
            // Close existing socket if role changed
            if (socketRef.current) {
                socketRef.current.close();
            }
            connectSocket();
        }
        return () => {
            // Cleanup on unmount
            if (socketRef.current) socketRef.current.close();
        };
    }, [sessionId, role]);

    // Manage Audio Capture (Toggle Level)
    useEffect(() => {
        if (isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    }, [isRecording]);

    const connectSocket = () => {
        const wsUrl = `${WS_URL}/api/session/ws/${sessionId}?role=${role}`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => console.log(`Connected as ${role}`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'status' && data.status === 'completed') {
                onControlMessage(data);
            }
            window.dispatchEvent(new CustomEvent('transcript_update', { detail: data }));
        };
        ws.onclose = () => {
            socketRef.current = null;
        };
    };

    const startRecording = async () => {
        try {
            if (!streamRef.current) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
            }

            const options = { mimeType: 'audio/webm;codecs=opus' };
            const recorder = new MediaRecorder(streamRef.current, options);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.send(event.data);
                }
            };

            recorder.start(250);
        } catch (err) {
            console.error("Capture Error:", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    // Separate function for the HARD STOP
    useEffect(() => {
        const handleFinalStop = () => {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: 'control', command: 'stop_session' }));
            }
        };
        window.addEventListener('hard_stop_session', handleFinalStop);
        return () => window.removeEventListener('hard_stop_session', handleFinalStop);
    }, []);

    return null;
};

export default SessionAudioCapture;
