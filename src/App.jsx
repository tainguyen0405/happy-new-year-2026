import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

import CinematicVolume from './CinematicVolume'
import CinematicPlayButton from './CinematicPlayButton'
import CircularAudioVisualizer from './CircularAudioVisualizer'

const isTesting = false;

// --- 1. HÀM TẠO ÂM THANH CLICK (GIỮ NGUYÊN) ---
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

// --- 2. NÂNG CẤP PHÁO HOA (THÊM ĐUÔI BAY LÊN + TRỌNG LỰC & SHAKE) ---
// Component đuôi pháo hoa bay lên
function FireworkTrail({ startPos, endPos, color }) {
  const trailRef = useRef()
  const progressRef = useRef(0)
  const trailLength = 20 // Số điểm tạo đuôi
  
  const trailPoints = useMemo(() => {
    const points = []
    for (let i = 0; i < trailLength; i++) {
      points.push({ pos: new THREE.Vector3(...startPos), alpha: 1 })
    }
    return points
  }, [])

  useFrame((state, delta) => {
    if (!trailRef.current) return
    
    progressRef.current += delta * 1.5 // Tốc độ bay lên
    
    if (progressRef.current >= 1) {
      trailRef.current.material.opacity = Math.max(0, trailRef.current.material.opacity - delta * 2)
      return
    }

    // Vị trí hiện tại của đầu pháo hoa
    const currentPos = new THREE.Vector3().lerpVectors(
      new THREE.Vector3(...startPos),
      new THREE.Vector3(...endPos),
      progressRef.current
    )

    // Cập nhật đuôi (shift positions)
    for (let i = trailLength - 1; i > 0; i--) {
      trailPoints[i].pos.copy(trailPoints[i - 1].pos)
      trailPoints[i].alpha = (i / trailLength) * 0.8
    }
    trailPoints[0].pos.copy(currentPos)

    // Cập nhật geometry
    const posArr = new Float32Array(trailLength * 3)
    trailPoints.forEach((p, i) => {
      posArr.set([p.pos.x, p.pos.y, p.pos.z], i * 3)
    })
    
    trailRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
  })

  return (
    <points ref={trailRef}>
      <bufferGeometry />
      <pointsMaterial 
        size={0.35} 
        color={color} 
        transparent 
        opacity={1}
        blending={THREE.AdditiveBlending} 
        depthWrite={false} 
      />
    </points>
  )
}

function Firework({ color, position, triggerShake }) {
  const meshRef = useRef()
  const count = 500 // Tăng mật độ hạt
  const burstRef = useRef(false)
  const launchTimeRef = useRef(1.5) // Thời gian bay lên trước khi nổ
  
  const startPosition = useMemo(() => [position[0], -20, position[2]], [position])
  
  const particles = useMemo(() => {
    const p = []
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 0.3 + Math.random() * 0.5 // Nổ mạnh hơn
      p.push({
        vel: new THREE.Vector3(Math.sin(phi) * Math.cos(theta) * speed, Math.sin(phi) * Math.sin(theta) * speed, Math.cos(phi) * speed),
        pos: new THREE.Vector3(0, 0, 0),
        life: 1.0
      })
    }
    return p
  }, [])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    
    // Giai đoạn bay lên
    if (launchTimeRef.current > 0) {
      launchTimeRef.current -= delta
      return
    }
    
    // Kích hoạt rung camera khi bắt đầu nổ
    if (!burstRef.current) {
      triggerShake(0.5) 
      burstRef.current = true
    }

    const posArr = new Float32Array(count * 3)
    particles.forEach((p, i) => {
      p.pos.add(p.vel);
      p.vel.y -= 0.006; // Thêm trọng lực kéo hạt rơi xuống
      p.vel.multiplyScalar(0.97); // Ma sát không khí làm hạt chậm lại
      p.life -= delta * 0.45;
      posArr.set([p.pos.x, p.pos.y, p.pos.z], i * 3)
    })
    meshRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    meshRef.current.material.opacity = particles[0].life
  })

  return (
    <>
      <FireworkTrail startPos={startPosition} endPos={position} color={color} />
      <points ref={meshRef} position={position}>
        <bufferGeometry />
        <pointsMaterial size={0.2} color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </>
  )
}

function FireworkManager({ triggerShake }) {
  const [list, setList] = useState([])
  useEffect(() => {
    const interval = setInterval(() => {
      const newF = {
        id: Math.random(),
        pos: [(Math.random() - 0.5) * 80, Math.random() * 30, (Math.random() - 0.5) * 40],
        color: new THREE.Color().setHSL(Math.random(), 1, 0.6)
      }
      setList(prev => [...prev.slice(-15), newF])
    }, 600)
    return () => clearInterval(interval)
  }, [])
  return <>{list.map(f => <Firework key={f.id} position={f.pos} color={f.color} triggerShake={triggerShake} />)}</>
}

// --- 3. BỤI KHÔNG GIAN (GIỮ NGUYÊN) ---
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

