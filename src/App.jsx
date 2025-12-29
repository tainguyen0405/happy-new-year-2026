import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

import CinematicVolume from './CinematicVolume'
import CinematicPlayButton from './CinematicPlayButton'
import CircularAudioVisualizer from './CircularAudioVisualizer'
import MusicToggleButton from './MusicToggleButton'
import VolumeControl from './VolumeControl'

const isTesting = true;

// --- 1. HÀM TẠO ÂM THANH CLICK ---
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

// --- 2. BỤI KHÔNG GIAN (cho countdown) ---
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

// --- CHỮ VÒNG CUNG (cho countdown) ---
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

// --- COUNTDOWN DISPLAY (3D Scene) ---
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
            <ArcText 
              text="COUNTDOWN 2026" 
              radius={15}
              startAngle={Math.PI * 0.7}
              endAngle={Math.PI * 0.3}
              fontSize={0.8}
              textHeight={0.3}
              verticalOffset={-3}
            />
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

// --- 2D GLASS MORPHISM COMPONENTS ---
function GlassCard({ 
  children, 
  delay = 0, 
  fromDirection = 'bottom',
  className = '',
  style = {}
}) {
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: y * 15, y: -x * 15 })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
  }

  const getInitialTransform = () => {
    switch(fromDirection) {
      case 'left': return 'translateX(-120vw) rotate(-15deg) scale(0.8)'
      case 'right': return 'translateX(120vw) rotate(15deg) scale(0.8)'
      case 'top': return 'translateY(-120vh) rotate(-10deg) scale(0.8)'
      case 'bottom': return 'translateY(120vh) rotate(10deg) scale(0.8)'
      default: return 'scale(0) rotate(180deg)'
    }
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: isVisible 
          ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1)`
          : getInitialTransform(),
        transition: isVisible 
          ? 'transform 0.3s ease-out, opacity 0.3s ease-out'
          : 'all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '32px',
        boxShadow: `
          0 8px 32px 0 rgba(0, 0, 0, 0.37),
          inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
        `,
      }}
    >
      {children}
    </div>
  )
}

function AnimatedGradientBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    let time = 0
    
    const animate = () => {
      time += 0.01
      
      const gradient1 = ctx.createRadialGradient(
        canvas.width * (0.5 + Math.sin(time) * 0.3),
        canvas.height * (0.5 + Math.cos(time * 0.7) * 0.3),
        0,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.width * 0.8
      )
      gradient1.addColorStop(0, `hsla(${(time * 20) % 360}, 100%, 60%, 0.3)`)
      gradient1.addColorStop(0.5, `hsla(${(time * 20 + 60) % 360}, 100%, 50%, 0.2)`)
      gradient1.addColorStop(1, 'transparent')

      const gradient2 = ctx.createRadialGradient(
        canvas.width * (0.5 + Math.cos(time * 1.3) * 0.4),
        canvas.height * (0.5 + Math.sin(time * 0.9) * 0.4),
        0,
        canvas.width * 0.3,
        canvas.height * 0.3,
        canvas.width * 0.6
      )
      gradient2.addColorStop(0, `hsla(${(time * 30 + 180) % 360}, 100%, 60%, 0.3)`)
      gradient2.addColorStop(0.5, `hsla(${(time * 30 + 240) % 360}, 100%, 50%, 0.2)`)
      gradient2.addColorStop(1, 'transparent')

      ctx.fillStyle = '#0a0a1a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.fillStyle = gradient1
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.fillStyle = gradient2
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      requestAnimationFrame(animate)
    }
    
    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0
      }}
    />
  )
}

function FloatingParticles({ count = 50 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.2,
      hue: Math.random() * 360
    }))

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2)
        gradient.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${p.opacity})`)
        gradient.addColorStop(1, 'transparent')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2)
        ctx.fill()
      })
      
      requestAnimationFrame(animate)
    }
    
    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [count])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none'
      }}
    />
  )
}

