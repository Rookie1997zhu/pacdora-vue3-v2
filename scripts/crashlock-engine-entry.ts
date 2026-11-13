/**
 * esbuild entry: Lab Crashlock prototype → packages/crashlock-engine bundle.
 * Runtime geometry uses the emitted ESM only (no TypeScript in Docker).
 */
export {
  generateCrashlockWithOutline,
  setFitCoeffs,
  GEOM_WIDTH_UU,
  GEOM_HEIGHT_UU,
} from '../research/packative-dieline-lab/src/prototype/crashlock.ts'
