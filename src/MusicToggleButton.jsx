import React, { useState } from 'react';

// Hàm tạo âm thanh click
const playCustomClick = () => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const playPulse = (time, freq, dur) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(10, time + dur);
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + dur);
  };
  const now = audioCtx.currentTime;
  playPulse(now, 1200, 0.04);
  playPulse(now + 0.05, 900, 0.06);
};

export default function MusicToggleButton({ soundRef, isPlaying, setIsPlaying }) {
  const [hovered, setHover] = useState(false);

  const handleClick = () => {
    if (soundRef.current) {
      if (isPlaying) {
        soundRef.current.pause();
      } else {
        soundRef.current.play();
      }
      setIsPlaying(!isPlaying);
      playCustomClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        background: isPlaying 
          ? 'linear-gradient(135deg, #18181b 0%, #27272a 100%)'
          : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        border: 'none',
        boxShadow: hovered 
          ? (isPlaying 
              ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 8px 32px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)')
          : (isPlaying 
              ? '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : '0 4px 16px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'),
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1000,
        transform: hovered ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
        backdropFilter: 'blur(10px)'
      }}
    >
      {isPlaying ? (
        // Icon PAUSE - Modern Figma Style
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ 
            width: '4px', 
            height: '20px', 
            background: '#a1a1aa',
            borderRadius: '2px',
            transition: 'all 0.2s ease'
          }}></div>
          <div style={{ 
            width: '4px', 
            height: '20px', 
            background: '#a1a1aa',
            borderRadius: '2px',
            transition: 'all 0.2s ease'
          }}></div>
        </div>
      ) : (
        // Icon PLAY - Modern Figma Style
        <div style={{ 
          width: 0, 
          height: 0, 
          borderLeft: '16px solid white',
          borderTop: '10px solid transparent',
          borderBottom: '10px solid transparent',
          marginLeft: '3px',
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
        }}></div>
      )}
    </div>
  );
}