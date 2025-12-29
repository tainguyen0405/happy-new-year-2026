import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { motion, AnimatePresence } from 'framer-motion' // npm install framer-motion
import * as THREE from 'three'

const isTesting = true; // Bật true để test 15 giây

// --- 1. UTILS & 3D COMPONENTS (GIỮ NGUYÊN TỪ CODE GỐC) ---

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

function InteractiveDust({ count = 6000 }) {
  const mesh = useRef(); const { raycaster, camera } = useThree(); const shockwaveRef = useRef(0)
  const starTexture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d'); const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'white'); gradient.addColorStop(1, 'transparent'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(canvas)
  }, [])
  useEffect(() => {
    const h = () => { shockwaveRef.current = 2.0 }; window.addEventListener('pointerdown', h); return () => window.removeEventListener('pointerdown', h)
  }, [])
  const [pos, col, orig, vel] = useMemo(() => {
    const p = new Float32Array(count * 3), c = new Float32Array(count * 3), o = new Float32Array(count * 3), v = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 250, y = (Math.random() - 0.5) * 250, z = (Math.random() - 0.5) * 250
      p.set([x, y, z], i * 3); o.set([x, y, z], i * 3)
      const color = new THREE.Color().setHSL(Math.random() * 0.1 + 0.6, 0.9, 0.8); c.set([color.r, color.g, color.b], i * 3)
    }
    return [p, c, o, v]
  }, [count])
  useFrame((state) => {
    if (!mesh.current) return; shockwaveRef.current *= 0.92; raycaster.setFromCamera(state.mouse, camera)
    const positions = mesh.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3; const pV = new THREE.Vector3(positions[i3], positions[i3+1], positions[i3+2]); const cp = new THREE.Vector3(); raycaster.ray.closestPointToPoint(pV, cp)
      const d = pV.distanceTo(cp); const r = 30 + (shockwaveRef.current * 40)
      if (d < r) {
        const f = (r - d) / r; const fd = new THREE.Vector3().copy(pV).sub(cp).normalize()
        vel[i3] += fd.x * f * (2 + shockwaveRef.current * 15); vel[i3+1] += fd.y * f * (2 + shockwaveRef.current * 15); vel[i3+2] += fd.z * f * (2 + shockwaveRef.current * 15)
      }
      vel[i3] += (orig[i3] - positions[i3]) * 0.015; vel[i3] *= 0.92; positions[i3] += vel[i3]
      vel[i3+1] += (orig[i3+1] - positions[i3+1]) * 0.015; vel[i3+1] *= 0.92; positions[i3+1] += vel[i3+1]
      vel[i3+2] += (orig[i3+2] - positions[i3+2]) * 0.015; vel[i3+2] *= 0.92; positions[i3+2] += vel[i3+2]
    }
    mesh.current.geometry.attributes.position.needsUpdate = true
  })
  return (<points ref={mesh}><bufferGeometry><bufferAttribute attach="attributes-position" count={pos.length/3} array={pos} itemSize={3} /><bufferAttribute attach="attributes-color" count={col.length/3} array={col} itemSize={3} /></bufferGeometry><pointsMaterial size={0.8} vertexColors transparent map={starTexture} blending={THREE.AdditiveBlending} depthWrite={false} /></points>)
}

function RainbowMaterial() {
  const matRef = useRef()
  useFrame((state) => { 
    if (matRef.current) { 
      const hue = (state.clock.getElapsedTime() * 0.1) % 1
      matRef.current.color.setHSL(hue, 1, 0.5); matRef.current.emissive.setHSL(hue, 1, 0.2)
    } 
  })
  return <meshPhysicalMaterial ref={matRef} metalness={1} roughness={0.1} emissiveIntensity={0.5} />
}

function ArcText({ text, radius = 15, startAngle = Math.PI * 0.7, endAngle = Math.PI * 0.3, fontSize = 0.8, textHeight = 0.3, verticalOffset = 0 }) {
  const fontUrl = '/happy-new-year-2026/fonts/Orbitron_Regular.json'
  const characters = text.split('')
  const totalAngle = startAngle - endAngle
  const angleStep = totalAngle / (characters.length - 1)
  return (
    <group position={[0, verticalOffset, 0]}>
      {characters.map((char, i) => {
        const angle = startAngle - (angleStep * i)
        const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius
        return (
          <group key={i} position={[x, y, 0]} rotation={[0, 0, angle - Math.PI / 2]}>
            <Center><Text3D font={fontUrl} size={fontSize} height={textHeight} bevelEnabled curveSegments={8}>{char}<RainbowMaterial /></Text3D></Center>
          </group>
        )
      })}
    </group>
  )
}

