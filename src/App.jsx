import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// LƯU Ý: Nếu bạn không có các file component con này, hãy comment dòng import lại.
// Code dưới đây vẫn chạy tốt mà không cần các nút bấm âm thanh phụ trợ.
// import CinematicVolume from './CinematicVolume'
// import CinematicPlayButton from './CinematicPlayButton'
// import CircularAudioVisualizer from './CircularAudioVisualizer'
// import MusicToggleButton from './MusicToggleButton'
// import VolumeControl from './VolumeControl'

const isTesting = true; // Chế độ test: countdown 15s. Đổi thành false để chạy ngày thật.

// --- 1. UTILS & AUDIO ---
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

// --- 2. FIREWORKS & VISUALS (3D) ---
function OptimizedFirework({ position, color, texture }) {
  const pointsRef = useRef()
  const count = 80 
  const [particles] = useState(() => {
    const data = []
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 0.5 + Math.random() * 0.8 
      data.push({
        velocity: new THREE.Vector3(Math.sin(phi) * Math.cos(theta) * speed, Math.sin(phi) * Math.sin(theta) * speed, Math.cos(phi) * speed),
        life: 1.0 - Math.random() * 0.2
      })
    }
    return data
  })
  const bufferGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [count])

  useFrame((state, delta) => {
    if (!pointsRef.current) return
    const positions = pointsRef.current.geometry.attributes.position.array
    for (let i = 0; i < count; i++) {
      const p = particles[i]
      if (p.life > 0) {
        positions[i*3] += p.velocity.x * delta * 15 
        positions[i*3+1] += p.velocity.y * delta * 15
        positions[i*3+2] += p.velocity.z * delta * 15
        p.velocity.y -= 0.02
        p.velocity.multiplyScalar(0.96) 
        p.life -= delta * 0.8
      } else { positions[i*3] = 9999 }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true
    pointsRef.current.material.opacity = Math.max(0, pointsRef.current.material.opacity - delta * 0.3)
  })

  return (
    <points ref={pointsRef} position={position}>
      <primitive object={bufferGeo} />
      <pointsMaterial size={1.2} map={texture} color={color} transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

function FireworkManager() {
  const [fireworks, setFireworks] = useState([])
  const texture = useMemo(() => getParticleTexture(), [])
  useEffect(() => {
    const interval = setInterval(() => {
      const id = Math.random()
      const colors = ['#ff0000', '#ffa500', '#ffd700', '#00ffcc', '#ff00ff']
      const newF = {
        id,
        pos: [(Math.random() - 0.5) * 60, 10 + Math.random() * 20, (Math.random() - 0.5) * 30],
        color: new THREE.Color(colors[Math.floor(Math.random() * colors.length)])
      }
      setFireworks(prev => [...prev.slice(-10), newF])
    }, 800) 
    return () => clearInterval(interval)
  }, [])
  return <>{fireworks.map(f => <OptimizedFirework key={f.id} position={f.pos} color={f.color} texture={texture} />)}</>
}

// --- 3. UI COMPONENTS (REDESIGNED) ---

// 3.1 Cinematic Title (NEW DESIGN - GOLD TEXT)
function CinematicTitle2D() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Great+Vibes&family=Montserrat:wght@300;600&display=swap');
          
          .cinematic-container {
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            width: 100%; height: 100%; text-align: center;
            perspective: 1000px;
          }

          /* Hiệu ứng chữ vàng kim loại */
          .gold-text {
            background: linear-gradient(to bottom, #cfc09f 22%, #634f2c 24%, #cfc09f 26%, #cfc09f 27%, #ffecb3 40%, #3a2c0f 78%); 
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            color: #fff;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
            position: relative;
          }

          .line-1 { 
            font-family: 'Cinzel', serif; 
            font-size: 2.5rem; 
            letter-spacing: 1rem; 
            text-transform: uppercase;
            animation: fadeDown 2s ease-out forwards 0.5s; 
            opacity: 0; 
            margin-bottom: -10px;
          }
          
          .line-2 { 
            font-family: 'Cinzel', serif; 
            font-size: 12rem; 
            font-weight: 700; 
            line-height: 1;
            background: linear-gradient(135deg, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 20px rgba(255, 200, 0, 0.4));
            animation: scaleIn 3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 1s; 
            opacity: 0; 
            transform: scale(0.8);
          }

          .line-3 { 
            font-family: 'Great Vibes', cursive; 
            font-size: 3.5rem; 
            color: #ffecd2; 
            margin-top: 10px;
            text-shadow: 0 0 10px rgba(255,0,0,0.8);
            animation: fadeInUp 2s ease-out forwards 2.5s; 
            opacity: 0; 
          }

          @keyframes fadeDown { 
            from { opacity: 0; transform: translateY(-30px); letter-spacing: 2rem; } 
            to { opacity: 1; transform: translateY(0); letter-spacing: 1rem; } 
          }
          @keyframes scaleIn { 
            from { opacity: 0; transform: scale(0.5); letter-spacing: -20px; } 
            to { opacity: 1; transform: scale(1); letter-spacing: 0px; } 
          }
          @keyframes fadeInUp { 
            from { opacity: 0; transform: translateY(30px); } 
            to { opacity: 1; transform: translateY(0); } 
          }

          @media (max-width: 768px) { 
            .line-1 { font-size: 1.2rem; letter-spacing: 0.5rem; } 
            .line-2 { font-size: 6rem; } 
            .line-3 { font-size: 2rem; }
          }
        `}
      </style>
      <div className="cinematic-container">
        <div className="line-1 gold-text">Happy New Year</div>
        <div className="line-2">2026</div>
        <div className="line-3">Cung Chúc Tân Xuân</div>
      </div>
    </div>
  )
}

// 3.2 Lucky Money Feature (NEW DESIGN - 3D ENVELOPE)
const DENOMINATIONS = [
  { value: "50.000", bg: "linear-gradient(135deg, #e492b2 0%, #b56585 100%)", text: "Tình duyên phơi phới" },
  { value: "100.000", bg: "linear-gradient(135deg, #95c783 0%, #4e7040 100%)", text: "Sức khỏe dồi dào" },
  { value: "200.000", bg: "linear-gradient(135deg, #e09f8d 0%, #a34e3c 100%)", text: "Phát tài phát lộc" },
  { value: "500.000", bg: "linear-gradient(135deg, #74dadd 0%, #2c7a7d 100%)", text: "Vạn sự như ý" }
];

function LuckyMoneyFeature() {
  const [step, setStep] = useState(0);
  const [selectedMoney, setSelectedMoney] = useState(null);

  const pickRandomMoney = () => {
    const rand = Math.random();
    if (rand < 0.3) return DENOMINATIONS[0];
    if (rand < 0.6) return DENOMINATIONS[1];
    if (rand < 0.85) return DENOMINATIONS[2];
    return DENOMINATIONS[3];
  };

  const handleOpenDeck = () => { playCustomClick(); setStep(1); };
  const handlePickEnvelope = () => { 
    playCustomClick(); 
    const money = pickRandomMoney(); 
    setSelectedMoney(money); 
    setStep(2); 
  };
  const handleClose = () => { setStep(0); setSelectedMoney(null); };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
      <style>
        {`
          /* === BACKDROP & GENERAL === */
          .overlay-backdrop {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.9); backdrop-filter: blur(10px);
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            pointer-events: auto; animation: fadeInOverlay 0.5s ease;
          }
          @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }

          /* === BUTTON NHỎ GÓC MÀN HÌNH === */
          .lucky-btn-container {
            position: absolute; bottom: 40px; left: 40px;
            pointer-events: auto; cursor: pointer;
            animation: bounceFloat 2s infinite ease-in-out;
            filter: drop-shadow(0 0 15px rgba(255,0,0,0.6));
          }
          .mini-icon {
            font-size: 50px; 
            background: radial-gradient(circle, #ffeb3b, #fbc02d);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          }
          @keyframes bounceFloat { 
            0%, 100% { transform: translateY(0) rotate(-5deg); } 
            50% { transform: translateY(-15px) rotate(5deg); } 
          }

          /* === ANIMATION MỞ BAO LÌ XÌ === */
          .envelope-wrapper {
            position: relative; width: 280px; height: 380px;
            display: flex; justify-content: center; align-items: flex-end;
          }
          
          /* Phong bao đỏ */
          .red-envelope-body {
            position: absolute; bottom: 0; left: 0;
            width: 100%; height: 100%;
            background: linear-gradient(135deg, #d00000, #8a0000);
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            z-index: 10;
            overflow: hidden;
            border: 2px solid #ffd700;
          }
          /* Hoa văn trên bao */
          .red-envelope-body::before {
            content: ''; position: absolute; inset: 10px;
            border: 1px dashed rgba(255, 215, 0, 0.3); border-radius: 8px;
          }
          .center-char {
            position: absolute; top: 55%; left: 50%;
            transform: translate(-50%, -50%);
            font-size: 80px; color: #ffd700;
            font-family: serif; font-weight: bold;
            text-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 11;
          }

          /* Nắp bao (Flap) */
          .envelope-cap {
            position: absolute; top: 0; left: 0; width: 100%; height: 35%;
            background: #b30000;
            clip-path: polygon(0 0, 100% 0, 50% 100%);
            transform-origin: top;
            z-index: 15;
            transition: transform 0.6s 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            border-top: 4px solid #ffd700;
          }
          /* Khi mở, nắp lật lên */
          .envelope-wrapper.open .envelope-cap {
            transform: rotateX(180deg);
            z-index: 1; /* Ra sau tờ tiền */
          }

          /* Tờ tiền */
          .money-card {
            position: absolute; bottom: 10px; left: 15px; right: 15px; height: 90%;
            border-radius: 8px;
            display: flex; flex-direction: column; justify-content: space-between;
            padding: 15px; box-sizing: border-box;
            color: #fff;
            box-shadow: 0 0 20px rgba(0,0,0,0.2);
            transform: translateY(0) scale(0.9);
            z-index: 5; /* Nằm trong bao */
            transition: all 1s 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          /* Họa tiết tiền Polymer */
          .money-pattern {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            opacity: 0.1;
            background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, #fff 10px, #fff 11px);
            z-index: 0;
          }
          .money-content { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
          
          /* Khi mở, tiền bay lên */
          .envelope-wrapper.open .money-card {
            transform: translateY(-200px) scale(1.1);
            z-index: 20; /* Bay lên trên bao */
            box-shadow: 0 30px 60px rgba(0,0,0,0.6);
          }

          .money-val { font-size: 36px; font-weight: 800; font-family: 'Montserrat', sans-serif; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
          .money-label { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; }
          .money-circle { 
            width: 80px; height: 80px; border-radius: 50%; 
            border: 2px solid rgba(255,255,255,0.4); 
            align-self: center; display: flex; align-items: center; justify-content: center;
            font-size: 10px; color: rgba(255,255,255,0.7);
          }

          /* === TEXT LỜI CHÚC & NÚT === */
          .wish-text-container {
            margin-top: 150px; text-align: center; color: #fff;
            opacity: 0; animation: fadeInText 1s ease 1.5s forwards;
          }
          .wish-main { font-family: 'Cinzel', serif; font-size: 1.8rem; color: #ffd700; margin-bottom: 10px; }
          .wish-sub { font-family: 'Montserrat', sans-serif; font-size: 1rem; color: #ddd; font-style: italic; }

          .close-btn {
            margin-top: 30px;
            padding: 12px 40px;
            background: linear-gradient(90deg, #ffd700, #fdb931);
            color: #8a0000;
            font-weight: 800; text-transform: uppercase; letter-spacing: 1px;
            border: none; border-radius: 50px;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
            cursor: pointer;
            transition: transform 0.2s;
          }
          .close-btn:hover { transform: scale(1.05); background: #fff; }

          /* === STEP 1: CHỌN BAO === */
          .deck-container { display: flex; gap: 30px; perspective: 1000px; flex-wrap: wrap; justify-content: center; }
          .deck-envelope {
            width: 100px; height: 160px;
            background: #d00000;
            border: 2px solid #ffd700; border-radius: 8px;
            cursor: pointer;
            position: relative;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            transition: transform 0.3s;
            display: flex; justify-content: center; align-items: center;
          }
          .deck-envelope:hover { transform: translateY(-20px) rotate(2deg); box-shadow: 0 15px 35px rgba(255, 215, 0, 0.3); }
          .deck-envelope::after { content: '福'; color: #ffd700; font-size: 40px; font-family: serif; border: 2px solid #ffd700; padding: 5px; border-radius: 50%; }

          @keyframes fadeInText { to { opacity: 1; margin-top: 80px; } }
          
          @media (max-width: 600px) {
             .envelope-wrapper { transform: scale(0.8); }
             .money-val { font-size: 28px; }
             .deck-container { gap: 15px; }
             .deck-envelope { width: 80px; height: 130px; }
          }
        `}
      </style>

      {/* Step 0: Nút mở ban đầu */}
      {step === 0 && (
        <div className="lucky-btn-container" onClick={handleOpenDeck}>
          <div style={{ textAlign: 'center' }}>
            <div className="mini-icon">🧧</div>
            <div style={{ color: '#ffd700', fontWeight: 'bold', textShadow: '0 2px 4px #000', marginTop: 5 }}>RÚT LÌ XÌ</div>
          </div>
        </div>
      )}

      {/* Step 1: Chọn bao lì xì */}
      {step === 1 && (
        <div className="overlay-backdrop">
          <h2 style={{ color: '#ffd700', fontFamily: 'Cinzel, serif', fontSize: '2rem', marginBottom: 50, textShadow: '0 0 10px #ff0000' }}>
            CHỌN LỘC ĐẦU NĂM
          </h2>
          <div className="deck-container">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="deck-envelope" onClick={handlePickEnvelope}></div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Mở bao & Kết quả */}
      {step === 2 && selectedMoney && (
        <div className="overlay-backdrop">
          {/* Wrapper bao lì xì với class 'open' để kích hoạt animation */}
          <div className="envelope-wrapper open">
            
            {/* Tờ tiền */}
            <div className="money-card" style={{ background: selectedMoney.bg }}>
              <div className="money-pattern"></div>
              <div className="money-content">
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="money-label">VN STATE BANK</div>
                    <div className="money-label">{selectedMoney.value}</div>
                 </div>
                 <div className="money-circle">VN2026</div>
                 <div className="money-val" style={{ textAlign: 'center' }}>{selectedMoney.value} <span style={{fontSize: 20}}>VND</span></div>
              </div>
            </div>

            {/* Thân bao đỏ (đè lên phần dưới tiền khi chưa bay lên) */}
            <div className="red-envelope-body">
              <div className="center-char">福</div>
            </div>
            
            {/* Nắp bao (lật lên) */}
            <div className="envelope-cap"></div>
          </div>

          <div className="wish-text-container">
            <div className="wish-main">CHÚC MỪNG NĂM MỚI</div>
            <div className="wish-sub">"{selectedMoney.text}"</div>
            <button className="close-btn" onClick={handleClose}>Nhận Lộc</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 4. SCENE CONTENT (3D) ---
function SceneContent({ scene, handleLaunch, soundRef, isPlaying, setIsPlaying }) {
  const { camera } = useThree()
  const hasAutoPlayed = useRef(false)
  useEffect(() => { if (scene === 'fireworks') { camera.position.set(0, 0, 40); camera.lookAt(0, 0, 0) } }, [scene, camera])
  
  // Auto play logic
  useEffect(() => {
    if (scene === 'fireworks' && !hasAutoPlayed.current && soundRef.current) {
      setTimeout(() => { 
        if (soundRef.current && soundRef.current.play) soundRef.current.play(); 
        setIsPlaying(true); 
        hasAutoPlayed.current = true 
      }, 200)
    }
  }, [scene, soundRef, setIsPlaying])

  return (
    <>
      {scene === 'countdown' ? (
        <Suspense fallback={null}>
          <InteractiveDust count={4000} />
          <Stars radius={250} count={2000} factor={4} fade speed={1} />
          <ambientLight intensity={0.5} />
          {/* COUNTDOWN & BUTTON (GIỮ NGUYÊN) */}
          <CountdownDisplay onFinishTransition={handleLaunch} />
          {/* Audio Visualizer nếu có */}
          {/* <CircularAudioVisualizer soundRef={soundRef} radius={18} count={150} /> */}
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/lofi.mp3" distance={30} loop />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <Stars radius={150} count={1000} factor={2} fade speed={0.2} />
          <FireworkManager />
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/celebration.mp3" distance={50} loop />
          <ambientLight intensity={0.1} color="#000022" />
        </Suspense>
      )}
    </>
  )
}

// --- 5. MAIN APP ---
export default function App() {
  const soundRef = useRef()
  const [scene, setScene] = useState('countdown')
  const [flash, setFlash] = useState(0)
  const [isUiVisible, setUiVisible] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(2.0)

  const handleLaunch = () => {
    setUiVisible(false) // Ẩn nút launch
    setFlash(1) // Hiệu ứng flash
    setTimeout(() => {
      setScene('fireworks')
      const fade = setInterval(() => {
        setFlash(prev => { if (prev <= 0) { clearInterval(fade); return 0; } return prev - 0.05 })
      }, 30)
    }, 600)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000', overflow: 'hidden' }}>
      
      {/* CÁC COMPONENT PHỤ (Nếu có file import thì bỏ comment) */}
      {/* {isUiVisible && (
        <>
          <CinematicVolume soundRef={soundRef} />
          <CinematicPlayButton soundRef={soundRef} />
        </>
      )} */}

      {scene === 'fireworks' && (
        <>
          {/* UI ĐIỀU KHIỂN NHẠC (Nếu có file import) */}
          {/* <MusicToggleButton soundRef={soundRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
          <VolumeControl soundRef={soundRef} volume={volume} setVolume={setVolume} /> */}
          
          {/* === CÁC PHẦN ĐÃ ĐƯỢC REDESIGN === */}
          <CinematicTitle2D />
          <LuckyMoneyFeature />
        </>
      )}
      
      {/* Flash Effect Layer */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: flash, zIndex: 50, pointerEvents: 'none' }} />

      {/* 3D CANVAS LAYER */}
      <Canvas camera={{ position: [0, 8, 35], fov: 50 }} dpr={[1, 1.5]}>
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
            <Bloom luminanceThreshold={0.2} intensity={1.0} mipmapBlur />
        </EffectComposer>
        
        {scene === 'countdown' ? (
             <OrbitControls enablePan={false} minDistance={20} maxDistance={100} maxPolarAngle={Math.PI / 2} minPolarAngle={0} enabled={true} />
        ) : (
            <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.3} maxPolarAngle={Math.PI / 1.8} minPolarAngle={Math.PI / 2.2} />
        )}
      </Canvas>
    </div>
  )
}

// --- UTILS COMPONENTS (KEPT ORIGINAL) ---

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
      // Giữ nguyên logic time countdown như yêu cầu
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