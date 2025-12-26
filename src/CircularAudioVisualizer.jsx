import React, { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function CircularAudioVisualizer({ soundRef, radius = 14 , count = 180, barWidth = 0.12 } ) {
  const meshRef = useRef()
  const analyserRef = useRef()
  const groupRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const _color = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    if (soundRef.current && soundRef.current.context) {
      analyserRef.current = new THREE.AudioAnalyser(soundRef.current, 128)
    }
  }, [soundRef.current])

  useFrame((state, delta) => {
    if (!meshRef.current || !analyserRef.current) return
    const data = analyserRef.current.getFrequencyData()
    const average = analyserRef.current.getAverageFrequency()
    const time = state.clock.getElapsedTime()

    // Quay hỗn loạn mọi hướng
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4
      groupRef.current.rotation.x += Math.sin(time * 0.3) * delta * 0.6
      groupRef.current.rotation.z += Math.cos(time * 0.2) * delta * 0.4
    }

    _color.setHSL((time * 0.1) % 1, 0.8, 0.5)
    meshRef.current.material.color.copy(_color)
    meshRef.current.material.emissive.copy(_color)
    meshRef.current.material.emissiveIntensity = 2 + (average / 30)

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const audioValue = data[Math.floor((i / count) * (data.length / 2))] || 0
      const scaleY = 0.4 + (audioValue / 25) + (average / 60)
      
      dummy.position.set(Math.cos(angle) * (radius + scaleY / 2), Math.sin(angle) * (radius + scaleY / 2), 0)
      dummy.rotation.set(0, 0, angle - Math.PI / 2)
      dummy.scale.set(1, scaleY, 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[null, null, count]}>
        <boxGeometry args={[barWidth, 1, 0.6]} /> 
        <meshStandardMaterial toneMapped={false} transparent opacity={0.9} />
      </instancedMesh>
    </group>
  )
}