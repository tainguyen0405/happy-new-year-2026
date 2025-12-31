import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
// Đã bỏ 'Text' khỏi import dưới đây
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// --- CÁC COMPONENT CON ---
import CircularAudioVisualizer from './CircularAudioVisualizer'

// Set false để chạy đúng giờ thực tế
const isTesting = true; 

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

// --- TÍNH NĂNG MỚI 1: HỆ THỐNG ĐÈN TRỜI (KHÔNG HIỂN THỊ TEXT 3D) ---
function Lantern({ position, onRemove }) {
    const ref = useRef()
    const [wobbleOffset] = useState(() => Math.random() * Math.PI * 2)
    
    useFrame((state, delta) => {
        if (!ref.current) return
        // Bay lên
        ref.current.position.y += delta * (0.8 + Math.random() * 0.5)
        // Đung đưa nhẹ
        ref.current.position.x += Math.sin(state.clock.elapsedTime + wobbleOffset) * 0.005
        ref.current.position.z += Math.cos(state.clock.elapsedTime + wobbleOffset) * 0.005
        
        // Xoay nhẹ
        ref.current.rotation.y += delta * 0.2

        // Xóa khi bay quá cao
        if (ref.current.position.y > 60) {
            onRemove()
        }
    })

    return (
        <group ref={ref} position={position}>
            {/* Thân đèn */}
            <mesh>
                <cylinderGeometry args={[0.3, 0.2, 0.6, 16, 1, true]} />
                <meshBasicMaterial color="#ffaa00" side={THREE.DoubleSide} transparent opacity={0.8} />
            </mesh>
            {/* Đáy đèn */}
            <mesh position={[0, -0.3, 0]}>
                <ringGeometry args={[0.1, 0.2, 16]} />
                <meshBasicMaterial color="#cc8800" side={THREE.DoubleSide} />
            </mesh>
            {/* Ánh sáng bên trong */}
            <pointLight distance={5} intensity={1.5} color="#ffaa00" decay={2} />
        </group>
    )
}

function LanternManager() {
    const [lanterns, setLanterns] = useState([])

    // Tự động thả vài đèn nền
    useFrame((state) => {
        if (Math.random() < 0.005) { 
            spawnLantern(false)
        }
    })

    // Lắng nghe sự kiện thả đèn từ UI
    useEffect(() => {
        const handleSpawn = (e) => {
            // Nhận message nhưng không hiển thị lên đèn nữa (chỉ mang tính tượng trưng)
            spawnLantern(true);
        };
        window.addEventListener('spawn-lantern', handleSpawn);
        return () => window.removeEventListener('spawn-lantern', handleSpawn);
    }, []);

    const spawnLantern = (fromBottom = false) => {
        const x = (Math.random() - 0.5) * 60
        const z = (Math.random() - 0.5) * 40
        const y = fromBottom ? -10 : -10 + Math.random() * 20 
        const id = Math.random()
        setLanterns(prev => [...prev, { id, position: [x, y, z] }])
    }

    const removeLantern = (id) => {
        setLanterns(prev => prev.filter(l => l.id !== id))
    }

    return (
        <group>
             {lanterns.map(l => (
                 <Lantern key={l.id} position={l.position} onRemove={() => removeLantern(l.id)} />
             ))}
        </group>
    )
}


// --- 2. HỆ THỐNG PHÁO HOA (VISUALS) ---

// 2.1 Component Tên Lửa
function Rocket({ position, targetHeight, color, onExplode }) {
    const ref = useRef()
    const exploded = useRef(false) 
    const speed = 20 + Math.random() * 10
    
    useFrame((state, delta) => {
        if (!ref.current || exploded.current) return 
        
        ref.current.position.y += speed * delta
        ref.current.position.x += Math.sin(state.clock.elapsedTime * 10) * 0.02
        
        if (ref.current.position.y >= targetHeight) {
            exploded.current = true 
            ref.current.visible = false 
            onExplode(ref.current.position.clone()) 
        }
    })

    return (
        <mesh ref={ref} position={position}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color={color} toneMapped={false} />
            <mesh position={[0, -0.6, 0]}>
                 <cylinderGeometry args={[0.05, 0, 1.2, 8]} />
                 <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
            </mesh>
        </mesh>
    )
}

