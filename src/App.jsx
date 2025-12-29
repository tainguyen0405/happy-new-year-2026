import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing' 
import * as THREE from 'three'

// --- IMPORT COMPONENT ÂM THANH CỦA BẠN (GIỮ NGUYÊN) ---
import CinematicVolume from './CinematicVolume'
import CinematicPlayButton from './CinematicPlayButton'
import CircularAudioVisualizer from './CircularAudioVisualizer'
import MusicToggleButton from './MusicToggleButton'

// --- GLOBAL SETTINGS (TỪ CODE 1) ---
const isTesting = true; // Set false nếu muốn chạy đúng ngày 1/1/2026

// --- 1. UTILS ---
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

// --- 2. 3D COMPONENTS ---

// Hiệu ứng bụi không gian + Warp Speed (GIỮ CỦA CODE 2 ĐỂ CÓ HIỆU ỨNG BAY)
function InteractiveDust({ count = 6000, isLaunching }) {
  const mesh = useRef(); const { raycaster, camera } = useThree(); const shockwaveRef = useRef(0)
  const starTexture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d'); const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'white'); gradient.addColorStop(1, 'transparent'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(canvas)
  }, [])

  const [pos, col, orig, vel] = useMemo(() => {
    const p = new Float32Array(count * 3), c = new Float32Array(count * 3), o = new Float32Array(count * 3), v = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 300, y = (Math.random() - 0.5) * 300, z = (Math.random() - 0.5) * 300
      p.set([x, y, z], i * 3); o.set([x, y, z], i * 3)
      const color = new THREE.Color().setHSL(Math.random() * 0.1 + 0.6, 0.9, 0.8); c.set([color.r, color.g, color.b], i * 3)
    }
    return [p, c, o, v]
  }, [count])

  useFrame((state) => {
    if (!mesh.current) return
    shockwaveRef.current *= 0.92; raycaster.setFromCamera(state.mouse, camera)
    const positions = mesh.current.geometry.attributes.position.array;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      if (isLaunching) {
        // Warp Speed Logic (Code 2)
        vel[i3 + 2] += 2.0; 
        positions[i3 + 2] += vel[i3 + 2];
        if (positions[i3 + 2] > 50) { positions[i3 + 2] = -200; vel[i3 + 2] = 0; }
      } else {
        const pV = new THREE.Vector3(positions[i3], positions[i3+1], positions[i3+2])
        const cp = new THREE.Vector3(); raycaster.ray.closestPointToPoint(pV, cp)
        const d = pV.distanceTo(cp); const r = 30 + (shockwaveRef.current * 40)
        if (d < r) {
            const f = (r - d) / r; const fd = new THREE.Vector3().copy(pV).sub(cp).normalize()
            vel[i3] += fd.x * f * 2; vel[i3+1] += fd.y * f * 2; vel[i3+2] += fd.z * f * 2
        }
        vel[i3] += (orig[i3] - positions[i3]) * 0.015; vel[i3] *= 0.92; positions[i3] += vel[i3]
        vel[i3+1] += (orig[i3+1] - positions[i3+1]) * 0.015; vel[i3+1] *= 0.92; positions[i3+1] += vel[i3+1]
        vel[i3+2] += (orig[i3+2] - positions[i3+2]) * 0.015; vel[i3+2] *= 0.92; positions[i3+2] += vel[i3+2]
      }
    }
    mesh.current.geometry.attributes.position.needsUpdate = true
  })
  return (<points ref={mesh}><bufferGeometry><bufferAttribute attach="attributes-position" count={pos.length/3} array={pos} itemSize={3} /><bufferAttribute attach="attributes-color" count={col.length/3} array={col} itemSize={3} /></bufferGeometry><pointsMaterial size={isLaunching ? 2.0 : 0.8} vertexColors transparent map={starTexture} blending={THREE.AdditiveBlending} depthWrite={false} /></points>)
}

// --- LOGIC COUNTDOWN & DISPLAY (LẤY TỪ CODE 1) ---

function RainbowMaterial() {
    const matRef = useRef()
    useFrame((state) => { if (matRef.current) { const hue = (state.clock.getElapsedTime() * 0.1) % 1; matRef.current.color.setHSL(hue, 1, 0.5); matRef.current.emissive.setHSL(hue, 1, 0.2); } })
    return <meshPhysicalMaterial ref={matRef} metalness={1} roughness={0.1} emissiveIntensity={0.5} />
}

function ArcText({ 
  text, 
  radius = 15,
  startAngle = Math.PI * 0.7,
  endAngle = Math.PI * 0.3,
  fontSize = 0.8,
  textHeight = 0.3,
  verticalOffset = 0
}) {
  const fontUrl = '/happy-new-year-2026/fonts/Orbitron_Regular.json'
  const characters = text.split('')
  const totalAngle = startAngle - endAngle
  const angleStep = totalAngle / (characters.length - 1)
  
  return (
    <group position={[0, verticalOffset, 0]}>
      {characters.map((char, i) => {
        const angle = startAngle - (angleStep * i)
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        
        return (
          <group key={i} position={[x, y, 0]} rotation={[0, 0, angle - Math.PI / 2]}>
            <Center>
              <Text3D font={fontUrl} size={fontSize} height={textHeight} bevelEnabled curveSegments={8}>
                {char}
                <RainbowMaterial />
              </Text3D>
            </Center>
          </group>
        )
      })}
    </group>
  )
}

