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

// --- 2. PHÁO HOA VỚI ĐUÔI BAY LÊN ---
function FireworkTrail({ startPos, endPos, color }) {
  const trailRef = useRef()
  const progressRef = useRef(0)
  const trailLength = 20
  
  const trailPoints = useMemo(() => {
    const points = []
    for (let i = 0; i < trailLength; i++) {
      points.push({ pos: new THREE.Vector3(...startPos), alpha: 1 })
    }
    return points
  }, [])

  useFrame((state, delta) => {
    if (!trailRef.current) return
    
    progressRef.current += delta * 1.5
    
    if (progressRef.current >= 1) {
      trailRef.current.material.opacity = Math.max(0, trailRef.current.material.opacity - delta * 2)
      return
    }

    const currentPos = new THREE.Vector3().lerpVectors(
      new THREE.Vector3(...startPos),
      new THREE.Vector3(...endPos),
      progressRef.current
    )

    for (let i = trailLength - 1; i > 0; i--) {
      trailPoints[i].pos.copy(trailPoints[i - 1].pos)
      trailPoints[i].alpha = (i / trailLength) * 0.8
    }
    trailPoints[0].pos.copy(currentPos)

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
  const count = 500
  const burstRef = useRef(false)
  const launchTimeRef = useRef(1.5)
  
  const startPosition = useMemo(() => [position[0], -20, position[2]], [position])
  
  const particles = useMemo(() => {
    const p = []
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 0.3 + Math.random() * 0.5
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
    
    if (launchTimeRef.current > 0) {
      launchTimeRef.current -= delta
      return
    }
    
    if (!burstRef.current) {
      triggerShake(0.5) 
      burstRef.current = true
    }

    const posArr = new Float32Array(count * 3)
    particles.forEach((p, i) => {
      p.pos.add(p.vel);
      p.vel.y -= 0.006;
      p.vel.multiplyScalar(0.97);
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

// --- 3. BỤI KHÔNG GIAN ---
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

// --- CINEMATIC TEXT WITH MULTI-LAYER ---
function CinematicText() {
  const groupRef = useRef()
  const [scale, setScale] = useState(0)
  
  // Animation xuất hiện
  useEffect(() => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 0.02
      if (progress >= 1) {
        setScale(1)
        clearInterval(interval)
      } else {
        setScale(progress)
      }
    }, 16)
    return () => clearInterval(interval)
  }, [])
  
  // Animation chữ
  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.2) * 0.1
      groupRef.current.position.y = 2 + Math.sin(time * 0.5) * 0.3
    }
  })
  
  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      {/* HAPPY NEW YEAR với nhiều layers */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.8}>
        <group>
          {/* Layer 1: Shadow/Depth */}
          <Center position={[0.3, 1.7, -0.5]}>
            <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={2.5} height={0.6} bevelEnabled>
              HAPPY NEW YEAR
              <meshStandardMaterial color="#000000" opacity={0.5} transparent />
            </Text3D>
          </Center>
          
          {/* Layer 2: Main text với gradient effect */}
          <Center position={[0, 2, 0]}>
            <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={2.5} height={0.6} bevelEnabled>
              HAPPY NEW YEAR
              <GradientMaterial />
            </Text3D>
          </Center>
          
          {/* Layer 3: Glow outline */}
          <Center position={[0, 2, 0.1]}>
            <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={2.6} height={0.1} bevelEnabled>
              HAPPY NEW YEAR
              <meshBasicMaterial 
                color="#FFD700" 
                transparent 
                opacity={0.4}
                blending={THREE.AdditiveBlending}
              />
            </Text3D>
          </Center>

          {/* 2026 với hiệu ứng tương tự */}
          <Center position={[0.3, -4.1, -0.5]}>
            <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={5} height={1.2} bevelEnabled>
              2026
              <meshStandardMaterial color="#000000" opacity={0.5} transparent />
            </Text3D>
          </Center>
          
          <Center position={[0, -3.8, 0]}>
            <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={5} height={1.2} bevelEnabled>
              2026
              <GradientMaterial scale={2} />
            </Text3D>
          </Center>
          
          <Center position={[0, -3.8, 0.1]}>
            <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={5.2} height={0.1} bevelEnabled>
              2026
              <meshBasicMaterial 
                color="#FFD700" 
                transparent 
                opacity={0.5}
                blending={THREE.AdditiveBlending}
              />
            </Text3D>
          </Center>
        </group>
      </Float>
      
      {/* Spotlight effects */}
      <spotLight
        position={[10, 10, 10]}
        angle={0.3}
        penumbra={1}
        intensity={20}
        color="#FFD700"
        target-position={[0, 2, 0]}
      />
      <spotLight
        position={[-10, 10, -10]}
        angle={0.3}
        penumbra={1}
        intensity={20}
        color="#FFA500"
        target-position={[0, -3.8, 0]}
      />
    </group>
  )
}

