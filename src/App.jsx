import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'

/**
 * PATHS:
 * /happy-new-year-2026/fonts/Orbitron_Regular.json
 * /happy-new-year-2026/sounds/lofi.mp3
 * /happy-new-year-2026/sounds/celebration.mp3
 */

const isTesting = true;

// --- 1. 3D UTILS & COMPONENTS ---

function InteractiveDust({ count = 4000 }) {
  const mesh = useRef();
  const { raycaster, camera } = useThree();
  const [pos, col, orig, vel] = useMemo(() => {
    const p = new Float32Array(count * 3), c = new Float32Array(count * 3), o = new Float32Array(count * 3), v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 200, y = (Math.random() - 0.5) * 200, z = (Math.random() - 0.5) * 200;
      p.set([x, y, z], i * 3); o.set([x, y, z], i * 3);
      const color = new THREE.Color().setHSL(Math.random() * 0.1 + 0.5, 0.8, 0.7);
      c.set([color.r, color.g, color.b], i * 3);
    }
    return [p, c, o, v];
  }, [count]);

  useFrame((state) => {
    if (!mesh.current) return;
    const positions = mesh.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      vel[i3] += (orig[i3] - positions[i3]) * 0.01;
      positions[i3] += vel[i3] *= 0.9;
      positions[i3+1] += (orig[i3+1] - positions[i3+1]) * 0.01;
      positions[i3+2] += (orig[i3+2] - positions[i3+2]) * 0.01;
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={pos.length/3} array={pos} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={col.length/3} array={col} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.5} vertexColors transparent opacity={0.6} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function MechanicalButton({ onActivate }) {
  const [hovered, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const buttonRef = useRef();

  useFrame(() => {
    if (buttonRef.current) {
      buttonRef.current.position.z = THREE.MathUtils.lerp(buttonRef.current.position.z, pressed ? -1 : 0, 0.2);
    }
  });

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <Cylinder args={[4, 4.2, 1, 64]} position={[0, -0.5, 0]}>
        <meshStandardMaterial color="#111" metalness={1} roughness={0.2} />
      </Cylinder>
      <group 
        ref={buttonRef}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => { setHover(false); setPressed(false); }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => { setPressed(false); onActivate(); }}
      >
        <Cylinder args={[3.2, 3.2, 1.2, 64]}>
          <meshStandardMaterial color={hovered ? "#ff0044" : "#660022"} emissive="#ff0000" emissiveIntensity={hovered ? 2 : 0.5} />
        </Cylinder>
        <Center rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.7, 0]}>
          <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={0.8} height={0.2}>
            LAUNCH
            <meshStandardMaterial color="white" />
          </Text3D>
        </Center>
      </group>
    </group>
  );
}

function CountdownDisplay({ onFinishTransition }) {
  const [timeLeft, setTimeLeft] = useState(10);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (timeLeft <= 0) return <MechanicalButton onActivate={onFinishTransition} />;

  return (
    <Center>
      <Float speed={5} rotationIntensity={0.5}>
        <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={8} height={2}>
          {timeLeft}
          <meshStandardMaterial color="white" emissive="#00ccff" emissiveIntensity={2} />
        </Text3D>
      </Float>
    </Center>
  );
}

// --- 2. 2D BENTO FIGMA CINEMATIC SCENE ---

const containerVars = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.3 } }
};

const itemVars = {
  hidden: { y: 30, opacity: 0, scale: 0.95, filter: 'blur(10px)' },
  show: { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 80, damping: 15 } }
};

function CelebrationBento() {
  return (
    <div style={styles.bentoWrapper}>
      {/* Dynamic Backgrounds */}
      <div style={styles.aurora} />
      <div style={styles.vignette} />

      <motion.div 
        variants={containerVars} 
        initial="hidden" 
        animate="show" 
        style={styles.gridContainer}
      >
        {/* Row 1: Status & Welcome */}
        <motion.div variants={itemVars} style={{ ...styles.box, gridColumn: '1 / span 2' }}>
          <div style={styles.badge}>SYSTEM STATUS: OPERATIONAL</div>
          <h1 style={styles.title}>HAPPY NEW YEAR</h1>
          <p style={styles.subtitle}>Welcome to the next chapter of excellence.</p>
        </motion.div>

        {/* Big Year Box */}
        <motion.div variants={itemVars} style={{ ...styles.box, justifyContent: 'center', alignItems: 'center' }}>
          <div style={styles.yearRow}>
            <span style={styles.yearDigit}>20</span>
            <span style={styles.yearDigitGold}>26</span>
          </div>
        </motion.div>

        {/* Row 2: Stats & Quotes */}
        <motion.div variants={itemVars} style={styles.box}>
          <div style={styles.statLabel}>UPTIME</div>
          <div style={styles.statValue}>365 DAYS</div>
          <div style={styles.statSub}>Remaining possibilities: ∞</div>
        </motion.div>

        <motion.div variants={itemVars} style={{ ...styles.box, gridColumn: '2 / span 2', position: 'relative' }}>
          <div style={styles.quoteIcon}>“</div>
          <p style={styles.quoteText}>
            The future belongs to those who believe in the beauty of their dreams.
          </p>
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: '100%' }} 
            transition={{ duration: 10, repeat: Infinity }}
            style={styles.loadingLine} 
          />
        </motion.div>

        {/* Row 3: CTA Footer */}
        <motion.div 
          variants={itemVars} 
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          style={{ ...styles.box, gridColumn: '1 / span 3', flexDirection: 'row', justifyContent: 'space-between', cursor: 'pointer' }}
        >
          <div style={styles.footerText}>INITIALIZE DESTINY_2026</div>
          <div style={styles.pulseContainer}>
            <div style={styles.pulseDot} />
            <span style={styles.onlineText}>CORE ONLINE</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Decorative UI elements */}
      <div style={styles.uiTopLeft}>LN-2026 / GLOBAL</div>
      <div style={styles.uiBottomRight}>© DESIGNED BY AI_VISION</div>
    </div>
  );
}

