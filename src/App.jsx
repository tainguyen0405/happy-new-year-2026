import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// --- CÁC COMPONENT CON ---
import CinematicVolume from './CinematicVolume'
// ĐÃ XÓA DÒNG IMPORT CinematicPlayButton ĐỂ TRÁNH LỖI DUPLICATE
import CircularAudioVisualizer from './CircularAudioVisualizer'

const isTesting = false; // Đã set false để chạy thật cho năm mới

// --- 1. UTILS (GIỮ NGUYÊN) ---
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

// --- 2. HỆ THỐNG PHÁO HOA NÂNG CẤP (ROCKET + EXPLOSION) ---

// 2.1 Component Tên Lửa (Bay từ dưới lên)
function Rocket({ position, targetHeight, color, onExplode }) {
    const ref = useRef()
    const speed = 25 + Math.random() * 10
    
    useFrame((state, delta) => {
        if (!ref.current) return
        ref.current.position.y += speed * delta
        
        // Tạo hiệu ứng lắc lư nhẹ khi bay
        ref.current.position.x += Math.sin(state.clock.elapsedTime * 10) * 0.02
        
        // Khi đạt độ cao mục tiêu
        if (ref.current.position.y >= targetHeight) {
            onExplode(ref.current.position.clone())
        }
    })

    return (
        <mesh ref={ref} position={position}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color={color} toneMapped={false} />
            {/* Trail effect giả lập bằng Cylinder kéo dài phía sau */}
            <mesh position={[0, -0.6, 0]}>
                 <cylinderGeometry args={[0.05, 0, 1.2, 8]} />
                 <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
            </mesh>
        </mesh>
    )
}