// 2.2 Helper tạo hình dáng (Trái tim, Sao, Liễu...)
const createFireworkParticles = (count, type, color) => {
    const data = []
    const baseSpeed = type === 'willow' ? 0.3 : (0.6 + Math.random() * 0.5)

    for (let i = 0; i < count; i++) {
        let velocity = new THREE.Vector3()
        
        if (type === 'heart') {
            const t = (i / count) * Math.PI * 2 
            const x = 16 * Math.pow(Math.sin(t), 3)
            const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)
            const z = (Math.random() - 0.5) * 4 
            velocity.set(x, y, z).multiplyScalar(0.04) 
            const euler = new THREE.Euler(0, Math.random() * Math.PI, 0) 
            velocity.applyEuler(euler)

        } else if (type === 'star') {
            const points = 5
            const angle = (i / count) * Math.PI * 2 * points 
            const isTip = Math.floor(i / (count / (points * 2))) % 2 === 0
            const radius = isTip ? 1.2 : 0.5 
            const x = Math.cos(angle) * radius
            const y = Math.sin(angle) * radius
            const z = (Math.random() - 0.5) * 0.5
            velocity.set(x, y, z).multiplyScalar(baseSpeed)
            const euler = new THREE.Euler(Math.random(), Math.random(), 0)
            velocity.applyEuler(euler)

        } else if (type === 'sphere_small') {
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)
            velocity.set(
                Math.sin(phi) * Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi)
            ).normalize().multiplyScalar(baseSpeed * 0.5)

        } else {
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)
            velocity.set(
                Math.sin(phi) * Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi)
            ).normalize().multiplyScalar(baseSpeed)
        }

        data.push({
            velocity,
            life: 1.0 + Math.random() * 0.3,
            color: new THREE.Color(color)
        })
    }
    return data
}

// 2.3 Component Vụ Nổ
function Explosion({ position, color, type, texture, onFinish }) {
    const pointsRef = useRef()
    const count = type === 'willow' ? 80 : (type === 'heart' || type === 'star' ? 150 : 100)
    const [particles] = useState(() => createFireworkParticles(count, type, color))

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
                aliveCount++
                positions[i*3]   += p.velocity.x * delta * 15
                positions[i*3+1] += p.velocity.y * delta * 15
                positions[i*3+2] += p.velocity.z * delta * 15

                if (type === 'willow') {
                    p.velocity.y -= 0.03 
                    p.velocity.multiplyScalar(0.92) 
                    p.life -= delta * 0.4 
                } else {
                    p.velocity.y -= 0.015 
                    p.velocity.multiplyScalar(0.96) 
                    p.life -= delta * 0.8
                }
            } else {
                positions[i*3] = 99999 
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true
        
        if (type === 'willow') {
             pointsRef.current.material.opacity = Math.max(0, pointsRef.current.material.opacity - delta * 0.2)
        } else {
             pointsRef.current.material.opacity = Math.max(0, pointsRef.current.material.opacity - delta * 0.5)
        }
        
        if (aliveCount === 0) onFinish()
    })

    return (
        <points ref={pointsRef} position={position}>
            <primitive object={bufferGeo} />
            <pointsMaterial size={type === 'willow' ? 0.8 : 1.2} map={texture} color={color} transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
    )
}

