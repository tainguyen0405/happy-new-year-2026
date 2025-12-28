import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function RectangularAudioVisualizer({ 
  soundRef, 
  width = 26,      // Chiều rộng khung (bao cả 2026)
  height = 12,     // Chiều cao khung (bao cả HAPPY và 2026)
  barCount = 100,  // Số thanh visualizer
  barWidth = 0.3,  // Độ dày thanh
  barDepth = 0.2,  // Độ sâu thanh
  position = [0, -1, 0] // Vị trí trung tâm khung
}) {
  const groupRef = useRef();
  const analyserRef = useRef();
  const dataArrayRef = useRef();

  // Tính toán vị trí các thanh xung quanh khung
  const bars = useMemo(() => {
    const barsArray = [];
    const perimeter = (width + height) * 2;
    const spacing = perimeter / barCount;
    
    for (let i = 0; i < barCount; i++) {
      const distance = (i / barCount) * perimeter;
      let x, y, rotation, scaleAxis;
      
      // Cạnh TRÊN
      if (distance < width) {
        x = -width/2 + distance;
        y = height/2;
        rotation = 0;
        scaleAxis = 'y'; // Scale lên trên
      }
      // Cạnh PHẢI
      else if (distance < width + height) {
        x = width/2;
        y = height/2 - (distance - width);
        rotation = Math.PI / 2;
        scaleAxis = 'x'; // Scale sang phải
      }
      // Cạnh DƯỚI
      else if (distance < width * 2 + height) {
        x = width/2 - (distance - width - height);
        y = -height/2;
        rotation = Math.PI;
        scaleAxis = 'y'; // Scale xuống dưới
      }
      // Cạnh TRÁI
      else {
        x = -width/2;
        y = -height/2 + (distance - width * 2 - height);
        rotation = -Math.PI / 2;
        scaleAxis = 'x'; // Scale sang trái
      }
      
      barsArray.push({ x, y, rotation, scaleAxis });
    }
    
    return barsArray;
  }, [width, height, barCount]);

  // Setup Audio Analyser
  useEffect(() => {
    if (soundRef?.current?.gain?.context) {
      const audioContext = soundRef.current.gain.context;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512; // Tăng resolution
      analyser.smoothingTimeConstant = 0.8; // Làm mượt hơn
      
      // Connect audio source to analyser
      if (soundRef.current.source) {
        soundRef.current.source.connect(analyser);
      }
      
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
  }, [soundRef]);

  useFrame(() => {
    if (!groupRef.current || !analyserRef.current || !dataArrayRef.current) return;
    
    // Lấy dữ liệu tần số
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Cập nhật từng thanh
    groupRef.current.children.forEach((bar, i) => {
      // Map index với frequency data
      const dataIndex = Math.floor((i / barCount) * dataArrayRef.current.length);
      const value = dataArrayRef.current[dataIndex] / 255; // Normalize 0-1
      
      // Tính scale (min 0.3, max 4)
      const scale = 0.3 + value * 3.5;
      
      // Scale theo trục phù hợp
      if (bars[i].scaleAxis === 'y') {
        bar.scale.y = scale;
      } else {
        bar.scale.x = scale;
      }
      
      // Thay đổi màu và độ sáng theo intensity
      const hue = 0.15; // Giữ màu vàng gold
      const lightness = 0.5 + value * 0.3;
      bar.material.color.setHSL(hue, 1, lightness);
      bar.material.emissiveIntensity = 0.2 + value * 0.8;
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {bars.map((bar, i) => (
        <mesh
          key={i}
          position={[bar.x, bar.y, 0]}
          rotation={[0, 0, bar.rotation]}
        >
          <boxGeometry args={[barWidth, 0.5, barDepth]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.3}
            metalness={0.9}
            roughness={0.1}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
      
      {/* Thêm các góc sáng để làm khung đẹp hơn */}
      {[
        [-width/2, height/2, 0],
        [width/2, height/2, 0],
        [width/2, -height/2, 0],
        [-width/2, -height/2, 0]
      ].map((pos, i) => (
        <mesh key={`corner-${i}`} position={pos}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.8}
            metalness={1}
            roughness={0}
          />
        </mesh>
      ))}
    </group>
  );
}