function CountdownDisplay({ onFinishTransition }) {
    const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0, total: 999 })
    const fontUrl = '/happy-new-year-2026/fonts/Orbitron_Regular.json'
    
    // Logic đếm ngược từ Code 1
    useEffect(() => {
      const targetTime = isTesting ? new Date().getTime() + 15000 : new Date("Jan 1, 2026 00:00:00").getTime();
      const timer = setInterval(() => {
        const dist = targetTime - new Date().getTime()
        if (dist <= 0) { setTimeLeft({ total: 0 }); clearInterval(timer); return; }
        setTimeLeft({ d: Math.floor(dist/86400000), h: Math.floor((dist%86400000)/3600000), m: Math.floor((dist%3600000)/60000), s: Math.floor((dist%60000)/1000), total: Math.floor(dist/1000) })
      }, 1000); return () => clearInterval(timer)
    }, [])

    if (timeLeft.total <= 0) return <MechanicalButton onActivate={onFinishTransition} />

    return (
      <group>
        {timeLeft.total <= 10 ? (
          <Center><Text3D font={fontUrl} size={8} height={2.5} bevelEnabled>{timeLeft.total}<meshPhysicalMaterial metalness={1} roughness={0.1} color="white" /></Text3D></Center>
        ) : (
          <Float speed={2} rotationIntensity={0.1} floatIntensity={0.4}>
              <group>
                  <ArcText 
                    text="COUNTDOWN 2026" 
                    radius={15}
                    startAngle={Math.PI * 0.7}
                    endAngle={Math.PI * 0.3}
                    fontSize={0.8}
                    textHeight={0.3}
                    verticalOffset={-3}
                  />

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
    if (buttonCoreRef.current) {
      const targetZ = pressed ? -0.8 : 0 
      buttonCoreRef.current.position.z = THREE.MathUtils.lerp(buttonCoreRef.current.position.z, targetZ, 0.4)
    }
  })
  return (
    <group ref={outerGroupRef}>
      <Cylinder args={[3, 3.2, 0.5, 64]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.4]}>
        <meshStandardMaterial color="#050505" metalness={1} roughness={0.2} />
      </Cylinder>
      <group onPointerOver={() => setHover(true)} onPointerOut={() => (setHover(false), setPressed(false))}
        onPointerDown={() => { setPressed(true); playCustomClick(); }} 
        onPointerUp={() => { setPressed(false); onActivate() }} ref={buttonCoreRef}>
        <Cylinder args={[2, 2.1, 0.8, 64]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color={hovered ? "#ff0033" : "#220000"} metalness={1} emissive="#ff0000" emissiveIntensity={hovered ? 1.2 : 0.1}/>
        </Cylinder>
      </group>
      <Center position={[0, -4.8, 0]}><Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={0.5} height={0.1}>LAUNCH 2026<meshStandardMaterial color="white" /></Text3D></Center>
    </group>
  )
}

// Helper Camera Rig (Code 2)
function CameraRig({ isLaunching }) {
    useFrame((state) => {
        if (isLaunching) {
            state.camera.position.x += (Math.random() - 0.5) * 0.2
            state.camera.position.y += (Math.random() - 0.5) * 0.2
        } else {
            const t = state.clock.getElapsedTime()
            state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, 8 + Math.sin(t / 2), 0.1)
        }
    })
    return null
}

// --- 3. 2D CINEMATIC & MINI GAMES (GIỮ NGUYÊN CỦA CODE 2) ---

