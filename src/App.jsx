import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

import CinematicVolume from './CinematicVolume'
import CinematicPlayButton from './CinematicPlayButton'
import CircularAudioVisualizer from './CircularAudioVisualizer'
import MusicToggleButton from './MusicToggleButton'
import VolumeControl from './VolumeControl'

const isTesting = true; // Set false khi chạy thật

// --- 1. UTILS: TEXTURE GENERATOR (Tạo đốm sáng mượt mà giúp giảm lag) ---
const getParticleTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.premultiplyAlpha = true;
  return texture;
}

// --- 2. HÀM TẠO ÂM THANH CLICK ---
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

// --- 3. PHÁO HOA TỐI ƯU (CINEMATIC FIREWORKS) ---
// Sử dụng Texture để 1 hạt trông to và sáng hơn, giảm số lượng hạt cần vẽ
function OptimizedFirework({ position, color, texture }) {
  const pointsRef = useRef()
  const count = 80 // Giảm số lượng hạt nhưng tăng kích thước texture -> Không lag
  
  // Khởi tạo dữ liệu hạt
  const [particles] = useState(() => {
    const data = []
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 0.5 + Math.random() * 0.8 // Tốc độ nổ nhanh chậm khác nhau
      data.push({
        velocity: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed
        ),
        life: 1.0 - Math.random() * 0.2 // Tuổi thọ ngẫu nhiên
      })
    }
    return data
  })

  // Buffer Geometry
  const bufferGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [count])

  useFrame((state, delta) => {
    if (!pointsRef.current) return
    
    const positions = pointsRef.current.geometry.attributes.position.array
    let aliveCount = 0

    for (let i = 0; i < count; i++) {
      const p = particles[i]
      if (p.life > 0) {
        // Cập nhật vị trí
        positions[i*3] += p.velocity.x * delta * 15 // Speed multiplier
        positions[i*3+1] += p.velocity.y * delta * 15
        positions[i*3+2] += p.velocity.z * delta * 15
        
        // Trọng lực & Sức cản
        p.velocity.y -= 0.02 // Gravity
        p.velocity.multiplyScalar(0.96) // Air drag
        
        p.life -= delta * 0.8
        aliveCount++
      } else {
        // Giấu đi khi chết
        positions[i*3] = 9999
      }
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true
    pointsRef.current.material.opacity = Math.max(0, pointsRef.current.material.opacity - delta * 0.3)
    
    // Reset pháo hoa nếu tắt hết (để loop - tuỳ chọn)
    if (aliveCount === 0) {
        // Logic remove component should be handled by manager, 
        // here we just fade out completely
    }
  })

  return (
    <points ref={pointsRef} position={position}>
      <primitive object={bufferGeo} />
      <pointsMaterial 
        size={1.2} // Kích thước hạt to nhờ texture
        map={texture} 
        color={color} 
        transparent 
        opacity={1} 
        depthWrite={false} 
        blending={THREE.AdditiveBlending} 
      />
    </points>
  )
}

