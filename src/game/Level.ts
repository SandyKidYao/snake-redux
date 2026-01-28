import * as THREE from 'three'
import { Grid } from './Grid'
import { SquareGrid } from './SquareGrid'
import { HexGrid } from './HexGrid'
import { GridType, LevelConfig } from '../core/GameState'
import {
  Obstacle,
  ObstacleType,
  Pickup,
  PowerPath,
  Seeker,
} from './MapElements'
import { Snake } from './Snake'
import { SnakeController } from './SnakeController'
import { LevelLoader } from '../core/LevelLoader'
import {
  NormalizedLevelData,
  ObstacleData,
  PickupData,
  SeekerData,
  PowerPathData,
} from '../core/LevelTypes'

export class Level {
  private grid: Grid
  private obstacles: Obstacle[] = []
  private pickups: Pickup[] = []
  private powerPaths: PowerPath[] = []
  private seekers: Seeker[] = []
  private snake: Snake | null = null
  private snakeController: SnakeController | null = null
  private elementsGroup: THREE.Group = new THREE.Group()
  private isHexGrid: boolean
  private holePositionSet: Set<string> = new Set()
  private occupiedFrontPositions: Set<string> = new Set()
  private occupiedBackPositions: Set<string> = new Set()
  private snakeData: NormalizedLevelData['snake'] | null = null

  private constructor(config: LevelConfig, levelData: NormalizedLevelData) {
    this.isHexGrid = config.gridType === GridType.HEXAGONAL

    // Create grid based on config
    if (config.gridType === GridType.SQUARE) {
      this.grid = new SquareGrid(config.gridSize.width, config.gridSize.height, 1)
    } else {
      this.grid = new HexGrid(config.gridSize.width, config.gridSize.height, 1)
    }

    // Generate level elements from JSON data
    this.generateFromLevelData(levelData)
  }

  /**
   * Create a Level from loaded JSON data
   */
  static fromLevelData(levelData: NormalizedLevelData): Level {
    const config: LevelConfig = {
      id: levelData.id,
      name: levelData.name,
      gridType: levelData.gridType,
      gridSize: levelData.gridSize,
      timeLimit: levelData.timeLimit,
    }
    return new Level(config, levelData)
  }

  /**
   * Generate level elements from JSON data
   */
  private generateFromLevelData(data: NormalizedLevelData): void {
    // Process holes first (they affect floor tiles)
    this.processHoles(data.elements.front.obstacles)

    // Front side elements
    this.processObstacles(
      data.elements.front.obstacles.filter(
        (o) => LevelLoader.parseObstacleType(String(o.type)) !== ObstacleType.HOLE
      ),
      false
    )
    this.processPickups(data.elements.front.pickups, false)
    this.processPowerPaths(data.elements.front.powerPaths, false)
    this.processSeekers(data.elements.front.seekers, false)

    // Back side elements
    this.processObstacles(data.elements.back.obstacles, true)
    this.processPickups(data.elements.back.pickups, true)
    this.processPowerPaths(data.elements.back.powerPaths, true)
    this.processSeekers(data.elements.back.seekers, true)

    // Store snake config for later initialization
    this.snakeData = data.snake

    // Create snake and controller
    this.snake = new Snake(this.grid)
    this.snakeController = new SnakeController(this.grid)

    // Pass hole positions to controller for flip detection
    this.snakeController.setHolePositions(this.holePositionSet)

    // If test path is defined, use it for static display (preview mode)
    // Otherwise, initialize for gameplay
    if (data.snake.testPath && data.snake.testPath.length > 0) {
      this.snake.setPath(data.snake.testPath)
    } else {
      // Initialize controller with start position
      this.snakeController.initialize(
        data.snake.startPosition.x,
        data.snake.startPosition.y,
        data.snake.startDirection,
        data.snake.initialLength,
        data.snake.startOnBackSide
      )
      // Update snake rendering from controller
      this.snake.updateFromSegments(this.snakeController.getSegments())
    }

    this.elementsGroup.add(this.snake.getMesh())

    // Position elements group same as grid
    this.elementsGroup.position.copy(this.grid.getMesh().position)
  }