// 3.0 Icon & Golden Title
const HorseIcon = ({ color = "#ffd700" }) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
    <path fill={color} d="M78.5,32.6c-2.3-4.8-6.1-8.5-9.9-10.9c-2.9-1.8-8.6-3.8-12.8-2.6c-2.6,0.7-3.9,2.8-4.2,3.3c-0.4,0.6-0.8,1.3-1.2,2c-0.8,1.4-1.6,2.9-2.7,4.1c-1.3,1.4-2.8,2.3-4.6,2.8c-1.5,0.4-3.1,0.2-4.6-0.6c-1.2-0.6-2.2-1.6-3-2.8c-0.6-0.9-1-1.9-1.2-3c-0.1-0.5-0.1-1.1,0-1.6c0.3-1.7,1.6-3.1,3.1-3.9c0.8-0.4,1.7-0.6,2.6-0.6c0.9,0,1.8,0.2,2.6,0.6c1.3,0.7,2.2,2,2.4,3.5c0.1,0.6,0,1.2-0.2,1.8c-0.4,1.1-1.3,1.9-2.4,2.3c-0.9,0.3-1.9,0.2-2.8-0.3c-0.7-0.4-1.2-1-1.4-1.8c-0.1-0.4-0.1-0.8,0.1-1.2c0.3-0.8,1-1.3,1.8-1.4c0.6-0.1,1.2,0.1,1.7,0.5c0.3,0.3,0.5,0.7,0.6,1.1c0,0.1,0,0.2,0,0.3c-0.1,0.3-0.3,0.5-0.6,0.6c-0.2,0.1-0.4,0.1-0.6,0c-0.2-0.1-0.3-0.3-0.3-0.5c0-0.1,0-0.2,0.1-0.3c0.1-0.1,0.2-0.2,0.3-0.2c0.1,0,0.2,0,0.3,0.1c0.4,0.2,0.5,0.7,0.3,1.1c-0.3,0.5-0.9,0.6-1.4,0.4c-0.4-0.2-0.6-0.6-0.6-1c0-0.3,0.1-0.6,0.3-0.8c0.4-0.4,1-0.4,1.4-0.1c0.3,0.2,0.4,0.6,0.3,0.9c-0.1,0.2-0.3,0.4-0.6,0.4c-0.2,0-0.4-0.1-0.4-0.3c-0.1-0.2,0-0.3,0.1-0.4c0.2-0.2,0.5-0.1,0.6,0.1c0.1,0.1,0.1,0.3,0,0.4C51,44.2,51,44.2,50.9,44.2c-0.1,0-0.2-0.1-0.2-0.2c0-0.1,0-0.2,0.1-0.2c0.1-0.1,0.2-0.1,0.3,0c1.7,1.8,2.7,4.6,1.4,7.3c-1,2.1-3.2,3.3-5.4,3.7c-2.8,0.5-5.6-0.4-7.8-2.1c-1.8-1.4-3.1-3.3-3.9-5.4c-0.6-1.6-0.9-3.2-0.8-4.9c0.1-1.4,0.4-2.7,1-4c0.9-1.8,2.2-3.3,3.8-4.5c2.4-1.8,5.4-2.5,8.3-2.1c2.3,0.3,4.4,1.4,6.1,2.9c1.4,1.2,2.4,2.8,3,4.5c0.5,1.4,0.6,2.9,0.3,4.4c-0.3,1.3-0.9,2.5-1.9,3.5c-1.6,1.7-4,2.5-6.3,2.2c-1.8-0.3-3.4-1.3-4.6-2.7c-0.9-1.1-1.5-2.5-1.7-3.9c-0.2-1.1,0-2.2,0.5-3.2c0.7-1.4,2-2.3,3.5-2.7c1.2-0.3,2.5-0.1,3.6,0.5c0.9,0.5,1.7,1.3,2.2,2.2c0.5,0.9,0.7,1.9,0.6,2.9c-0.1,0.8-0.4,1.6-0.9,2.3c-0.7,1-1.8,1.7-3,2c-1,0.2-2,0-2.9-0.5c-0.7-0.4-1.3-1-1.6-1.8c-0.3-0.6-0.3-1.3-0.2-1.9c0.2-0.9,0.8-1.6,1.6-2c0.7-0.3,1.4-0.3,2.1,0c0.6,0.2,1,0.7,1.2,1.3c0.1,0.4,0.1,0.9,0,1.3c-0.2,0.6-0.7,1-1.3,1.2c-0.5,0.2-1,0.1-1.4-0.2c-0.3-0.2-0.5-0.6-0.5-1c0-0.3,0.1-0.6,0.3-0.8c0.3-0.3,0.7-0.4,1.1-0.3c0.3,0.1,0.5,0.3,0.6,0.6c0.1,0.2,0,0.4-0.1,0.6c-0.2,0.2-0.4,0.3-0.7,0.2c-0.2,0-0.3-0.2-0.3-0.4c0-0.1,0.1-0.3,0.2-0.3c0.1-0.1,0.2,0,0.3,0.1C35.9,40.1,36,40.6,35.9,41c-0.2,0.5-0.7,0.8-1.2,0.7c-0.4-0.1-0.7-0.4-0.8-0.8c0-0.3,0.1-0.6,0.4-0.8c0.3-0.2,0.7-0.2,1,0c0.2,0.1,0.3,0.4,0.3,0.6c0,0.2-0.1,0.3-0.3,0.4c-0.1,0.1-0.3,0-0.3-0.1c-0.1-0.1-0.1-0.2,0-0.3c0.1-0.1,0.2-0.1,0.2,0c0.6,1,0.9,2.2,0.7,3.4c-0.2,1-0.7,1.9-1.4,2.6c-1.1,1.1-2.7,1.6-4.2,1.4c-1.2-0.2-2.3-0.8-3.1-1.7c-0.7-0.8-1.1-1.8-1.2-2.9c-0.1-0.9,0.1-1.8,0.5-2.6c0.6-1.1,1.6-1.9,2.7-2.3c1-0.3,2.1-0.2,3,0.3c0.8,0.4,1.5,1.1,1.8,1.9c0.3,0.7,0.3,1.5,0.1,2.3c-0.2,0.6-0.6,1.2-1.1,1.6c-0.6,0.4-1.3,0.6-2,0.5c-0.6-0.1-1.1-0.4-1.5-0.9c-0.3-0.4-0.4-0.9-0.3-1.4c0.1-0.6,0.4-1,0.9-1.3c0.4-0.2,0.9-0.2,1.3-0.1c0.4,0.1,0.7,0.4,0.9,0.8c0.1,0.3,0.1,0.6,0,0.9c-0.1,0.4-0.4,0.7-0.8,0.8c-0.3,0.1-0.6,0-0.9-0.2c-0.2-0.2-0.3-0.5-0.2-0.8c0-0.2,0.2-0.4,0.4-0.4c0.2,0,0.3,0.1,0.4,0.3c0,0.1,0,0.2-0.1,0.3c-0.1,0.1-0.2,0.1-0.2,0c-1.7,0.7-3.1,2.1-3.8,3.8c-0.6,1.4-0.5,3,0.3,4.4c0.9,1.6,2.5,2.7,4.3,3.1c1.8,0.4,3.7-0.1,5.2-1.2c1.4-1,2.4-2.6,2.7-4.4c0.2-1.4,0-2.8-0.7-4.1c-0.8-1.4-2.1-2.4-3.6-2.9c-1.4-0.5-3-0.3-4.3,0.4c-1.2,0.7-2.1,1.8-2.5,3.1c-0.3,1.1-0.2,2.3,0.4,3.3c0.7,1.2,1.9,2,3.3,2.2c1.1,0.2,2.3-0.2,3.2-1c0.8-0.7,1.3-1.8,1.3-2.9c0.1-0.9-0.2-1.9-0.8-2.6c-0.7-0.9-1.8-1.4-2.9-1.4c-1,0-1.9,0.4-2.6,1.1c-0.6,0.6-0.9,1.4-0.9,2.2c0,0.7,0.3,1.4,0.8,1.9c0.6,0.6,1.4,0.9,2.2,0.8c0.7-0.1,1.3-0.5,1.7-1.1c0.3-0.5,0.4-1.1,0.2-1.6c-0.1-0.5-0.5-0.9-1-1.1c-0.4-0.2-0.9-0.2-1.3,0c-0.4,0.2-0.6,0.6-0.7,1c-0.1,0.4,0,0.7,0.2,1c0.2,0.2,0.5,0.4,0.8,0.3c0.2-0.1,0.4-0.2,0.4-0.5c0.1-0.2,0-0.4-0.2-0.5c-0.2-0.1-0.3-0.1-0.4,0.1c-0.1,0.1-0.1,0.3,0,0.4L78.5,32.6z"/>
  </svg>
)

