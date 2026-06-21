/**
 * Utilities for calculating and managing model memory requirements
 */

export interface ModelMemoryInfo {
  estimatedMemoryMB: number;
  warningLevel: "safe" | "warning" | "critical";
  recommendedDeviceRAM: string;
}

/**
 * Calculate estimated memory required to load a model
 * Based on model size and quantization method
 */
export function estimateModelMemory(
  modelSizeMB: number,
  quantization?: string,
): number {
  // Quantization multipliers (lower = more compression)
  const quantizationMultipliers: { [key: string]: number } = {
    "q0f16": 0.5, // float16 quantization
    "q0f32": 1.0, // float32 (full precision)
    "q4f16": 0.35, // 4-bit + float16
    "q4f32": 0.6, // 4-bit + float32
    "q3f16": 0.4, // 3-bit + float16
    "q8f16": 0.55, // 8-bit + float16
  };

  let multiplier = 1.0;
  if (quantization) {
    multiplier = quantizationMultipliers[quantization] || 0.7; // default to ~70% for unknown quant
  }

  // Add overhead for model metadata, KV cache, and runtime buffers (~20% overhead)
  const baseMemory = modelSizeMB * multiplier;
  const memoryWithOverhead = baseMemory * 1.2;

  return Math.round(memoryWithOverhead);
}

/**
 * Extract model size from model name or file
 * Common formats: "Llama-7B", "Phi-3B", "Model-13B-Instruct-q4f16"
 */
export function extractModelSizeFromName(name: string): number | null {
  // Match patterns like 7B, 13B, 3.5B, etc.
  const sizeRegex = /(\d+(?:\.\d+)?)\s*[BK]/i;
  const match = name.match(sizeRegex);

  if (match) {
    const size = parseFloat(match[1]);
    // Convert to MB assuming ~2 bytes per parameter for fp32
    // B = billions of parameters, 2 bytes = 1 MB per billion params
    if (match[0].toLowerCase().endsWith("b")) {
      return size * 2000; // 1B params ≈ 2000MB in fp32
    } else if (match[0].toLowerCase().endsWith("k")) {
      return (size * 2) / 1000; // K params
    }
  }

  return null;
}

/**
 * Get device memory info from WebGL or estimate from browser
 */
export function getDeviceMemoryInfo(): {
  totalMemoryMB: number;
  estimatedFreeMB: number;
} {
  let totalMemoryMB = 8192; // Default to 8GB
  let estimatedFreeMB = 4096; // Default estimate

  // Try to use navigator deviceMemory API (limited support)
  if ("deviceMemory" in navigator) {
    totalMemoryMB = (navigator as any).deviceMemory * 1024; // Convert GB to MB
    estimatedFreeMB = (totalMemoryMB * 0.6) | 0; // Estimate 60% available
  }

  // WebGL memory detection (experimental)
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_lose_context");
      // Note: WEBGL doesn't reliably expose memory, this is a fallback
    }
  } catch (e) {
    // WebGL not supported
  }

  return { totalMemoryMB, estimatedFreeMB };
}

/**
 * Categorize memory warning level based on requirements vs available memory
 */
export function getMemoryWarningLevel(
  requiredMemoryMB: number,
  availableMemoryMB: number,
): "safe" | "warning" | "critical" {
  const ratio = requiredMemoryMB / availableMemoryMB;

  if (ratio > 0.8) {
    return "critical"; // Model takes >80% of available memory
  } else if (ratio > 0.6) {
    return "warning"; // Model takes 60-80% of available memory
  }
  return "safe"; // Model takes <60% of available memory
}

/**
 * Get human-readable memory estimate info
 */
export function getModelMemoryInfo(
  modelSizeMB: number,
  quantization?: string,
): ModelMemoryInfo {
  const estimatedMemoryMB = estimateModelMemory(modelSizeMB, quantization);
  const { estimatedFreeMB } = getDeviceMemoryInfo();
  const warningLevel = getMemoryWarningLevel(estimatedMemoryMB, estimatedFreeMB);

  // Recommend device RAM based on estimated needs
  let recommendedDeviceRAM: string;
  if (estimatedMemoryMB > 8000) {
    recommendedDeviceRAM = "16GB+ RAM";
  } else if (estimatedMemoryMB > 4000) {
    recommendedDeviceRAM = "8GB+ RAM";
  } else if (estimatedMemoryMB > 2000) {
    recommendedDeviceRAM = "4GB+ RAM";
  } else {
    recommendedDeviceRAM = "2GB+ RAM";
  }

  return {
    estimatedMemoryMB,
    warningLevel,
    recommendedDeviceRAM,
  };
}

/**
 * Format bytes to human-readable memory size
 */
export function formatMemorySize(mb: number): string {
  if (mb > 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(mb)} MB`;
}