function CountdownDisplay({ onFinishTransition }) {
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0, total: 999 })
  const fontUrl = '/happy-new-year-2026/fonts/Orbitron_Regular.json'
  useEffect(() => {
    const targetTime = isTesting ? new Date().getTime() + 15000 : new Date("Jan 1, 2026 00:00:00").getTime();
    const timer = setInterval(() => {
      const dist = targetTime - new Date().getTime()
      if (dist <= 0) { setTimeLeft({ total: 0 }); clearInterval(timer); return; }
      setTimeLeft({ 
        d: Math.floor(dist/86400000), h: Math.floor((dist%86400000)/3600000), 
        m: Math.floor((dist%3600000)/60000), s: Math.floor((dist%60000)/1000), 
        total: Math.floor(dist/1000) 
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  if (timeLeft.total <= 0) return <MechanicalButton onActivate={onFinishTransition} />
  return (
    <group>
      {timeLeft.total <= 10 ? (
        <Center><Text3D font={fontUrl} size={8} height={2.5} bevelEnabled>{timeLeft.total}<meshPhysicalMaterial metalness={1} roughness={0.1} color="white" /></Text3D></Center>
      ) : (
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.4}>
          <group>
            <ArcText text="COUNTDOWN 2026" radius={15} startAngle={Math.PI * 0.7} endAngle={Math.PI * 0.3} fontSize={0.8} textHeight={0.3} verticalOffset={-3} />
            <Center top position={[-0.5, 2, 0]}><Text3D font={fontUrl} size={5} height={1.5} bevelEnabled>{timeLeft.d}<RainbowMaterial /></Text3D></Center>
            <Center position={[-0.2, -1, 0]}><Text3D font={fontUrl} size={1} height={0.5}>DAYS TO 2026<meshStandardMaterial color="#888" /></Text3D></Center>
            <Center bottom position={[-1.5, -4, 0]}><Text3D font={fontUrl} size={1.2} height={0.4}>{`${timeLeft.h}h  ${timeLeft.m}m  ${timeLeft.s}s`}<RainbowMaterial /></Text3D></Center>
          </group>
        </Float>
      )}
    </group>
  )
}

function MechanicalButton({ onActivate }) {
  const [hovered, setHover] = useState(false); const [pressed, setPressed] = useState(false)
  const outerGroupRef = useRef(); const buttonCoreRef = useRef()
  useFrame((state) => {
    if (outerGroupRef.current) outerGroupRef.current.lookAt(state.camera.position)
    if (buttonCoreRef.current) { buttonCoreRef.current.position.z = THREE.MathUtils.lerp(buttonCoreRef.current.position.z, pressed ? -0.8 : 0, 0.4) }
  })
  return (
    <group ref={outerGroupRef}>
      <Cylinder args={[3, 3.2, 0.5, 64]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.4]}><meshStandardMaterial color="#050505" metalness={1} roughness={0.2} /></Cylinder>
      <group onPointerOver={() => setHover(true)} onPointerOut={() => (setHover(false), setPressed(false))} onPointerDown={() => { setPressed(true); playCustomClick(); }} onPointerUp={() => { setPressed(false); onActivate() }} ref={buttonCoreRef}>
        <Cylinder args={[2, 2.1, 0.8, 64]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color={hovered ? "#ff0033" : "#220000"} metalness={1} emissive="#ff0000" emissiveIntensity={hovered ? 1.2 : 0.1} />
        </Cylinder>
      </group>
      <Center position={[0, -4.8, 0]}><Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={0.5} height={0.1}>LAUNCH 2026<meshStandardMaterial color="white" /></Text3D></Center>
    </group>
  )
}

// --- 2. NEW 2D CELEBRATION (FIGMA BENTO STYLE) ---

const bentoVars = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.4 } }
};

const itemVars = {
  hidden: { y: 40, opacity: 0, scale: 0.9, filter: 'blur(10px)' },
  show: { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 100, damping: 20 } }
};

function CelebrationBento() {
  return (
    <div style={styles.bentoWrapper}>
      <div style={styles.auroraBg} />
      <motion.div variants={bentoVars} initial="hidden" animate="show" style={styles.gridContainer}>
        
        {/* Box Tiêu đề chính */}
        <motion.div variants={itemVars} style={{ ...styles.box, gridColumn: '1 / span 2' }}>
          <div style={styles.badge}>SYSTEM STATUS: INITIALIZED</div>
          <h1 style={styles.mainTitle}>HAPPY NEW YEAR</h1>
          <p style={styles.tagLine}>Elevating your journey to the next dimension.</p>
        </motion.div>

        {/* Box Số Năm */}
        <motion.div variants={itemVars} style={{ ...styles.box, alignItems: 'center', justifyContent: 'center' }}>
          <div style={styles.yearRow}>
            <span style={styles.yearWhite}>20</span>
            <span style={styles.yearGold}>26</span>
          </div>
        </motion.div>

        {/* Box Quotes */}
        <motion.div variants={itemVars} style={{ ...styles.box, background: 'rgba(255,255,255,0.03)' }}>
          <div style={styles.quoteIcon}>“</div>
          <p style={styles.quoteText}>The best way to predict the future is to create it.</p>
          <div style={styles.loadingBar}><motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 5, repeat: Infinity }} style={styles.loadingFill} /></div>
        </motion.div>

        {/* Box Footer / CTA */}
        <motion.div variants={itemVars} whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }} style={{ ...styles.box, gridColumn: '1 / span 3', flexDirection: 'row', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={styles.footerText}>INITIALIZE_DESTINY_2026.EXE</div>
          <div style={styles.pulseContainer}>
            <div style={styles.pulseDot} />
            <span style={styles.onlineText}>CORE ONLINE</span>
          </div>
        </motion.div>

      </motion.div>
      <div style={styles.uiCorner}>LN-2026 / VER 1.0.4</div>
    </div>
  );
}

