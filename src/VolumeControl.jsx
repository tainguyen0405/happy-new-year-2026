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

export default function VolumeControl({ soundRef, volume, setVolume }) {
  const [hovered, setHover] = useState(false);

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (soundRef.current) {
      soundRef.current.setVolume(newVolume);
    }
  };

  const increaseVolume = () => {
    const newVolume = Math.min(2, volume + 0.1); // Max 200%
    setVolume(newVolume);
    if (soundRef.current) {
      soundRef.current.setVolume(newVolume);
    }
    playCustomClick();
  };

  const decreaseVolume = () => {
    const newVolume = Math.max(0, volume - 0.1);
    setVolume(newVolume);
    if (soundRef.current) {
      soundRef.current.setVolume(newVolume);
    }
    playCustomClick();
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'fixed',
        bottom: '110px',
        right: '30px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 12px',
        background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
        border: 'none',
        borderRadius: '16px',
        boxShadow: hovered 
          ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          : '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        zIndex: 1000,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Button tăng âm lượng */}
      <button
        onClick={increaseVolume}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          border: 'none',
          color: 'white',
          fontSize: '18px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.05)';
          e.target.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Thanh slider vertical */}
      <div style={{ position: 'relative', width: '4px', height: '120px' }}>
        {/* Background track */}
        <div style={{
          position: 'absolute',
          width: '4px',
          height: '100%',
          background: '#3f3f46',
          borderRadius: '2px'
        }}></div>
        
        {/* Filled track - từ dưới lên */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          width: '4px',
          height: `${(volume / 2) * 100}%`,
          background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '2px',
          transition: 'height 0.1s ease'
        }}></div>
        
        {/* Input range - xoay 270 độ để vertical */}
        <input
          type="range"
          min="0"
          max="2"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          style={{
            position: 'absolute',
            width: '120px',
            height: '4px',
            cursor: 'pointer',
            opacity: 0,
            zIndex: 2,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            transformOrigin: 'center'
          }}
        />
      </div>

      {/* Hiển thị % âm lượng */}
      <span style={{ 
        color: '#a1a1aa', 
        fontSize: '13px', 
        fontWeight: '600',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {Math.round((volume / 2) * 100)}%
      </span>

      {/* Button giảm âm lượng */}
      <button
        onClick={decreaseVolume}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #52525b 0%, #3f3f46 100%)',
          border: 'none',
          color: 'white',
          fontSize: '18px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.05)';
          e.target.style.background = 'linear-gradient(135deg, #71717a 0%, #52525b 100%)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.background = 'linear-gradient(135deg, #52525b 0%, #3f3f46 100%)';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8H13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}