  /**
   * Process hole obstacles - remove floor tiles
   */
  private processHoles(obstacles: ObstacleData[]): void {
    obstacles.forEach((obsData) => {
      const type = LevelLoader.parseObstacleType(String(obsData.type))
      if (type === ObstacleType.HOLE) {
        this.holePositionSet.add(`${obsData.x},${obsData.y}`)
        this.grid.removeCellMesh(obsData.x, obsData.y)

        const worldPos = this.grid.gridToWorld(obsData.x, obsData.y)
        const hole = new Obstacle(ObstacleType.HOLE, obsData.x, obsData.y, worldPos, 1, this.isHexGrid)
        this.obstacles.push(hole)
        this.elementsGroup.add(hole.mesh)
      }
    })
  }

  /**
   * Process non-hole obstacles from JSON data
   */
  private processObstacles(obstacles: ObstacleData[], isBackSide: boolean): void {
    obstacles.forEach((obsData) => {
      if (this.isPositionOccupied(obsData.x, obsData.y, isBackSide)) return

      const type = LevelLoader.parseObstacleType(String(obsData.type))
      const worldPos = this.grid.gridToWorld(obsData.x, obsData.y)
      const obstacle = new Obstacle(type, obsData.x, obsData.y, worldPos, 1, this.isHexGrid)

      if (isBackSide) {
        obstacle.mesh.scale.y = -1
      }

      this.obstacles.push(obstacle)
      this.elementsGroup.add(obstacle.mesh)
      this.markPositionOccupied(obsData.x, obsData.y, isBackSide)
    })
  }

  /**
   * Process pickups from JSON data
   */
  private processPickups(pickups: PickupData[], isBackSide: boolean): void {
    const yOffset = isBackSide ? -0.3 : 0.3

    pickups.forEach((pickupData) => {
      if (this.isPositionOccupied(pickupData.x, pickupData.y, isBackSide)) return

      const type = LevelLoader.parsePickupType(String(pickupData.type))
      const worldPos = this.grid.gridToWorld(pickupData.x, pickupData.y)
      const adjustedPos = new THREE.Vector3(worldPos.x, yOffset, worldPos.z)

      const pickup = new Pickup(type, pickupData.x, pickupData.y, adjustedPos, pickupData.letter)
      this.pickups.push(pickup)
      this.elementsGroup.add(pickup.mesh)
      this.markPositionOccupied(pickupData.x, pickupData.y, isBackSide)
    })
  }

  /**
   * Process power paths from JSON data
   */
  private processPowerPaths(powerPaths: PowerPathData[], isBackSide: boolean): void {
    powerPaths.forEach((pathData) => {
      if (pathData.cells.length === 0) return

      const powerPath = new PowerPath(
        pathData.cells,
        (x, y) => {
          const pos = this.grid.gridToWorld(x, y)
          return isBackSide ? new THREE.Vector3(pos.x, -0.06, pos.z) : pos
        },
        1,
        this.isHexGrid
      )
      this.powerPaths.push(powerPath)
      this.elementsGroup.add(powerPath.mesh)
    })
  }

  /**
   * Process seekers from JSON data
   */
  private processSeekers(seekers: SeekerData[], isBackSide: boolean): void {
    seekers.forEach((seekerData) => {
      if (this.isPositionOccupied(seekerData.x, seekerData.y, isBackSide)) return

      const type = LevelLoader.parseSeekerType(String(seekerData.type))
      const worldPos = this.grid.gridToWorld(seekerData.x, seekerData.y)
      const seeker = new Seeker(type, seekerData.x, seekerData.y, worldPos)

      this.seekers.push(seeker)
      this.elementsGroup.add(seeker.mesh)
      this.markPositionOccupied(seekerData.x, seekerData.y, isBackSide)
    })
  }

