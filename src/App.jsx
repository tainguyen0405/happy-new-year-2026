import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// Đảm bảo đường dẫn import đúng với project của bạn
import CinematicVolume from './CinematicVolume'
import CinematicPlayButton from './CinematicPlayButton'
import CircularAudioVisualizer from './CircularAudioVisualizer'
import MusicToggleButton from './MusicToggleButton'
import VolumeControl from './VolumeControl'

const isTesting = true;

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

// --- 2. 3D COMPONENTS (COUNTDOWN PHASE) ---

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
    for (let i = 0; i < count; i++) {
      const i3 = i * 3; const pV = new THREE.Vector3(pos[i3], pos[i3+1], pos[i3+2]); const cp = new THREE.Vector3(); raycaster.ray.closestPointToPoint(pV, cp)
      const d = pV.distanceTo(cp); const r = 30 + (shockwaveRef.current * 40)
      if (d < r) {
        const f = (r - d) / r; const fd = new THREE.Vector3().copy(pV).sub(cp).normalize()
        vel[i3] += fd.x * f * (2 + shockwaveRef.current * 15); vel[i3+1] += fd.y * f * (2 + shockwaveRef.current * 15); vel[i3+2] += fd.z * f * (2 + shockwaveRef.current * 15)
      }
      vel[i3] += (orig[i3] - pos[i3]) * 0.015; vel[i3] *= 0.92; pos[i3] += vel[i3]; vel[i3+1] += (orig[i3+1] - pos[i3+1]) * 0.015; vel[i3+1] *= 0.92; pos[i3+1] += vel[i3+1]; vel[i3+2] += (orig[i3+2] - pos[i3+2]) * 0.015; vel[i3+2] *= 0.92; pos[i3+2] += vel[i3+2]
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
      matRef.current.color.setHSL(hue, 1, 0.5)
      matRef.current.emissive.setHSL(hue, 1, 0.2)
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
  
  useEffect(() => {
    const targetTime = isTesting ? new Date().getTime() + 15000 : new Date("Jan 1, 2026 00:00:00").getTime();
    const timer = setInterval(() => {
      const dist = targetTime - new Date().getTime()
      if (dist <= 0) { setTimeLeft({ total: 0 }); clearInterval(timer); return; }
      setTimeLeft({ 
        d: Math.floor(dist/86400000), 
        h: Math.floor((dist%86400000)/3600000), 
        m: Math.floor((dist%3600000)/60000), 
        s: Math.floor((dist%60000)/1000), 
        total: Math.floor(dist/1000) 
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  
  if (timeLeft.total <= 0) return <MechanicalButton onActivate={onFinishTransition} />
  
  return (
    <group>
      {timeLeft.total <= 10 ? (
        <Center>
          <Text3D font={fontUrl} size={8} height={2.5} bevelEnabled>
            {timeLeft.total}
            <meshPhysicalMaterial metalness={1} roughness={0.1} color="white" />
          </Text3D>
        </Center>
      ) : (
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.4}>
          <group>
            <ArcText text="COUNTDOWN 2026" radius={15} startAngle={Math.PI * 0.7} endAngle={Math.PI * 0.3} fontSize={0.8} textHeight={0.3} verticalOffset={-3} />
            <Center top position={[-0.5, 2, 0]}>
              <Text3D font={fontUrl} size={5} height={1.5} bevelEnabled>
                {timeLeft.d}
                <RainbowMaterial />
              </Text3D>
            </Center>
            <Center position={[-0.2, -1, 0]}>
              <Text3D font={fontUrl} size={1} height={0.5}>
                DAYS TO 2026
                <meshStandardMaterial color="#888" />
              </Text3D>
            </Center>
            <Center bottom position={[-1.5, -4, 0]}>
              <Text3D font={fontUrl} size={1.2} height={0.4}>
                {`${timeLeft.h}h  ${timeLeft.m}m  ${timeLeft.s}s`}
                <RainbowMaterial />
              </Text3D>
            </Center>
          </group>
        </Float>
      )}
    </group>
  )
}

function MechanicalButton({ onActivate }) {
  const [hovered, setHover] = useState(false)
  const [pressed, setPressed] = useState(false)
  const outerGroupRef = useRef()
  const buttonCoreRef = useRef()
  
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
      <group 
        onPointerOver={() => setHover(true)} 
        onPointerOut={() => (setHover(false), setPressed(false))}
        onPointerDown={() => { setPressed(true); playCustomClick(); }} 
        onPointerUp={() => { setPressed(false); onActivate() }} 
        ref={buttonCoreRef}
      >
        <Cylinder args={[2, 2.1, 0.8, 64]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial 
            color={hovered ? "#ff0033" : "#220000"} 
            metalness={1} 
            emissive="#ff0000" 
            emissiveIntensity={hovered ? 1.2 : 0.1}
          />
        </Cylinder>
      </group>
      <Center position={[0, -4.8, 0]}>
        <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={0.5} height={0.1}>
          LAUNCH 2026
          <meshStandardMaterial color="white" />
        </Text3D>
      </Center>
    </group>
  )
}

// --- 3. 2D CINEMATIC SCENE (NEW - REPLACES GLASS CARDS) ---
function HappyNewYear2026Scene() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    // Kích hoạt animation sau khi mount
    const t = setTimeout(() => setActive(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#000',
      overflow: 'hidden',
      fontFamily: '"Orbitron", sans-serif',
      color: '#fff'
    }}>
      
      {/* 1. BACKGROUND: AURORA MESH GRADIENT */}
      <div style={{
        position: 'absolute',
        inset: -100,
        background: `
          radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%),
          conic-gradient(from 0deg at 50% 50%, #0f0c29, #302b63, #24243e, #0f0c29)
        `,
        opacity: 0.8,
        filter: 'blur(80px)',
        animation: 'auroraSpin 20s linear infinite',
        zIndex: 1
      }} />
      
      {/* Orbs */}
      <div className="orb" style={{ 
        top: '20%', left: '20%', background: '#ff0055', animationDelay: '0s' 
      }} />
      <div className="orb" style={{ 
        bottom: '20%', right: '20%', background: '#00ccff', animationDelay: '-5s' 
      }} />

      {/* 2. FILM GRAIN & VIGNETTE */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%221%22/%3E%3C/svg%3E")',
        opacity: 0.07,
        backgroundSize: '200px',
      }} />
      
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        pointerEvents: 'none',
        background: 'radial-gradient(circle at center, transparent 0%, #000 120%)'
      }} />

      {/* 3. MAIN CONTENT */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
      }}>
        
        {/* Dòng chữ nhỏ */}
        <div style={{
          fontSize: 'clamp(14px, 1.5vw, 18px)',
          letterSpacing: '0.8em',
          textTransform: 'uppercase',
          fontWeight: 300,
          opacity: active ? 0.7 : 0,
          transform: active ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) 0.5s',
          marginBottom: '2vh'
        }}>
          Goodbye 2025
        </div>

        {/* HAPPY NEW YEAR */}
        <h1 style={{
          fontSize: 'clamp(40px, 6vw, 80px)',
          fontWeight: 800,
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(to bottom, #ffffff 30%, #a5a5a5 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          opacity: active ? 1 : 0,
          transform: active ? 'scale(1)' : 'scale(1.1) blur(10px)',
          filter: active ? 'blur(0px)' : 'blur(20px)',
          transition: 'all 2s cubic-bezier(0.16, 1, 0.3, 1) 0.8s'
        }}>
          HAPPY NEW YEAR
        </h1>

        {/* SỐ 2026 */}
        <div style={{
          fontSize: 'clamp(100px, 25vw, 350px)',
          fontWeight: 900,
          lineHeight: 0.9,
          letterSpacing: '-0.05em',
          position: 'relative',
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0) scale(1)' : 'translateY(50px) scale(0.9)',
          transition: 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1) 1s',
          backgroundImage: 'linear-gradient(135deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
          backgroundSize: '200% auto',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          animation: 'shine 5s linear infinite'
        }}>
          2026
        </div>

        {/* Quote */}
        <div style={{
          maxWidth: '600px',
          padding: '0 20px',
          marginTop: '4vh',
          fontSize: 'clamp(16px, 1.5vw, 20px)',
          fontWeight: 300,
          lineHeight: 1.6,
          color: 'rgba(255,255,255,0.8)',
          opacity: active ? 1 : 0,
          filter: active ? 'blur(0px)' : 'blur(5px)',
          transition: 'all 2s ease 2s'
        }}>
          "A new chapter unfolds. May your journey be filled with light, courage, and infinite possibilities."
        </div>

      </div>

      <style>{`
        @keyframes auroraSpin {
          0% { transform: rotate(0deg) scale(1.5); }
          50% { transform: rotate(180deg) scale(2); }
          100% { transform: rotate(360deg) scale(1.5); }
        }
        
        @keyframes shine {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .orb {
          position: absolute;
          width: 40vw;
          height: 40vw;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.4;
          animation: orbFloat 10s ease-in-out infinite alternate;
          z-index: 1;
        }

        @keyframes orbFloat {
          0% { transform: translate(0, 0); }
          100% { transform: translate(30px, -50px); }
        }
      `}</style>
    </div>
  )
}

