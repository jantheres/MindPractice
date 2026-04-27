import React, { useState, useEffect } from 'react';

const StreamingText = ({ text }) => {
    const [displayedText, setDisplayedText] = useState('');
    
    useEffect(() => {
        if (!text) {
            setDisplayedText('');
            return;
        }

        // If the new text is significantly longer than displayed, start "typing"
        if (text.length > displayedText.length) {
            const words = text.split(' ');
            const displayedWords = displayedText.split(' ');
            
            // Only type the NEW words
            let currentWordIndex = displayedWords.length - 1;
            if (currentWordIndex < 0) currentWordIndex = 0;

            const interval = setInterval(() => {
                if (currentWordIndex < words.length) {
                    setDisplayedText(words.slice(0, currentWordIndex + 1).join(' '));
                    currentWordIndex++;
                } else {
                    clearInterval(interval);
                }
            }, 100); // 100ms per word for a natural feel

            return () => clearInterval(interval);
        } else if (text.length < displayedText.length) {
            // If text was shortened (unlikely but possible with corrections), just update
            setDisplayedText(text);
        }
    }, [text]);

    return <span>{displayedText}</span>;
};

export default StreamingText;
