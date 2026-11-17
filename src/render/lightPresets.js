/**
 * Parametric light presets shared conceptually with the Blender render service.
 * No external HDR assets.
 */

/** @typedef {'softbox'|'daylight'|'warm'} LightPreset */

export const LIGHT_PRESET_DEFAULTS = {
  softbox: {sunPhi: 45, sunTheta: 35, sunIntensity: 1.6, envIntensity: 0.85, color: 0xffffff},
  daylight: {sunPhi: 55, sunTheta: 140, sunIntensity: 2.2, envIntensity: 0.7, color: 0xfff6e8},
  warm: {sunPhi: 40, sunTheta: 210, sunIntensity: 1.8, envIntensity: 0.9, color: 0xffe0b8},
}

/**
 * Spherical angles (degrees) → direction vector pointing toward the origin.
 * phi: elevation from +Y (0 = top, 90 = horizon), theta: azimuth around Y.
 */
export function sunDirectionFromAngles(phiDeg, thetaDeg, radius = 800) {
  const phi = ((Number(phiDeg) || 45) * Math.PI) / 180
  const theta = ((Number(thetaDeg) || 35) * Math.PI) / 180
  const x = radius * Math.sin(phi) * Math.cos(theta)
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)
  return {x, y, z}
}