function FireworkManager() {
  const [fireworks, setFireworks] = useState([])
  const texture = useMemo(() => getParticleTexture(), [])
  
  useEffect(() => {
    // Spawn pháo hoa mỗi khoảng thời gian
    const interval = setInterval(() => {
      const id = Math.random()
      const colors = ['#ff0000', '#ffa500', '#ffd700', '#00ffcc', '#ff00ff']
      const randomColor = colors[Math.floor(Math.random() * colors.length)]
      
      const newF = {
        id,
        pos: [(Math.random() - 0.5) * 60, 10 + Math.random() * 20, (Math.random() - 0.5) * 30],
        color: new THREE.Color(randomColor)
      }
      
      setFireworks(prev => [...prev.slice(-10), newF]) // Giới hạn số lượng pháo hoa cùng lúc
    }, 800) // Tần suất bắn
    
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {fireworks.map(f => (
        <OptimizedFirework key={f.id} position={f.pos} color={f.color} texture={texture} />
      ))}
    </>
  )
}

// --- 4. FEATURE: LÌ XÌ (RÚT TIỀN THẬT) ---
// --- 4. FEATURE: LÌ XÌ (ĐÃ FIX VỊ TRÍ SANG TRÁI) ---
const DENOMINATIONS = [
  { value: "50.000", color: "linear-gradient(135deg, #e492b2, #b56585)", text: "Năm mới nhẹ nhàng, tình cảm đong đầy" },
  { value: "100.000", color: "linear-gradient(135deg, #7da36d, #4e7040)", text: "Lộc biếc mai vàng, khởi đầu suôn sẻ" },
  { value: "200.000", color: "linear-gradient(135deg, #c9806e, #a34e3c)", text: "May mắn song hành, tài lộc gõ cửa" },
  { value: "500.000", color: "linear-gradient(135deg, #58aeb1, #2c7a7d)", text: "Đại phú đại quý, tiền vào như nước" }
];

function LuckyMoneyFeature() {
  const [step, setStep] = useState(0); 
  const [selectedMoney, setSelectedMoney] = useState(null);

  const pickRandomMoney = () => {
    const rand = Math.random();
    if (rand < 0.4) return DENOMINATIONS[0];
    if (rand < 0.7) return DENOMINATIONS[1];
    if (rand < 0.9) return DENOMINATIONS[2];
    return DENOMINATIONS[3];
  };

  const handleOpenDeck = () => {
    playCustomClick();
    setStep(1);
  };

  const handlePickEnvelope = () => {
    playCustomClick();
    const money = pickRandomMoney();
    setSelectedMoney(money);
    setStep(2);
  };

  const handleClose = () => {
    setStep(0);
    setSelectedMoney(null);
  };

  return (
    <Html fullscreen style={{ pointerEvents: 'none', zIndex: 9999 }}>
      <style>
        {`
          /* --- SỬA VỊ TRÍ TẠI ĐÂY --- */
          /* Chuyển từ right: 30px sang left: 30px để không đè lên volume */
          .lucky-btn-container {
            position: absolute; 
            bottom: 30px; 
            left: 30px; /* Vị trí mới: Góc trái */
            pointer-events: auto; 
            cursor: pointer;
            animation: float 3s ease-in-out infinite;
            text-align: center;
          }

          .mini-envelope {
            width: 60px; height: 90px;
            background: #d32f2f;
            border: 2px solid #ffd700;
            border-radius: 6px;
            display: flex; justify-content: center; align-items: center;
            font-size: 24px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
          }
          .mini-envelope::after { content: '福'; color: #ffd700; font-family: serif; }

          .overlay-backdrop {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.85);
            backdrop-filter: blur(8px);
            display: flex; flex-direction: column;
            justify-content: center; align-items: center;
            pointer-events: auto;
            animation: fadeIn 0.3s ease;
          }

          .envelope-deck {
            display: flex; gap: 20px;
            perspective: 1000px;
          }
          .big-envelope {
            width: 100px; height: 160px;
            background: linear-gradient(135deg, #b71c1c, #d32f2f);
            border: 2px solid #ffd700;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.3s;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex; justify-content: center; align-items: center;
          }
          .big-envelope:hover { transform: translateY(-20px) scale(1.05); }
          .big-envelope span { font-size: 40px; color: #ffd700; }

          .result-container {
            position: relative;
            width: 200px; height: 300px;
            display: flex; justify-content: center; align-items: flex-end;
          }
          
          .opened-envelope-body {
            position: absolute; bottom: 0; width: 100%; height: 60%;
            background: #d32f2f;
            border: 2px solid #ffd700;
            border-top: none;
            border-radius: 0 0 10px 10px;
            z-index: 10;
          }
          .opened-envelope-flap {
            position: absolute; bottom: 60%; width: 100%; height: 20%;
            background: #b71c1c;
            clip-path: polygon(0 0, 50% 100%, 100% 0);
            z-index: 5;
          }

          .money-note {
            width: 90%; height: 80%;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(0,0,0,0.2);
            position: absolute; bottom: 10px;
            display: flex; flex-direction: column;
            justify-content: space-between; padding: 10px;
            box-sizing: border-box;
            color: white; font-family: sans-serif; font-weight: bold;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            z-index: 2; 
            animation: slideUpMoney 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          }

          .money-value { font-size: 24px; align-self: flex-end; }
          .money-center { font-size: 32px; align-self: center; opacity: 0.3; }
          .money-label { font-size: 10px; text-transform: uppercase; }

          @keyframes slideUpMoney {
            0% { transform: translateY(0); z-index: 8; }
            100% { transform: translateY(-180px) scale(1.2); z-index: 15; }
          }
          
          .wish-text {
            color: #fff; margin-top: 200px; font-family: 'Montserrat', sans-serif;
            font-size: 1.2rem; text-align: center; max-width: 80%;
            animation: fadeIn 1s ease 1s forwards; opacity: 0;
          }
          
          .close-btn {
            margin-top: 20px; padding: 10px 30px;
            background: white; color: #d32f2f; font-weight: bold;
            border: none; border-radius: 20px; cursor: pointer;
          }

          @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          
          @media (max-width: 600px) {
             .envelope-deck { gap: 10px; transform: scale(0.8); }
             .big-envelope { width: 70px; height: 110px; }
          }
        `}
      </style>

      {/* STEP 0: Nút Lì Xì (Góc trái) */}
      {step === 0 && (
        <div className="lucky-btn-container" onClick={handleOpenDeck}>
          <div className="mini-envelope"></div>
          <div style={{ color: 'white', marginTop: 5, fontSize: 12, fontWeight: 'bold', textShadow: '0 2px 2px black' }}>RÚT LÌ XÌ</div>
        </div>
      )}

      {/* STEP 1: Chọn bao */}
      {step === 1 && (
        <div className="overlay-backdrop">
          <h2 style={{ color: '#ffd700', fontFamily: 'serif', marginBottom: 40, fontSize: '2rem' }}>CHỌN LỘC ĐẦU NĂM</h2>
          <div className="envelope-deck">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="big-envelope" onClick={handlePickEnvelope}>
                <span>🧧</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Kết quả */}
      {step === 2 && selectedMoney && (
        <div className="overlay-backdrop">
          <div className="result-container">
            <div className="money-note" style={{ background: selectedMoney.color }}>
               <div className="money-label">NGÂN HÀNG MAY MẮN</div>
               <div className="money-center">VND</div>
               <div className="money-value">{selectedMoney.value}</div>
            </div>
            <div className="opened-envelope-flap"></div>
            <div className="opened-envelope-body">
                <div style={{textAlign: 'center', color: '#ffd700', marginTop: 20, fontSize: 30}}>福</div>
            </div>
          </div>
          <div className="wish-text">"{selectedMoney.text}"</div>
          <button className="close-btn" onClick={handleClose}>Nhận Lộc</button>
        </div>
      )}
    </Html>
  );
}

// --- 5. CINEMATIC 2D TITLE ---
function CinematicTitle2D() {
  return (
    <Html fullscreen style={{ pointerEvents: 'none', zIndex: 100 }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Montserrat:wght@300;600&display=swap');
          .cinematic-container {
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            width: 100%; height: 100%; color: #ffffff; text-align: center;
            font-family: 'Cinzel', serif; text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
          }
          .line-1 { font-family: 'Montserrat', sans-serif; font-size: 2rem; letter-spacing: 0.8rem; color: #ffecd2; animation: fadeUp 3s forwards 0.5s; opacity: 0; }
          .line-2 { font-size: 10rem; font-weight: 700; background: linear-gradient(to bottom, #fff 30%, #ffd700 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: zoomIn 4s forwards 1.5s; opacity: 0; filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.4)); }
          .line-3 { font-family: 'Montserrat', sans-serif; margin-top: 20px; font-size: 1.2rem; letter-spacing: 0.5rem; color: #aaa; animation: fadeIn 3s forwards 4s; opacity: 0; }
          @keyframes fadeUp { to { opacity: 1; transform: translateY(0); letter-spacing: 1.2rem; } }
          @keyframes zoomIn { to { opacity: 1; transform: scale(1); letter-spacing: 0px; } }
          @keyframes fadeIn { to { opacity: 0.8; } }
          @media (max-width: 768px) { .line-1 { font-size: 1.2rem; } .line-2 { font-size: 5rem; } }
        `}
      </style>
      <div className="cinematic-container">
        <div className="line-1">Happy New Year</div>
        <div className="line-2">2026</div>
        <div className="line-3">CHÚC MỪNG NĂM MỚI</div>
      </div>
    </Html>
  )
}

// --- SCENE CONTENT ---
function SceneContent({ scene, handleLaunch, soundRef, isPlaying, setIsPlaying }) {
  const { camera } = useThree()
  const hasAutoPlayed = useRef(false)

  useEffect(() => {
    if (scene === 'fireworks') {
        camera.position.set(0, 0, 40) // Góc nhìn chính diện
        camera.lookAt(0, 0, 0)
    }
  }, [scene, camera])

  useEffect(() => {
    if (scene === 'fireworks' && !hasAutoPlayed.current && soundRef.current) {
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
          <InteractiveDust count={4000} /> {/* Giảm count để tối ưu */}
          <Stars radius={250} count={2000} factor={4} fade speed={1} />
          <ambientLight intensity={0.5} />
          <CountdownDisplay onFinishTransition={handleLaunch} />
          <CircularAudioVisualizer soundRef={soundRef} radius={18} count={150} />
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/lofi.mp3" distance={30} loop />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <Stars radius={150} count={1000} factor={2} fade speed={0.2} />
          
          {/* Pháo hoa mới tối ưu */}
          <FireworkManager />
          
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/celebration.mp3" distance={50} loop />
          
          <CinematicTitle2D />
          
          {/* Feature Lì Xì */}
          <LuckyMoneyFeature />

          <ambientLight intensity={0.1} color="#000022" />
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

      <Canvas camera={{ position: [0, 8, 35], fov: 50 }} dpr={[1, 1.5]}> {/* Giới hạn DPR để giảm tải GPU */}
        <color attach="background" args={['#050505']} />
        <Environment preset="city" />
        <SceneContent 
          scene={scene} 
          handleLaunch={handleLaunch} 
          soundRef={soundRef} 
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
        />
        <EffectComposer disableNormalPass>
            {/* Bloom nhẹ, hiệu quả cao */}
            <Bloom luminanceThreshold={0.2} intensity={1.0} mipmapBlur />
        </EffectComposer>
        
        {scene === 'countdown' ? (
             <OrbitControls 
             enablePan={false} 
             minDistance={20} 
             maxDistance={100}
             maxPolarAngle={Math.PI / 2}
             minPolarAngle={0}
             enabled={true}
           />
        ) : (
            <OrbitControls 
                enablePan={false}
                enableZoom={false}
                autoRotate
                autoRotateSpeed={0.3} 
                maxPolarAngle={Math.PI / 1.8}
                minPolarAngle={Math.PI / 2.2}
            />
        )}
      </Canvas>
    </div>
  )
}

// --- GIỮ NGUYÊN PHẦN COUNTDOWN & DUST CŨ ---
function InteractiveDust({ count = 4000 }) {
  const mesh = useRef(); const { raycaster, camera } = useThree(); const shockwaveRef = useRef(0)
  const starTexture = useMemo(() => getParticleTexture(), [])
  useEffect(() => { const h = () => { shockwaveRef.current = 2.0 }; window.addEventListener('pointerdown', h); return () => window.removeEventListener('pointerdown', h) }, [])
  const [pos, col, orig, vel] = useMemo(() => {
    const p = new Float32Array(count * 3), c = new Float32Array(count * 3), o = new Float32Array(count * 3), v = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 200, y = (Math.random() - 0.5) * 200, z = (Math.random() - 0.5) * 200
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
  return (<points ref={mesh}><bufferGeometry><bufferAttribute attach="attributes-position" count={pos.length/3} array={pos} itemSize={3} /><bufferAttribute attach="attributes-color" count={col.length/3} array={col} itemSize={3} /></bufferGeometry><pointsMaterial size={0.6} vertexColors transparent map={starTexture} blending={THREE.AdditiveBlending} depthWrite={false} /></points>)
}

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

function ArcText({ text, radius = 15, startAngle = Math.PI * 0.7, endAngle = Math.PI * 0.3, fontSize = 0.8, textHeight = 0.3, verticalOffset = 0 }) {
    const fontUrl = '/happy-new-year-2026/fonts/Orbitron_Regular.json'
    const characters = text.split('')
    const totalAngle = startAngle - endAngle
    const angleStep = totalAngle / (characters.length - 1)
    return (
      <group position={[0, verticalOffset, 0]}>
        {characters.map((char, i) => {
          const angle = startAngle - (angleStep * i); const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius
          return (<group key={i} position={[x, y, 0]} rotation={[0, 0, angle - Math.PI / 2]}><Center><Text3D font={fontUrl} size={fontSize} height={textHeight} bevelEnabled curveSegments={8}>{char}<RainbowMaterial /></Text3D></Center></group>)
        })}
      </group>
    )
}

function MechanicalButton({ onActivate }) {
  const [hovered, setHover] = useState(false); const [pressed, setPressed] = useState(false); const outerGroupRef = useRef(); const buttonCoreRef = useRef()
  useFrame((state) => {
    if (outerGroupRef.current) outerGroupRef.current.lookAt(state.camera.position)
    if (buttonCoreRef.current) { const targetZ = pressed ? -0.8 : 0; buttonCoreRef.current.position.z = THREE.MathUtils.lerp(buttonCoreRef.current.position.z, targetZ, 0.4) }
  })
  return (
    <group ref={outerGroupRef}>
      <Cylinder args={[3, 3.2, 0.5, 64]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.4]}><meshStandardMaterial color="#050505" metalness={1} roughness={0.2} /></Cylinder>
      <group onPointerOver={() => setHover(true)} onPointerOut={() => (setHover(false), setPressed(false))} onPointerDown={() => { setPressed(true); playCustomClick(); }} onPointerUp={() => { setPressed(false); onActivate() }} ref={buttonCoreRef}>
        <Cylinder args={[2, 2.1, 0.8, 64]} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color={hovered ? "#ff0033" : "#220000"} metalness={1} emissive="#ff0000" emissiveIntensity={hovered ? 1.2 : 0.1}/></Cylinder>
      </group>
      <Center position={[0, -4.8, 0]}><Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={0.5} height={0.1}>LAUNCH 2026<meshStandardMaterial color="white" /></Text3D></Center>
    </group>
  )
}

function RainbowMaterial() {
    const matRef = useRef(); useFrame((state) => { if (matRef.current) { const hue = (state.clock.getElapsedTime() * 0.1) % 1; matRef.current.color.setHSL(hue, 1, 0.5); matRef.current.emissive.setHSL(hue, 1, 0.2); } })
    return <meshPhysicalMaterial ref={matRef} metalness={1} roughness={0.1} emissiveIntensity={0.5} />
}