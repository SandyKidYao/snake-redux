import { GridType, LevelConfig } from './GameState'
import {
  LevelJsonData,
  NormalizedLevelData,
  LevelLoadResult,
  LevelRegistry,
  SideElements,
  SnakeConfig,
  GridPosition,
  SnakePathPoint,
} from './LevelTypes'
import { ObstacleType, PickupType, SeekerType } from '../game/MapElements'

export class LevelLoader {
  private static instance: LevelLoader
  private registry: LevelRegistry = {
    levels: new Map(),
    order: [],
  }
  private loadedFromJson: boolean = false

  // Singleton pattern
  static getInstance(): LevelLoader {
    if (!LevelLoader.instance) {
      LevelLoader.instance = new LevelLoader()
    }
    return LevelLoader.instance
  }

  private constructor() {}

  // ============ Public API ============

  /**
   * Load all levels from JSON files
   * @param levelPaths Array of paths to level JSON files
   */
  async loadLevels(levelPaths: string[]): Promise<void> {
    for (const path of levelPaths) {
      const result = await this.loadLevelFromFile(path)
      if (result.success && result.data) {
        this.registry.levels.set(result.data.id, result.data)
        this.registry.order.push(result.data.id)
        console.log(`Loaded level: ${result.data.name} (${result.data.id})`)
      } else {
        console.error(`Failed to load level from ${path}:`, result.error)
      }
    }
    this.loadedFromJson = this.registry.order.length > 0
  }

  /**
   * Load a single level from JSON file
   */
  async loadLevelFromFile(path: string): Promise<LevelLoadResult> {
    try {
      // Add cache-busting parameter to ensure fresh data
      const cacheBuster = `?t=${Date.now()}`
      const response = await fetch(path + cacheBuster)
      if (!response.ok) {
        return { success: false, error: `HTTP error: ${response.status}` }
      }
      const json = await response.json()
      return this.parseLevelJson(json)
    } catch (error) {
      return { success: false, error: `Failed to load: ${error}` }
    }
  }

  /**
   * Parse and validate raw JSON data
   */
  parseLevelJson(json: unknown): LevelLoadResult {
    try {
      const rawData = json as LevelJsonData
      const validated = this.validateLevelData(rawData)
      const normalized = this.normalizeLevelData(validated)
      return { success: true, data: normalized }
    } catch (error) {
      return { success: false, error: `Validation error: ${error}` }
    }
  }

  /**
   * Get a level by ID
   */
  getLevel(id: string): NormalizedLevelData | undefined {
    return this.registry.levels.get(id)
  }

  /**
   * Get all level IDs in order
   */
  getLevelIds(): string[] {
    return [...this.registry.order]
  }

  /**
   * Get all levels as LevelConfig array (for backward compatibility)
   */
  getLevelConfigs(): LevelConfig[] {
    return this.registry.order.map((id) => {
      const level = this.registry.levels.get(id)!
      return {
        id: level.id,
        name: level.name,
        gridType: level.gridType,
        gridSize: level.gridSize,
        timeLimit: level.timeLimit,
      }
    })
  }

  /**
   * Check if levels were loaded from JSON
   */
  isLoadedFromJson(): boolean {
    return this.loadedFromJson
  }

  /**
   * Get the number of loaded levels
   */
  getLevelCount(): number {
    return this.registry.order.length
  }

  // ============ Validation ============

  private validateLevelData(data: LevelJsonData): LevelJsonData {
    // Required fields
    if (!data.id || typeof data.id !== 'string') {
      throw new Error('Missing or invalid "id"')
    }
    if (!data.name || typeof data.name !== 'string') {
      throw new Error('Missing or invalid "name"')
    }
    if (!data.gridType || !['square', 'hexagonal'].includes(data.gridType)) {
      throw new Error('Missing or invalid "gridType"')
    }
    if (
      !data.gridSize ||
      typeof data.gridSize.width !== 'number' ||
      typeof data.gridSize.height !== 'number'
    ) {
      throw new Error('Missing or invalid "gridSize"')
    }
    if (typeof data.timeLimit !== 'number' || data.timeLimit <= 0) {
      throw new Error('Missing or invalid "timeLimit"')
    }

    // Validate grid bounds
    if (data.gridSize.width < 5 || data.gridSize.height < 5) {
      throw new Error('Grid size must be at least 5x5')
    }

    // Validate element positions are within bounds
    if (data.elements) {
      this.validateElementPositions(data.elements.front, data.gridSize, 'front')
      this.validateElementPositions(data.elements.back, data.gridSize, 'back')
    }

    return data
  }

