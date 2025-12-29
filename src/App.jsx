import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text3D, Center, Float, Stars, Environment, PositionalAudio, Cylinder } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

/**
 * LƯU Ý: 
 * 1. Đảm bảo các file font và sound nằm đúng thư mục public:
 *    - /happy-new-year-2026/fonts/Orbitron_Regular.json
 *    - /happy-new-year-2026/sounds/lofi.mp3
 *    - /happy-new-year-2026/sounds/celebration.mp3
 */

const isTesting = true;

// --- 1. UTILS & HELPERS ---
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
  const mesh = useRef(); 
  const { raycaster, camera } = useThree(); 
  const shockwaveRef = useRef(0);

  const starTexture = useMemo(() => {
    const canvas = document.createElement('canvas'); 
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d'); 
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'white'); 
    gradient.addColorStop(1, 'transparent'); 
    ctx.fillStyle = gradient; 
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useEffect(() => {
    const h = () => { shockwaveRef.current = 2.0 }; 
    window.addEventListener('pointerdown', h); 
    return () => window.removeEventListener('pointerdown', h);
  }, []);

  const [pos, col, orig, vel] = useMemo(() => {
    const p = new Float32Array(count * 3), c = new Float32Array(count * 3), o = new Float32Array(count * 3), v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 250, y = (Math.random() - 0.5) * 250, z = (Math.random() - 0.5) * 250;
      p.set([x, y, z], i * 3); o.set([x, y, z], i * 3);
      const color = new THREE.Color().setHSL(Math.random() * 0.1 + 0.6, 0.9, 0.8); 
      c.set([color.r, color.g, color.b], i * 3);
    }
    return [p, c, o, v];
  }, [count]);

  useFrame((state) => {
    if (!mesh.current) return;
    shockwaveRef.current *= 0.92;
    raycaster.setFromCamera(state.mouse, camera);
    const positions = mesh.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const pV = new THREE.Vector3(positions[i3], positions[i3+1], positions[i3+2]);
      const cp = new THREE.Vector3();
      raycaster.ray.closestPointToPoint(pV, cp);
      
      const d = pV.distanceTo(cp);
      const r = 30 + (shockwaveRef.current * 40);

      if (d < r) {
        const f = (r - d) / r;
        const fd = new THREE.Vector3().copy(pV).sub(cp).normalize();
        vel[i3] += fd.x * f * (2 + shockwaveRef.current * 15);
        vel[i3+1] += fd.y * f * (2 + shockwaveRef.current * 15);
        vel[i3+2] += fd.z * f * (2 + shockwaveRef.current * 15);
      }
      
      vel[i3] += (orig[i3] - positions[i3]) * 0.015;
      vel[i3] *= 0.92;
      positions[i3] += vel[i3];

      vel[i3+1] += (orig[i3+1] - positions[i3+1]) * 0.015;
      vel[i3+1] *= 0.92;
      positions[i3+1] += vel[i3+1];

      vel[i3+2] += (orig[i3+2] - positions[i3+2]) * 0.015;
      vel[i3+2] *= 0.92;
      positions[i3+2] += vel[i3+2];
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={pos.length/3} array={pos} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={col.length/3} array={col} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.8} vertexColors transparent map={starTexture} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

function RainbowMaterial() {
  const matRef = useRef();
  useFrame((state) => { 
    if (matRef.current) { 
      const hue = (state.clock.getElapsedTime() * 0.1) % 1;
      matRef.current.color.setHSL(hue, 1, 0.5);
      matRef.current.emissive.setHSL(hue, 1, 0.2);
    } 
  });
  return <meshPhysicalMaterial ref={matRef} metalness={1} roughness={0.1} emissiveIntensity={0.5} />;
}

function CountdownDisplay({ onFinishTransition }) {
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0, total: 999 });
  const fontUrl = '/happy-new-year-2026/fonts/Orbitron_Regular.json';
  
  useEffect(() => {
    const targetTime = isTesting ? new Date().getTime() + 15000 : new Date("Jan 1, 2026 00:00:00").getTime();
    const timer = setInterval(() => {
      const dist = targetTime - new Date().getTime();
      if (dist <= 0) { 
        setTimeLeft({ total: 0 }); 
        clearInterval(timer); 
        return; 
      }
      setTimeLeft({ 
        d: Math.floor(dist/86400000), 
        h: Math.floor((dist%86400000)/3600000), 
        m: Math.floor((dist%3600000)/60000), 
        s: Math.floor((dist%60000)/1000), 
        total: Math.floor(dist/1000) 
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  if (timeLeft.total <= 0) return <MechanicalButton onActivate={onFinishTransition} />;
  
  return (
    <group>
      {timeLeft.total <= 10 ? (
        <Center>
          <Float speed={5} rotationIntensity={2} floatIntensity={2}>
            <Text3D font={fontUrl} size={8} height={2.5} bevelEnabled>
              {timeLeft.total}
              <meshPhysicalMaterial metalness={1} roughness={0.1} color="white" emissive="#00ccff" emissiveIntensity={2} />
            </Text3D>
          </Float>
        </Center>
      ) : (
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.4}>
          <group>
            <Center top position={[0, 4, 0]}>
              <Text3D font={fontUrl} size={6} height={1.5} bevelEnabled>
                {timeLeft.d}
                <RainbowMaterial />
              </Text3D>
            </Center>
            <Center position={[0, 0, 0]}>
              <Text3D font={fontUrl} size={1} height={0.5}>
                DAYS TO 2026
                <meshStandardMaterial color="#888" />
              </Text3D>
            </Center>
            <Center bottom position={[0, -4, 0]}>
              <Text3D font={fontUrl} size={1.5} height={0.4}>
                {`${timeLeft.h}h : ${timeLeft.m}m : ${timeLeft.s}s`}
                <RainbowMaterial />
              </Text3D>
            </Center>
          </group>
        </Float>
      )}
    </group>
  );
}

function MechanicalButton({ onActivate }) {
  const [hovered, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const outerGroupRef = useRef();
  const buttonCoreRef = useRef();
  
  useFrame((state) => {
    if (outerGroupRef.current) outerGroupRef.current.lookAt(state.camera.position);
    if (buttonCoreRef.current) {
      const targetZ = pressed ? -0.8 : 0; 
      buttonCoreRef.current.position.z = THREE.MathUtils.lerp(buttonCoreRef.current.position.z, targetZ, 0.4);
    }
  });
  
  return (
    <group ref={outerGroupRef}>
      <Cylinder args={[4, 4.2, 0.8, 64]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.4]}>
        <meshStandardMaterial color="#050505" metalness={1} roughness={0.2} />
      </Cylinder>
      <group 
        onPointerOver={() => setHover(true)} 
        onPointerOut={() => { setHover(false); setPressed(false); }}
        onPointerDown={(e) => { e.stopPropagation(); setPressed(true); playCustomClick(); }} 
        onPointerUp={(e) => { e.stopPropagation(); setPressed(false); onActivate(); }} 
        ref={buttonCoreRef}
      >
        <Cylinder args={[3, 3.1, 1.2, 64]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial 
            color={hovered ? "#ff0033" : "#440000"} 
            metalness={1} 
            emissive="#ff0000" 
            emissiveIntensity={hovered ? 2 : 0.2}
          />
        </Cylinder>
        <Center position={[0, 0, 0.7]}>
          <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={0.8} height={0.2}>
            GO
            <meshStandardMaterial color="white" />
          </Text3D>
        </Center>
      </group>
      <Center position={[0, -6, 0]}>
        <Text3D font="/happy-new-year-2026/fonts/Orbitron_Regular.json" size={0.6} height={0.1}>
          READY TO LAUNCH
          <meshStandardMaterial color="white" opacity={0.5} transparent />
        </Text3D>
      </Center>
    </group>
  );
}

// --- 3. 2D CINEMATIC CELEBRATION SCENE ---
function HappyNewYear2026Scene() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden',
      fontFamily: '"Orbitron", sans-serif', color: '#fff'
    }}>
      <style>{`
        @keyframes auroraSpin {
          0% { transform: rotate(0deg) scale(1.5); }
          100% { transform: rotate(360deg) scale(1.5); }
        }
        @keyframes shine {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .orb {
          position: absolute; width: 50vw; height: 50vw; border-radius: 50%;
          filter: blur(120px); opacity: 0.3; animation: orbFloat 15s ease-in-out infinite alternate;
        }
        @keyframes orbFloat {
          0% { transform: translate(-10%, -10%) scale(1); }
          100% { transform: translate(10%, 10%) scale(1.2); }
        }
      `}</style>

      {/* Background Aurora */}
      <div style={{
        position: 'absolute', inset: -200,
        background: `conic-gradient(from 0deg at 50% 50%, #0f0c29, #302b63, #24243e, #0f0c29)`,
        opacity: 0.6, filter: 'blur(100px)', animation: 'auroraSpin 30s linear infinite', zIndex: 1
      }} />
      
      <div className="orb" style={{ top: '10%', left: '10%', background: '#ff0055', animationDuration: '12s' }} />
      <div className="orb" style={{ bottom: '10%', right: '10%', background: '#00ccff', animationDelay: '-5s' }} />

      {/* Main UI */}
      <div style={{
        position: 'relative', zIndex: 10, width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'
      }}>
        <div style={{
          fontSize: 'clamp(14px, 2vw, 20px)', letterSpacing: '1em', textTransform: 'uppercase',
          opacity: active ? 0.8 : 0, transform: active ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s', marginBottom: '20px'
        }}>
          A New Beginning
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 8vw, 100px)', fontWeight: 900, margin: 0,
          background: 'linear-gradient(to bottom, #fff 40%, #777 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: active ? 1 : 0, filter: active ? 'blur(0)' : 'blur(20px)',
          transform: active ? 'scale(1)' : 'scale(1.2)',
          transition: 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1) 0.8s'
        }}>
          HAPPY NEW YEAR
        </h1>

        <div style={{
          fontSize: 'clamp(120px, 30vw, 450px)', fontWeight: 900, lineHeight: 0.8,
          backgroundImage: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 25%, #B38728 50%, #FBF5B7 75%, #AA771C 100%)',
          backgroundSize: '200% auto', WebkitBackgroundClip: 'text', color: 'transparent',
          animation: 'shine 4s linear infinite',
          opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(100px)',
          transition: 'all 3s cubic-bezier(0.16, 1, 0.3, 1) 1.2s'
        }}>
          2026
        </div>

        <p style={{
          maxWidth: '800px', padding: '0 40px', marginTop: '30px',
          fontSize: 'clamp(16px, 1.8vw, 24px)', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)',
          opacity: active ? 1 : 0, transition: 'all 2s ease 2.5s'
        }}>
          "May the coming year be a masterpiece of your own making."
        </p>
      </div>

      {/* Film Grain & Vignette */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', background: 'radial-gradient(circle, transparent 0%, rgba(0,0,0,0.8) 150%)' }} />
    </div>
  );
}

