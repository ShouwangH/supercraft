'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useViewerStore } from '@/stores/viewerStore'
import { useMeshStore } from '@/stores/meshStore'
import type { MeshData } from '@/types/mesh'

interface MeshViewerProps {
  className?: string
}

/**
 * Creates a THREE.BufferGeometry from MeshData
 */
function createGeometryFromMeshData(meshData: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1))

  if (meshData.normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3))
  } else {
    geometry.computeVertexNormals()
  }

  return geometry
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
  const activeMesh = useMeshStore((state) => {
    const activeMeshId = state.activeMeshId
    return activeMeshId ? state.meshes[activeMeshId] : undefined
  })

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

    // Placeholder cube (will be replaced when mesh is loaded)
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

  // Update mesh when active mesh changes
  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return

    // Remove existing mesh
    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      if (Array.isArray(meshRef.current.material)) {
        meshRef.current.material.forEach((m) => m.dispose())
      } else {
        meshRef.current.material.dispose()
      }
      meshRef.current = null
    }

    // Create new mesh from active mesh data or show placeholder
    const geometry = activeMesh
      ? createGeometryFromMeshData(activeMesh)
      : new THREE.BoxGeometry(1, 1, 1)

    const material = new THREE.MeshStandardMaterial({
      color: 0x4a9eff,
      wireframe: wireframe,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true

    if (activeMesh) {
      // Center the mesh based on bounding box
      const { min, max, dimensions } = activeMesh.boundingBox
      const centerX = (min[0] + max[0]) / 2
      const centerY = (min[1] + max[1]) / 2
      const centerZ = (min[2] + max[2]) / 2
      mesh.position.set(-centerX, -centerY, -centerZ)

      // Adjust camera to fit the mesh
      const maxDim = Math.max(...dimensions)
      const distance = maxDim * 2
      cameraRef.current.position.set(distance, distance, distance)
      cameraRef.current.lookAt(0, 0, 0)
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    } else {
      mesh.position.y = 0.5
    }

    sceneRef.current.add(mesh)
    meshRef.current = mesh
  }, [activeMesh, wireframe])

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      data-testid="mesh-viewer"
    />
  )
}
