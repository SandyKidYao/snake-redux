import * as THREE from 'three'
import { Grid } from './Grid'
import { GridType } from '../core/GameState'
import { SnakeDirection, SnakePathPoint } from '../core/LevelTypes'

/**
 * Direction indices for different grid types:
 * - Square grid: 4 directions (0=up, 1=right, 2=down, 3=left), 90° turns
 * - Hex grid: 6 directions (0=up, 1=up-right, 2=down-right, 3=down, 4=down-left, 5=up-left), 60° turns
 */
export class SnakeController {
  private grid: Grid
  private isHex: boolean

  // Snake state
  private segments: SnakePathPoint[] = []
  private directionIndex: number = 0 // Current direction (0-3 for square, 0-5 for hex)
  private isOnBackSide: boolean = false

  // Movement parameters
  private baseSpeed: number = 3 // Cells per second
  private currentSpeed: number = 3
  private moveProgress: number = 0 // Progress towards next cell (0-1)

  // Direction vectors (calculated based on grid type)
  private directions: THREE.Vector2[] = []

  // State flags
  private isAlive: boolean = true
  private pendingTurn: 'left' | 'right' | null = null

  // Hole positions (for flip detection)
  private holePositions: Set<string> = new Set()

  constructor(grid: Grid) {
    this.grid = grid
    this.isHex = grid.getType() === GridType.HEXAGONAL
    this.initializeDirections()
  }

  /**
   * Initialize direction vectors based on grid type
   * These are approximate world-space direction vectors for camera/rendering
   */
  private initializeDirections(): void {
    if (this.isHex) {
      // Hex grid: 6 directions, 60° apart
      // Matches the neighbor order in getNextCellPosition()
      // 0: top-right (NE), 1: right (E), 2: bottom-right (SE)
      // 3: bottom-left (SW), 4: left (W), 5: top-left (NW)
      const sqrt3_2 = Math.sqrt(3) / 2
      this.directions = [
        new THREE.Vector2(0.5, -sqrt3_2),   // 0: top-right (NE)
        new THREE.Vector2(1, 0),             // 1: right (E)
        new THREE.Vector2(0.5, sqrt3_2),    // 2: bottom-right (SE)
        new THREE.Vector2(-0.5, sqrt3_2),   // 3: bottom-left (SW)
        new THREE.Vector2(-1, 0),            // 4: left (W)
        new THREE.Vector2(-0.5, -sqrt3_2),  // 5: top-left (NW)
      ]
    } else {
      // Square grid: 4 directions, 90° apart
      // 0: up (negative Z), 1: right (+X), 2: down (+Z), 3: left (-X)
      this.directions = [
        new THREE.Vector2(0, -1),  // 0: up
        new THREE.Vector2(1, 0),   // 1: right
        new THREE.Vector2(0, 1),   // 2: down
        new THREE.Vector2(-1, 0),  // 3: left
      ]
    }
  }

  /**
   * Initialize snake with starting position and direction
   */
  initialize(
    startX: number,
    startY: number,
    direction: SnakeDirection,
    initialLength: number = 4,
    onBackSide: boolean = false
  ): void {
    this.isOnBackSide = onBackSide
    this.directionIndex = this.directionToIndex(direction)
    this.segments = []
    this.moveProgress = 0
    this.isAlive = true
    this.pendingTurn = null

    // Create initial snake body (head at front, tail at back)
    // Build backwards from head position
    const oppositeDir = this.getOppositeDirection()

    for (let i = 0; i < initialLength; i++) {
      const x = startX + oppositeDir.x * i
      const y = startY + oppositeDir.y * i
      this.segments.push({
        x,
        y,
        backSide: onBackSide
      })
    }
  }

  /**
   * Convert direction name to index
   */
  private directionToIndex(direction: SnakeDirection): number {
    if (this.isHex) {
      // Hex directions (6 directions, 60° apart)
      // 0: top-right (NE), 1: right (E), 2: bottom-right (SE)
      // 3: bottom-left (SW), 4: left (W), 5: top-left (NW)
      switch (direction) {
        case 'ne': return 0
        case 'right': return 1
        case 'se': return 2
        case 'sw': return 3
        case 'left': return 4
        case 'nw': return 5
        // Map "up" and "down" to nearest direction
        case 'up': return 0    // Treat as top-right
        case 'down': return 3  // Treat as bottom-left
        default: return 1      // Default to right
      }
    } else {
      // Square directions (4 directions, 90° apart)
      // 0: up, 1: right, 2: down, 3: left
      switch (direction) {
        case 'up': return 0
        case 'right': return 1
        case 'down': return 2
        case 'left': return 3
        default: return 1
      }
    }
  }

