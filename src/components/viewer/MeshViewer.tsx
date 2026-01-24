'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useViewerStore, type OverlayMode } from '@/stores/viewerStore'
import { useMeshStore } from '@/stores/meshStore'
import { useReportStore } from '@/stores/reportStore'
import type { MeshData } from '@/types/mesh'
import type { OverlayData } from '@/types/report'

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

/**
 * Creates edge overlay LineSegments from edge vertex pairs
 */
function createEdgeOverlay(
  positions: Float32Array,
  edgeVertexPairs: number[],
  color: THREE.ColorRepresentation
): THREE.LineSegments {
  const linePositions: number[] = []

  for (let i = 0; i < edgeVertexPairs.length; i += 2) {
    const v0 = edgeVertexPairs[i]
    const v1 = edgeVertexPairs[i + 1]

    linePositions.push(
      positions[v0 * 3],
      positions[v0 * 3 + 1],
      positions[v0 * 3 + 2],
      positions[v1 * 3],
      positions[v1 * 3 + 1],
      positions[v1 * 3 + 2]
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))

  const material = new THREE.LineBasicMaterial({
    color,
    linewidth: 2,
    depthTest: true,
    transparent: true,
    opacity: 0.9,
  })

  return new THREE.LineSegments(geometry, material)
}

/**
 * Creates component-colored mesh with per-face colors
 */
function createComponentColoredMesh(
  meshData: MeshData,
  componentIdPerFace: number[],
  mainComponentIndex: number
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry()

  // We need to create non-indexed geometry for per-face colors
  const faceCount = meshData.indices.length / 3
  const positions: number[] = []
  const colors: number[] = []
  const normals: number[] = []

  // Generate distinct colors for components
  const componentColors: THREE.Color[] = []
  const maxComponentId = Math.max(...componentIdPerFace, 0)
  for (let i = 0; i <= maxComponentId; i++) {
    if (i === mainComponentIndex) {
      // Main component is blue
      componentColors.push(new THREE.Color(0x4a9eff))
    } else {
      // Floaters are yellow/orange
      componentColors.push(new THREE.Color(0xffaa00))
    }
  }

  for (let f = 0; f < faceCount; f++) {
    const i0 = meshData.indices[f * 3]
    const i1 = meshData.indices[f * 3 + 1]
    const i2 = meshData.indices[f * 3 + 2]

    // Positions
    positions.push(
      meshData.positions[i0 * 3],
      meshData.positions[i0 * 3 + 1],
      meshData.positions[i0 * 3 + 2],
      meshData.positions[i1 * 3],
      meshData.positions[i1 * 3 + 1],
      meshData.positions[i1 * 3 + 2],
      meshData.positions[i2 * 3],
      meshData.positions[i2 * 3 + 1],
      meshData.positions[i2 * 3 + 2]
    )

    // Colors - same for all 3 vertices of the face
    const componentId = componentIdPerFace[f] ?? 0
    const color = componentColors[componentId] ?? componentColors[0]
    for (let v = 0; v < 3; v++) {
      colors.push(color.r, color.g, color.b)
    }

    // Normals
    if (meshData.normals) {
      normals.push(
        meshData.normals[i0 * 3],
        meshData.normals[i0 * 3 + 1],
        meshData.normals[i0 * 3 + 2],
        meshData.normals[i1 * 3],
        meshData.normals[i1 * 3 + 1],
        meshData.normals[i1 * 3 + 2],
        meshData.normals[i2 * 3],
        meshData.normals[i2 * 3 + 1],
        meshData.normals[i2 * 3 + 2]
      )
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  if (normals.length > 0) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  } else {
    geometry.computeVertexNormals()
  }

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
  })

  return new THREE.Mesh(geometry, material)
}

/**
 * Creates overhang heatmap mesh with per-face colors
 */
