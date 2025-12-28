import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function RectangularAudioVisualizer({ 
  soundRef, 
  width = 20,      // Chiều rộng hình chữ nhật
  height = 6,      // Chiều cao hình chữ nhật
  depth = 3,       // Độ sâu (z-axis)
  barCount = 60,   // Số thanh visualizer
  position = [0, 2, 0] // Vị trí trung tâm
}) {
  const meshRef = useRef();
  const analyserRef = useRef();
  const dataArrayRef = useRef();

  // Tính toán vị trí các thanh xung quanh hình chữ nhật
  const bars = useMemo(() => {
    const barsArray = [];
    const perSide = Math.floor(barCount / 4); // Số thanh mỗi cạnh
    
    // Cạnh TRÊN (top)
    for (let i = 0; i < perSide; i++) {
      const t = i / (perSide - 1);
      barsArray.push({
        pos: new THREE.Vector3(
          -width/2 + t * width,
          height/2,
          0
        ),
        normal: new THREE.Vector3(0, 1, 0) // Hướng lên trên
      });
    }
    
    // Cạnh PHẢI (right)
    for (let i = 0; i < perSide; i++) {
      const t = i / (perSide - 1);
      barsArray.push({
        pos: new THREE.Vector3(
          width/2,
          height/2 - t * height,
          0
        ),
        normal: new THREE.Vector3(1, 0, 0) // Hướng sang phải
      });
    }
    
    // Cạnh DƯỚI (bottom)
    for (let i = 0; i < perSide; i++) {
      const t = i / (perSide - 1);
      barsArray.push({
        pos: new THREE.Vector3(
          width/2 - t * width,
          -height/2,
          0
        ),
        normal: new THREE.Vector3(0, -1, 0) // Hướng xuống dưới
      });
    }
    
    // Cạnh TRÁI (left)
    for (let i = 0; i < perSide; i++) {
      const t = i / (perSide - 1);
      barsArray.push({
        pos: new THREE.Vector3(
          -width/2,
          -height/2 + t * height,
          0
        ),
        normal: new THREE.Vector3(-1, 0, 0) // Hướng sang trái
      });
    }
    
    return barsArray;
  }, [width, height, barCount]);

  // Setup Audio Analyser
  useEffect(() => {
    if (soundRef?.current?.gain?.context) {
      const audioContext = soundRef.current.gain.context;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      
      // Connect audio source to analyser
      if (soundRef.current.source) {
        soundRef.current.source.connect(analyser);
      }
      
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
  }, [soundRef]);

  // Tạo geometry cho tất cả các thanh
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
    return geo;
  }, []);

  useFrame(() => {
    if (!meshRef.current || !analyserRef.current || !dataArrayRef.current) return;
    
    // Lấy dữ liệu tần số
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Cập nhật scale của từng thanh
    meshRef.current.children.forEach((bar, i) => {
      // Map index của thanh với dữ liệu frequency
      const dataIndex = Math.floor((i / bars.length) * dataArrayRef.current.length);
      const value = dataArrayRef.current[dataIndex] / 255; // Normalize 0-1
      
      // Scale thanh theo hướng normal (hướng ra ngoài)
      const scale = 0.5 + value * 3; // Min 0.5, max 3.5
      
      // Áp dụng scale theo hướng của thanh
      if (bars[i].normal.y !== 0) {
        // Thanh dọc (trên/dưới) - scale theo Y
        bar.scale.y = scale;
      } else {
        // Thanh ngang (trái/phải) - scale theo X
        bar.scale.x = scale;
      }
      
      // Thay đổi màu theo intensity
      const hue = 0.15 + value * 0.15; // Vàng gold (0.15) -> Cam (0.3)
      bar.material.color.setHSL(hue, 1, 0.5 + value * 0.3);
      bar.material.emissiveIntensity = 0.3 + value * 0.7;
    });
  });

  return (
    <group ref={meshRef} position={position}>
      {bars.map((bar, i) => (
        <mesh
          key={i}
          position={[bar.pos.x, bar.pos.y, bar.pos.z]}
          geometry={geometry}
          rotation={[
            0, 
            0, 
            bar.normal.x !== 0 ? Math.PI / 2 : 0 // Xoay 90° nếu thanh ngang
          ]}
        >
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}