// --- 3. MAIN APP ---

export default function App() {
  const [scene, setScene] = useState('countdown');
  const [flash, setFlash] = useState(0);
  const soundRef = useRef();

  const handleLaunch = () => {
    setFlash(1);
    setTimeout(() => {
      setScene('celebration');
      if (soundRef.current) {
        soundRef.current.play().catch(() => {});
      }
      // Fade out flash
      let val = 1;
      const interval = setInterval(() => {
        val -= 0.05;
        setFlash(val);
        if (val <= 0) { setFlash(0); clearInterval(interval); }
      }, 30);
    }, 800);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* Flash Layer */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: flash, zIndex: 9999, pointerEvents: 'none' }} />

      {scene === 'countdown' ? (
        <Canvas camera={{ position: [0, 5, 35], fov: 45 }}>
          <color attach="background" args={['#020205']} />
          <Suspense fallback={null}>
            <InteractiveDust />
            <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
            <Environment preset="city" />
            <CountdownDisplay onFinishTransition={handleLaunch} />
            <PositionalAudio url="/happy-new-year-2026/sounds/lofi.mp3" distance={50} loop />
          </Suspense>
          <OrbitControls enablePan={false} maxDistance={60} minDistance={15} />
          <EffectComposer>
            <Bloom intensity={1.5} luminanceThreshold={0.1} mipmapBlur />
          </EffectComposer>
        </Canvas>
      ) : (
        <>
          <CelebrationBento />
          <audio ref={soundRef} src="/happy-new-year-2026/sounds/celebration.mp3" loop />
        </>
      )}
    </div>
  );
}

// --- 4. STYLES (FIGMA DESIGN SYSTEM) ---

const styles = {
  bentoWrapper: {
    width: '100%', height: '100%', background: '#050505', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter", sans-serif',
    color: 'white', position: 'relative', overflow: 'hidden'
  },
  aurora: {
    position: 'absolute', inset: -100, zIndex: 1,
    background: 'radial-gradient(circle at 20% 20%, #1a1a40 0%, transparent 40%), radial-gradient(circle at 80% 80%, #2e1030 0%, transparent 40%)',
    filter: 'blur(80px)', opacity: 0.6
  },
  vignette: {
    position: 'absolute', inset: 0, zIndex: 2,
    background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.8) 120%)'
  },
  gridContainer: {
    position: 'relative', zIndex: 10, display: 'grid',
    gridTemplateColumns: 'repeat(3, 300px)', gridTemplateRows: 'repeat(3, auto)',
    gap: '20px', padding: '40px'
  },
  box: {
    background: 'rgba(255, 255, 255, 0.04)', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(30px)', padding: '35px', display: 'flex', flexDirection: 'column', gap: '15px'
  },
  badge: { fontSize: '10px', letterSpacing: '3px', color: '#00ccff', fontWeight: 700 },
  title: { fontSize: '42px', fontWeight: 900, margin: 0, letterSpacing: '-1.5px' },
  subtitle: { fontSize: '16px', color: 'rgba(255,255,255,0.5)', margin: 0 },
  yearRow: { display: 'flex', fontSize: '72px', fontWeight: 900 },
  yearDigit: { color: 'white' },
  yearDigitGold: { color: '#BF953F', backgroundImage: 'linear-gradient(to bottom, #FCF6BA, #BF953F)', WebkitBackgroundClip: 'text' },
  statLabel: { fontSize: '12px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' },
  statValue: { fontSize: '32px', fontWeight: 800 },
  statSub: { fontSize: '11px', color: '#00ffaa' },
  quoteIcon: { fontSize: '50px', color: '#00ccff', lineHeight: 1, marginBottom: '-20px' },
  quoteText: { fontSize: '18px', fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 },
  loadingLine: { position: 'absolute', bottom: 0, left: 0, height: '3px', background: '#00ccff' },
  footerText: { fontSize: '14px', fontWeight: 600, letterSpacing: '2px' },
  pulseContainer: { display: 'flex', alignItems: 'center', gap: '10px' },
  pulseDot: { width: '8px', height: '8px', background: '#00ff88', borderRadius: '50%', boxShadow: '0 0 10px #00ff88' },
  onlineText: { fontSize: '10px', fontWeight: 800, color: '#00ff88' },
  uiTopLeft: { position: 'absolute', top: '30px', left: '30px', fontSize: '12px', opacity: 0.3, letterSpacing: '4px' },
  uiBottomRight: { position: 'absolute', bottom: '30px', right: '30px', fontSize: '12px', opacity: 0.3 }
};