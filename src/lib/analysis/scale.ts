/**
 * Scale Analysis Module
 *
 * Checks if mesh dimensions are reasonable for 3D printing.
 * Warns about models that are too small (hard to print) or too large
 * (won't fit on typical print beds).
 */

import type { BBox } from '@/types/mesh'

export interface ScaleResult {
  /** Whether the scale is reasonable for printing */
  isReasonable: boolean
  /** Maximum dimension in mm */
  maxDimensionMm: number
  /** Minimum dimension in mm */
  minDimensionMm: number
  /** Warning message if scale is problematic, null otherwise */
  warning: string | null
  /** Severity of scale issue */
  severity: 'none' | 'info' | 'warning' | 'error'
  /** Suggested scale factor to apply (1.0 if no change needed) */
  suggestedScaleFactor: number
}

export interface ScaleCheckOptions {
  /** Minimum acceptable dimension in mm (default: 5) */
  minDimensionMm?: number
  /** Maximum acceptable dimension in mm (default: 2000) */
  maxDimensionMm?: number
  /** Ideal minimum dimension for warning (default: 10) */
  idealMinDimensionMm?: number
  /** Ideal maximum dimension for warning (default: 300) */
  idealMaxDimensionMm?: number
  /** Assumed units in the mesh (1 = mm, 0.001 = meters, 25.4 = inches) */
  unitScale?: number
}

const DEFAULT_OPTIONS: Required<ScaleCheckOptions> = {
  minDimensionMm: 5,
  maxDimensionMm: 2000,
  idealMinDimensionMm: 10,
  idealMaxDimensionMm: 300,
  unitScale: 1, // Assume mm
}

/**
 * Checks if mesh dimensions are reasonable for 3D printing.
 *
 * @param bbox - Mesh bounding box
 * @param options - Scale check options
 * @returns ScaleResult with dimension analysis
 */
export function checkScale(bbox: BBox, options: ScaleCheckOptions = {}): ScaleResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Apply unit scale to convert to mm
  const dimensions = bbox.dimensions.map((d) => d * opts.unitScale)
  const maxDim = Math.max(...dimensions)
  const minDim = Math.min(...dimensions)

  // Check for degenerate mesh (zero dimensions)
  if (maxDim === 0) {
    return {
      isReasonable: false,
      maxDimensionMm: 0,
      minDimensionMm: 0,
      warning: 'Mesh has zero dimensions',
      severity: 'error',
      suggestedScaleFactor: 1,
    }
  }

  // Check absolute limits
  if (maxDim < opts.minDimensionMm) {
    const scaleFactor = opts.idealMinDimensionMm / maxDim
    return {
      isReasonable: false,
      maxDimensionMm: maxDim,
      minDimensionMm: minDim,
      warning: `Model is very small (${maxDim.toFixed(2)}mm). Consider scaling up by ${scaleFactor.toFixed(1)}x`,
      severity: 'error',
      suggestedScaleFactor: scaleFactor,
    }
  }

  if (maxDim > opts.maxDimensionMm) {
    const scaleFactor = opts.idealMaxDimensionMm / maxDim
    return {
      isReasonable: false,
      maxDimensionMm: maxDim,
      minDimensionMm: minDim,
      warning: `Model is very large (${maxDim.toFixed(2)}mm). Consider scaling down by ${scaleFactor.toFixed(2)}x`,
      severity: 'error',
      suggestedScaleFactor: scaleFactor,
    }
  }

  // Check ideal limits (warnings)
  if (maxDim < opts.idealMinDimensionMm) {
    const scaleFactor = opts.idealMinDimensionMm / maxDim
    return {
      isReasonable: true,
      maxDimensionMm: maxDim,
      minDimensionMm: minDim,
      warning: `Model is small (${maxDim.toFixed(2)}mm). Some details may not print well`,
      severity: 'warning',
      suggestedScaleFactor: scaleFactor,
    }
  }

  if (maxDim > opts.idealMaxDimensionMm) {
    const scaleFactor = opts.idealMaxDimensionMm / maxDim
    return {
      isReasonable: true,
      maxDimensionMm: maxDim,
      minDimensionMm: minDim,
      warning: `Model is large (${maxDim.toFixed(2)}mm). May not fit on typical print beds`,
      severity: 'warning',
      suggestedScaleFactor: scaleFactor,
    }
  }

  // All good
  return {
    isReasonable: true,
    maxDimensionMm: maxDim,
    minDimensionMm: minDim,
    warning: null,
    severity: 'none',
    suggestedScaleFactor: 1,
  }
}

/**
 * Detects likely unit system based on mesh dimensions.
 * Returns suggested unit scale factor to convert to mm.
 *
 * @param bbox - Mesh bounding box
 * @returns Object with detected unit system and scale factor
 */
export function detectUnits(bbox: BBox): { unit: string; scaleFactor: number } {
  const maxDim = Math.max(...bbox.dimensions)

  // If maxDim is in a typical mm range, assume mm
  if (maxDim >= 1 && maxDim <= 2000) {
    return { unit: 'mm', scaleFactor: 1 }
  }

  // If maxDim is very small, might be meters
  if (maxDim >= 0.001 && maxDim < 1) {
    return { unit: 'meters', scaleFactor: 1000 }
  }

  // If maxDim is very small (micrometers), might be meters with small object
  if (maxDim < 0.001 && maxDim > 0) {
    return { unit: 'meters', scaleFactor: 1000 }
  }

  // If maxDim is in inches range (1-80 inches = 25-2000mm)
  if (maxDim >= 0.1 && maxDim <= 80) {
    // Could be inches - check if multiplying by 25.4 gives reasonable mm
    const inMm = maxDim * 25.4
    if (inMm >= 10 && inMm <= 2000) {
      return { unit: 'inches', scaleFactor: 25.4 }
    }
  }

  // Default to mm
  return { unit: 'mm', scaleFactor: 1 }
}
