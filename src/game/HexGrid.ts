import * as THREE from 'three'
import { GridType } from '../core/GameState'
import { Grid, GridCell, CellType } from './Grid'

export class HexGrid extends Grid {
  private readonly hexRadius: number
  private readonly hexHeight: number
  private readonly hexWidth: number

  constructor(width: number, height: number, cellSize: number = 1) {
    super(width, height, cellSize)

    // Hexagon dimensions (pointy-top orientation)
    this.hexRadius = cellSize
    this.hexHeight = this.hexRadius * 2
    this.hexWidth = Math.sqrt(3) * this.hexRadius

    this.initializeCells()
    this.mesh = this.createMesh()
  }

  getType(): GridType {
    return GridType.HEXAGONAL
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

    // Add colored regions
    this.addColoredRegions()
  }

  private addColoredRegions(): void {
    // Create clustered red/danger zones like in the original
    const dangerZones = [
      { cx: Math.floor(this.width / 2), cy: Math.floor(this.height / 2), radius: 2 },
      { cx: 2, cy: 2, radius: 1 },
      { cx: this.width - 3, cy: this.height - 3, radius: 1 },
    ]

    for (const zone of dangerZones) {
      for (let dy = -zone.radius; dy <= zone.radius; dy++) {
        for (let dx = -zone.radius; dx <= zone.radius; dx++) {
          const x = zone.cx + dx
          const y = zone.cy + dy
          if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            if (Math.abs(dx) + Math.abs(dy) <= zone.radius + 1) {
              this.setCellType(x, y, CellType.SPEED_DOWN)
            }
          }
        }
      }
    }
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group()

    // Create individual hex cell meshes
    this.cells.forEach((cell) => {
      const cellMesh = this.createHexMesh(cell)
      group.add(cellMesh)
      // Track mesh for potential removal (holes)
      this.cellMeshes.set(this.getCellKey(cell.x, cell.y), cellMesh)
    })

    // Center the grid
    const totalWidth = this.width * this.hexWidth + this.hexWidth / 2
    const totalHeight = this.height * this.hexHeight * 0.75 + this.hexHeight * 0.25
    group.position.set(-totalWidth / 2 + this.hexWidth / 2, 0, -totalHeight / 2 + this.hexRadius)