  /**
   * Get the opposite direction vector (for building initial snake body)
   */
  private getOppositeDirection(): THREE.Vector2 {
    const numDirs = this.isHex ? 6 : 4
    const oppositeIndex = (this.directionIndex + numDirs / 2) % numDirs
    return this.directions[oppositeIndex].clone()
  }

  /**
   * Get current direction vector
   */
  getCurrentDirection(): THREE.Vector2 {
    return this.directions[this.directionIndex].clone()
  }

  /**
   * Get the next cell position based on current direction (for hex grid, considers row parity)
   */
  private getNextCellPosition(): { x: number; y: number } {
    const head = this.segments[0]

    if (this.isHex) {
      // Hex grid movement depends on whether current row is odd or even
      // Matches HexGrid.getNeighbors() exactly
      const isOddRow = head.y % 2 === 1

      // Direction indices for hex:
      // 0: top-right, 1: right, 2: bottom-right, 3: bottom-left, 4: left, 5: top-left
      const offsets = isOddRow
        ? [
            { x: 1, y: -1 },   // 0: top-right
            { x: 1, y: 0 },    // 1: right
            { x: 1, y: 1 },    // 2: bottom-right
            { x: 0, y: 1 },    // 3: bottom-left
            { x: -1, y: 0 },   // 4: left
            { x: 0, y: -1 },   // 5: top-left
          ]
        : [
            { x: 0, y: -1 },   // 0: top-right
            { x: 1, y: 0 },    // 1: right
            { x: 0, y: 1 },    // 2: bottom-right
            { x: -1, y: 1 },   // 3: bottom-left
            { x: -1, y: 0 },   // 4: left
            { x: -1, y: -1 },  // 5: top-left
          ]

      const offset = offsets[this.directionIndex]
      return {
        x: head.x + offset.x,
        y: head.y + offset.y
      }
    } else {
      // Square grid - simple
      const dir = this.directions[this.directionIndex]
      return {
        x: head.x + dir.x,
        y: head.y + dir.y
      }
    }
  }

  /**
   * Turn left (counter-clockwise)
   */
  turnLeft(): void {
    if (!this.isAlive) return
    this.pendingTurn = 'left'
  }

  /**
   * Turn right (clockwise)
   */
  turnRight(): void {
    if (!this.isAlive) return
    this.pendingTurn = 'right'
  }

  /**
   * Apply pending turn
   * On back side, turn direction is visually inverted due to camera flip,
   * so we swap left/right to maintain intuitive controls
   */
  private applyTurn(): void {
    if (!this.pendingTurn) return

    const numDirs = this.isHex ? 6 : 4

    // On back side, swap turn direction to compensate for camera flip
    let actualTurn = this.pendingTurn
    if (this.isOnBackSide) {
      actualTurn = this.pendingTurn === 'left' ? 'right' : 'left'
    }

    if (actualTurn === 'left') {
      this.directionIndex = (this.directionIndex - 1 + numDirs) % numDirs
    } else {
      this.directionIndex = (this.directionIndex + 1) % numDirs
    }

    this.pendingTurn = null
  }

  /**
   * Update snake movement
   * @param deltaTime Time since last frame in seconds
   * @returns true if snake moved to a new cell
   */
  update(deltaTime: number): boolean {
    if (!this.isAlive || this.segments.length === 0) return false

    // Update move progress
    this.moveProgress += this.currentSpeed * deltaTime

    // Check if we've moved to the next cell
    if (this.moveProgress >= 1) {
      this.moveProgress -= 1

      // Apply any pending turn before moving
      this.applyTurn()

      // Move to next cell
      const nextPos = this.getNextCellPosition()

      // Check bounds - if out of bounds, flip to other side
      if (!this.isValidPosition(nextPos.x, nextPos.y)) {
        this.handleBoundaryFlip()
      }
      // Check for hole - if it's a hole, flip to other side
      else if (this.isHole(nextPos.x, nextPos.y)) {
        this.handleHoleFlip(nextPos)
      }
      // Normal move
      else {
        this.segments.unshift({
          x: nextPos.x,
          y: nextPos.y,
          backSide: this.isOnBackSide
        })
        this.segments.pop()
      }

      return true
    }

    return false
  }

