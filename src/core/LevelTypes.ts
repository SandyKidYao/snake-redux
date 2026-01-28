import { GridType } from './GameState'
import { ObstacleType, PickupType, SeekerType } from '../game/MapElements'

// ============ Position Types ============

export interface GridPosition {
  x: number
  y: number
}

export interface SnakePathPoint extends GridPosition {
  backSide?: boolean
}

// ============ Element Data Types ============

export interface ObstacleData {
  type: ObstacleType | string
  x: number
  y: number
}

export interface PickupData {
  type: PickupType | string
  x: number
  y: number
  letter?: string // For LETTER type only
}

export interface PowerPathData {
  cells: GridPosition[]
}

export interface SeekerData {
  type: SeekerType | string
  x: number
  y: number
}

// ============ Side Elements ============

export interface SideElements {
  obstacles: ObstacleData[]
  pickups: PickupData[]
  powerPaths: PowerPathData[]
  seekers: SeekerData[]
}

// ============ Snake Configuration ============

export type SnakeDirection = 'up' | 'down' | 'left' | 'right' | 'ne' | 'nw' | 'se' | 'sw'

export interface SnakeConfig {
  startPosition: GridPosition
  startDirection: SnakeDirection
  startOnBackSide?: boolean
  initialLength?: number
  testPath?: SnakePathPoint[] // For test/demo levels
}

// ============ Main Level Data Interface (JSON input) ============

export interface LevelJsonData {
  id: string
  name: string
  gridType: 'square' | 'hexagonal'
  gridSize: {
    width: number
    height: number
  }
  timeLimit: number
  snake?: SnakeConfig
  elements?: {
    front?: Partial<SideElements>
    back?: Partial<SideElements>
  }
}

// ============ Normalized Level Data (after parsing) ============

export interface NormalizedLevelData {
  id: string
  name: string
  gridType: GridType
  gridSize: {
    width: number
    height: number
  }
  timeLimit: number
  snake: Required<Omit<SnakeConfig, 'testPath'>> & { testPath: SnakePathPoint[] }
  elements: {
    front: SideElements
    back: SideElements
  }
}

// ============ Level Load Result ============

export interface LevelLoadResult {
  success: boolean
  data?: NormalizedLevelData
  error?: string
}

// ============ Level Registry ============

export interface LevelRegistry {
  levels: Map<string, NormalizedLevelData>
  order: string[] // Level IDs in display order
}