// --- 4. SCENE WRAPPER & APP ---
export default function App() {
  const soundRef = useRef();
  const [scene, setScene] = useState('countdown');
  const [flash, setFlash] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleLaunch = () => {
    // Kích hoạt flash trắng
    setFlash(1);
    
    // Sau 600ms chuyển cảnh
    setTimeout(() => {
      setScene('celebration');
      // Giảm flash dần dần
      const fadeInterval = setInterval(() => {
        setFlash(prev => {
          if (prev <= 0) { clearInterval(fadeInterval); return 0; }
          return prev - 0.05;
        });
      }, 30);
    }, 600);
  };

  // Logic tự động chơi nhạc celebration
  useEffect(() => {
    if (scene === 'celebration' && soundRef.current) {
      soundRef.current.volume = 0.6;
      soundRef.current.play().catch(e => console.log("Autoplay blocked or failed", e));
      setIsPlaying(true);
    }
  }, [scene]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000', overflow: 'hidden' }}>
      
      {/* Flash Layer */}
      <div style={{ 
        position: 'absolute', inset: 0, backgroundColor: 'white', 
        opacity: flash, zIndex: 9999, pointerEvents: 'none' 
      }} />

      {scene === 'countdown' ? (
        <Canvas camera={{ position: [0, 5, 40], fov: 45 }}>
          <color attach="background" args={['#020205']} />
          <Suspense fallback={null}>
            <InteractiveDust count={5000} />
            <Stars radius={150} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <Environment preset="city" />
            <CountdownDisplay onFinishTransition={handleLaunch} />
            
            {/* Audio 3D cho Countdown */}
            <PositionalAudio url="/happy-new-year-2026/sounds/lofi.mp3" distance={50} loop />
          </Suspense>

          <OrbitControls 
            enablePan={false} 
            maxDistance={80} 
            minDistance={20} 
            maxPolarAngle={Math.PI / 1.8} 
          />

          <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.2} intensity={2.5} mipmapBlur />
          </EffectComposer>
        </Canvas>
      ) : (
        <>
          <HappyNewYear2026Scene />
          {/* Audio cho Celebration (2D) */}
          <audio 
            ref={soundRef} 
            src="/happy-new-year-2026/sounds/celebration.mp3" 
            loop 
            style={{ display: 'none' }}
          />
        </>
      )}

      {/* Mẹo: Có thể thêm nút Toggle Mute ở góc màn hình tại đây */}
    </div>
  );
}