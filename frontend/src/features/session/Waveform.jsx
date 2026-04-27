import React from 'react';
import { motion } from 'framer-motion';

const Waveform = ({ isRecording, color = '#3b82f6' }) => {
    const bars = Array.from({ length: 15 });

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            height: '24px'
        }}>
            {bars.map((_, i) => (
                <motion.div
                    key={i}
                    animate={{
                        height: isRecording ? [4, 16, 8, 20, 4] : 4
                    }}
                    transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.05,
                        ease: "easeInOut"
                    }}
                    style={{
                        width: '3px',
                        background: color,
                        borderRadius: '2px',
                        opacity: isRecording ? 1 : 0.3
                    }}
                />
            ))}
        </div>
    );
};

export default Waveform;