// --- 3. MAIN APP ---

export default function App() {
  const [scene, setScene] = useState('countdown');
  const [flash, setFlash] = useState(0);
  const soundRef = useRef()

  const handleLaunch = () => {
    setFlash(1)
    setTimeout(() => {
      setScene('celebration')
      if (soundRef.current) soundRef.current.play().catch(() => {})
      let val = 1
      const fade = setInterval(() => {
        val -= 0.05; setFlash(val)
        if (val <= 0) { setFlash(0); clearInterval(fade); }
      }, 30)
    }, 600)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <AnimatePresence>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: flash, zIndex: 9999, pointerEvents: 'none' }} />
      </AnimatePresence>

      {scene === 'countdown' ? (
        <Canvas camera={{ position: [0, 8, 35], fov: 50 }}>
          <color attach="background" args={['#0a0a1a']} />
          <Suspense fallback={null}>
            <InteractiveDust />
            <Stars radius={250} count={3000} factor={4} fade speed={1} />
            <Environment preset="city" />
            <CountdownDisplay onFinishTransition={handleLaunch} />
            <PositionalAudio url="/happy-new-year-2026/sounds/lofi.mp3" distance={30} loop />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={20} maxDistance={100} />
          <EffectComposer><Bloom luminanceThreshold={0.1} intensity={2.0} mipmapBlur /></EffectComposer>
        </Canvas>
      ) : (
        <>
          <CelebrationBento />
          <audio ref={soundRef} src="/happy-new-year-2026/sounds/celebration.mp3" loop />
        </>
      )}
    </div>
  )
}

// --- 4. FIGMA BENTO STYLES ---

const styles = {
  bentoWrapper: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: '#050505', color: 'white', overflow: 'hidden' },
  auroraBg: { position: 'absolute', inset: -100, background: 'radial-gradient(circle at 20% 30%, #1a1a2e 0%, transparent 50%), radial-gradient(circle at 80% 70%, #0f0f1a 0%, transparent 50%)', opacity: 0.6, filter: 'blur(100px)' },
  gridContainer: { position: 'relative', zIndex: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 300px)', gap: '20px', padding: '20px' },
  box: { background: 'rgba(255, 255, 255, 0.04)', borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(40px)', padding: '35px', display: 'flex', flexDirection: 'column', gap: '15px' },
  badge: { fontSize: '10px', letterSpacing: '3px', color: '#00ccff', fontWeight: 800 },
  mainTitle: { fontSize: '42px', fontWeight: 900, margin: 0, letterSpacing: '-1.5px' },
  tagLine: { fontSize: '16px', color: 'rgba(255,255,255,0.5)', margin: 0 },
  yearRow: { display: 'flex', fontSize: '72px', fontWeight: 900 },
  yearWhite: { color: 'white' },
  yearGold: { color: '#BF953F', backgroundImage: 'linear-gradient(to bottom, #FCF6BA, #BF953F)', WebkitBackgroundClip: 'text' },
  quoteIcon: { fontSize: '40px', color: '#00ccff', marginBottom: '-15px' },
  quoteText: { fontSize: '15px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontStyle: 'italic' },
  loadingBar: { height: '2px', width: '100%', background: 'rgba(255,255,255,0.1)', marginTop: '10px' },
  loadingFill: { height: '100%', background: '#00ccff' },
  footerText: { fontSize: '13px', fontWeight: 600, letterSpacing: '2px', opacity: 0.8 },
  pulseContainer: { display: 'flex', alignItems: 'center', gap: '10px' },
  pulseDot: { width: '8px', height: '8px', background: '#00ff88', borderRadius: '50%', boxShadow: '0 0 12px #00ff88' },
  onlineText: { fontSize: '10px', fontWeight: 800, color: '#00ff88' },
  uiCorner: { position: 'absolute', bottom: '40px', left: '40px', fontSize: '11px', opacity: 0.3, letterSpacing: '2px' }
};