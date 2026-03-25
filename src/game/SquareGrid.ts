import * as THREE from 'three'
import { GridType } from '../core/GameState'
import { Grid, GridCell, CellType } from './Grid'

export class SquareGrid extends Grid {
  constructor(width: number, height: number, cellSize: number = 1) {
    super(width, height, cellSize)
    this.initializeCells()
    this.mesh = this.createMesh()
  }

  getType(): GridType {
    return GridType.SQUARE
  }

  private initializeCells(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const worldPos = this.gridToWorld(x, y)
        const cell: GridCell = {
          x,
          y,
          type: CellType.NORMAL,
          worldPosition: worldPos,
        }
        this.cells.set(this.getCellKey(x, y), cell)
      }
    }

    // Add colored regions like the original game
    this.addColoredRegions()
  }

  private addColoredRegions(): void {
    // Create some clustered colored regions instead of random cells
    const regions = [
      { cx: 3, cy: 3, radius: 2, type: CellType.SPEED_UP },
      { cx: this.width - 4, cy: 4, radius: 2, type: CellType.SPEED_UP },
      { cx: Math.floor(this.width / 2), cy: this.height - 3, radius: 2, type: CellType.SPEED_DOWN },
      { cx: 2, cy: this.height - 4, radius: 1, type: CellType.SPEED_DOWN },
    ]

    for (const region of regions) {
      for (let dy = -region.radius; dy <= region.radius; dy++) {
        for (let dx = -region.radius; dx <= region.radius; dx++) {
          const x = region.cx + dx
          const y = region.cy + dy
          if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            if (Math.abs(dx) + Math.abs(dy) <= region.radius + 1) {
              this.setCellType(x, y, region.type)
            }
          }
        }
      }
    }
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group()

    // Create individual cell meshes
    this.cells.forEach((cell) => {
      const cellMesh = this.createCellMesh(cell)
      group.add(cellMesh)
      // Track mesh for potential removal (holes)
      this.cellMeshes.set(this.getCellKey(cell.x, cell.y), cellMesh)
    })

    // Center the grid
    const offsetX = (this.width * this.cellSize) / 2 - this.cellSize / 2
    const offsetZ = (this.height * this.cellSize) / 2 - this.cellSize / 2
    group.position.set(-offsetX, 0, -offsetZ)

    return group
  }

  private getCellColor(cell: GridCell): { top: number; side: number; edge: number } {
    switch (cell.type) {
      case CellType.SPEED_UP:
        // Green cells
        return {
          top: 0x00aa44,
          side: 0x006622,
          edge: 0x00ff66,
        }
      case CellType.SPEED_DOWN:
        // Magenta/Pink cells
        return {
          top: 0xaa2266,
          side: 0x661144,
          edge: 0xff4488,
        }
      default:
        // Normal cells - cyan/teal with position-based variation (hardcoded hex)
        // Create color variation based on position
        if ((cell.x + cell.y) % 5 === 0) {
          // Some cells slightly different shade
          return {
            top: 0x004455,
            side: 0x002233,
            edge: 0x00aaaa,
          }
        }

        return {
          top: 0x003344,
          side: 0x001a22,
          edge: 0x008888,
        }
    }
  }

  private createCellMesh(cell: GridCell): THREE.Group {
    const cellGroup = new THREE.Group()
    const size = this.cellSize * 0.92 // Gap between cells
    const thickness = 0.08 // Small thickness to prevent z-fighting

    const colors = this.getCellColor(cell)

    // Create a box with small thickness for dual-surface gameplay
    const boxGeometry = new THREE.BoxGeometry(size, thickness, size)

    // Materials for each face - top and bottom have different colors
    const materials = [
      new THREE.MeshStandardMaterial({ color: colors.side, emissive: colors.side, emissiveIntensity: 0.1, roughness: 0.7 }), // right
      new THREE.MeshStandardMaterial({ color: colors.side, emissive: colors.side, emissiveIntensity: 0.1, roughness: 0.7 }), // left
      new THREE.MeshStandardMaterial({ color: colors.top, emissive: colors.top, emissiveIntensity: 0.2, roughness: 0.6 }), // top
      new THREE.MeshStandardMaterial({ color: colors.side, emissive: colors.side, emissiveIntensity: 0.15, roughness: 0.7 }), // bottom
      new THREE.MeshStandardMaterial({ color: colors.side, emissive: colors.side, emissiveIntensity: 0.1, roughness: 0.7 }), // front
      new THREE.MeshStandardMaterial({ color: colors.side, emissive: colors.side, emissiveIntensity: 0.1, roughness: 0.7 }), // back
    ]

    const box = new THREE.Mesh(boxGeometry, materials)
    box.position.set(cell.worldPosition.x, 0, cell.worldPosition.z)
    cellGroup.add(box)

    // Edge lines on top surface
    const topEdgeGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size))
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: colors.edge,
      transparent: true,
      opacity: 0.6,
    })
    const topEdge = new THREE.LineSegments(topEdgeGeometry, edgeMaterial)
    topEdge.rotation.x = -Math.PI / 2
    topEdge.position.set(cell.worldPosition.x, thickness / 2 + 0.01, cell.worldPosition.z)
    cellGroup.add(topEdge)

    // Edge lines on bottom surface
    const bottomEdge = new THREE.LineSegments(topEdgeGeometry.clone(), edgeMaterial.clone())
    bottomEdge.rotation.x = -Math.PI / 2
    bottomEdge.position.set(cell.worldPosition.x, -thickness / 2 - 0.01, cell.worldPosition.z)
    cellGroup.add(bottomEdge)

    return cellGroup
  }

  getCellAt(x: number, y: number): GridCell | undefined {
    return this.cells.get(this.getCellKey(x, y))
  }

  getNeighbors(x: number, y: number): GridCell[] {
    const neighbors: GridCell[] = []
    const directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 1, dy: 0 }, // right
      { dx: 0, dy: 1 }, // down
      { dx: -1, dy: 0 }, // left
    ]

    for (const dir of directions) {
      const cell = this.getCellAt(x + dir.dx, y + dir.dy)
      if (cell) {
        neighbors.push(cell)
      }
    }

    return neighbors
  }

  worldToGrid(worldPos: THREE.Vector3): { x: number; y: number } {
    const offsetX = (this.width * this.cellSize) / 2 - this.cellSize / 2
    const offsetZ = (this.height * this.cellSize) / 2 - this.cellSize / 2

    const x = Math.round((worldPos.x + offsetX) / this.cellSize)
    const y = Math.round((worldPos.z + offsetZ) / this.cellSize)

    return { x, y }
  }

  gridToWorld(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(x * this.cellSize, 0, y * this.cellSize)
  }

  // Get direction vectors for square grid (4 directions)
  static getDirections(): THREE.Vector3[] {
    return [
      new THREE.Vector3(0, 0, -1), // up (forward)
      new THREE.Vector3(1, 0, 0), // right
      new THREE.Vector3(0, 0, 1), // down (backward)
      new THREE.Vector3(-1, 0, 0), // left
    ]
  }
}