// 2.4 Quản lý chung - Logic né cửa sổ
function FireworkManager() {
    const [rockets, setRockets] = useState([])
    const [explosions, setExplosions] = useState([])
    const texture = useMemo(() => getParticleTexture(), [])
    const timerRef = useRef(0)

    useFrame((state, delta) => {
        timerRef.current += delta
        if (timerRef.current > 0.6 + Math.random() * 0.6) {
            timerRef.current = 0
            
            const rand = Math.random()
            let type = 'sphere'
            if (rand > 0.80) type = 'heart'      
            else if (rand > 0.60) type = 'star'  
            else if (rand > 0.45) type = 'willow'
            else if (rand > 0.30) type = 'multi' 

            const colors = ['#ff0000', '#ffa500', '#ffd700', '#00ffcc', '#ff00ff', '#ffffff']
            const color = colors[Math.floor(Math.random() * colors.length)]
            const id = Math.random()

            // Toạ độ spawn
            let x = (Math.random() - 0.5) * 50; 
            let targetH;
            if (Math.abs(x) < 12) {
                targetH = 8 + Math.random() * 12; // Ở giữa thì bắn cao
            } else {
                targetH = -5 + Math.random() * 15; // Ở 2 bên thì bắn thấp
            }
            const z = (Math.random() - 0.5) * 20; 
            
            setRockets(prev => [...prev, { id, position: [x, -15, z], targetHeight: targetH, color, type }])
        }
    })

    const handleExplode = (rocketId, pos, color, type) => {
        setRockets(prev => prev.filter(r => r.id !== rocketId))
        if (type === 'multi') {
            const color2 = '#ffffff' 
            setExplosions(prev => [
                ...prev,
                { id: Math.random(), position: pos, color: color, type: 'sphere', texture },
                { id: Math.random(), position: pos, color: color2, type: 'sphere_small', texture } 
            ])
        } else {
            setExplosions(prev => [...prev, { id: Math.random(), position: pos, color, type, texture }])
        }
    }

    const removeExplosion = (id) => {
        setExplosions(prev => prev.filter(e => e.id !== id))
    }

    return (
        <>
            {rockets.map(r => (
                <Rocket 
                    key={r.id} 
                    position={r.position} 
                    targetHeight={r.targetHeight} 
                    color={r.color} 
                    onExplode={(pos) => handleExplode(r.id, pos, r.color, r.type)} 
                />
            ))}
            {explosions.map(e => (
                <Explosion 
                    key={e.id} 
                    position={e.position} 
                    color={e.color} 
                    type={e.type} 
                    texture={e.texture}
                    onFinish={() => removeExplosion(e.id)} 
                />
            ))}
        </>
    )
}

// --- 3. UI COMPONENTS (CONTROLS TÍCH HỢP) ---