// --- 2D HAPPY NEW YEAR SCENE ---
function HappyNewYear2026Scene() {
  const [showCards, setShowCards] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowCards(true), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      <AnimatedGradientBackground />
      <FloatingParticles count={60} />

      {/* DECORATIVE CARDS - Top Left */}
      {showCards && (
        <GlassCard
          delay={200}
          fromDirection="left"
          style={{
            position: 'absolute',
            top: '8%',
            left: '5%',
            width: '280px',
            height: '200px',
            zIndex: 2
          }}
        >
          <div style={{
            fontSize: '48px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px'
          }}>
            2025
          </div>
          <div style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '16px',
            fontWeight: '500'
          }}>
            Goodbye & Thank You
          </div>
        </GlassCard>
      )}

      {/* DECORATIVE CARDS - Top Right */}
      {showCards && (
        <GlassCard
          delay={400}
          fromDirection="right"
          style={{
            position: 'absolute',
            top: '8%',
            right: '5%',
            width: '280px',
            height: '200px',
            zIndex: 2
          }}
        >
          <div style={{
            fontSize: '48px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px'
          }}>
            2026
          </div>
          <div style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '16px',
            fontWeight: '500'
          }}>
            New Adventures Await
          </div>
        </GlassCard>
      )}

      {/* MAIN CENTER CARD */}
      <GlassCard
        delay={600}
        fromDirection="bottom"
        style={{
          position: 'relative',
          zIndex: 3,
          width: '90%',
          maxWidth: '800px',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 40px'
        }}
      >
        <div style={{
          fontSize: 'clamp(48px, 8vw, 96px)',
          fontWeight: '900',
          textAlign: 'center',
          lineHeight: '1.2',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #ffd89b 0%, #19547b 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'gradientShift 3s ease infinite',
          letterSpacing: '2px'
        }}>
          HAPPY NEW YEAR
        </div>

        <div style={{
          fontSize: 'clamp(72px, 12vw, 144px)',
          fontWeight: '900',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 50%, #FF6347 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'float 3s ease-in-out infinite',
          textShadow: '0 0 40px rgba(255, 215, 0, 0.5)',
          letterSpacing: '4px'
        }}>
          2026
        </div>

        <div style={{
          marginTop: '32px',
          fontSize: 'clamp(16px, 2vw, 24px)',
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          fontWeight: '500',
          animation: 'fadeInUp 1s ease 1.2s both'
        }}>
          May this year bring you joy, success & endless possibilities ✨
        </div>
      </GlassCard>

      {/* DECORATIVE CARDS - Bottom Left */}
      {showCards && (
        <GlassCard
          delay={800}
          fromDirection="left"
          style={{
            position: 'absolute',
            bottom: '8%',
            left: '5%',
            width: '220px',
            height: '160px',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{
            fontSize: '64px',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            🎉
          </div>
        </GlassCard>
      )}

      {/* DECORATIVE CARDS - Bottom Right */}
      {showCards && (
        <GlassCard
          delay={1000}
          fromDirection="right"
          style={{
            position: 'absolute',
            bottom: '8%',
            right: '5%',
            width: '220px',
            height: '160px',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{
            fontSize: '64px',
            animation: 'pulse 2s ease-in-out infinite 0.5s'
          }}>
            🎊
          </div>
        </GlassCard>
      )}

      <style>{`
        @keyframes gradientShift {
          0%, 100% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(45deg); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}

// --- SCENE CONTENT ---
function SceneContent({ scene, handleLaunch, soundRef, isPlaying, setIsPlaying }) {
  const hasAutoPlayed = useRef(false)

  useEffect(() => {
    if (scene === 'celebration' && !hasAutoPlayed.current && soundRef.current) {
      setTimeout(() => {
        soundRef.current.play()
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

// --- APP CHÍNH ---
export default function App() {
  const soundRef = useRef()
  const [scene, setScene] = useState('countdown')
  const [flash, setFlash] = useState(0)
  const [isUiVisible, setUiVisible] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(2.0)

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
          <CinematicVolume soundRef={soundRef} />
          <CinematicPlayButton soundRef={soundRef} />
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
          <VolumeControl 
            soundRef={soundRef} 
            volume={volume}
            setVolume={setVolume}
          />
        </>
      )}

      {/* Flash transition */}
      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        backgroundColor: 'white', 
        opacity: flash, 
        zIndex: 10, 
        pointerEvents: 'none' 
      }} />

      {/* 3D Canvas cho countdown */}
      {scene === 'countdown' && (
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
      )}

      {/* 2D Scene cho celebration */}
      {scene === 'celebration' && (
        <>
          <HappyNewYear2026Scene />
          <audio 
            ref={soundRef} 
            src="/happy-new-year-2026/sounds/celebration.mp3" 
            loop 
          />
        </>
      )}
    </div>
  )
}