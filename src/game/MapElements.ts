import * as THREE from 'three'

// ============ Element Types ============

export enum ObstacleType {
  SOLID_WALL = 'solid_wall', // 实体墙 - 撞上立即死亡
  BREAKABLE_WALL = 'breakable_wall', // 可破墙 - 撞破但损失长度
  HOLE = 'hole', // 空洞
}

export enum PickupType {
  FOOD = 'food', // 绿色食物丸 - +5分，增长，回复Boost
  ENERGY = 'energy', // 能量道具 - 补充Boost
  SHIELD = 'shield', // 护盾 - 防护一次伤害
  TELEPORT = 'teleport', // 传送器
  EXTRA_LIFE = 'extra_life', // 额外生命
  LETTER = 'letter', // 字母收集物
}

export interface MapElement {
  type: string
  gridX: number
  gridY: number
  mesh: THREE.Object3D
  dispose(): void
}

// ============ Obstacle Class ============

export class Obstacle implements MapElement {
  type: ObstacleType
  gridX: number
  gridY: number
  mesh: THREE.Group
  health: number = 1 // For breakable walls

  private static readonly COLORS = {
    [ObstacleType.SOLID_WALL]: {
      main: 0x333344,
      edge: 0x666688,
      emissive: 0x111122,
    },
    [ObstacleType.BREAKABLE_WALL]: {
      main: 0x554433,
      edge: 0x887766,
      emissive: 0x221100,
    },
    [ObstacleType.HOLE]: {
      main: 0x000000,
      edge: 0x440000,
      emissive: 0x220000,
    },
  }

  constructor(type: ObstacleType, gridX: number, gridY: number, worldPos: THREE.Vector3, cellSize: number = 1, isHexGrid: boolean = false) {
    this.type = type
    this.gridX = gridX
    this.gridY = gridY
    this.mesh = this.createMesh(worldPos, cellSize, isHexGrid)

    if (type === ObstacleType.BREAKABLE_WALL) {
      this.health = 1
    }
  }