  /**
   * Check if position is within grid bounds
   */
  private isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.grid.getWidth() && y >= 0 && y < this.grid.getHeight()
  }

  /**
   * Reverse direction (180° turn) - used when flipping to other side
   */
  private reverseDirection(): void {
    const numDirs = this.isHex ? 6 : 4
    this.directionIndex = (this.directionIndex + numDirs / 2) % numDirs
  }

  /**
   * Handle boundary collision - flip to other side of the map
   * When snake hits edge, it wraps around the edge to the other side
   * Direction is reversed so snake continues in opposite direction
   */
  private handleBoundaryFlip(): void {
    const head = this.segments[0]

    // Flip to the other side
    this.isOnBackSide = !this.isOnBackSide

    // Reverse direction - snake wraps around and goes back
    this.reverseDirection()

    // Add a single flip point at current head position on the new side
    // The snake "wraps around" the edge
    this.segments.unshift({
      x: head.x,
      y: head.y,
      backSide: this.isOnBackSide
    })

    // Remove one tail segment to maintain length
    this.segments.pop()
  }

  /**
   * Handle hole - flip to other side at the hole position
   * Snake enters the hole and emerges on the other side, continuing in reversed direction
   */
  private handleHoleFlip(holePos: { x: number; y: number }): void {
    // Flip to the other side
    this.isOnBackSide = !this.isOnBackSide

    // Reverse direction - snake wraps around the hole edge
    this.reverseDirection()

    // Add the hole position on the new side as the new head
    this.segments.unshift({
      x: holePos.x,
      y: holePos.y,
      backSide: this.isOnBackSide
    })

    // Remove one tail segment to maintain length
    this.segments.pop()
  }

  /**
   * Grow the snake by one segment
   */
  grow(): void {
    if (this.segments.length === 0) return

    // Duplicate the tail segment
    const tail = this.segments[this.segments.length - 1]
    this.segments.push({ ...tail })
  }

  /**
   * Get the head position in world coordinates
   */
  getHeadWorldPosition(): THREE.Vector3 {
    if (this.segments.length === 0) return new THREE.Vector3()

    const head = this.segments[0]
    const worldPos = this.grid.gridToWorld(head.x, head.y)

    // Adjust Y based on which side we're on
    const floorOffset = 0.08
    worldPos.y = head.backSide ? -floorOffset : floorOffset

    return worldPos
  }

  /**
   * Get the direction the head is facing in world coordinates
   */
  getHeadWorldDirection(): THREE.Vector3 {
    if (this.segments.length < 2) {
      // Use current direction
      const dir = this.getCurrentDirection()
      return new THREE.Vector3(dir.x, 0, dir.y).normalize()
    }

    const head = this.segments[0]
    const neck = this.segments[1]

    const headWorld = this.grid.gridToWorld(head.x, head.y)
    const neckWorld = this.grid.gridToWorld(neck.x, neck.y)

    return new THREE.Vector3(
      headWorld.x - neckWorld.x,
      0,
      headWorld.z - neckWorld.z
    ).normalize()
  }

  /**
   * Get interpolated head position for smooth camera following
   */
  getInterpolatedHeadPosition(): THREE.Vector3 {
    if (this.segments.length < 2) return this.getHeadWorldPosition()

    const head = this.segments[0]
    const neck = this.segments[1]

    const headWorld = this.grid.gridToWorld(head.x, head.y)
    const neckWorld = this.grid.gridToWorld(neck.x, neck.y)

    // Interpolate between neck and head based on move progress
    const pos = new THREE.Vector3(
      neckWorld.x + (headWorld.x - neckWorld.x) * this.moveProgress,
      0,
      neckWorld.z + (headWorld.z - neckWorld.z) * this.moveProgress
    )

    // Adjust Y based on which side we're on
    const floorOffset = 0.08
    pos.y = head.backSide ? -floorOffset : floorOffset

    return pos
  }

  /**
   * Get all segments for rendering (in tail-to-head order for Snake.ts)
   */
  getSegments(): SnakePathPoint[] {
    // Snake.ts expects path[0] = tail, path[last] = head
    // But we store segments[0] = head, segments[last] = tail
    // So we need to reverse the array
    return [...this.segments].reverse()
  }

  /**
   * Set hole positions for flip detection
   */
  setHolePositions(holes: Set<string>): void {
    this.holePositions = holes
  }

  /**
   * Check if a position is a hole
   */
  private isHole(x: number, y: number): boolean {
    return this.holePositions.has(`${x},${y}`)
  }

  /**
   * Set speed multiplier (for boost/slow)
   */
  setSpeedMultiplier(multiplier: number): void {
    this.currentSpeed = this.baseSpeed * multiplier
  }

  /**
   * Check if snake is alive
   */
  getIsAlive(): boolean {
    return this.isAlive
  }

  /**
   * Kill the snake
   */
  kill(): void {
    this.isAlive = false
  }

  /**
   * Get current direction index (for debugging)
   */
  getDirectionIndex(): number {
    return this.directionIndex
  }

  /**
   * Check if on back side
   */
  getIsOnBackSide(): boolean {
    return this.isOnBackSide
  }

  /**
   * Get move progress (0-1)
   */
  getMoveProgress(): number {
    return this.moveProgress
  }

  /**
   * Get the target cell position (where the head is moving towards)
   * Returns the next cell position based on current direction
   */
  getTargetCellPosition(): { x: number; y: number } | null {
    if (this.segments.length === 0) return null
    return this.getNextCellPosition()
  }
}
