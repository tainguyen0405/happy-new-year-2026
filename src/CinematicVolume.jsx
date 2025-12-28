import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Volume1, VolumeX, Zap } from 'lucide-react';

export default function CinematicVolume({ soundRef }) {
  const [isHovered, setIsHovered] = useState(false);
  const [volume, setVolume] = useState(200); // Max 500%

  // Xử lý thay đổi volume
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (soundRef.current) {
      soundRef.current.setVolume(newVolume / 100); 
    }
  };

  const getIcon = () => {
    if (volume === 0) return <VolumeX size={24} color="#00f3ff" />;
    if (volume < 100) return <Volume1 size={24} color="#00f3ff" />;
    return <Volume2 size={24} color="#00f3ff" />;
  };

  return (
    <div 
      className="cinematic-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        bottom: '40px',
        left: '40px',
        display: 'flex',
        alignItems: 'center',
        zIndex: 1000,
        fontFamily: "'Orbitron', sans-serif",
      }}
    >
      {/* 1. THE CORE (NÚT TRÒN) */}
      <motion.div
        animate={{
          boxShadow: isHovered 
            ? "0 0 20px rgba(0, 243, 255, 0.8), inset 0 0 10px rgba(0, 243, 255, 0.5)" 
            : "0 0 10px rgba(0, 243, 255, 0.3), inset 0 0 5px rgba(0, 243, 255, 0.2)",
          scale: isHovered ? 1.1 : 1,
        }}
        transition={{ duration: 0.3 }}
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 20, 30, 0.9)',
          border: '2px solid #00f3ff',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Vòng xoay trang trí bên trong */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            border: '1px dashed rgba(0, 243, 255, 0.3)',
            borderRadius: '50%',
          }}
        />
        {getIcon()}
      </motion.div>

      {/* 2. THE ENERGY BEAM (THANH SLIDER DỌC) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 20 }}
            animate={{ height: 280, opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            style={{
              width: '40px',
              backgroundColor: 'rgba(0, 15, 25, 0.8)',
              border: '1px solid rgba(0, 243, 255, 0.3)',
              borderBottom: 'none',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingBottom: '25px',
              paddingTop: '15px',
              position: 'absolute',
              bottom: '60px',
              left: '0',
              overflow: 'hidden',
              backdropFilter: 'blur(5px)',
            }}
          >
            {/* Lưới trang trí (Grid dọc) */}
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              backgroundImage: 'linear-gradient(0deg, rgba(0,243,255,0.1) 1px, transparent 1px)',
              backgroundSize: '100% 20px',
              pointerEvents: 'none'
            }} />

            {/* Chỉ số % (HUD Text) - Đặt lên trên */}
            <div style={{ 
              marginBottom: '10px', 
              color: '#00f3ff', 
              fontSize: '14px', 
              fontWeight: 'bold', 
              fontFamily: 'monospace',
              textShadow: '0 0 5px rgba(0,243,255,0.8)',
              textAlign: 'center'
            }}>
              {Math.round(volume)}%
            </div>

            {/* Input Slider DỌC */}
            <div style={{ position: 'relative', flexGrow: 1, width: '6px', display: 'flex', justifyContent: 'center' }}>
              
              {/* Thanh nền (Track) */}
              <div style={{ position: 'absolute', height: '100%', width: '2px', background: '#333' }} />
              
              {/* Thanh năng lượng (Progress từ dưới lên) */}
              <motion.div 
                style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  width: '100%', 
                  height: `${(volume / 500) * 100}%`,
                  background: 'linear-gradient(180deg, #fff, #00f3ff)',
                  boxShadow: '0 0 10px #00f3ff',
                  zIndex: 0
                }} 
              />

              {/* Input thật (Invisible) - Xoay dọc */}
              <input
                type="range"
                min="0"
                max="500"
                value={volume}
                onChange={handleVolumeChange}
                orient="vertical"
                style={{
                  width: '20px',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  position: 'absolute',
                  zIndex: 10,
                  writingMode: 'bt-lr',
                  WebkitAppearance: 'slider-vertical',
                }}
              />
              
              {/* Cục điều khiển (Thumb ảo) */}
              <motion.div
                style={{
                  position: 'absolute',
                  bottom: `${(volume / 500) * 100}%`,
                  width: '12px',
                  height: '12px',
                  background: '#000',
                  border: '2px solid #00f3ff',
                  boxShadow: '0 0 15px #00f3ff',
                  transform: 'translate(0, 50%) rotate(45deg)',
                  pointerEvents: 'none',
                  zIndex: 5
                }}
              />
            </div>

            {/* Decor: Icon tia sét max volume */}
            {volume > 400 && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ position: 'absolute', top: '5px', left: '50%', transform: 'translateX(-50%)' }}
              >
                <Zap size={10} color="#ff0055" fill="#ff0055" />
              </motion.div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}