// --- 4. SCENE CONTENT WRAPPER ---
function SceneContent({ scene, handleLaunch, soundRef, isPlaying, setIsPlaying }) {
  const hasAutoPlayed = useRef(false)

  useEffect(() => {
    // Tự động play nhạc khi chuyển sang màn celebration
    if (scene === 'celebration' && !hasAutoPlayed.current && soundRef.current) {
      setTimeout(() => {
        // Kiểm tra xem soundRef.current có phải là HTMLAudioElement không để gọi .play()
        if (soundRef.current.play) {
            soundRef.current.play().catch(e => console.log("Audio play failed:", e));
        }
        setIsPlaying(true)
        hasAutoPlayed.current = true
      }, 200)
    }
  }, [scene, soundRef, setIsPlaying])

  return (
    <>
      {scene === 'countdown' ? (
        <Suspense fallback={null}>
          <InteractiveDust count={6000} />
          <Stars radius={250} count={3000} factor={4} fade speed={1} />
          <ambientLight intensity={0.5} />
          <CountdownDisplay onFinishTransition={handleLaunch} />
          <CircularAudioVisualizer soundRef={soundRef} radius={18} count={200} />
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/lofi.mp3" distance={30} loop />
        </Suspense>
      ) : null}
    </>
  )
}

// --- 5. APP COMPONENT ---
export default function App() {
  const soundRef = useRef()
  const [scene, setScene] = useState('countdown')
  const [flash, setFlash] = useState(0)
  const [isUiVisible, setUiVisible] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)

  const handleLaunch = () => {
    setUiVisible(false)
    setFlash(1)
    
    setTimeout(() => {
      setScene('celebration')
      const fade = setInterval(() => {
        setFlash(prev => {
          if (prev <= 0) { clearInterval(fade); return 0; }
          return prev - 0.05 
        })
      }, 30)
    }, 600)
  }

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      position: 'relative', 
      background: '#000', 
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* UI Controls cho countdown */}
      {isUiVisible && scene === 'countdown' && (
        <>
          <CinematicVolume soundRef={soundRef} volume={volume} setVolume={setVolume} />
          <CinematicPlayButton soundRef={soundRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
        </>
      )}

      {/* Music controls cho celebration */}
      {scene === 'celebration' && (
        <>
          <MusicToggleButton 
            soundRef={soundRef} 
            isPlaying={isPlaying} 
            setIsPlaying={setIsPlaying}
          />
          {/* Nếu muốn chỉnh volume ở màn hình cuối thì bật dòng này lên */}
          {/* <VolumeControl soundRef={soundRef} volume={volume} setVolume={setVolume} /> */}
        </>
      )}

      {/* Flash transition */}
      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        backgroundColor: 'white', 
        opacity: flash, 
        zIndex: 999, 
        pointerEvents: 'none' 
      }} />

      {/* 3D Canvas cho countdown */}
      {scene === 'countdown' ? (
        <Canvas camera={{ position: [0, 8, 35], fov: 50 }}>
          <color attach="background" args={['#0a0a1a']} />
          <Environment preset="city" />
          <SceneContent 
            scene={scene} 
            handleLaunch={handleLaunch} 
            soundRef={soundRef} 
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
          />
          <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.1} intensity={2.8} mipmapBlur />
          </EffectComposer>
          <OrbitControls 
            enablePan={false} 
            minDistance={20} 
            maxDistance={100}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={0}
            enabled={true}
          />
        </Canvas>
      ) : (
        /* 2D Scene cho celebration */
        <>
          <HappyNewYear2026Scene />
          {/* Audio tag cho 2D Scene (HTML) vì Scene 3D đã bị unmount */}
          <audio 
            ref={soundRef} 
            src="/happy-new-year-2026/sounds/celebration.mp3" 
            loop 
            style={{ display: 'none' }}
          />
        </>
      )}
    </div>
  )
}