// Material với gradient effect
function GradientMaterial({ scale = 1 }) {
  const matRef = useRef()
  
  useFrame((state) => {
    if (matRef.current) {
      const time = state.clock.getElapsedTime()
      const hue = (Math.sin(time * 0.5) * 0.1 + 0.15) // Dao động quanh vàng cam
      matRef.current.color.setHSL(hue, 1, 0.6)
      matRef.current.emissive.setHSL(hue, 1, 0.4)
      matRef.current.emissiveIntensity = 0.8 + Math.sin(time * 2) * 0.2
    }
  })
  
  return (
    <meshPhysicalMaterial
      ref={matRef}
      metalness={1}
      roughness={0.05}
      clearcoat={1}
      clearcoatRoughness={0.1}
      reflectivity={1}
    />
  )
}

// --- CHỮ VÒNG CUNG ---
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

// --- GRASS FIELD 360° (Cỏ thực tế bằng Instanced Mesh) ---
function GrassField({ count = 8000 }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  
  // Tạo vị trí và kích thước ngẫu nhiên cho mỗi cọng cỏ
  const grassData = useMemo(() => {
    const data = []
    const radius = 60 // Bán kính vùng cỏ
    
    for (let i = 0; i < count; i++) {
      // Phân bố ngẫu nhiên trong vòng tròn
      const angle = Math.random() * Math.PI * 2
      const dist = Math.sqrt(Math.random()) * radius
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      
      data.push({
        position: [x, -8, z],
        scale: [0.3 + Math.random() * 0.4, 1 + Math.random() * 1.5, 0.3 + Math.random() * 0.4],
        rotation: [0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3]
      })
    }
    return data
  }, [count])
  
  useEffect(() => {
    if (!meshRef.current) return
    
    grassData.forEach((grass, i) => {
      dummy.position.set(...grass.position)
      dummy.scale.set(...grass.scale)
      dummy.rotation.set(...grass.rotation)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [grassData, dummy])
  
  // Animation: cỏ lắc lư nhẹ
  useFrame((state) => {
    if (!meshRef.current) return
    
    grassData.forEach((grass, i) => {
      const time = state.clock.getElapsedTime()
      const offset = i * 0.1
      
      dummy.position.set(...grass.position)
      dummy.scale.set(...grass.scale)
      dummy.rotation.set(
        Math.sin(time * 0.5 + offset) * 0.1,
        grass.rotation[1],
        Math.cos(time * 0.3 + offset) * 0.1
      )
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })
  
  return (
    <>
      {/* Sàn nền */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8.05, 0]} receiveShadow>
        <circleGeometry args={[65, 64]} />
        <meshStandardMaterial color="#2d5016" roughness={0.9} />
      </mesh>
      
      {/* Cỏ instanced */}
      <instancedMesh ref={meshRef} args={[null, null, count]} castShadow receiveShadow>
        <coneGeometry args={[0.1, 1, 3]} />
        <meshStandardMaterial 
          color="#4a7c2c" 
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </>
  )
}

// --- SCENE CONTENT ---
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
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/lofi.mp3" distance={30} loop />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <Stars radius={150} count={1200} factor={2} fade speed={0.4} />
          <FireworkManager triggerShake={triggerShake} />
          
          {/* Thảm cỏ 360° */}
          <GrassField count={8000} />
          
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/celebration.mp3" distance={50} loop />
          
          {/* Chữ được đặt ở giữa không gian với hiệu ứng cinematic */}
          <CinematicText />

          {/* Ánh sáng cinematic */}
          <pointLight position={[0, 25, 0]} intensity={15} color="#FFD700" decay={2} />
          <pointLight position={[20, 5, 20]} intensity={8} color="#FF8C00" />
          <pointLight position={[-20, 5, -20]} intensity={8} color="#FFA500" />
          <ambientLight intensity={0.2} color="#FFE4B5" />
        </Suspense>
      )}
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

      {scene === 'fireworks' && (
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

      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: flash, zIndex: 10, pointerEvents: 'none' }} />

      <Canvas camera={{ position: [0, 8, 35], fov: 50 }}>
        <color attach="background" args={['#0a0a0a']} />
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
        />
      </Canvas>
    </div>
  )
}

// --- COUNTDOWN DISPLAY ---
function CountdownDisplay({ onFinishTransition }) {
    const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0, total: 999 })
    const fontUrl = '/happy-new-year-2026/fonts/Orbitron_Regular.json'
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

function RainbowMaterial() {
    const matRef = useRef()
    useFrame((state) => { if (matRef.current) { const hue = (state.clock.getElapsedTime() * 0.1) % 1; matRef.current.color.setHSL(hue, 1, 0.5); matRef.current.emissive.setHSL(hue, 1, 0.2); } })
    return <meshPhysicalMaterial ref={matRef} metalness={1} roughness={0.1} emissiveIntensity={0.5} />
}