// 2.2 Helper tạo hình dáng pháo hoa
const createFireworkParticles = (count, type, color) => {
    const data = []
    const baseSpeed = type === 'willow' ? 0.3 : (0.5 + Math.random() * 0.8)

    for (let i = 0; i < count; i++) {
        let velocity = new THREE.Vector3()
        
        if (type === 'heart') {
            // Công thức hình trái tim 3D
            const t = Math.random() * Math.PI * 2
            const x = 16 * Math.pow(Math.sin(t), 3)
            const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)
            const z = (Math.random() - 0.5) * 2 
            velocity.set(x, y, z).normalize().multiplyScalar(baseSpeed * 0.8)
            const euler = new THREE.Euler(Math.random()*0.5, Math.random()*Math.PI, 0)
            velocity.applyEuler(euler)

        } else if (type === 'star') {
            // Hình ngôi sao 5 cánh
            const angle = (i / count) * Math.PI * 2 * 5 
            const radius = (i % 2 === 0) ? 1 : 0.4 
            const x = Math.cos(angle) * radius
            const y = Math.sin(angle) * radius
            const z = (Math.random() - 0.5) * 0.5
            velocity.set(x, y, z).normalize().multiplyScalar(baseSpeed)
             const euler = new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, 0)
             velocity.applyEuler(euler)

        } else {
            // Sphere & Willow & Multi
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
    const count = type === 'willow' ? 60 : (type === 'heart' || type === 'star' ? 100 : 120)
    
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

        if (aliveCount === 0) {
            onFinish()
        }
    })

    return (
        <points ref={pointsRef} position={position}>
            <primitive object={bufferGeo} />
            <pointsMaterial 
                size={type === 'willow' ? 0.8 : 1.2} 
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

// 2.4 Quản lý chung (Spawner)
function FireworkManager() {
    const [rockets, setRockets] = useState([])
    const [explosions, setExplosions] = useState([])
    const texture = useMemo(() => getParticleTexture(), [])
    const timerRef = useRef(0)

    useFrame((state, delta) => {
        timerRef.current += delta
        // Tần suất bắn: 0.8s - 1.5s một quả
        if (timerRef.current > 0.8 + Math.random() * 0.7) {
            timerRef.current = 0
            
            const rand = Math.random()
            let type = 'sphere'
            if (rand > 0.85) type = 'heart'
            else if (rand > 0.7) type = 'star'
            else if (rand > 0.55) type = 'willow'
            else if (rand > 0.4) type = 'multi'

            const colors = ['#ff0000', '#ffa500', '#ffd700', '#00ffcc', '#ff00ff', '#ffffff']
            const color = colors[Math.floor(Math.random() * colors.length)]

            const id = Math.random()
            const x = (Math.random() - 0.5) * 50
            const z = (Math.random() - 0.5) * 30
            const targetH = 15 + Math.random() * 15

            setRockets(prev => [...prev, { id, position: [x, -10, z], targetHeight: targetH, color, type }])
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

// --- 3. UI COMPONENTS ---

// 3.1 Nút Play/Pause (Được định nghĩa trực tiếp ở đây)
function CinematicPlayButton({ soundRef, isPlaying, setIsPlaying }) {
  const toggleMusic = () => {
    if (!soundRef.current) return;
    
    // Đảm bảo Context luôn Resume trước
    if (soundRef.current.context.state === 'suspended') {
      soundRef.current.context.resume();
    }

    if (isPlaying) {
      soundRef.current.pause();
      setIsPlaying(false);
    } else {
      soundRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div 
      onClick={toggleMusic}
      style={{
        position: 'absolute', bottom: '50px', right: '50px', zIndex: 100,
        width: '60px', height: '60px', borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        cursor: 'pointer', transition: 'all 0.3s ease',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
    >
      {isPlaying ? (
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: '4px', height: '20px', background: '#fff', borderRadius: '2px' }}></div>
          <div style={{ width: '4px', height: '20px', background: '#fff', borderRadius: '2px' }}></div>
        </div>
      ) : (
        <div style={{ width: '0', height: '0', borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '16px solid #fff', marginLeft: '4px' }}></div>
      )}
    </div>
  )
}

// 3.2 Title & Lì Xì (Giữ nguyên)
function CinematicTitle2D() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cinzel:wght@400;700&family=Montserrat:wght@300;600&display=swap');
          .cinematic-wrapper { width: 100%; height: 100%; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .text-glow { text-shadow: 0 0 10px rgba(255, 215, 0, 0.3), 0 0 20px rgba(255, 215, 0, 0.2); }
          .line-happy { font-family: 'Great Vibes', cursive; font-size: 3.5rem; color: #ffecd2; opacity: 0; transform: translateY(20px); animation: elegantFadeUp 2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 0.5s; }
          .line-year { font-family: 'Cinzel', serif; font-size: 8rem; font-weight: 800; line-height: 1; margin: 10px 0; background: linear-gradient(to bottom, #cfc09f 22%, #634f2c 24%, #cfc09f 26%, #cfc09f 27%, #ffecb3 40%, #3a2c0f 78%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; opacity: 0; transform: scale(0.9); filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.4)); animation: zoomInGold 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards 1s; }
          .line-sub { font-family: 'Montserrat', sans-serif; margin-top: 15px; font-size: 1rem; letter-spacing: 0.8rem; text-transform: uppercase; color: #ffffff; opacity: 0; animation: fadeInSub 3s ease forwards 3s; border-top: 1px solid rgba(255,255,255,0.3); border-bottom: 1px solid rgba(255,255,255,0.3); padding: 10px 20px; }
          @keyframes elegantFadeUp { to { opacity: 1; transform: translateY(0); } }
          @keyframes zoomInGold { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
          @keyframes fadeInSub { to { opacity: 0.9; letter-spacing: 1rem; } }
          @media (max-width: 768px) { .line-happy { font-size: 2.5rem; } .line-year { font-size: 4rem; } .line-sub { font-size: 0.7rem; letter-spacing: 0.3rem; } }
        `}
      </style>
      <div className="cinematic-wrapper">
        <div className="line-happy text-glow">Happy New Year</div>
        <div className="line-year">2026</div>
        <div className="line-sub">Vạn Sự Như Ý - Tỷ Sự Như Mơ</div>
      </div>
    </div>
  )
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
            .lucky-btn-container { position: absolute; bottom: 40px; left: 40px; pointer-events: auto; cursor: pointer; animation: floatBtn 3s ease-in-out infinite; display: flex; flex-direction: column; align-items: center; transition: transform 0.2s; }
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

// --- 5. SCENE CONTENT (Sử dụng FireworkManager mới) ---
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
          {/* SỬ DỤNG HỆ THỐNG PHÁO HOA MỚI */}
          <FireworkManager />
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
      
      {scene === 'countdown' && (
        <>
            <CinematicVolume soundRef={soundRef} />
            <CinematicPlayButton soundRef={soundRef} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
        </>
      )}

      {scene === 'fireworks' && (
        <>
          <CinematicTitle2D />
          <LuckyMoneyFeature />
        </>
      )}
      
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: flash, zIndex: 50, pointerEvents: 'none' }} />

      <Canvas camera={{ position: [0, 8, 35], fov: 50 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#050505']} />
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
      <Center position={[0, -4.8, 0]}><Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={0.5} height={0.1}>LAUNCH 2026<meshStandardMaterial color="white" /></Text3D></Center>
    </group>
  )
}

function RainbowMaterial() {
    const matRef = useRef(); useFrame((state) => { if (matRef.current) { const hue = (state.clock.getElapsedTime() * 0.1) % 1; matRef.current.color.setHSL(hue, 1, 0.5); matRef.current.emissive.setHSL(hue, 1, 0.2); } })
    return <meshPhysicalMaterial ref={matRef} metalness={1} roughness={0.1} emissiveIntensity={0.5} />
}