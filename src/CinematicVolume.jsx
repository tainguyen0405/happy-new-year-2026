import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Volume1, VolumeX, Zap } from 'lucide-react';

export default function CinematicVolume({ soundRef }) {
  const [isHovered, setIsHovered] = useState(false);
  const [volume, setVolume] = useState(200); // Max 200%

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
        fontFamily: "'Orbitron', sans-serif", // Font công nghệ (nếu có)
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
              borderBottom: 'none', // Nối liền với nút tròn
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '4px', // Góc vát kiểu sci-fi
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingBottom: '25px', // Tránh đè lên nút tròn
              paddingTop: '15px',
              position: 'absolute',
              bottom: '60px', // Đặt phía trên nút tròn
              left: '0',
              overflow: 'hidden',
              backdropFilter: 'blur(5px)',
            }}
          >
            {/* Lưới trang trí (Grid) */}
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              backgroundImage: 'linear-gradient(90deg, rgba(0,243,255,0.1) 1px, transparent 1px)',
              backgroundSize: '20px 100%',
              pointerEvents: 'none'
            }} />

            {/* Input Slider */}
            <div style={{ position: 'relative', flexGrow: 1, height: '6px', display: 'flex', alignItems: 'center' }}>
              
              {/* Thanh nền (Track) */}
              <div style={{ position: 'absolute', width: '100%', height: '2px', background: '#333' }} />
              
              {/* Thanh năng lượng (Progress) */}
              <motion.div 
                style={{ 
                  position: 'absolute', 
                  left: 0, 
                  height: '100%', 
                  width: `${(volume / 500) * 100}%`,
                  background: 'linear-gradient(90deg, #00f3ff, #fff)', // Hiệu ứng tia laser
                  boxShadow: '0 0 10px #00f3ff',
                  zIndex: 0
                }} 
              />

              {/* Input thật (Invisible) */}
              <input
                type="range"
                min="0"
                max="500"
                value={volume}
                onChange={handleVolumeChange}
                style={{
                  width: '100%',
                  height: '20px', // Vùng bấm rộng hơn
                  opacity: 0, // Ẩn đi để dùng UI custom
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 10
                }}
              />
              
              {/* Cục điều khiển (Thumb ảo) */}
              <motion.div
                style={{
                  position: 'absolute',
                  left: `${(volume / 500) * 100}%`,
                  width: '12px',
                  height: '12px',
                  background: '#000',
                  border: '2px solid #00f3ff',
                  boxShadow: '0 0 15px #00f3ff',
                  transform: 'translate(-50%, 0) rotate(45deg)', // Hình thoi
                  pointerEvents: 'none',
                  zIndex: 5
                }}
              />
            </div>

            {/* Chỉ số % (HUD Text) */}
            <div style={{ 
              marginLeft: '15px', 
              color: '#00f3ff', 
              fontSize: '14px', 
              fontWeight: 'bold', 
              fontFamily: 'monospace',
              textShadow: '0 0 5px rgba(0,243,255,0.8)',
              minWidth: '50px',
              textAlign: 'right'
            }}>
              {Math.round(volume)}%
            </div>

            {/* Decor: Icon tia sét max volume */}
            {volume > 400 && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ position: 'absolute', right: '5px', top: '5px' }}
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