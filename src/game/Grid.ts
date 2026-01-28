import * as THREE from 'three'
import { GridType } from '../core/GameState'

export enum CellType {
  NORMAL = 'normal',
  SPEED_UP = 'speed_up', // Green - accelerate
  SPEED_DOWN = 'speed_down', // Red - decelerate
  WALL = 'wall',
  HOLE = 'hole',
}

export interface GridCell {
  x: number
  y: number
  type: CellType
  worldPosition: THREE.Vector3
}

export abstract class Grid {
  protected cells: Map<string, GridCell> = new Map()
  protected cellMeshes: Map<string, THREE.Object3D> = new Map()
  protected mesh: THREE.Group = new THREE.Group()
  protected width: number
  protected height: number
  protected cellSize: number

  constructor(width: number, height: number, cellSize: number = 1) {
    this.width = width
    this.height = height
    this.cellSize = cellSize
  }

  abstract getType(): GridType
  abstract createMesh(): THREE.Group
  abstract getCellAt(x: number, y: number): GridCell | undefined
  abstract getNeighbors(x: number, y: number): GridCell[]
  abstract worldToGrid(worldPos: THREE.Vector3): { x: number; y: number }
  abstract gridToWorld(x: number, y: number): THREE.Vector3

  getMesh(): THREE.Group {
    return this.mesh
  }

  // Remove the floor tile at the given position (for holes)
  removeCellMesh(x: number, y: number): void {
    const key = this.getCellKey(x, y)
    const cellMesh = this.cellMeshes.get(key)
    if (cellMesh) {
      this.mesh.remove(cellMesh)
      // Dispose geometry and materials
      cellMesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
      this.cellMeshes.delete(key)
    }
  }

  getWidth(): number {
    return this.width
  }

  getHeight(): number {
    return this.height
  }

  getCellSize(): number {
    return this.cellSize
  }

  getCellKey(x: number, y: number): string {
    return `${x},${y}`
  }

  getAllCells(): GridCell[] {
    return Array.from(this.cells.values())
  }

  setCellType(x: number, y: number, type: CellType): void {
    const cell = this.cells.get(this.getCellKey(x, y))
    if (cell) {
      cell.type = type
    }
  }

  dispose(): void {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
  }
}