  private createMesh(worldPos: THREE.Vector3, cellSize: number, isHexGrid: boolean = false): THREE.Group {
    const group = new THREE.Group()
    const colors = Obstacle.COLORS[this.type]
    const floorSurface = 0.04 // Half of floor thickness (0.08), walls sit on top of floor

    if (this.type === ObstacleType.HOLE) {
      // Hole - floor tile is already removed, no visual needed
      // The hole is simply the absence of floor
    } else if (this.type === ObstacleType.BREAKABLE_WALL) {
      // Breakable wall - pyramid (4-sided for square, 6-sided for hex)
      const sides = isHexGrid ? 6 : 4

      if (isHexGrid) {
        // Hexagonal pyramid - radius matches hex floor tile
        const hexRadius = cellSize * 0.94
        const pyramidHeight = cellSize * 0.94

        const coneGeometry = new THREE.ConeGeometry(hexRadius, pyramidHeight, sides)
        const coneMaterial = new THREE.MeshStandardMaterial({
          color: colors.main,
          emissive: colors.emissive,
          emissiveIntensity: 0.3,
          roughness: 0.6,
          metalness: 0.3,
        })
        const cone = new THREE.Mesh(coneGeometry, coneMaterial)
        // Position so base sits on the floor surface
        cone.position.set(worldPos.x, floorSurface + pyramidHeight / 2, worldPos.z)
        group.add(cone)

        // Edge highlight
        const edgeGeometry = new THREE.EdgesGeometry(coneGeometry)
        const edgeMaterial = new THREE.LineBasicMaterial({
          color: colors.edge,
          transparent: true,
          opacity: 0.8,
        })
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
        edges.position.copy(cone.position)
        group.add(edges)
      } else {
        // Square pyramid - base covers floor tile
        const baseSize = cellSize * 0.92
        const pyramidHeight = cellSize * 0.92
        // For a square with side length s, the circumradius (center to corner) is s * sqrt(2) / 2
        const radius = (baseSize * Math.sqrt(2)) / 2

        const coneGeometry = new THREE.ConeGeometry(radius, pyramidHeight, sides)
        const coneMaterial = new THREE.MeshStandardMaterial({
          color: colors.main,
          emissive: colors.emissive,
          emissiveIntensity: 0.3,
          roughness: 0.6,
          metalness: 0.3,
        })
        const cone = new THREE.Mesh(coneGeometry, coneMaterial)
        // Rotate to align square base with grid (45 degrees)
        cone.rotation.y = Math.PI / 4
        // Position so base sits on the floor surface
        cone.position.set(worldPos.x, floorSurface + pyramidHeight / 2, worldPos.z)
        group.add(cone)

        // Edge highlight
        const edgeGeometry = new THREE.EdgesGeometry(coneGeometry)
        const edgeMaterial = new THREE.LineBasicMaterial({
          color: colors.edge,
          transparent: true,
          opacity: 0.8,
        })
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
        edges.rotation.copy(cone.rotation)
        edges.position.copy(cone.position)
        group.add(edges)
      }

    } else {
      // Solid wall - cube for square grid, hexagonal prism for hex grid

      if (isHexGrid) {
        // Hexagonal prism - radius matches hex floor tile
        const hexRadius = cellSize * 0.94
        const prismHeight = cellSize * 0.94

        const cylinderGeometry = new THREE.CylinderGeometry(hexRadius, hexRadius, prismHeight, 6)
        const cylinderMaterial = new THREE.MeshStandardMaterial({
          color: colors.main,
          emissive: colors.emissive,
          emissiveIntensity: 0.3,
          roughness: 0.7,
          metalness: 0.2,
        })
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        // Position so base sits on the floor surface
        cylinder.position.set(worldPos.x, floorSurface + prismHeight / 2, worldPos.z)
        group.add(cylinder)

        // Edge highlight
        const edgeGeometry = new THREE.EdgesGeometry(cylinderGeometry)
        const edgeMaterial = new THREE.LineBasicMaterial({
          color: colors.edge,
          transparent: true,
          opacity: 0.6,
        })
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
        edges.position.copy(cylinder.position)
        group.add(edges)
      } else {
        // Cube for square grid
        const cubeSize = cellSize * 0.92

        const boxGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)
        const boxMaterial = new THREE.MeshStandardMaterial({
          color: colors.main,
          emissive: colors.emissive,
          emissiveIntensity: 0.3,
          roughness: 0.7,
          metalness: 0.2,
        })
        const box = new THREE.Mesh(boxGeometry, boxMaterial)
        // Position cube so base sits on the floor surface
        box.position.set(worldPos.x, floorSurface + cubeSize / 2, worldPos.z)
        group.add(box)

        // Edge highlight
        const edgeGeometry = new THREE.EdgesGeometry(boxGeometry)
        const edgeMaterial = new THREE.LineBasicMaterial({
          color: colors.edge,
          transparent: true,
          opacity: 0.6,
        })
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
        edges.position.copy(box.position)
        group.add(edges)
      }
    }

    return group
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

// ============ Pickup Class ============

export class Pickup implements MapElement {
  type: PickupType
  gridX: number
  gridY: number
  mesh: THREE.Group
  letter?: string // For letter pickups
  value: number = 5 // Score value

  private static readonly CONFIGS = {
    [PickupType.FOOD]: {
      color: 0x44ff44,
      emissive: 0x22aa22,
      size: 0.25,
      shape: 'sphere',
    },
    [PickupType.ENERGY]: {
      color: 0x44aaff,
      emissive: 0x2266aa,
      size: 0.3,
      shape: 'octahedron',
    },
    [PickupType.SHIELD]: {
      color: 0xffff44,
      emissive: 0xaaaa22,
      size: 0.35,
      shape: 'torus',
    },
    [PickupType.TELEPORT]: {
      color: 0xff44ff,
      emissive: 0xaa22aa,
      size: 0.3,
      shape: 'icosahedron',
    },
    [PickupType.EXTRA_LIFE]: {
      color: 0xff4444,
      emissive: 0xaa2222,
      size: 0.35,
      shape: 'heart',
    },
    [PickupType.LETTER]: {
      color: 0xffffff,
      emissive: 0xaaaaaa,
      size: 0.4,
      shape: 'box',
    },
  }

