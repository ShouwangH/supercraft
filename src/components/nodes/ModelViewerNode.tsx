'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NodeProps } from 'reactflow'
import { useReactFlow, useEdges } from 'reactflow'
import type { ModelViewerNodeData, AppNode, AppEdge } from '@/types/nodes'
import { NODE_TYPES } from '@/types/nodes'
import { useMeshStore } from '@/stores/meshStore'
import { Handle, Position } from 'reactflow'
import type { MeshData } from '@/types/mesh'

interface ModelViewerNodeProps extends NodeProps<ModelViewerNodeData> {}

// Types for dynamic Three.js imports
type ThreeModule = typeof import('three')
type ViewerState = {
  renderer: import('three').WebGLRenderer
  scene: import('three').Scene
  camera: import('three').PerspectiveCamera
  controls: import('three/addons/controls/OrbitControls.js').OrbitControls
  mesh: import('three').Mesh | null
  frameId: number
}

export function ModelViewerNode({ id, data, selected }: ModelViewerNodeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ViewerState | null>(null)

  const [isHovered, setIsHovered] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  // Local darkness settings per-node (not shared globally)
  const [modelDarkness, setModelDarkness] = useState(0.3)
  const [backgroundDarkness, setBackgroundDarkness] = useState(0.85)

  const { addNodes, addEdges, getNode, getNodes, setNodes, setEdges } = useReactFlow()
  const edges = useEdges()

  // Delete this node and its connected edges
  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id))
    setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id))
  }, [id, setNodes, setEdges])

  // Find a non-overlapping position for a new node
  const findNonOverlappingPosition = useCallback((baseX: number, baseY: number) => {
    const nodes = getNodes()
    const nodeWidth = 250
    const nodeHeight = 300
    const padding = 50

    let x = baseX
    let y = baseY
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const overlaps = nodes.some((n) => {
        const dx = Math.abs(n.position.x - x)
        const dy = Math.abs(n.position.y - y)
        return dx < nodeWidth + padding && dy < nodeHeight + padding
      })

      if (!overlaps) break

      // Try moving down first, then right
      if (attempts % 2 === 0) {
        y += nodeHeight + padding
      } else {
        x += nodeWidth + padding
        y = baseY
      }
      attempts++
    }

    return { x, y }
  }, [getNodes])
  const getMesh = useMeshStore((state) => state.getMesh)

  // Use the meshId that was set when this node was created
  // This ensures each node in a workflow uses its specific mesh, not a dynamically looked-up one
  const connectedMeshId = data.meshId

  const meshData = useMemo(() => {
    if (!connectedMeshId) return null
    return getMesh(connectedMeshId)
  }, [connectedMeshId, getMesh])

  // Initialize Three.js viewer with dynamic imports
  useEffect(() => {
    if (!containerRef.current) return

    let mounted = true
    const container = containerRef.current

    async function initViewer() {
      // Dynamically import Three.js
      const THREE = await import('three')
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js')

      if (!mounted || !container) return

      const width = container.clientWidth || 200
      const height = container.clientHeight || 150

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      if (!renderer) {
        console.warn('WebGL not available')
        return
      }

      const bgValue = 1 - backgroundDarkness
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(bgValue, bgValue, bgValue)

      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
      camera.position.set(3, 3, 3)
      camera.lookAt(0, 0, 0)

      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.enableZoom = true
      controls.enablePan = false

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
      scene.add(ambientLight)
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
      directionalLight.position.set(5, 10, 5)
      scene.add(directionalLight)
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
      fillLight.position.set(-5, 5, -5)
      scene.add(fillLight)

      // Create mesh
      const geometry = meshData
        ? (() => {
            const g = new THREE.BufferGeometry()
            g.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3))
            g.setIndex(new THREE.BufferAttribute(meshData.indices, 1))
            if (meshData.normals) {
              g.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3))
            } else {
              g.computeVertexNormals()
            }
            return g
          })()
        : new THREE.BoxGeometry(1, 1, 1)

      const meshColorValue = 1 - modelDarkness
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(meshColorValue, meshColorValue, meshColorValue),
        side: THREE.DoubleSide, // Render both sides to handle inverted normals
      })

      const mesh = new THREE.Mesh(geometry, material)

      if (meshData) {
        const { min, max, dimensions } = meshData.boundingBox
        const centerX = (min[0] + max[0]) / 2
        const centerY = (min[1] + max[1]) / 2
        const centerZ = (min[2] + max[2]) / 2
        mesh.position.set(-centerX, -centerY, -centerZ)

        const maxDim = Math.max(...dimensions)
        const distance = maxDim * 2
        camera.position.set(distance, distance, distance)
        camera.lookAt(0, 0, 0)
        controls.target.set(0, 0, 0)
        controls.update()
      }

      scene.add(mesh)

      viewerRef.current = {
        renderer,
        scene,
        camera,
        controls,
        mesh,
        frameId: 0,
      }

      const animate = () => {
        if (!viewerRef.current) return
        viewerRef.current.frameId = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      setIsLoaded(true)
    }

    initViewer()

    return () => {
      mounted = false
      if (viewerRef.current) {
        cancelAnimationFrame(viewerRef.current.frameId)
        try {
          container.removeChild(viewerRef.current.renderer.domElement)
        } catch {}
        viewerRef.current.renderer.dispose()
        viewerRef.current.controls.dispose()
        viewerRef.current = null
      }
    }
  }, []) // Empty deps - only run once on mount

  // Update background when darkness changes
  useEffect(() => {
    if (!viewerRef.current) return

    const updateColors = async () => {
      const THREE = await import('three')
      const bgValue = 1 - backgroundDarkness
      viewerRef.current!.scene.background = new THREE.Color(bgValue, bgValue, bgValue)
    }
    updateColors()
  }, [backgroundDarkness])

  // Update mesh color when darkness changes
  useEffect(() => {
    if (!viewerRef.current?.mesh) return

    const updateMeshColor = async () => {
      const meshColorValue = 1 - modelDarkness
      const material = viewerRef.current!.mesh!.material as import('three').MeshStandardMaterial
      material.color.setRGB(meshColorValue, meshColorValue, meshColorValue)
    }
    updateMeshColor()
  }, [modelDarkness])

  // Handle creating PrintabilityReportNode
  const handleCreateReport = useCallback(() => {
    const thisNode = getNode(id) as AppNode
    if (!thisNode) return

    const position = findNonOverlappingPosition(thisNode.position.x + 350, thisNode.position.y)
    const newNodeId = `printability-report-${Date.now()}`
    const newNode: AppNode = {
      id: newNodeId,
      type: NODE_TYPES.PRINTABILITY_REPORT,
      position,
      data: {
        label: 'Printability Report',
        status: 'idle',
        meshId: connectedMeshId,
        reportId: null,
        analyzing: false,
        error: null,
      },
    }

    const newEdge: AppEdge = {
      id: `edge-${id}-${newNodeId}`,
      source: id,
      sourceHandle: 'mesh',
      target: newNodeId,
      targetHandle: 'mesh',
    }

    addNodes([newNode])
    addEdges([newEdge])
  }, [id, getNode, connectedMeshId, addNodes, addEdges, findNonOverlappingPosition])

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
  }, [])

  return (
    <>
      <div
        className={`rounded-lg border-2 overflow-hidden transition-all ${
          selected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-neutral-600'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="mesh"
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-neutral-800"
        />

        {/* Header */}
        <div className="px-3 py-2 bg-neutral-800 border-b border-neutral-700 relative">
          <div className="text-sm font-medium text-white pr-6">{data.label || '3D Model'}</div>
          {data.meshName && (
            <div className="text-xs text-gray-400 truncate pr-6">{data.meshName}</div>
          )}
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
            className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 transition-colors"
            title="Delete node"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Mini viewer */}
        <div
          ref={containerRef}
          className="w-[220px] h-[180px] cursor-pointer bg-neutral-900"
          onClick={(e) => {
            e.stopPropagation()
            handleOpenModal()
          }}
        >
          {!isLoaded && (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
              Loading...
            </div>
          )}
        </div>

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="mesh"
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-neutral-800"
        />
      </div>

      {/* Hover controls - positioned close to node with bridge area */}
      {isHovered && (
        <div
          className="absolute left-0 right-0 -bottom-[52px] flex flex-col items-center z-50"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Invisible bridge to maintain hover */}
          <div className="h-2 w-full" />
          {/* Button group */}
          <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg border border-neutral-600 shadow-lg">
            {/* Printer button - only show for non-corrected models */}
            {!data.label?.includes('Corrected') && (
              <>
                <button
                  onClick={handleCreateReport}
                  className="p-2 bg-neutral-700 hover:bg-blue-600 rounded transition-colors"
                  title="Printability Report"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-neutral-600" />
              </>
            )}

            {/* Model darkness slider */}
            <div className="flex flex-col gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
              <label className="text-[10px] text-gray-400">Model</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={modelDarkness}
                onChange={(e) => setModelDarkness(parseFloat(e.target.value))}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-16 h-1 accent-blue-500"
              />
            </div>

            {/* Background darkness slider */}
            <div className="flex flex-col gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
              <label className="text-[10px] text-gray-400">Background</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={backgroundDarkness}
                onChange={(e) => setBackgroundDarkness(parseFloat(e.target.value))}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-16 h-1 accent-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Full-page modal - rendered via portal to escape React Flow constraints */}
      {showModal && createPortal(
        <ViewerModal
          meshData={meshData}
          onClose={handleCloseModal}
          modelDarkness={modelDarkness}
          backgroundDarkness={backgroundDarkness}
          setModelDarkness={setModelDarkness}
          setBackgroundDarkness={setBackgroundDarkness}
        />,
        document.body
      )}
    </>
  )
}

/**
 * Full-page modal viewer
 */
function ViewerModal({
  meshData,
  onClose,
  modelDarkness,
  backgroundDarkness,
  setModelDarkness,
  setBackgroundDarkness,
}: {
  meshData: MeshData | null | undefined
  onClose: () => void
  modelDarkness: number
  backgroundDarkness: number
  setModelDarkness: (v: number) => void
  setBackgroundDarkness: (v: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ViewerState | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let mounted = true
    const container = containerRef.current

    async function initViewer() {
      const THREE = await import('three')
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js')

      if (!mounted || !container) return

      const width = container.clientWidth
      const height = container.clientHeight

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      if (!renderer) {
        console.warn('WebGL not available')
        return
      }

      const bgValue = 1 - backgroundDarkness
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(bgValue, bgValue, bgValue)

      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
      camera.position.set(5, 5, 5)
      camera.lookAt(0, 0, 0)

      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
      scene.add(ambientLight)
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
      directionalLight.position.set(5, 10, 5)
      directionalLight.castShadow = true
      scene.add(directionalLight)
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
      fillLight.position.set(-5, 5, -5)
      scene.add(fillLight)

      // Create mesh
      const geometry = meshData
        ? (() => {
            const g = new THREE.BufferGeometry()
            g.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3))
            g.setIndex(new THREE.BufferAttribute(meshData.indices, 1))
            if (meshData.normals) {
              g.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3))
            } else {
              g.computeVertexNormals()
            }
            return g
          })()
        : new THREE.BoxGeometry(1, 1, 1)

      const meshColorValue = 1 - modelDarkness
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(meshColorValue, meshColorValue, meshColorValue),
        side: THREE.DoubleSide, // Render both sides to handle inverted normals
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true

      if (meshData) {
        const { min, max, dimensions } = meshData.boundingBox
        const centerX = (min[0] + max[0]) / 2
        const centerY = (min[1] + max[1]) / 2
        const centerZ = (min[2] + max[2]) / 2
        mesh.position.set(-centerX, -centerY, -centerZ)

        const maxDim = Math.max(...dimensions)
        const distance = maxDim * 2
        camera.position.set(distance, distance, distance)
        camera.lookAt(0, 0, 0)
        controls.target.set(0, 0, 0)
        controls.update()
      }

      scene.add(mesh)

      viewerRef.current = {
        renderer,
        scene,
        camera,
        controls,
        mesh,
        frameId: 0,
      }

      const animate = () => {
        if (!viewerRef.current) return
        viewerRef.current.frameId = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      const handleResize = () => {
        if (!container || !viewerRef.current) return
        const w = container.clientWidth
        const h = container.clientHeight
        viewerRef.current.camera.aspect = w / h
        viewerRef.current.camera.updateProjectionMatrix()
        viewerRef.current.renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }

    const cleanupResize = initViewer()

    return () => {
      mounted = false
      cleanupResize?.then((cleanup) => cleanup?.())
      if (viewerRef.current) {
        cancelAnimationFrame(viewerRef.current.frameId)
        try {
          container.removeChild(viewerRef.current.renderer.domElement)
        } catch {}
        viewerRef.current.renderer.dispose()
        viewerRef.current.controls.dispose()
        viewerRef.current = null
      }
    }
  }, [meshData, modelDarkness, backgroundDarkness])

  // Update background
  useEffect(() => {
    if (!viewerRef.current) return

    const updateColors = async () => {
      const THREE = await import('three')
      const bgValue = 1 - backgroundDarkness
      viewerRef.current!.scene.background = new THREE.Color(bgValue, bgValue, bgValue)
    }
    updateColors()
  }, [backgroundDarkness])

  // Update mesh color
  useEffect(() => {
    if (!viewerRef.current?.mesh) return

    const meshColorValue = 1 - modelDarkness
    const material = viewerRef.current.mesh.material as import('three').MeshStandardMaterial
    material.color.setRGB(meshColorValue, meshColorValue, meshColorValue)
  }, [modelDarkness])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-[90vw] h-[90vh] bg-neutral-900 rounded-lg overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 p-3 bg-neutral-800/90 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Model</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={modelDarkness}
              onChange={(e) => setModelDarkness(parseFloat(e.target.value))}
              className="w-24 accent-blue-500"
            />
          </div>
          <div className="w-px h-6 bg-neutral-600" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Background</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={backgroundDarkness}
              onChange={(e) => setBackgroundDarkness(parseFloat(e.target.value))}
              className="w-24 accent-blue-500"
            />
          </div>
        </div>

        {/* Viewer */}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  )
}