  private isPositionOccupied(x: number, y: number, isBackSide: boolean = false): boolean {
    const key = `${x},${y}`
    if (isBackSide) {
      return this.occupiedBackPositions.has(key) || this.isHolePosition(x, y)
    }
    return this.occupiedFrontPositions.has(key) || this.isHolePosition(x, y)
  }

  private markPositionOccupied(x: number, y: number, isBackSide: boolean = false): void {
    const key = `${x},${y}`
    if (isBackSide) {
      this.occupiedBackPositions.add(key)
    } else {
      this.occupiedFrontPositions.add(key)
    }
  }

  private isHolePosition(x: number, y: number): boolean {
    return this.holePositionSet.has(`${x},${y}`)
  }

  getGrid(): Grid {
    return this.grid
  }

  getElementsGroup(): THREE.Group {
    return this.elementsGroup
  }

  getObstacles(): Obstacle[] {
    return this.obstacles
  }

  getPickups(): Pickup[] {
    return this.pickups
  }

  getPowerPaths(): PowerPath[] {
    return this.powerPaths
  }

  getSeekers(): Seeker[] {
    return this.seekers
  }

  removePickup(pickup: Pickup): void {
    const index = this.pickups.indexOf(pickup)
    if (index > -1) {
      this.pickups.splice(index, 1)
      this.elementsGroup.remove(pickup.mesh)
      pickup.dispose()
    }
  }

  update(time: number, deltaTime: number): void {
    // Update pickups (floating animation)
    this.pickups.forEach((pickup) => pickup.update(time))

    // Update power paths (pulsing glow)
    this.powerPaths.forEach((path) => path.update(time))

    // Update seekers
    this.seekers.forEach((seeker) => seeker.update(time, deltaTime))
  }

  getSnake(): Snake | null {
    return this.snake
  }

  getSnakeController(): SnakeController | null {
    return this.snakeController
  }

  /**
   * Start gameplay mode - initialize snake controller from config
   * Call this when transitioning from preview to actual gameplay
   */
  startGameplay(): void {
    if (!this.snakeData || !this.snakeController || !this.snake) return

    // Pass hole positions to controller
    this.snakeController.setHolePositions(this.holePositionSet)

    // Initialize controller with start position
    this.snakeController.initialize(
      this.snakeData.startPosition.x,
      this.snakeData.startPosition.y,
      this.snakeData.startDirection,
      this.snakeData.initialLength,
      this.snakeData.startOnBackSide
    )

    // Update snake rendering
    this.snake.updateFromSegments(this.snakeController.getSegments())
  }

  /**
   * Update snake movement and rendering
   * @param deltaTime Time since last frame in seconds
   * @returns true if snake moved to a new cell
   */
  updateSnake(deltaTime: number): boolean {
    if (!this.snakeController || !this.snake) return false

    const moved = this.snakeController.update(deltaTime)

    // Always update snake rendering for smooth movement
    // Pass moveProgress and target position for interpolation
    const targetCell = this.snakeController.getTargetCellPosition()

    // Only use target for interpolation if it's a valid position (not out of bounds or hole)
    let targetWorld: THREE.Vector3 | null = null
    if (targetCell) {
      const isValid =
        targetCell.x >= 0 &&
        targetCell.x < this.grid.getWidth() &&
        targetCell.y >= 0 &&
        targetCell.y < this.grid.getHeight()
      const isHole = this.holePositionSet.has(`${targetCell.x},${targetCell.y}`)

      if (isValid && !isHole) {
        targetWorld = this.grid.gridToWorld(targetCell.x, targetCell.y)
      }
    }

    this.snake.updateFromSegments(
      this.snakeController.getSegments(),
      this.snakeController.getMoveProgress(),
      targetWorld
    )

    return moved
  }

  dispose(): void {
    this.grid.dispose()
    this.obstacles.forEach((o) => o.dispose())
    this.pickups.forEach((p) => p.dispose())
    this.powerPaths.forEach((p) => p.dispose())
    this.seekers.forEach((s) => s.dispose())
    this.snake?.dispose()
  }
}