  private validateElementPositions(
    elements: Partial<SideElements> | undefined,
    gridSize: { width: number; height: number },
    side: string
  ): void {
    if (!elements) return

    const validatePosition = (pos: GridPosition, type: string) => {
      if (pos.x < 0 || pos.x >= gridSize.width || pos.y < 0 || pos.y >= gridSize.height) {
        throw new Error(`${type} position (${pos.x}, ${pos.y}) out of bounds on ${side} side`)
      }
    }

    elements.obstacles?.forEach((o) => validatePosition(o, 'Obstacle'))
    elements.pickups?.forEach((p) => validatePosition(p, 'Pickup'))
    elements.seekers?.forEach((s) => validatePosition(s, 'Seeker'))
    elements.powerPaths?.forEach((path) => {
      path.cells?.forEach((c) => validatePosition(c, 'PowerPath cell'))
    })
  }

  // ============ Normalization ============

  private normalizeLevelData(data: LevelJsonData): NormalizedLevelData {
    const gridType = data.gridType === 'hexagonal' ? GridType.HEXAGONAL : GridType.SQUARE

    return {
      id: data.id,
      name: data.name,
      gridType,
      gridSize: data.gridSize,
      timeLimit: data.timeLimit,
      snake: this.normalizeSnakeConfig(data.snake, data.gridSize),
      elements: {
        front: this.normalizeSideElements(data.elements?.front),
        back: this.normalizeSideElements(data.elements?.back),
      },
    }
  }

  private normalizeSnakeConfig(
    config: SnakeConfig | undefined,
    gridSize: { width: number; height: number }
  ): Required<Omit<SnakeConfig, 'testPath'>> & { testPath: SnakePathPoint[] } {
    const centerX = Math.floor(gridSize.width / 2)
    const centerY = Math.floor(gridSize.height / 2)

    return {
      startPosition: config?.startPosition || { x: centerX, y: centerY },
      startDirection: config?.startDirection || 'right',
      startOnBackSide: config?.startOnBackSide || false,
      initialLength: config?.initialLength || 4,
      testPath: config?.testPath || [],
    }
  }

  private normalizeSideElements(elements: Partial<SideElements> | undefined): SideElements {
    return {
      obstacles: elements?.obstacles || [],
      pickups: elements?.pickups || [],
      powerPaths: elements?.powerPaths || [],
      seekers: elements?.seekers || [],
    }
  }

  // ============ String to Enum Conversion (Static Utilities) ============

  static parseObstacleType(str: string): ObstacleType {
    const map: Record<string, ObstacleType> = {
      solid_wall: ObstacleType.SOLID_WALL,
      breakable_wall: ObstacleType.BREAKABLE_WALL,
      hole: ObstacleType.HOLE,
    }
    return map[str] || ObstacleType.SOLID_WALL
  }

  static parsePickupType(str: string): PickupType {
    const map: Record<string, PickupType> = {
      food: PickupType.FOOD,
      energy: PickupType.ENERGY,
      shield: PickupType.SHIELD,
      teleport: PickupType.TELEPORT,
      extra_life: PickupType.EXTRA_LIFE,
      letter: PickupType.LETTER,
    }
    return map[str] || PickupType.FOOD
  }

  static parseSeekerType(str: string): SeekerType {
    const map: Record<string, SeekerType> = {
      pickup_stealer: SeekerType.PICKUP_STEALER,
      energy_provider: SeekerType.ENERGY_PROVIDER,
    }
    return map[str] || SeekerType.PICKUP_STEALER
  }
}