function CinematicIntegratedControls({ soundRef, isPlaying, setIsPlaying }) {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const previousVolume = useRef(1);

  // Đồng bộ volume khi mount
  useEffect(() => {
    if (soundRef.current) {
      setVolume(soundRef.current.getVolume());
    }
  }, [soundRef]);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!soundRef.current) return;
    if (soundRef.current.context.state === 'suspended') soundRef.current.context.resume();
    
    if (isPlaying) {
      soundRef.current.pause();
      setIsPlaying(false);
    } else {
      soundRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!soundRef.current) return;
    
    if (isMuted) {
      soundRef.current.setVolume(previousVolume.current);
      setVolume(previousVolume.current);
      setIsMuted(false);
    } else {
      previousVolume.current = volume;
      soundRef.current.setVolume(0);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (soundRef.current) soundRef.current.setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  return (
    <div 
      style={{ position: 'absolute', bottom: '80px', right: '50px', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      <style>
        {`
          .control-group {
            display: flex; align-items: center; gap: 15px;
            padding: 12px 20px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 40px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
          }
          .control-group:hover { background: rgba(255, 255, 255, 0.15); transform: scale(1.05); }
          .icon-btn { cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.8; transition: 0.2s; }
          .icon-btn:hover { opacity: 1; transform: scale(1.1); }
          .slider-container {
            width: 36px; height: 120px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            display: flex; justify-content: center; align-items: center;
            margin-bottom: 10px;
            opacity: 0; transform: translateY(20px) scale(0.9);
            pointer-events: none;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            position: absolute; bottom: 100%; left: 12px;
          }
          .slider-container.show { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
          .vol-range { -webkit-appearance: none; width: 100px; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; outline: none; transform: rotate(-90deg); }
          .vol-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fff; cursor: pointer; box-shadow: 0 0 10px rgba(255,255,255,0.5); }
        `}
      </style>

      {/* Slider trượt lên */}
      <div className={`slider-container ${showSlider ? 'show' : ''}`}>
        <input type="range" min="0" max="2" step="0.05" value={volume} onChange={handleVolumeChange} className="vol-range" />
      </div>

      {/* Thanh điều khiển chính */}
      <div className="control-group">
        <div className="icon-btn" onClick={toggleMute}>
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            {isMuted || volume === 0 ? (<><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></>) : (<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>)}
          </svg>
        </div>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.3)' }}></div>
        <div className="icon-btn" onClick={togglePlay}>
          {isPlaying ? (
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          ) : (
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          )}
        </div>
      </div>
    </div>
  );
}

// 3.3 Title 2D - Code Window Style
function CinematicTitle2D() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cinzel:wght@400;700&family=Montserrat:wght@300;600&display=swap');
          .cinematic-wrapper { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; perspective: 1000px; }
          .code-window { background: rgba(15, 15, 25, 0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; padding: 40px 60px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6); position: relative; min-width: 600px; animation: floatWindow 6s ease-in-out infinite; transform-style: preserve-3d; }
          .window-header { position: absolute; top: 20px; left: 24px; display: flex; gap: 8px; }
          .dot { width: 12px; height: 12px; border-radius: 50%; }
          .dot.red { background: #ff5f56; } .dot.yellow { background: #ffbd2e; } .dot.green { background: #27c93f; }
          .window-label { position: absolute; top: 18px; right: 24px; font-family: 'Montserrat', monospace; font-size: 0.8rem; color: rgba(255,255,255,0.4); font-weight: 600; }
          .text-glow { text-shadow: 0 0 10px rgba(255, 215, 0, 0.3), 0 0 20px rgba(255, 215, 0, 0.2); }
          .line-happy { font-family: 'Great Vibes', cursive; font-size: 3.5rem; color: #ffecd2; opacity: 0; transform: translateY(20px); animation: elegantFadeUp 2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 0.5s; }
          .line-year { font-family: 'Cinzel', serif; font-size: 8rem; font-weight: 800; line-height: 1; margin: 10px 0; background: linear-gradient(to bottom, #cfc09f 22%, #634f2c 24%, #cfc09f 26%, #cfc09f 27%, #ffecb3 40%, #3a2c0f 78%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; opacity: 0; transform: scale(0.9); filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.4)); animation: zoomInGold 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 1s; }
          .line-sub { font-family: 'Montserrat', sans-serif; margin-top: 15px; font-size: 1rem; letter-spacing: 0.8rem; text-transform: uppercase; color: #ffffff; opacity: 0; animation: fadeInSub 3s ease forwards 3s; border-top: 1px solid rgba(255,255,255,0.3); border-bottom: 1px solid rgba(255,255,255,0.3); padding: 10px 20px; }
          @keyframes floatWindow { 0%, 100% { transform: translateY(0px) rotateX(0deg); } 50% { transform: translateY(-20px) rotateX(2deg); } }
          @keyframes elegantFadeUp { to { opacity: 1; transform: translateY(0); } }
          @keyframes zoomInGold { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
          @keyframes fadeInSub { to { opacity: 0.9; letter-spacing: 1rem; } }
          @media (max-width: 768px) { .code-window { min-width: 90%; padding: 30px 20px; } .line-happy { font-size: 2.5rem; } .line-year { font-size: 4rem; } .line-sub { font-size: 0.7rem; letter-spacing: 0.3rem; } }
        `}
      </style>
      <div className="cinematic-wrapper">
        <div className="code-window">
          <div className="window-header">
            <div className="dot red"></div><div className="dot yellow"></div><div className="dot green"></div>
          </div>
          <div className="window-label">TaiNguyen0405.jsx</div>
          <div className="line-happy text-glow">Happy New Year</div>
          <div className="line-year">2026</div>
          <div className="line-sub">Vạn Sự Như Ý - Tỷ Sự Như Mơ</div>
        </div>
      </div>
    </div>
  )
}

// --- TÍNH NĂNG MỚI 2: GIEO QUẺ & THẢ ĐÈN UI ---
const FORTUNES = [
    { name: "Đại Cát", poem: "Năm mới lộc đến đầy nhà\nCông danh tấn tới vinh hoa rạng ngời." },
    { name: "Trung Cát", poem: "Bình an, sức khỏe dồi dào\nGia đạo êm ấm, ngọt ngào yêu thương." },
    { name: "Tiểu Cát", poem: "Khó khăn rồi sẽ qua mau\nKiên trì nhẫn nại, về sau an nhàn." },
    { name: "Thượng Thượng", poem: "Cầu gì được nấy hanh thông\nTiền tài sự nghiệp như rồng bay cao." },
    { name: "Quý Nhân", poem: "Ra đường gặp được quý nhân\nViệc làm suôn sẻ, muôn phần mắn may." }
];

function FeatureButtons() {
    const [fortuneStep, setFortuneStep] = useState(0); // 0: closed, 1: shaking, 2: result
    const [currentFortune, setCurrentFortune] = useState(null);
    const [lanternStep, setLanternStep] = useState(0); // 0: closed, 1: input
    const [wishMessage, setWishMessage] = useState("");

    // Gieo quẻ logic
    const handleGieoQue = () => {
        playCustomClick();
        setFortuneStep(1); 
        setTimeout(() => {
            const randomFortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
            setCurrentFortune(randomFortune);
            setFortuneStep(2); 
        }, 2000);
    };

    const closeFortune = () => {
        setFortuneStep(0);
        setCurrentFortune(null);
    };

    // Thả đèn logic (Mở popup nhập liệu)
    const handleOpenLanternInput = () => {
        playCustomClick();
        setWishMessage(""); // Reset message
        setLanternStep(1);
    };

    const handleReleaseLantern = () => {
        playCustomClick();
        // Bắn sự kiện kèm message (tuy nhiên 3D không hiển thị nữa)
        window.dispatchEvent(new CustomEvent('spawn-lantern', { detail: { message: wishMessage } }));
        setLanternStep(0);
    };

    return (
        <>
            <style>
                {`
                    .feature-dock {
                        position: absolute; bottom: 70px; left: 120px;
                        display: flex; gap: 20px;
                        pointer-events: auto; z-index: 100;
                    }
                    .feature-btn {
                        display: flex; flex-direction: column; align-items: center;
                        cursor: pointer; transition: transform 0.2s;
                    }
                    .feature-btn:hover { transform: scale(1.1); }
                    .btn-icon {
                        width: 50px; height: 50px; border-radius: 50%;
                        background: rgba(0,0,0,0.5); border: 2px solid #ffdb4d;
                        display: flex; justify-content: center; align-items: center;
                        font-size: 24px; box-shadow: 0 0 10px rgba(255, 219, 77, 0.3);
                    }
                    .btn-label {
                        color: #ffdb4d; margin-top: 5px; font-size: 12px; font-weight: bold;
                        background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px;
                    }
                    /* Overlay chung */
                    .feature-overlay {
                        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                        background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);
                        display: flex; justify-content: center; align-items: center;
                        z-index: 200; pointer-events: auto;
                    }
                    .feature-card {
                        width: 320px; padding: 40px 20px;
                        background: #fff8e1; border: 4px solid #b71c1c; border-radius: 8px;
                        text-align: center; position: relative;
                        animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    }
                    .fortune-title { font-family: 'Cinzel', serif; font-size: 2rem; color: #b71c1c; margin-bottom: 20px; }
                    .fortune-text { font-family: 'Montserrat', sans-serif; font-size: 1.2rem; color: #333; line-height: 1.6; white-space: pre-line; }
                    .action-btn { margin-top: 20px; padding: 10px 30px; background: #b71c1c; color: #ffdb4d; border: none; font-weight: bold; cursor: pointer; border-radius: 20px; font-size: 1rem; }
                    .action-btn:hover { background: #d32f2f; }
                    
                    /* Input Style */
                    .wish-input {
                        width: 100%; height: 100px; padding: 10px;
                        background: rgba(255,255,255,0.9);
                        border: 2px solid #b71c1c; border-radius: 4px;
                        font-family: 'Montserrat', sans-serif; font-size: 1rem;
                        color: #b71c1c; resize: none; outline: none;
                        margin-bottom: 15px;
                    }
                    .wish-input::placeholder { color: rgba(183, 28, 28, 0.5); }

                    /* Shaking Animation */
                    .shaking-tube {
                        font-size: 100px;
                        animation: shake 0.5s infinite;
                    }
                    @keyframes shake {
                        0% { transform: rotate(0deg); }
                        25% { transform: rotate(10deg); }
                        50% { transform: rotate(0deg); }
                        75% { transform: rotate(-10deg); }
                        100% { transform: rotate(0deg); }
                    }
                    @keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                `}
            </style>

            <div className="feature-dock">
                {/* Nút Gieo Quẻ */}
                <div className="feature-btn" onClick={handleGieoQue}>
                    <div className="btn-icon">📜</div>
                    <div className="btn-label">GIEO QUẺ</div>
                </div>

                {/* Nút Thả Đèn */}
                <div className="feature-btn" onClick={handleOpenLanternInput}>
                    <div className="btn-icon">🏮</div>
                    <div className="btn-label">THẢ ĐÈN</div>
                </div>
            </div>

            {/* UI Gieo Quẻ */}
            {fortuneStep === 1 && (
                <div className="feature-overlay">
                    <div className="shaking-tube">🎋</div>
                    <div style={{color: 'white', marginTop: 20, fontFamily: 'Montserrat'}}>Đang xin keo...</div>
                </div>
            )}

            {fortuneStep === 2 && currentFortune && (
                <div className="feature-overlay">
                    <div className="feature-card">
                        <div className="fortune-title">{currentFortune.name}</div>
                        <div className="fortune-text">{currentFortune.poem}</div>
                        <button className="action-btn" onClick={closeFortune}>Nhận Lời Chúc</button>
                    </div>
                </div>
            )}

            {/* UI Thả Đèn (Nhập lời chúc) */}
            {lanternStep === 1 && (
                <div className="feature-overlay">
                    <div className="feature-card" style={{ background: '#212121', border: '2px solid #ffaa00' }}>
                         <h2 style={{ color: '#ffaa00', fontFamily: 'Cinzel', marginBottom: 15 }}>Gửi Ước Nguyện</h2>
                         <textarea 
                            className="wish-input" 
                            placeholder="Nhập điều ước của bạn..." 
                            value={wishMessage}
                            onChange={(e) => setWishMessage(e.target.value)}
                            maxLength={30}
                            style={{ background: '#333', color: '#fff', border: '1px solid #555' }}
                         />
                         <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button className="action-btn" onClick={() => setLanternStep(0)} style={{ background: '#555', color: '#ccc' }}>Hủy</button>
                            <button className="action-btn" onClick={handleReleaseLantern} style={{ background: '#ffaa00', color: '#000' }}>Thả Đèn</button>
                         </div>
                    </div>
                </div>
            )}
        </>
    );
}


const DENOMINATIONS = [
    { value: "50.000", color: "#e492b2", bg: "linear-gradient(135deg, #fce4ec, #e91e63)", text: "Năm mới nhẹ nhàng, tình cảm đong đầy" },
    { value: "100.000", color: "#7da36d", bg: "linear-gradient(135deg, #e8f5e9, #4caf50)", text: "Lộc biếc mai vàng, khởi đầu suôn sẻ" },
    { value: "200.000", color: "#c9806e", bg: "linear-gradient(135deg, #efebe9, #d84315)", text: "May mắn song hành, tài lộc gõ cửa" },
    { value: "500.000", color: "#58aeb1", bg: "linear-gradient(135deg, #e0f7fa, #00acc1)", text: "Đại phú đại quý, tiền vào như nước" }
];

function LuckyMoneyFeature() {
    const [step, setStep] = useState(0); 
    const [selectedMoney, setSelectedMoney] = useState(null);
    const [flapOpen, setFlapOpen] = useState(false); 
    const [moneyRise, setMoneyRise] = useState(false); 
    const pickRandomMoney = () => {
      const rand = Math.random();
      if (rand < 0.4) return DENOMINATIONS[0];
      if (rand < 0.7) return DENOMINATIONS[1];
      if (rand < 0.9) return DENOMINATIONS[2];
      return DENOMINATIONS[3];
    };
    const handleOpenDeck = () => { playCustomClick(); setStep(1); };
    const handlePickEnvelope = () => { 
      playCustomClick(); 
      const money = pickRandomMoney(); 
      setSelectedMoney(money); 
      setStep(2); 
      setTimeout(() => { setFlapOpen(true); setTimeout(() => { setMoneyRise(true); }, 600); }, 300);
    };
    const handleClose = () => { setStep(0); setSelectedMoney(null); setFlapOpen(false); setMoneyRise(false); };
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
        <style>
          {`
            .lucky-btn-container { position: absolute; bottom: 70px; left: 40px; pointer-events: auto; cursor: pointer; animation: floatBtn 3s ease-in-out infinite; display: flex; flex-direction: column; align-items: center; transition: transform 0.2s; }
            .lucky-btn-container:hover { transform: scale(1.1); }
            .icon-lixi { width: 50px; height: 80px; background: #d00000; border: 2px solid #ffdb4d; border-radius: 6px; display: flex; justify-content: center; align-items: center; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
            .icon-lixi::after { content: '福'; color: #ffdb4d; font-family: serif; font-size: 24px; }
            .overlay-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); display: flex; flex-direction: column; justify-content: center; align-items: center; pointer-events: auto; animation: fadeInOverlay 0.4s ease; }
            .deck-grid { display: flex; gap: 30px; perspective: 1000px; }
            .lixi-card { width: 100px; height: 160px; background: linear-gradient(135deg, #b30000, #e60000); border: 2px solid #ffdb4d; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transition: transform 0.3s; }
            .lixi-card:hover { transform: translateY(-20px); }
            .lixi-card span { font-size: 40px; color: #ffdb4d; }
            .envelope-container { position: relative; width: 260px; height: 360px; margin-top: 20px; }
            .env-back { position: absolute; bottom: 0; width: 100%; height: 100%; background: #8e0000; border-radius: 10px; box-shadow: 0 15px 35px rgba(0,0,0,0.6); z-index: 1; }
            .env-money { position: absolute; left: 50%; bottom: 10px; width: 90%; height: 55%; transform: translateX(-50%); z-index: 5; transition: transform 1s cubic-bezier(0.34, 1.56, 0.64, 1), bottom 1s ease; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.2); display: flex; flex-direction: column; }
            .env-money.rise { bottom: 120px; transform: translateX(-50%) scale(1.1) rotate(-2deg); z-index: 25; }
            .env-pocket { position: absolute; bottom: 0; left: 0; width: 100%; height: 75%; background: #c62828; border-radius: 0 0 10px 10px; border: 2px solid #ffdb4d; border-top: none; z-index: 10; display: flex; justify-content: center; align-items: center; box-shadow: inset 0 10px 20px rgba(0,0,0,0.2); }
            .env-pocket-text { font-family: 'Cinzel', serif; color: #ffdb4d; font-size: 60px; margin-top: 30px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
            .env-flap { position: absolute; top: 0; left: 0; width: 100%; height: 25%; background: #b71c1c; border-radius: 10px 10px 0 0; border: 2px solid #ffdb4d; border-bottom: none; transform-origin: bottom; z-index: 15; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), z-index 0.2s 0.3s; clip-path: polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%); height: 40%; }
            .env-flap.open { transform: rotateX(180deg); z-index: 0; opacity: 0.8; }
            .bill-layout { flex: 1; padding: 15px; display: flex; flex-direction: column; justify-content: space-between; position: relative; }
            .bill-val { font-weight: 900; font-size: 28px; color: #fff; text-align: right; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
            .bill-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 2px solid rgba(255,255,255,0.5); padding: 5px 20px; color: white; font-weight: bold; border-radius: 20px; }
            .wish-box { margin-top: 30px; color: #ffdb4d; font-family: 'Montserrat', sans-serif; font-size: 1.4rem; font-weight: 600; text-align: center; max-width: 90%; opacity: 0; transform: translateY(20px); animation: fadeInMsg 1s forwards 1s; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
            .btn-nhan-loc { margin-top: 25px; padding: 12px 40px; border-radius: 30px; border: none; background: #ffdb4d; color: #b71c1c; font-weight: bold; font-size: 1.2rem; cursor: pointer; box-shadow: 0 0 15px #ffdb4d; transition: transform 0.2s; }
            .btn-nhan-loc:hover { transform: scale(1.1); }
            @keyframes floatBtn { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
            @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeInMsg { to { opacity: 1; transform: translateY(0); } }
            @media (max-width: 600px) { .deck-grid { gap: 10px; transform: scale(0.9); } .envelope-container { transform: scale(0.85); margin-top: 10px; } }
          `}
        </style>
        {step === 0 && (
          <div className="lucky-btn-container" onClick={handleOpenDeck}>
            <div className="icon-lixi"></div>
            <div style={{ color: '#ffdb4d', marginTop: 5, fontSize: 12, fontWeight: 'bold', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>RÚT LÌ XÌ</div>
          </div>
        )}
        {step === 1 && (
          <div className="overlay-backdrop">
            <h2 style={{ color: '#ffdb4d', fontFamily: 'Cinzel, serif', marginBottom: 30, fontSize: '2rem' }}>CHỌN LỘC ĐẦU NĂM</h2>
            <div className="deck-grid">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="lixi-card" onClick={handlePickEnvelope}><span>🧧</span></div>
              ))}
            </div>
          </div>
        )}
        {step === 2 && selectedMoney && (
          <div className="overlay-backdrop">
            <div className="envelope-container">
                <div className={`env-flap ${flapOpen ? 'open' : ''}`}></div>
                <div className="env-pocket">
                    <div className="env-pocket-text">福</div>
                </div>
                <div className={`env-money ${moneyRise ? 'rise' : ''}`} style={{ background: selectedMoney.bg }}>
                     <div className="bill-layout">
                        <div style={{color: 'white', opacity: 0.8, fontSize: 10}}>LUCKY MONEY 2026</div>
                        <div className="bill-center">VND</div>
                        <div className="bill-val">{selectedMoney.value}</div>
                     </div>
                </div>
                <div className="env-back"></div>
            </div>
            <div className="wish-box">"{selectedMoney.text}"</div>
            {moneyRise && (<button className="btn-nhan-loc" onClick={handleClose}>Nhận Lộc</button>)}
          </div>
        )}
      </div>
    );
}

// --- 5. SCENE CONTENT ---
function SceneContent({ scene, handleLaunch, soundRef, isPlaying, setIsPlaying }) {
  const { camera } = useThree()
  
  useEffect(() => { 
    if (scene === 'fireworks') { 
        camera.position.set(0, 0, 40); 
        camera.lookAt(0, 0, 0) 
    } 
  }, [scene, camera])

  useEffect(() => {
    if (scene === 'fireworks' && soundRef.current) {
        if (soundRef.current.context.state === 'suspended') {
            soundRef.current.context.resume();
        }
        setIsPlaying(true);
    }
  }, [scene, soundRef, setIsPlaying])

  return (
    <>
      {scene === 'countdown' ? (
        <Suspense fallback={null}>
          <InteractiveDust count={4000} />
          <Stars radius={250} count={2000} factor={4} fade speed={1} />
          <ambientLight intensity={0.5} />
          <CountdownDisplay onFinishTransition={handleLaunch} />
          <CircularAudioVisualizer soundRef={soundRef} radius={18} count={150} />
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/lofi.mp3" distance={30} loop />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <Stars radius={150} count={1000} factor={2} fade speed={0.2} />
          <FireworkManager />
          <LanternManager /> {/* TÍNH NĂNG MỚI: Lanterns 3D */}
          <PositionalAudio ref={soundRef} url="/happy-new-year-2026/sounds/celebration.mp3" distance={50} loop autoplay={true} />
          <ambientLight intensity={0.1} color="#000022" />
        </Suspense>
      )}
    </>
  )
}

// --- 6. MAIN APP ---
export default function App() {
  const soundRef = useRef()
  const [scene, setScene] = useState('countdown')
  const [flash, setFlash] = useState(0)
  const [isUiVisible, setUiVisible] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleLaunch = () => {
    if (soundRef.current && soundRef.current.context) {
        soundRef.current.context.resume();
    }
    setUiVisible(false)
    setFlash(1)
    setTimeout(() => {
      setScene('fireworks') 
      const fade = setInterval(() => {
        setFlash(prev => { if (prev <= 0) { clearInterval(fade); return 0; } return prev - 0.05 })
      }, 30)
    }, 600)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000', overflow: 'hidden' }}>
      
      {/* 1. Integrated Controls (Hiển thị ở cả 2 scene) */}
      <CinematicIntegratedControls soundRef={soundRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />

      {/* 2. UI riêng cho Fireworks */}
      {scene === 'fireworks' && (
        <>
          <div style={{ zIndex: 10, position: 'absolute', inset: 0 }}>
             <CinematicTitle2D />
          </div>
          <LuckyMoneyFeature />
          <FeatureButtons /> {/* TÍNH NĂNG MỚI: Nút Gieo Quẻ và Thả Đèn */}
        </>
      )}
      
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: flash, zIndex: 50, pointerEvents: 'none' }} />

      {/* 3. Canvas (Z-index 20 để pháo hoa nổ đè lên UI) */}
      {/* Logic click: Countdown = auto (để bấm nút Launch), Fireworks = none (để bấm Lì xì) */}
      <Canvas 
         className="canvas-overlay"
         style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: scene === 'countdown' ? 'auto' : 'none' }} 
         camera={{ position: [0, 8, 35], fov: 50 }} 
         dpr={[1, 1.5]}
         gl={{ alpha: true }} 
      >
        <Environment preset="city" />
        <SceneContent scene={scene} handleLaunch={handleLaunch} soundRef={soundRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
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

// --- UTILS COMPONENTS KHÁC (Dust, Countdown, Text...) ---
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
      <Center position={[0, -4.8, 0]}><Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={0.5} height={0.1}>START<meshStandardMaterial color="white" /></Text3D></Center>
    </group>
  )
}

function RainbowMaterial() {
    const matRef = useRef(); useFrame((state) => { if (matRef.current) { const hue = (state.clock.getElapsedTime() * 0.1) % 1; matRef.current.color.setHSL(hue, 1, 0.5); matRef.current.emissive.setHSL(hue, 1, 0.2); } })
    return <meshPhysicalMaterial ref={matRef} metalness={1} roughness={0.1} emissiveIntensity={0.5} />
}