// --- COMPONENT CHỮ VÒNG CUNG ---
// ĐIỀU CHỈNH THAM SỐ Ở ĐÂY:
function ArcText({ 
  text, 
  radius = 15,                    // 🔧 Bán kính vòng cung (10-20 phù hợp)
  startAngle = Math.PI * 0.7,     // 🔧 Góc bắt đầu (0.6-0.8 đẹp)
  endAngle = Math.PI * 0.3,       // 🔧 Góc kết thúc (0.2-0.4 đẹp)
  fontSize = 0.8,                 // 🔧 Kích thước chữ (0.5-1.5)
  textHeight = 0.3,               // 🔧 Độ dày 3D (0.2-0.8)
  verticalOffset = 0              // 🔧 Độ cao so với trung tâm (-5 đến 5)
}) {
  const fontUrl = load('fonts/Orbitron_Regular.json')
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

// --- BUTTON NHẠC 2D STYLE FIGMA/MOTION ---
function MusicToggleButton({ soundRef, isPlaying, setIsPlaying, volume }) {
  const [hovered, setHover] = useState(false)

  const handleClick = () => {
    if (soundRef.current) {
      if (isPlaying) {
        soundRef.current.pause()
      } else {
        soundRef.current.play()
      }
      setIsPlaying(!isPlaying)
      playCustomClick()
    }
  }

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
  )
}

// --- BUTTON ĐIỀU CHỈNH ÂM LƯỢNG STYLE FIGMA/MOTION ---
function VolumeControl({ soundRef, volume, setVolume }) {
  const [hovered, setHover] = useState(false)

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (soundRef.current) {
      soundRef.current.setVolume(newVolume)
    }
  }

  const increaseVolume = () => {
    const newVolume = Math.min(2, volume + 0.1) // Max 200%
    setVolume(newVolume)
    if (soundRef.current) {
      soundRef.current.setVolume(newVolume)
    }
    playCustomClick()
  }

  const decreaseVolume = () => {
    const newVolume = Math.max(0, volume - 0.1)
    setVolume(newVolume)
    if (soundRef.current) {
      soundRef.current.setVolume(newVolume)
    }
    playCustomClick()
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '110px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
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
          e.target.style.transform = 'scale(1.05)'
          e.target.style.background = 'linear-gradient(135deg, #71717a 0%, #52525b 100%)'
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)'
          e.target.style.background = 'linear-gradient(135deg, #52525b 0%, #3f3f46 100%)'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8H13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Thanh slider custom */}
      <div style={{ position: 'relative', width: '120px', height: '4px' }}>
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '4px',
          background: '#3f3f46',
          borderRadius: '2px'
        }}></div>
        <div style={{
          position: 'absolute',
          width: `${(volume / 2) * 100}%`, // Chia 2 vì max là 2 (200%)
          height: '4px',
          background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '2px',
          transition: 'width 0.1s ease'
        }}></div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          style={{
            position: 'absolute',
            width: '100%',
            height: '4px',
            cursor: 'pointer',
            opacity: 0,
            zIndex: 2
          }}
        />
      </div>

      {/* Hiển thị % âm lượng */}
      <span style={{ 
        color: '#a1a1aa', 
        fontSize: '13px', 
        fontWeight: '600',
        minWidth: '42px',
        textAlign: 'right',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {Math.round((volume / 2) * 100)}%
      </span>

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
          e.target.style.transform = 'scale(1.05)'
          e.target.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)'
          e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

// --- 4. NÂNG CẤP CAMERA SHAKE & GOLD TEXT ---
function SceneContent({ scene, handleLaunch, soundRef, isPlaying, setIsPlaying }) {
  const { camera } = useThree()
  const shakeIntensity = useRef(0)
  const hasAutoPlayed = useRef(false)

  useFrame(() => {
    if (shakeIntensity.current > 0) {
      camera.position.x += (Math.random() - 0.5) * shakeIntensity.current
      camera.position.y += (Math.random() - 0.5) * shakeIntensity.current
      shakeIntensity.current *= 0.9 
    }
  })

  // TỰ ĐỘNG PHÁT NHẠC KHI VÀO SCENE FIREWORKS
  useEffect(() => {
    if (scene === 'fireworks' && !hasAutoPlayed.current && soundRef.current) {
      setTimeout(() => {
        soundRef.current.play()
        setIsPlaying(true)
        hasAutoPlayed.current = true
      }, 200)
    }
  }, [scene, soundRef, setIsPlaying])

  const triggerShake = (val) => { shakeIntensity.current = val }

  return (
    <>
      {scene === 'countdown' ? (
        <Suspense fallback={null}>
          <InteractiveDust count={6000} />
          <Stars radius={250} count={3000} factor={4} fade speed={1} />
          <ambientLight intensity={0.5} />
          <CountdownDisplay onFinishTransition={handleLaunch} />
          <CircularAudioVisualizer soundRef={soundRef} radius={18} count={200} />
          <PositionalAudio ref={soundRef} url="/sounds/lofi.mp3" distance={30} loop />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <Stars radius={150} count={1200} factor={2} fade speed={0.4} />
          <FireworkManager triggerShake={triggerShake} />
          
          {/* ÂM THANH FIREWORKS */}
          <PositionalAudio ref={soundRef} url="/sounds/celebration.mp3" distance={50} loop />
          
          <Float speed={3} rotationIntensity={0.6} floatIntensity={1.5}>
            {/* Chữ HAPPY NEW YEAR */}
            <Center position={[0, 2, 0]}>
              <Text3D font="/fonts/Orbitron_Regular.json" size={2.5} height={0.6} bevelEnabled>
                HAPPY NEW YEAR
                <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.02} emissive="#FFB300" emissiveIntensity={0.2} />
              </Text3D>
            </Center>

            {/* Chữ 2026 */}
            <Center position={[0, -3.8, 0]}>
              <Text3D font="/fonts/Orbitron_Regular.json" size={5} height={1.2} bevelEnabled>
                2026
                <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.01} emissive="#FFD700" emissiveIntensity={0.5} />
              </Text3D>
            </Center>
          </Float>

          <pointLight position={[0, 10, 20]} intensity={8} color="#FFD700" />
        </Suspense>
      )}
    </>
  )
}

