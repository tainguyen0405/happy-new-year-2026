import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause } from 'lucide-react';

export default function CinematicPlayButton({ soundRef }) {
  // Mặc định là FALSE (Vì mình đã tắt Autoplay bên App.jsx)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const togglePlay = () => {
    if (soundRef.current) {
      // 1. Mở khóa AudioContext (Bắt buộc cho trình duyệt)
      if (soundRef.current.context.state === 'suspended') {
        soundRef.current.context.resume();
      }

      // 2. Kiểm tra trạng thái THỰC của âm thanh
      if (soundRef.current.isPlaying) {
        // Nếu đang hát -> Tắt
        soundRef.current.pause();
        setIsPlaying(false);
      } else {
        // Nếu đang tắt -> Hát
        soundRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={togglePlay}
    >
      {/* HINT TEXT */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            style={{
              marginBottom: '15px',
              color: isPlaying ? '#00f3ff' : '#ff0055', // Xanh khi hát, Đỏ khi tắt
              fontFamily: 'monospace',
              fontSize: '12px',
              letterSpacing: '2px',
              textShadow: `0 0 10px ${isPlaying ? 'rgba(0, 243, 255, 0.8)' : 'rgba(255, 0, 85, 0.8)'}`,
              background: 'rgba(0, 20, 30, 0.9)',
              padding: '6px 16px',
              borderRadius: '4px',
              border: `1px solid ${isPlaying ? 'rgba(0, 243, 255, 0.3)' : 'rgba(255, 0, 85, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backdropFilter: 'blur(4px)',
              pointerEvents: 'none', // Tránh chuột che mất nút click
              whiteSpace: 'nowrap'
            }}
          >
            <div style={{ 
              width: '6px', 
              height: '6px', 
              background: isPlaying ? '#00ff66' : '#ff0055', 
              borderRadius: '50%', 
              boxShadow: `0 0 8px ${isPlaying ? '#00ff66' : '#ff0055'}` 
            }} />
            {isPlaying ? "ĐANG PHÁT..." : "[ BẤM ĐỂ PHÁT NHẠC]"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CORE BUTTON */}
      <motion.div
        animate={{
          scale: isHovered ? 1.1 : 1,
          boxShadow: isPlaying 
            ? "0 0 30px rgba(0, 243, 255, 0.4), inset 0 0 10px rgba(0, 243, 255, 0.3)" 
            : "0 0 15px rgba(255, 0, 85, 0.4), inset 0 0 5px rgba(255, 0, 85, 0.2)"
        }}
        whileTap={{ scale: 0.95 }}
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(0, 10, 20, 0.95)',
          border: `2px solid ${isPlaying ? '#00f3ff' : '#ff0055'}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {/* Vòng xoay trang trí */}
        <motion.div
          animate={{ rotate: isPlaying ? 360 : 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          style={{
            position: 'absolute',
            width: '120%',
            height: '120%',
            border: `1px dashed ${isPlaying ? 'rgba(0, 243, 255, 0.3)' : 'rgba(255, 0, 85, 0.3)'}`,
            borderRadius: '50%',
            pointerEvents: 'none'
          }}
        />

        {/* Icon Logic: Playing = Pause Icon || Paused = Play Icon */}
        <motion.div
          initial={false}
          animate={{ scale: isPlaying ? 1 : 1.2 }}
        >
          {isPlaying ? (
            <Pause size={28} color="#00f3ff" fill="#00f3ff" style={{ filter: 'drop-shadow(0 0 5px #00f3ff)' }} />
          ) : (
            <Play size={28} color="#ff0055" fill="#ff0055" style={{ filter: 'drop-shadow(0 0 5px #ff0055)', marginLeft: '4px' }} />
          )}
        </motion.div>

      </motion.div>
    </div>
  );
}
