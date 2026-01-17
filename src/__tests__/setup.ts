import '@testing-library/jest-dom'

// Mock ResizeObserver for React Flow
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock WebGL context for Three.js
const mockWebGLContext = {
  getExtension: () => ({
    loseContext: () => {},
  }),
  getParameter: (param: number) => {
    // Return reasonable defaults for common parameters
    if (param === 7938) return 'WebGL 1.0' // VERSION
    if (param === 7936) return 'Mock Vendor' // VENDOR
    if (param === 7937) return 'Mock Renderer' // RENDERER
    if (param === 35661) return 16 // MAX_TEXTURE_IMAGE_UNITS
    if (param === 34930) return 16 // MAX_COMBINED_TEXTURE_IMAGE_UNITS
    if (param === 3379) return 16384 // MAX_TEXTURE_SIZE
    if (param === 34076) return 16384 // MAX_CUBE_MAP_TEXTURE_SIZE
    if (param === 36347) return 1024 // MAX_VERTEX_UNIFORM_VECTORS
    if (param === 36348) return 512 // MAX_FRAGMENT_UNIFORM_VECTORS
    if (param === 36349) return 16 // MAX_VARYING_VECTORS
    if (param === 34024) return 16 // MAX_VERTEX_ATTRIBS
    return 0
  },
  getShaderPrecisionFormat: () => ({
    precision: 23,
    rangeMin: 127,
    rangeMax: 127,
  }),
  getSupportedExtensions: () => [],
  createShader: () => ({}),
  shaderSource: () => {},
  compileShader: () => {},
  getShaderParameter: () => true,
  createProgram: () => ({}),
  attachShader: () => {},
  linkProgram: () => {},
  getProgramParameter: () => true,
  useProgram: () => {},
  createBuffer: () => ({}),
  bindBuffer: () => {},
  bufferData: () => {},
  enable: () => {},
  disable: () => {},
  depthFunc: () => {},
  clearColor: () => {},
  clearDepth: () => {},
  clear: () => {},
  viewport: () => {},
  createTexture: () => ({}),
  bindTexture: () => {},
  texImage2D: () => {},
  texParameteri: () => {},
  createFramebuffer: () => ({}),
  bindFramebuffer: () => {},
  framebufferTexture2D: () => {},
  checkFramebufferStatus: () => 36053, // FRAMEBUFFER_COMPLETE
  createRenderbuffer: () => ({}),
  bindRenderbuffer: () => {},
  renderbufferStorage: () => {},
  framebufferRenderbuffer: () => {},
  getUniformLocation: () => ({}),
  getAttribLocation: () => 0,
  enableVertexAttribArray: () => {},
  vertexAttribPointer: () => {},
  uniform1i: () => {},
  uniform1f: () => {},
  uniform2f: () => {},
  uniform3f: () => {},
  uniform4f: () => {},
  uniformMatrix4fv: () => {},
  drawArrays: () => {},
  drawElements: () => {},
  getShaderInfoLog: () => '',
  getProgramInfoLog: () => '',
  deleteShader: () => {},
  deleteProgram: () => {},
  deleteBuffer: () => {},
  deleteTexture: () => {},
  deleteFramebuffer: () => {},
  deleteRenderbuffer: () => {},
  pixelStorei: () => {},
  activeTexture: () => {},
  generateMipmap: () => {},
  blendFunc: () => {},
  blendEquation: () => {},
  cullFace: () => {},
  frontFace: () => {},
  scissor: () => {},
  lineWidth: () => {},
  polygonOffset: () => {},
  colorMask: () => {},
  depthMask: () => {},
  stencilMask: () => {},
  stencilFunc: () => {},
  stencilOp: () => {},
  isContextLost: () => false,
  getContextAttributes: () => ({}),
  canvas: document.createElement('canvas'),
  drawingBufferWidth: 800,
  drawingBufferHeight: 600,
}

HTMLCanvasElement.prototype.getContext = function (contextType: string) {
  if (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl') {
    return mockWebGLContext as unknown as WebGLRenderingContext
  }
  return null
} as typeof HTMLCanvasElement.prototype.getContext