// --- 5. APP CHÍNH ---
export default function App() {
  const soundRef = useRef()
  const [scene, setScene] = useState('countdown')
  const [flash, setFlash] = useState(0)
  const [isUiVisible, setUiVisible] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false) // Nhạc chưa phát
  const [volume, setVolume] = useState(1.0) // Âm lượng mặc định 100% (max 200%)
  const [showVolumeControl, setShowVolumeControl] = useState(false) // Điều khiển hiển thị volume

  const handleLaunch = () => {
    setUiVisible(false)
    setFlash(1)
    
    setTimeout(() => {
      setScene('fireworks')
      const fade = setInterval(() => {
        setFlash(prev => {
          if (prev <= 0) { clearInterval(fade); return 0; }
          return prev - 0.05 
        })
      }, 30)
    }, 600)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000', overflow: 'hidden' }}>
      {isUiVisible && (
        <>
          <CinematicVolume soundRef={soundRef} />
          <CinematicPlayButton soundRef={soundRef} />
        </>
      )}

      {/* BUTTON ĐIỀU KHIỂN NHẠC 2D - CHỈ HIỆN Ở SCENE FIREWORKS */}
      {scene === 'fireworks' && (
        <>
          <MusicToggleButton 
            soundRef={soundRef} 
            isPlaying={isPlaying} 
            setIsPlaying={setIsPlaying}
            volume={volume}
            showVolumeControl={showVolumeControl}
            setShowVolumeControl={setShowVolumeControl}
          />
          <VolumeControl 
            soundRef={soundRef} 
            volume={volume}
            setVolume={setVolume}
            showVolumeControl={showVolumeControl}
            setShowVolumeControl={setShowVolumeControl}
          />
        </>
      )}

      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: flash, zIndex: 10, pointerEvents: 'none' }} />

      <Canvas camera={{ position: [0, 0, 45], fov: 45 }}>
        <color attach="background" args={['#000000']} />
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
        <OrbitControls enablePan={false} minDistance={20} maxDistance={100} />
      </Canvas>
    </div>
  )
}

// --- CÁC COMPONENT PHỤ ---
function CountdownDisplay({ onFinishTransition }) {
    const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0, total: 999 })
    const fontUrl = '/fonts/Orbitron_Regular.json'
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
                  {/* CHỮ "COUNTDOWN 2026" HÌNH VÒNG CUNG */}
                  {/* 🎨 ĐIỀU CHỈNH THAM SỐ Ở ĐÂY: */}
                  <ArcText 
                    text="COUNTDOWN 2026" 
                    radius={15}           // Bán kính vòng cung (10-20)
                    startAngle={Math.PI * 0.7}   // Góc bắt đầu bên trái
                    endAngle={Math.PI * 0.3}     // Góc kết thúc bên phải
                    fontSize={0.8}        // Kích thước chữ (0.5-1.5)
                    textHeight={0.3}      // Độ dày 3D (0.2-0.8)
                    verticalOffset={-3}   // Dịch lên/xuống (-5 đến 5)
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
      <Center position={[0, -4.8, 0]}><Text3D font="/fonts/Orbitron_Regular.json" size={0.5} height={0.1}>LAUNCH 2026<meshStandardMaterial color="white" /></Text3D></Center>
    </group>
  )
}

function RainbowMaterial() {
    const matRef = useRef()
    useFrame((state) => { if (matRef.current) { const hue = (state.clock.getElapsedTime() * 0.1) % 1; matRef.current.color.setHSL(hue, 1, 0.5); matRef.current.emissive.setHSL(hue, 1, 0.2); } })
    return <meshPhysicalMaterial ref={matRef} metalness={1} roughness={0.1} emissiveIntensity={0.5} />
}
