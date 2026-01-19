import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import type { MeshData } from '@/types/mesh'
import { computeBoundingBox, computeNormals } from '@/types/mesh'

export type SupportedFormat = 'glb' | 'gltf' | 'obj' | 'stl'

const SUPPORTED_EXTENSIONS: Record<string, SupportedFormat> = {
  '.glb': 'glb',
  '.gltf': 'gltf',
  '.obj': 'obj',
  '.stl': 'stl',
}

/**
 * Detects file format from filename
 */
export function detectFormat(filename: string): SupportedFormat | null {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return SUPPORTED_EXTENSIONS[ext] || null
}

/**
 * Extracts MeshData from a THREE.BufferGeometry
 */
export function extractMeshData(geometry: THREE.BufferGeometry, name: string, id: string): MeshData {
  // Ensure geometry has an index
  let indices: Uint32Array
  if (geometry.index) {
    indices = new Uint32Array(geometry.index.array)
  } else {
    // Non-indexed geometry - create indices
    const posCount = geometry.attributes.position.count
    indices = new Uint32Array(posCount)
    for (let i = 0; i < posCount; i++) {
      indices[i] = i
    }
  }

  // Get positions
  const positionAttr = geometry.attributes.position
  const positions = new Float32Array(positionAttr.array)

  // Get or compute normals
  let normals: Float32Array
  if (geometry.attributes.normal) {
    normals = new Float32Array(geometry.attributes.normal.array)
  } else {
    normals = computeNormals(positions, indices)
  }

  const vertexCount = positions.length / 3
  const triangleCount = indices.length / 3
  const boundingBox = computeBoundingBox(positions)

  return {
    id,
    name,
    positions,
    indices,
    normals,
    vertexCount,
    triangleCount,
    boundingBox,
  }
}

/**
 * Loads a GLB/GLTF file and extracts the first mesh
 */
async function loadGLTF(file: File, id: string): Promise<MeshData> {
  const loader = new GLTFLoader()
  const arrayBuffer = await file.arrayBuffer()

  return new Promise((resolve, reject) => {
    loader.parse(
      arrayBuffer,
      '',
      (gltf) => {
        // Find the first mesh in the scene
        let geometry: THREE.BufferGeometry | null = null
        gltf.scene.traverse((child) => {
          if (!geometry && child instanceof THREE.Mesh) {
            geometry = child.geometry
          }
        })

        if (!geometry) {
          reject(new Error('No mesh found in GLB/GLTF file'))
          return
        }

        const meshData = extractMeshData(geometry, file.name, id)
        resolve(meshData)
      },
      (error) => {
        reject(new Error(`Failed to parse GLB/GLTF: ${error.message}`))
      }
    )
  })
}

/**
 * Loads an OBJ file
 */
async function loadOBJ(file: File, id: string): Promise<MeshData> {
  const loader = new OBJLoader()
  const text = await file.text()

  const group = loader.parse(text)

  // Find the first mesh
  let geometry: THREE.BufferGeometry | null = null
  group.traverse((child) => {
    if (!geometry && child instanceof THREE.Mesh) {
      geometry = child.geometry
    }
  })

  if (!geometry) {
    throw new Error('No mesh found in OBJ file')
  }

  return extractMeshData(geometry, file.name, id)
}

/**
 * Loads an STL file
 */
async function loadSTL(file: File, id: string): Promise<MeshData> {
  const loader = new STLLoader()
  const arrayBuffer = await file.arrayBuffer()

  const geometry = loader.parse(arrayBuffer)

  return extractMeshData(geometry, file.name, id)
}

/**
 * Loads a mesh file and returns MeshData
 * Supports GLB, GLTF, OBJ, and STL formats
 */
export async function loadMeshFile(file: File, id: string): Promise<MeshData> {
  const format = detectFormat(file.name)

  if (!format) {
    throw new Error(`Unsupported file format: ${file.name}`)
  }

  switch (format) {
    case 'glb':
    case 'gltf':
      return loadGLTF(file, id)
    case 'obj':
      return loadOBJ(file, id)
    case 'stl':
      return loadSTL(file, id)
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

/**
 * Returns the accepted file extensions for file inputs
 */
export function getAcceptedExtensions(): string {
  return Object.keys(SUPPORTED_EXTENSIONS).join(',')
}