// TITLE STYLE 1: ROYAL GOLD
const GoldenTitle = ({ text }) => {
  return (
    <div style={{ position: 'relative', marginBottom: '30px', zIndex: 20 }}>
      <h1 className="golden-text" data-text={text}>{text}</h1>
      <style>{`
        .golden-text {
          font-family: "Orbitron", sans-serif; font-size: clamp(24px, 5vw, 60px); font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; margin: 0;
          background: linear-gradient(to bottom, #bf953f, #fcf6ba 20%, #b38728 40%, #fbf5b7 60%, #aa771c 80%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          filter: drop-shadow(0 2px 0px rgba(0,0,0,0.5)); position: relative;
          animation: textReveal 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        .golden-text::after {
          content: attr(data-text); position: absolute; left: 0; top: 0; width: 100%; height: 100%;
          background: linear-gradient(120deg, transparent 0%, transparent 40%, rgba(255, 255, 255, 0.8) 50%, transparent 60%, transparent 100%);
          background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: shineMove 4s linear infinite;
        }
        @keyframes shineMove { 0% { background-position: -200% center; } 20% { background-position: 200% center; } 100% { background-position: 200% center; } }
        @keyframes textReveal { from { opacity: 0; transform: translateY(20px) scale(0.9); letter-spacing: 0.5em; filter: blur(10px); } to { opacity: 1; transform: translateY(0) scale(1); letter-spacing: 0.2em; filter: blur(0); } }
      `}</style>
    </div>
  )
}

// 3.1 Visual Backgrounds
const FireworksCanvas = () => {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    let width = window.innerWidth; let height = window.innerHeight
    canvas.width = width; canvas.height = height
    const particles = []; const fireworks = []
    class Firework {
      constructor() { this.x = Math.random() * width; this.y = height; this.targetY = Math.random() * (height * 0.4); this.speed = 5 + Math.random() * 5; this.angle = -Math.PI / 2 + (Math.random() * 0.2 - 0.1); this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed; this.hue = Math.floor(Math.random() * 360); this.dead = false }
      update() { this.x += this.vx; this.y += this.vy; this.vy += 0.05; if (this.vy >= 0 || this.y <= this.targetY) { this.dead = true; explode(this.x, this.y, this.hue) } }
      draw() { ctx.fillStyle = `hsl(${this.hue}, 100%, 50%)`; ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill() }
    }
    class Particle {
      constructor(x, y, hue) { this.x = x; this.y = y; const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 4; this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed; this.hue = hue; this.alpha = 1; this.decay = Math.random() * 0.015 + 0.005; this.gravity = 0.05 }
      update() { this.x += this.vx; this.y += this.vy; this.vy += this.gravity; this.alpha -= this.decay }
      draw() { ctx.globalAlpha = this.alpha; ctx.fillStyle = `hsl(${this.hue}, 100%, 50%)`; ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1 }
    }
    function explode(x, y, hue) { for (let i = 0; i < 60; i++) { particles.push(new Particle(x, y, hue)) } }
    function loop() { ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(0, 0, width, height); ctx.globalCompositeOperation = 'lighter'; if (Math.random() < 0.05) fireworks.push(new Firework()); for (let i = fireworks.length - 1; i >= 0; i--) { fireworks[i].update(); fireworks[i].draw(); if (fireworks[i].dead) fireworks.splice(i, 1) }; for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); particles[i].draw(); if (particles[i].alpha <= 0) particles.splice(i, 1) }; requestAnimationFrame(loop) }
    loop()
    const handleResize = () => { width = window.innerWidth; height = window.innerHeight; canvas.width = width; canvas.height = height }; window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize)
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }} />
}