    return group
  }

  private getCellColor(cell: GridCell): { fill: number; edge: number } {
    const centerX = this.width / 2
    const centerY = this.height / 2

    // Distance from center (0 to 1)
    const dist = Math.sqrt(
      Math.pow((cell.x - centerX) / centerX, 2) + Math.pow((cell.y - centerY) / centerY, 2)
    )

    switch (cell.type) {
      case CellType.SPEED_DOWN:
        // Red/orange danger cells
        return {
          fill: 0xcc4422,
          edge: 0x441100,
        }
      case CellType.SPEED_UP:
        // Brighter green boost cells
        return {
          fill: 0x66dd44,
          edge: 0x224400,
        }
      default:
        // Green-yellow gradient based on position (like original)
        // Center is more yellow, edges are more green
        const t = Math.min(1, dist * 1.2)

        // Interpolate between yellow-green (center) and green (edges)
        const r = Math.floor(0x44 + (0x88 - 0x44) * (1 - t))
        const g = Math.floor(0xbb + (0xdd - 0xbb) * (1 - t))
        const b = Math.floor(0x22 + (0x44 - 0x22) * (1 - t))

        const fillColor = (r << 16) | (g << 8) | b

        return {
          fill: fillColor,
          edge: 0x223311,
        }
    }
  }

  private createHexMesh(cell: GridCell): THREE.Group {
    const cellGroup = new THREE.Group()
    const radius = this.hexRadius * 0.94 // Small gap between cells
    const thickness = 0.08 // Small thickness to prevent z-fighting

    const colors = this.getCellColor(cell)

    // Create hexagon shape
    const hexShape = new THREE.Shape()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2 // Start from top
      const x = radius * Math.cos(angle)
      const y = radius * Math.sin(angle)
      if (i === 0) {
        hexShape.moveTo(x, y)
      } else {
        hexShape.lineTo(x, y)
      }
    }
    hexShape.closePath()

    // Extrude with small thickness
    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: false,
    }
    const hexGeometry = new THREE.ExtrudeGeometry(hexShape, extrudeSettings)

    // Material for the hex tile
    const hexMaterial = new THREE.MeshStandardMaterial({
      color: colors.fill,
      emissive: colors.fill,
      emissiveIntensity: 0.15,
      roughness: 0.7,
    })

    const hex = new THREE.Mesh(hexGeometry, hexMaterial)
    hex.rotation.x = -Math.PI / 2
    // Position so the tile is centered vertically at y=0
    // ExtrudeGeometry after -PI/2 rotation has bottom at local y=0, top at local y=depth
    // So we offset by -thickness/2 to center the floor at y=0
    hex.position.set(cell.worldPosition.x, -thickness / 2, cell.worldPosition.z)
    cellGroup.add(hex)

    // Edge outline on top surface
    const edgePoints: THREE.Vector3[] = []
    for (let i = 0; i <= 6; i++) {
      const angle = (Math.PI / 3) * (i % 6) - Math.PI / 2
      const x = radius * Math.cos(angle)
      const z = radius * Math.sin(angle)
      edgePoints.push(new THREE.Vector3(x, 0, z))
    }
    const edgeGeometry = new THREE.BufferGeometry().setFromPoints(edgePoints)
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: colors.edge,
      linewidth: 1,
    })
    const topEdge = new THREE.Line(edgeGeometry, edgeMaterial)
    topEdge.position.set(cell.worldPosition.x, thickness / 2 + 0.01, cell.worldPosition.z)
    cellGroup.add(topEdge)

    // Edge outline on bottom surface
    const bottomEdge = new THREE.Line(edgeGeometry.clone(), edgeMaterial.clone())
    bottomEdge.position.set(cell.worldPosition.x, -thickness / 2 - 0.01, cell.worldPosition.z)
    cellGroup.add(bottomEdge)

    return cellGroup
  }

  getCellAt(x: number, y: number): GridCell | undefined {
    return this.cells.get(this.getCellKey(x, y))
  }

  getNeighbors(x: number, y: number): GridCell[] {
    const neighbors: GridCell[] = []

    // Offset coordinates for odd/even rows (pointy-top hex)
    const isOddRow = y % 2 === 1
    const directions = isOddRow
      ? [
          { dx: 1, dy: -1 }, // top-right
          { dx: 1, dy: 0 }, // right
          { dx: 1, dy: 1 }, // bottom-right
          { dx: 0, dy: 1 }, // bottom-left
          { dx: -1, dy: 0 }, // left
          { dx: 0, dy: -1 }, // top-left
        ]
      : [
          { dx: 0, dy: -1 }, // top-right
          { dx: 1, dy: 0 }, // right
          { dx: 0, dy: 1 }, // bottom-right
          { dx: -1, dy: 1 }, // bottom-left
          { dx: -1, dy: 0 }, // left
          { dx: -1, dy: -1 }, // top-left
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
    // Convert world position to hex grid coordinates
    const totalWidth = this.width * this.hexWidth + this.hexWidth / 2
    const totalHeight = this.height * this.hexHeight * 0.75 + this.hexHeight * 0.25

    const adjustedX = worldPos.x + totalWidth / 2 - this.hexWidth / 2
    const adjustedZ = worldPos.z + totalHeight / 2 - this.hexRadius

    const y = Math.round(adjustedZ / (this.hexHeight * 0.75))
    const isOddRow = y % 2 === 1
    const xOffset = isOddRow ? this.hexWidth / 2 : 0
    const x = Math.round((adjustedX - xOffset) / this.hexWidth)

    return { x, y }
  }

  gridToWorld(x: number, y: number): THREE.Vector3 {
    // Offset x for odd rows (pointy-top hex layout)
    const isOddRow = y % 2 === 1
    const xOffset = isOddRow ? this.hexWidth / 2 : 0

    const worldX = x * this.hexWidth + xOffset
    const worldZ = y * this.hexHeight * 0.75

    return new THREE.Vector3(worldX, 0, worldZ)
  }

  // Get direction vectors for hex grid (6 directions, 60° apart)
  static getDirections(): THREE.Vector3[] {
    const directions: THREE.Vector3[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2 // Start from top
      directions.push(new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle)).normalize())
    }
    return directions
  }
}