function createOverhangHeatmapMesh(
  meshData: MeshData,
  overhangFaceMask: number[],
  faceAngles: number[]
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry()

  const faceCount = meshData.indices.length / 3
  const positions: number[] = []
  const colors: number[] = []
  const normals: number[] = []

  for (let f = 0; f < faceCount; f++) {
    const i0 = meshData.indices[f * 3]
    const i1 = meshData.indices[f * 3 + 1]
    const i2 = meshData.indices[f * 3 + 2]

    // Positions
    positions.push(
      meshData.positions[i0 * 3],
      meshData.positions[i0 * 3 + 1],
      meshData.positions[i0 * 3 + 2],
      meshData.positions[i1 * 3],
      meshData.positions[i1 * 3 + 1],
      meshData.positions[i1 * 3 + 2],
      meshData.positions[i2 * 3],
      meshData.positions[i2 * 3 + 1],
      meshData.positions[i2 * 3 + 2]
    )

    // Color based on overhang
    let color: THREE.Color
    if (overhangFaceMask[f]) {
      // Overhang face - color by angle (45-90 deg -> yellow to red)
      const angle = faceAngles[f] ?? 45
      const t = Math.min(1, Math.max(0, (angle - 45) / 45))
      color = new THREE.Color().lerpColors(
        new THREE.Color(0xffff00), // yellow at 45 deg
        new THREE.Color(0xff0000), // red at 90 deg
        t
      )
    } else {
      // Non-overhang face - blue
      color = new THREE.Color(0x4a9eff)
    }

    for (let v = 0; v < 3; v++) {
      colors.push(color.r, color.g, color.b)
    }

    // Normals
    if (meshData.normals) {
      normals.push(
        meshData.normals[i0 * 3],
        meshData.normals[i0 * 3 + 1],
        meshData.normals[i0 * 3 + 2],
        meshData.normals[i1 * 3],
        meshData.normals[i1 * 3 + 1],
        meshData.normals[i1 * 3 + 2],
        meshData.normals[i2 * 3],
        meshData.normals[i2 * 3 + 1],
        meshData.normals[i2 * 3 + 2]
      )
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  if (normals.length > 0) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  } else {
    geometry.computeVertexNormals()
  }

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
  })

  return new THREE.Mesh(geometry, material)
}