const GoldenBokehBackground = () => (
  <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
     <style>{`
       .bokeh { position: absolute; border-radius: 50%; background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0) 70%); animation: floatBokeh linear infinite; }
       @keyframes floatBokeh { 0% { transform: translateY(100vh) scale(0.5); opacity: 0; } 20% { opacity: 0.5; } 80% { opacity: 0.5; } 100% { transform: translateY(-20vh) scale(1.2); opacity: 0; } }
     `}</style>
     {[...Array(15)].map((_, i) => (
       <div key={i} className="bokeh" style={{ left: `${Math.random() * 100}%`, width: `${Math.random() * 100 + 50}px`, height: `${Math.random() * 100 + 50}px`, animationDuration: `${Math.random() * 10 + 10}s`, animationDelay: `${Math.random() * 10}s` }} />
     ))}
  </div>
)

const SparklerEffect = () => {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); let width = window.innerWidth; let height = window.innerHeight; canvas.width = width; canvas.height = height
    let particles = []; let mouse = { x: -100, y: -100, isMoving: false }; let lastPos = { x: -100, y: -100 }
    const handleMove = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX; const y = e.touches ? e.touches[0].clientY : e.clientY; mouse.x = x; mouse.y = y; mouse.isMoving = true
      const dist = Math.hypot(x - lastPos.x, y - lastPos.y); const count = Math.min(dist / 2, 5)
      for(let i = 0; i < count; i++) { const lerpX = lastPos.x + (x - lastPos.x) * (i/count); const lerpY = lastPos.y + (y - lastPos.y) * (i/count); createParticles(lerpX, lerpY, 2) }
      lastPos = { x, y }; clearTimeout(timeout); timeout = setTimeout(() => { mouse.isMoving = false }, 100)
    }
    let timeout; window.addEventListener('mousemove', handleMove); window.addEventListener('touchmove', handleMove)
    class Spark {
      constructor(x, y) { this.x = x; this.y = y; const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 2 + 0.5; this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed; this.life = Math.random() * 30 + 10; this.decay = Math.random() * 0.5 + 0.5; this.color = `hsl(${Math.random() * 40 + 30}, 100%, 70%)`; this.gravity = 0.1; this.size = Math.random() * 2 + 1 }
      update() { this.x += this.vx; this.y += this.vy; this.vy += this.gravity; this.life -= this.decay; this.size *= 0.95 }
      draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 10; ctx.shadowColor = this.color }
    }
    function createParticles(x, y, amount) { for (let i = 0; i < amount; i++) { particles.push(new Spark(x, y)) } }
    function loop() { ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; ctx.fillRect(0, 0, width, height); ctx.globalCompositeOperation = 'lighter'; if (mouse.isMoving || (mouse.x > 0 && Math.random() < 0.3)) { createParticles(mouse.x, mouse.y, 2) }; for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); particles[i].draw(); if (particles[i].life <= 0) { particles.splice(i, 1) } }; requestAnimationFrame(loop) }
    loop()
    const handleResize = () => { width = window.innerWidth; height = window.innerHeight; canvas.width = width; canvas.height = height }; window.addEventListener('resize', handleResize); return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('touchmove', handleMove); window.removeEventListener('resize', handleResize) }
  }, [])
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9999, pointerEvents: 'none', mixBlendMode: 'screen' }}>
        <canvas ref={canvasRef} />
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontStyle: 'italic', pointerEvents: 'none', animation: 'pulseText 2s infinite' }}>✨ Di chuột để vẽ pháo sáng</div>
        <style>{`@keyframes pulseText { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.6; } }`}</style>
    </div>
  )
}

