'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useViewerStore } from '@/stores/viewerStore'

interface MeshViewerProps {
  className?: string
}

export function MeshViewer({ className = '' }: MeshViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const gridRef = useRef<THREE.GridHelper | null>(null)
  const axesRef = useRef<THREE.AxesHelper | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const frameIdRef = useRef<number>(0)

  const { showGrid, showAxes, wireframe } = useViewerStore()

  // Initialize Three.js scene
  const initScene = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    // Try to create renderer - may fail in test environments
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      console.warn('WebGL not available, skipping 3D viewer initialization')
      return
    }

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(5, 5, 5)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Configure renderer
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 1
    controls.maxDistance = 100
    controlsRef.current = controls

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 10, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    scene.add(directionalLight)

    // Secondary light for fill
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-5, 5, -5)
    scene.add(fillLight)

    // Grid helper
    const grid = new THREE.GridHelper(10, 10, 0x444444, 0x333333)
    grid.visible = showGrid
    scene.add(grid)
    gridRef.current = grid

    // Axes helper
    const axes = new THREE.AxesHelper(3)
    axes.visible = showAxes
    scene.add(axes)
    axesRef.current = axes

    // Placeholder cube
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a9eff,
      wireframe: wireframe,
    })
    const cube = new THREE.Mesh(geometry, material)
    cube.castShadow = true
    cube.receiveShadow = true
    cube.position.y = 0.5
    scene.add(cube)
    meshRef.current = cube

    // Animation loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()
  }, [showGrid, showAxes, wireframe])

  // Handle resize
  const handleResize = useCallback(() => {
    if (!containerRef.current || !rendererRef.current || !cameraRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    cameraRef.current.aspect = width / height
    cameraRef.current.updateProjectionMatrix()

    rendererRef.current.setSize(width, height)
  }, [])

  // Initialize scene on mount
  useEffect(() => {
    initScene()

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      // Cleanup
      cancelAnimationFrame(frameIdRef.current)
      resizeObserver.disconnect()

      if (rendererRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement)
        } catch {
          // Element may not exist in test environment
        }
        rendererRef.current.dispose()
      }

      if (controlsRef.current) {
        controlsRef.current.dispose()
      }
    }
  }, [initScene, handleResize])

  // Update grid visibility
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.visible = showGrid
    }
  }, [showGrid])

  // Update axes visibility
  useEffect(() => {
    if (axesRef.current) {
      axesRef.current.visible = showAxes
    }
  }, [showAxes])

  // Update wireframe mode
  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial
      material.wireframe = wireframe
    }
  }, [wireframe])

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      data-testid="mesh-viewer"
    />
  )
}