export function MeshViewer({ className = '' }: MeshViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const overlayRef = useRef<THREE.Object3D | null>(null)
  const frameIdRef = useRef<number>(0)

  const { overlayMode, modelDarkness, backgroundDarkness, registerScreenshotCallback, unregisterScreenshotCallback } = useViewerStore()
  const activeMesh = useMeshStore((state) => {
    const activeMeshId = state.activeMeshId
    return activeMeshId ? state.meshes[activeMeshId] : undefined
  })
  const activeMeshId = useMeshStore((state) => state.activeMeshId)
  const activeReport = useReportStore((state) => {
    const activeMeshId = useMeshStore.getState().activeMeshId
    return activeMeshId ? state.reports[activeMeshId] : undefined
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

    // Scene with darkness-controlled background
    const scene = new THREE.Scene()
    const bgValue = 1 - backgroundDarkness // 0 = white, 1 = black, so invert
    scene.background = new THREE.Color(bgValue, bgValue, bgValue)
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

    // Placeholder cube (will be replaced when mesh is loaded)
    // Use modelDarkness for color: 0 = white, 1 = black
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const meshColorValue = 1 - modelDarkness
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(meshColorValue, meshColorValue, meshColorValue),
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
  }, [modelDarkness, backgroundDarkness])

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

  // Screenshot capture callback
  const captureScreenshot = useCallback((): string | null => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
      return null
    }
    // Force a render before capturing
    rendererRef.current.render(sceneRef.current, cameraRef.current)
    return rendererRef.current.domElement.toDataURL('image/png')
  }, [])

  // Initialize scene on mount
  useEffect(() => {
    initScene()

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Register screenshot callback after scene is initialized
    const timeoutId = setTimeout(() => {
      registerScreenshotCallback(captureScreenshot)
    }, 100)

    return () => {
      // Cleanup
      clearTimeout(timeoutId)
      unregisterScreenshotCallback()
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
  }, [initScene, handleResize, captureScreenshot, registerScreenshotCallback, unregisterScreenshotCallback])

  // Update background darkness
  useEffect(() => {
    if (sceneRef.current) {
      const bgValue = 1 - backgroundDarkness
      sceneRef.current.background = new THREE.Color(bgValue, bgValue, bgValue)
    }
  }, [backgroundDarkness])

  // Update model darkness
  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial
      if (!material.vertexColors) {
        const meshColorValue = 1 - modelDarkness
        material.color.setRGB(meshColorValue, meshColorValue, meshColorValue)
      }
    }
  }, [modelDarkness])

  // Helper function to position mesh and fit camera
  const positionMeshAndCamera = useCallback(
    (mesh: THREE.Mesh, meshData: MeshData) => {
      const { min, max, dimensions } = meshData.boundingBox
      const centerX = (min[0] + max[0]) / 2
      const centerY = (min[1] + max[1]) / 2
      const centerZ = (min[2] + max[2]) / 2
      mesh.position.set(-centerX, -centerY, -centerZ)

      if (cameraRef.current && controlsRef.current) {
        const maxDim = Math.max(...dimensions)
        const distance = maxDim * 2
        cameraRef.current.position.set(distance, distance, distance)
        cameraRef.current.lookAt(0, 0, 0)
        controlsRef.current.target.set(0, 0, 0)
        controlsRef.current.update()
      }
    },
    []
  )

  // Remove existing overlay
  const clearOverlay = useCallback(() => {
    if (overlayRef.current && sceneRef.current) {
      sceneRef.current.remove(overlayRef.current)
      if (overlayRef.current instanceof THREE.Mesh) {
        overlayRef.current.geometry.dispose()
        if (Array.isArray(overlayRef.current.material)) {
          overlayRef.current.material.forEach((m) => m.dispose())
        } else {
          overlayRef.current.material.dispose()
        }
      } else if (overlayRef.current instanceof THREE.LineSegments) {
        overlayRef.current.geometry.dispose()
        ;(overlayRef.current.material as THREE.Material).dispose()
      }
      overlayRef.current = null
    }
  }, [])

  // Update mesh when active mesh changes
  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return

    // Clear any existing overlay
    clearOverlay()

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

    // Use modelDarkness for color: 0 = white, 1 = black
    const meshColorValue = 1 - modelDarkness
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(meshColorValue, meshColorValue, meshColorValue),
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true

    if (activeMesh) {
      positionMeshAndCamera(mesh, activeMesh)
    } else {
      mesh.position.y = 0.5
    }

    sceneRef.current.add(mesh)
    meshRef.current = mesh
  }, [activeMesh, modelDarkness, clearOverlay, positionMeshAndCamera])

  // Update overlay when overlay mode or report changes
  useEffect(() => {
    if (!sceneRef.current || !activeMesh || !activeReport) return

    // Clear existing overlay
    clearOverlay()

    // No overlay needed
    if (overlayMode === 'none') return

    const overlayData = activeReport.overlayData

    switch (overlayMode) {
      case 'boundary_edges': {
        if (overlayData.boundaryEdges && overlayData.boundaryEdges.length > 0) {
          const edgeOverlay = createEdgeOverlay(
            activeMesh.positions,
            overlayData.boundaryEdges,
            0xff0000 // red
          )
          // Position overlay same as mesh
          const { min, max } = activeMesh.boundingBox
          const centerX = (min[0] + max[0]) / 2
          const centerY = (min[1] + max[1]) / 2
          const centerZ = (min[2] + max[2]) / 2
          edgeOverlay.position.set(-centerX, -centerY, -centerZ)
          sceneRef.current.add(edgeOverlay)
          overlayRef.current = edgeOverlay
        }
        break
      }

      case 'non_manifold_edges': {
        if (overlayData.nonManifoldEdges && overlayData.nonManifoldEdges.length > 0) {
          const edgeOverlay = createEdgeOverlay(
            activeMesh.positions,
            overlayData.nonManifoldEdges,
            0xff8800 // orange
          )
          const { min, max } = activeMesh.boundingBox
          const centerX = (min[0] + max[0]) / 2
          const centerY = (min[1] + max[1]) / 2
          const centerZ = (min[2] + max[2]) / 2
          edgeOverlay.position.set(-centerX, -centerY, -centerZ)
          sceneRef.current.add(edgeOverlay)
          overlayRef.current = edgeOverlay
        }
        break
      }

      case 'components': {
        if (overlayData.componentIdPerFace && overlayData.mainComponentIndex !== undefined) {
          // Hide the regular mesh
          if (meshRef.current) {
            meshRef.current.visible = false
          }
          // Create component-colored mesh
          const componentMesh = createComponentColoredMesh(
            activeMesh,
            overlayData.componentIdPerFace,
            overlayData.mainComponentIndex
          )
          componentMesh.castShadow = true
          componentMesh.receiveShadow = true
          positionMeshAndCamera(componentMesh, activeMesh)
          sceneRef.current.add(componentMesh)
          overlayRef.current = componentMesh
        }
        break
      }

      case 'overhang': {
        if (overlayData.overhangFaceMask && overlayData.faceAngles) {
          // Hide the regular mesh
          if (meshRef.current) {
            meshRef.current.visible = false
          }
          // Create overhang heatmap mesh
          const overhangMesh = createOverhangHeatmapMesh(
            activeMesh,
            overlayData.overhangFaceMask,
            overlayData.faceAngles
          )
          overhangMesh.castShadow = true
          overhangMesh.receiveShadow = true
          positionMeshAndCamera(overhangMesh, activeMesh)
          sceneRef.current.add(overhangMesh)
          overlayRef.current = overhangMesh
        }
        break
      }
    }
  }, [overlayMode, activeReport, activeMesh, clearOverlay, positionMeshAndCamera])

  // Show the regular mesh when overlay is cleared
  useEffect(() => {
    if (overlayMode === 'none' && meshRef.current) {
      meshRef.current.visible = true
    }
  }, [overlayMode])

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      data-testid="mesh-viewer"
    />
  )
}