// 3.2 Game Lì xì
const LuckyMoneyGame = () => {
  const [viewState, setViewState] = useState('idle'); const [selectedId, setSelectedId] = useState(null); const [reward, setReward] = useState(null)
  const envelopes = [1, 2, 3, 4]; const rewards = ["10.000 VNĐ", "20.000 VNĐ", "50.000 VNĐ", "100.000 VNĐ", "500.000 VNĐ", "1 Tờ vé số", "Một nụ cười", "Chuyến du lịch"]
  const handleSelect = (id) => { if (viewState !== 'idle') return; setSelectedId(id); setViewState('focus'); setTimeout(() => { const r = rewards[Math.floor(Math.random() * rewards.length)]; setReward(r); setViewState('revealed') }, 800) }
  const handleReset = () => { setViewState('idle'); setSelectedId(null); setReward(null) }
  return (
    <div style={{ width: '100%', height: '450px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', perspective: '1200px', marginTop: '20px' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 90, opacity: viewState === 'idle' ? 0 : 1, pointerEvents: viewState === 'idle' ? 'none' : 'auto', transition: 'opacity 0.5s ease', backdropFilter: 'blur(5px)' }} onClick={viewState === 'revealed' ? handleReset : undefined} />
      <div style={{ display: 'flex', gap: '20px', zIndex: 100, justifyContent: 'center', alignItems: 'center' }}>
        {envelopes.map((id) => {
          const isSelected = selectedId === id; const isHidden = selectedId !== null && !isSelected
          return (
            <div key={id} onClick={() => handleSelect(id)} className="envelope-wrapper" style={{
                width: '100px', height: '160px', position: isSelected && viewState !== 'idle' ? 'fixed' : 'relative',
                top: isSelected && viewState !== 'idle' ? '55%' : 'auto', left: isSelected && viewState !== 'idle' ? '50%' : 'auto',
                transform: isSelected && viewState !== 'idle' ? 'translate(-50%, -50%) scale(2.2)' : (isHidden ? 'scale(0)' : 'scale(1)'),
                opacity: isHidden ? 0 : 1, transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)', cursor: 'pointer', zIndex: isSelected ? 100 : 10, transformStyle: 'preserve-3d'
            }}>
              <div style={{ position: 'absolute', left: '6px', right: '6px', bottom: '5px', height: '85%', background: 'linear-gradient(to bottom, #fffdf0 30%, #ffffff 100%)', borderRadius: '6px', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '20px', boxShadow: '0 -2px 5px rgba(0,0,0,0.1)', transform: viewState === 'revealed' ? 'translateY(-110px)' : 'translateY(0)', transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1.2) 0.5s' }}>
                 <div style={{ opacity: viewState === 'revealed' ? 1 : 0, transition: 'opacity 0.3s ease 0.8s', textAlign: 'center', width: '100%' }}>
                    <div style={{ fontSize: '6px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Lộc Xuân 2026</div><div style={{ color: '#d60000', fontWeight: '900', fontSize: '11px', padding: '0 2px' }}>{reward}</div><div style={{ marginTop: '5px', fontSize: '14px' }}>💰</div>
                 </div>
              </div>
              <div style={{ position: 'absolute', inset: 0, background: '#d60000', borderRadius: '12px', border: '1px solid #ffd700', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '25px', boxShadow: isSelected ? '0 30px 60px rgba(0,0,0,0.5)' : '0 4px 8px rgba(0,0,0,0.2)', backgroundImage: 'radial-gradient(#ffcc00 1px, transparent 1px)', backgroundSize: '15px 15px' }}>
                <div style={{ position: 'absolute', top: '35%', left: '-10%', width: '120%', height: '60px', borderTop: '1px solid rgba(255, 215, 0, 0.4)', borderRadius: '50%', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div style={{ width: '40px', marginBottom: '5px' }}><HorseIcon color="#ffd700" /></div><div style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '14px', letterSpacing: '2px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>2026</div></div>
              </div>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '35%', zIndex: 3, transformOrigin: 'top', transition: 'transform 0.5s ease', transform: viewState === 'revealed' ? 'rotateX(180deg)' : 'rotateX(0deg)', perspective: '1000px', transformStyle: 'preserve-3d' }}>
                <div style={{ position: 'absolute', inset: 0, background: '#bd0000', borderRadius: '12px 12px 50% 50%', border: '1px solid #ffd700', borderTop: 'none', backfaceVisibility: 'hidden', zIndex: 2, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} /><div style={{ position: 'absolute', inset: 0, background: '#800000', borderRadius: '12px 12px 50% 50%', transform: 'rotateX(180deg)', backfaceVisibility: 'hidden', zIndex: 1 }} />
              </div>
            </div>
          )
        })}
      </div>
      {viewState === 'revealed' && (
        <button onClick={handleReset} style={{ position: 'fixed', bottom: '50px', zIndex: 200, padding: '12px 40px', background: 'linear-gradient(90deg, #FFD700, #FFA500)', border: '2px solid #fff', borderRadius: '50px', color: '#8b0000', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 0 20px rgba(255, 215, 0, 0.6)', cursor: 'pointer', animation: 'fadeInUp 0.5s ease 0.8s backwards', textTransform: 'uppercase' }}>Nhận lộc & Quay lại</button>
      )}
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .envelope-wrapper:hover { transform: translateY(-5px); }`}</style>
    </div>
  )
}

// 3.3 Game Gieo Quẻ
const FortuneSticksGame = () => {
  const [shaking, setShaking] = useState(false); const [result, setResult] = useState(null)
  const fortunes = ["Đại Cát - Vạn sự như ý", "Tình Duyên - Năm nay có gấu", "Sự Nghiệp - Thăng quan tiến chức", "Sức Khỏe - Dồi dào năng lượng", "Tài Lộc - Tiền vào như nước", "Bình An - Gia đạo êm ấm"]
  const handleShake = () => { if (shaking || result) return; setShaking(true); setTimeout(() => { setShaking(false); setResult(fortunes[Math.floor(Math.random() * fortunes.length)]) }, 2000) }
  const reset = () => setResult(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px', height: '400px', justifyContent: 'center' }}>
      {!result ? (
        <div onClick={handleShake} style={{ cursor: 'pointer', position: 'relative' }}>
          <div style={{ width: '120px', height: '200px', background: 'linear-gradient(90deg, #8B4513, #A0522D, #8B4513)', borderRadius: '10px', border: '4px solid #DEB887', position: 'relative', display: 'flex', justifyContent: 'center', overflow: 'hidden', animation: shaking ? 'shakeTube 0.5s infinite' : 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
             <div style={{ position: 'absolute', top: '20px', fontSize: '40px', color: '#DEB887', fontWeight: 'bold', border: '2px solid #DEB887', borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Lộc</div>
             <div style={{ position: 'absolute', top: '-20px', width: '10px', height: '100px', background: '#DEB887', left: '30px', transform: 'rotate(-10deg)' }}></div><div style={{ position: 'absolute', top: '-30px', width: '10px', height: '100px', background: '#DEB887', left: '55px' }}></div><div style={{ position: 'absolute', top: '-20px', width: '10px', height: '100px', background: '#DEB887', left: '80px', transform: 'rotate(10deg)' }}></div>
          </div>
          <div style={{ marginTop: '20px', color: '#fff', textAlign: 'center', animation: 'pulse 1.5s infinite' }}>{shaking ? "Đang lắc..." : "Chạm để gieo quẻ"}</div>
        </div>
      ) : (
        <div style={{ animation: 'popIn 0.5s ease' }}>
          <div style={{ width: '60px', height: '300px', background: '#DEB887', margin: '0 auto', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', boxShadow: '0 0 20px rgba(255,215,0,0.8)', border: '2px solid #8B4513' }}>
             <div style={{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: '18px', fontWeight: 'bold', color: '#8B0000', letterSpacing: '5px' }}>{result.split(" - ")[0]}</div>
          </div>
          <div style={{ color: '#ffd700', fontSize: '20px', fontWeight: 'bold', marginTop: '20px', textShadow: '0 2px 5px black' }}>{result.split(" - ")[1]}</div>
          <button onClick={reset} style={{ marginTop: '20px', padding: '10px 30px', borderRadius: '20px', border: 'none', background: '#d60000', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Gieo lại</button>
        </div>
      )}
      <style>{`@keyframes shakeTube { 0% { transform: rotate(0deg) translateY(0); } 25% { transform: rotate(5deg) translateY(-5px); } 75% { transform: rotate(-5deg) translateY(5px); } 100% { transform: rotate(0deg) translateY(0); } } @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } } @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  )
}

// 3.4 Thả Đèn Trời
const WishLanterns = () => {
  const [wish, setWish] = useState(''); const [lanterns, setLanterns] = useState([])
  const handleSendWish = (e) => { e.preventDefault(); if (!wish.trim()) return; const colors = ['linear-gradient(to bottom, #ff5500, #ffaa00)', 'linear-gradient(to bottom, #d60000, #ff5500)', 'linear-gradient(to bottom, #ff8c00, #ffd700)']; const randomColor = colors[Math.floor(Math.random() * colors.length)]; const newLantern = { id: Date.now(), text: wish, left: Math.random() * 80 + 10, speed: Math.random() * 5 + 15, bg: randomColor }; setLanterns([...lanterns, newLantern]); setWish('') }
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px', position: 'relative', zIndex: 100, paddingBottom: '100px' }}>
      <form onSubmit={handleSendWish} style={{ display: 'flex', gap: '10px', zIndex: 200, alignItems: 'center' }}>
        <input type="text" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Viết điều ước..." maxLength={50} style={{ padding: '12px 20px', borderRadius: '25px', border: '1px solid #ffd700', background: 'rgba(255,255,255,0.15)', color: '#fff', outline: 'none', backdropFilter: 'blur(5px)', width: '220px', fontSize: '16px' }} />
        <button type="submit" style={{ padding: '12px 20px', borderRadius: '50%', background: '#d60000', color: '#fff', border: '1px solid #ffcc00', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 0 10px #d60000', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>➤</button>
      </form>
      {lanterns.map((l) => (
        <div key={l.id} className="lantern" style={{ left: `${l.left}%`, animationDuration: `${l.speed}s` }}>
          <div className="lantern-body" style={{ background: l.bg }}><div className="lantern-text">{l.text}</div></div><div className="lantern-light"></div>
        </div>
      ))}
      <style>{`.lantern { position: fixed; bottom: -120px; display: flex; flex-direction: column; align-items: center; animation: flyUp linear forwards; z-index: 50; pointer-events: none; } .lantern-body { width: 70px; min-height: 90px; border-radius: 15px 15px 25px 25px; display: flex; align-items: center; justifyContent: center; box-shadow: 0 0 20px rgba(255, 165, 0, 0.6); position: relative; padding: 5px; border: 1px solid rgba(255,255,255,0.2); } .lantern-body::after { content: ''; position: absolute; bottom: 10px; width: 20px; height: 20px; background: #ffcc00; border-radius: 50%; filter: blur(8px); animation: flicker 0.5s infinite alternate; } .lantern-text { font-size: 11px; color: #3e0000; font-weight: 800; text-align: center; line-height: 1.3; word-wrap: break-word; width: 100%; z-index: 2; text-shadow: 0 1px 0 rgba(255,255,255,0.4); } @keyframes flyUp { 0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; } 100% { transform: translateY(-120vh) scale(0.4) rotate(10deg); opacity: 0; } } @keyframes flicker { 0% { opacity: 0.7; transform: scale(1); } 100% { opacity: 1; transform: scale(1.2); } }`}</style>
    </div>
  )
}

// 3.5 Scene Chính
function HappyNewYear2026Scene() {
  const [active, setActive] = useState(false); const [tab, setTab] = useState('money'); const [recipient, setRecipient] = useState('')
  useEffect(() => { const t = setTimeout(() => setActive(true), 100); const params = new URLSearchParams(window.location.search); const to = params.get('to'); if (to) setRecipient(to); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(circle at center, #1a0b0b 0%, #050505 100%)', overflow: 'hidden', fontFamily: '"Orbitron", sans-serif', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <FireworksCanvas />
      <div className="hide-scrollbar" style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '20px', width: '100%', maxWidth: '800px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        
        <div style={{ fontSize: 'clamp(60px, 15vw, 150px)', fontWeight: 900, lineHeight: 0.9, marginBottom: '10px', marginTop: '20px', background: 'linear-gradient(to bottom, #FFFFE0 0%, #FFD700 30%, #B8860B 60%, #8B4513 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5)) drop-shadow(0 0 30px rgba(255, 215, 0, 0.3))', opacity: active ? 1 : 0, transform: active ? 'scale(1) translateY(0)' : 'scale(1.5) translateY(50px)', transition: 'all 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}>2026</div>

        <GoldenTitle text={`HAPPY NEW YEAR ${recipient ? '- ' + recipient : ''}`} />

        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', opacity: active ? 1 : 0, transition: 'opacity 1s ease 0.6s' }}>
          <button onClick={() => setTab('money')} style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: tab === 'money' ? '#d60000' : 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: tab === 'money' ? '0 0 15px #d60000' : 'none', transition: 'all 0.3s' }}>Hái Lộc 🧧</button>
          <button onClick={() => setTab('fortune')} style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: tab === 'fortune' ? '#d60000' : 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: tab === 'fortune' ? '0 0 15px #d60000' : 'none', transition: 'all 0.3s' }}>Gieo Quẻ 🎋</button>
        </div>

        <div style={{ opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(40px)', transition: 'all 1s cubic-bezier(0.22, 1, 0.36, 1) 0.6s', width: '100%' }}>{tab === 'money' ? <LuckyMoneyGame /> : <FortuneSticksGame />}</div>
        <div style={{ opacity: active ? 1 : 0, transition: 'opacity 1s ease 1s', width: '100%' }}><WishLanterns /></div>
      </div>
      <SparklerEffect />
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  )
}

// --- 4. SCENE CONTENT WRAPPER ---
function SceneContent({ scene, handleLaunch, soundRef, isPlaying, setIsPlaying, isLaunching }) {
  const hasAutoPlayed = useRef(false)
  useEffect(() => {
    if (scene === 'celebration' && !hasAutoPlayed.current && soundRef.current) {
      setTimeout(() => { if (soundRef.current.play) { soundRef.current.play().catch(e => console.log("Audio play failed:", e)); } setIsPlaying(true); hasAutoPlayed.current = true }, 200)
    }
  }, [scene, soundRef, setIsPlaying])
  
  return (
    <>
      {scene === 'countdown' ? (
        <Suspense fallback={null}>
          <InteractiveDust count={6000} isLaunching={isLaunching} />
          {/* LOGIC COUNTDOWN CŨNG NHƯ VÒNG TRÒN AUDIO ĐƯỢC GIỮ LẠI CHO ĐẾN KHI PHÓNG */}
          {!isLaunching && (
             <>
               <CountdownDisplay onFinishTransition={handleLaunch} />
               <CircularAudioVisualizer soundRef={soundRef} radius={18} count={200} />
             </>
          )}
          <Stars radius={250} count={3000} factor={4} fade speed={isLaunching ? 20 : 1} />
          <ambientLight intensity={0.5} />
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/lofi.mp3" distance={30} loop />
        </Suspense>
      ) : null}
    </>
  )
}

// --- 5. APP COMPONENT ---
export default function App() {
  const soundRef = useRef(); const [scene, setScene] = useState('countdown'); const [flash, setFlash] = useState(0); const [isUiVisible, setUiVisible] = useState(true); const [isPlaying, setIsPlaying] = useState(false); const [volume, setVolume] = useState(0.5); const [isLaunching, setIsLaunching] = useState(false)
  
  const handleLaunch = () => {
    setUiVisible(false); setIsLaunching(true)
    setTimeout(() => { setFlash(1); setTimeout(() => { setScene('celebration'); setIsLaunching(false); const fade = setInterval(() => { setFlash(prev => { if (prev <= 0) { clearInterval(fade); return 0; } return prev - 0.05 }) }, 30) }, 600) }, 1500)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {isUiVisible && scene === 'countdown' && (
        <><CinematicVolume soundRef={soundRef} volume={volume} setVolume={setVolume} /><CinematicPlayButton soundRef={soundRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} /></>
      )}
      {scene === 'celebration' && (
        <MusicToggleButton soundRef={soundRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
      )}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: flash, zIndex: 999, pointerEvents: 'none' }} />
      {scene === 'countdown' ? (
        <Canvas camera={{ position: [0, 8, 35], fov: 50 }}>
          <color attach="background" args={['#0a0a1a']} />
          {!isLaunching && <fog attach="fog" args={['#0a0a1a', 30, 100]} />} 
          <Environment preset="city" />
          <SceneContent scene={scene} handleLaunch={handleLaunch} soundRef={soundRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} isLaunching={isLaunching} />
          <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.1} intensity={isLaunching ? 4.0 : 2.0} mipmapBlur />
            <Noise opacity={0.05} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[isLaunching ? 0.05 : 0.002, isLaunching ? 0.05 : 0.002]} />
          </EffectComposer>
          <CameraRig isLaunching={isLaunching} />
        </Canvas>
      ) : (
        <><GoldenBokehBackground /><HappyNewYear2026Scene /><audio ref={soundRef} src="/happy-new-year-2026/sounds/celebration.mp3" loop style={{ display: 'none' }} /></>
      )}
    </div>
  )
}