  constructor(
    type: PickupType,
    gridX: number,
    gridY: number,
    worldPos: THREE.Vector3,
    letter?: string
  ) {
    this.type = type
    this.gridX = gridX
    this.gridY = gridY
    this.letter = letter
    this.mesh = this.createMesh(worldPos)

    // Set score values
    switch (type) {
      case PickupType.FOOD:
        this.value = 5
        break
      case PickupType.ENERGY:
        this.value = 10
        break
      case PickupType.LETTER:
        this.value = 50
        break
      default:
        this.value = 25
    }
  }

  private createMesh(worldPos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group()
    const config = Pickup.CONFIGS[this.type]

    let geometry: THREE.BufferGeometry

    switch (config.shape) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(config.size, 16, 12)
        break
      case 'octahedron':
        geometry = new THREE.OctahedronGeometry(config.size)
        break
      case 'torus':
        geometry = new THREE.TorusGeometry(config.size, config.size * 0.3, 8, 16)
        break
      case 'icosahedron':
        geometry = new THREE.IcosahedronGeometry(config.size)
        break
      case 'box':
        geometry = new THREE.BoxGeometry(config.size, config.size, config.size * 0.3)
        break
      default:
        geometry = new THREE.SphereGeometry(config.size, 16, 12)
    }

    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.emissive,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.9,
    })

    const mesh = new THREE.Mesh(geometry, material)

    // Calculate safe Y position based on element size
    // Floor surfaces at y = ±0.04, animation amplitude = 0.08
    const floorSurface = 0.04
    const animationAmplitude = 0.08
    const elementSize = config.size
    const isBackSide = worldPos.y < 0

    let yPos: number
    if (isBackSide) {
      // Back side: need baseY + amplitude + size < -floorSurface
      // So baseY < -floorSurface - amplitude - size
      const maxY = -floorSurface - animationAmplitude - elementSize
      yPos = worldPos.y !== 0 ? Math.min(worldPos.y, maxY) : maxY
    } else {
      // Front side: need baseY - amplitude - size > floorSurface
      // So baseY > floorSurface + amplitude + size
      const minY = floorSurface + animationAmplitude + elementSize
      yPos = worldPos.y !== 0 ? Math.max(worldPos.y, minY) : minY
    }

    mesh.position.set(worldPos.x, yPos, worldPos.z)
    group.add(mesh)

    // Add glow effect (point light)
    const light = new THREE.PointLight(config.color, 0.5, 2)
    light.position.copy(mesh.position)
    group.add(light)

    // Store reference for animation
    group.userData.innerMesh = mesh
    group.userData.baseY = yPos
    group.userData.animationAmplitude = animationAmplitude

    return group
  }

  // Animation update (call in game loop)
  update(time: number): void {
    const mesh = this.mesh.userData.innerMesh as THREE.Mesh
    if (mesh) {
      // Floating animation with safe amplitude
      const amplitude = this.mesh.userData.animationAmplitude || 0.08
      mesh.position.y = this.mesh.userData.baseY + Math.sin(time * 2) * amplitude

      // Rotation
      mesh.rotation.y += 0.02

      if (this.type === PickupType.SHIELD) {
        mesh.rotation.x += 0.01
      }
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

// ============ Power Path Class ============

export class PowerPath {
  cells: Array<{ x: number; y: number }>
  mesh: THREE.Group
  isActive: boolean = true
  isCompleted: boolean = false
  isHexGrid: boolean

  private glowIntensity: number = 0.5
  private pathMeshes: THREE.Mesh[] = []

  constructor(
    cells: Array<{ x: number; y: number }>,
    getWorldPos: (x: number, y: number) => THREE.Vector3,
    cellSize: number = 1,
    isHexGrid: boolean = false
  ) {
    this.cells = cells
    this.isHexGrid = isHexGrid
    this.mesh = this.createMesh(getWorldPos, cellSize)
  }

  private createHexShape(radius: number): THREE.Shape {
    const shape = new THREE.Shape()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      const x = radius * Math.cos(angle)
      const y = radius * Math.sin(angle)
      if (i === 0) {
        shape.moveTo(x, y)
      } else {
        shape.lineTo(x, y)
      }
    }
    shape.closePath()
    return shape
  }

  private createMesh(getWorldPos: (x: number, y: number) => THREE.Vector3, cellSize: number): THREE.Group {
    const group = new THREE.Group()

    // Create glowing overlay for each cell in the path
    this.cells.forEach((cell) => {
      const worldPos = getWorldPos(cell.x, cell.y)

      let geometry: THREE.BufferGeometry

      if (this.isHexGrid) {
        // Hexagonal shape for hex grid
        const hexRadius = cellSize * 0.88
        const hexShape = this.createHexShape(hexRadius)
        geometry = new THREE.ShapeGeometry(hexShape)
      } else {
        // Square shape for square grid
        const size = cellSize * 0.88
        geometry = new THREE.PlaneGeometry(size, size)
      }

      const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.rotation.x = -Math.PI / 2
      // Use the Y value from worldPos (allows for back-side positioning)
      // Default is just above floor surface (0.04 + 0.02 = 0.06)
      const yPos = worldPos.y !== 0 ? worldPos.y : 0.06
      mesh.position.set(worldPos.x, yPos, worldPos.z)
      group.add(mesh)

      this.pathMeshes.push(mesh)
    })

    return group
  }

  // Animation update - pulsing glow effect
  update(time: number): void {
    if (!this.isActive) return

    this.glowIntensity = 0.3 + Math.sin(time * 3) * 0.2

    this.pathMeshes.forEach((mesh, index) => {
      const material = mesh.material as THREE.MeshBasicMaterial
      // Create wave effect along path
      const offset = index * 0.2
      material.opacity = this.glowIntensity + Math.sin(time * 4 - offset) * 0.15
    })
  }

  setCompleted(): void {
    this.isCompleted = true
    this.pathMeshes.forEach((mesh) => {
      const material = mesh.material as THREE.MeshBasicMaterial
      material.color.setHex(0x00ff00)
      material.opacity = 0.5
    })
  }

  dispose(): void {
    this.pathMeshes.forEach((mesh) => {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    })
  }
}

// ============ Seeker (Enemy) Class ============

export enum SeekerType {
  PICKUP_STEALER = 'pickup_stealer', // Red - steals pickups
  ENERGY_PROVIDER = 'energy_provider', // Green - provides energy
}

export class Seeker implements MapElement {
  type: string
  seekerType: SeekerType
  gridX: number
  gridY: number
  mesh: THREE.Group

  // TODO: Seeker AI not yet implemented
  //   (placeholder fields removed: targetX, targetY, moveSpeed)

  constructor(seekerType: SeekerType, gridX: number, gridY: number, worldPos: THREE.Vector3) {
    this.type = 'seeker'
    this.seekerType = seekerType
    this.gridX = gridX
    this.gridY = gridY
    this.mesh = this.createMesh(worldPos)
  }

  private createMesh(worldPos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group()

    const color = this.seekerType === SeekerType.PICKUP_STEALER ? 0xff4444 : 0x44ff44
    const emissive = this.seekerType === SeekerType.PICKUP_STEALER ? 0xaa0000 : 0x00aa00

    // Main body - diamond/rhombus shape
    const baseRadius = 0.4
    const yScale = 1.5
    const geometry = new THREE.OctahedronGeometry(baseRadius)
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: emissive,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.3,
      transparent: true,
      opacity: 0.8,
    })

    // Calculate safe Y position
    // Floor surface at y = 0.04, animation amplitude = 0.1
    const floorSurface = 0.04
    const animationAmplitude = 0.1
    const scaledSize = baseRadius * yScale // 0.6
    const baseY = floorSurface + animationAmplitude + scaledSize // 0.74

    const body = new THREE.Mesh(geometry, material)
    body.position.set(worldPos.x, baseY, worldPos.z)
    body.scale.set(1, yScale, 1)
    group.add(body)

    // Glow
    const light = new THREE.PointLight(color, 0.8, 3)
    light.position.copy(body.position)
    group.add(light)

    group.userData.body = body
    group.userData.baseY = baseY
    group.userData.animationAmplitude = animationAmplitude

    return group
  }

  update(time: number, _deltaTime: number): void {
    const body = this.mesh.userData.body as THREE.Mesh
    if (body) {
      // Hovering animation with safe amplitude
      const baseY = this.mesh.userData.baseY || 0.74
      const amplitude = this.mesh.userData.animationAmplitude || 0.1
      body.position.y = baseY + Math.sin(time * 3) * amplitude

      // Rotation
      body.rotation.y += 0.03
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
