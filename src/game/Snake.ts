import * as THREE from 'three'
import { Grid } from './Grid'
import { SnakePathPoint } from '../core/LevelTypes'

export class Snake {
  private grid: Grid
  private mesh: THREE.Group = new THREE.Group()

  // Path points (grid coordinates)
  private pathPoints: Array<{ x: number; y: number }> = []
  private pathPointsWithSide: Array<{ x: number; y: number; backSide?: boolean }> = []

  // Four curves for the triangular cross-section (base center, left, right, apex)
  private centerCurve: THREE.CatmullRomCurve3 | null = null
  private leftCurve: THREE.CatmullRomCurve3 | null = null
  private rightCurve: THREE.CatmullRomCurve3 | null = null
  private apexCurve: THREE.CatmullRomCurve3 | null = null

  // Control points arrays (stored for direct access in body rendering)
  private centerPoints: THREE.Vector3[] = []
  private leftPoints: THREE.Vector3[] = []
  private rightPoints: THREE.Vector3[] = []
  private apexPoints: THREE.Vector3[] = []

  // Visual parameters
  private readonly triangleHalfWidth = 0.3  // Half width of triangle base (60% of cell / 2)
  private readonly triangleHeight = 0.3     // Height from base to apex (same as half width)
  private readonly floorOffset = 0.08       // How close base is to floor

  // Colors (Tron style)
  private readonly bodyColor = 0x002233
  private readonly edgeColor = 0x00ffff

  // Movement interpolation
  private moveProgress: number = 0

  constructor(grid: Grid) {
    this.grid = grid
  }

  // Set a static path for testing (grid coordinates)
  setPath(path: Array<{ x: number; y: number; backSide?: boolean }>): void {
    this.pathPointsWithSide = path
    this.pathPoints = path.map(p => ({ x: p.x, y: p.y }))
    this.buildCurves()
    this.buildMesh()
  }

  // Target world position for head interpolation
  private targetWorldPos: THREE.Vector3 | null = null

  /**
   * Update path from SnakeController segments (for dynamic movement)
   * @param segments Array of path points from controller
   * @param progress Movement progress (0-1) for interpolation
   * @param targetWorld Target world position for smooth head movement
   */
  updateFromSegments(
    segments: SnakePathPoint[],
    progress: number = 0,
    targetWorld: THREE.Vector3 | null = null
  ): void {
    if (segments.length < 2) return

    this.pathPointsWithSide = segments
    this.pathPoints = segments.map(p => ({ x: p.x, y: p.y }))
    this.moveProgress = progress
    this.targetWorldPos = targetWorld
    this.buildCurves()
    this.buildMesh()
  }

  // Build the three curves from path points
  // Edge-based approach: control points at cell edges, not centers
  // This ensures smooth direction transitions at turns
  private buildCurves(): void {
    if (this.pathPointsWithSide.length < 2) return

    const centerPoints: THREE.Vector3[] = []
    const leftPoints: THREE.Vector3[] = []
    const rightPoints: THREE.Vector3[] = []
    const apexPoints: THREE.Vector3[] = []

    // Helper to add a control point with direction
    const addPoint = (x: number, y: number, z: number, dirX: number, dirZ: number, isBackSide: boolean) => {
      // right = perpendicular to direction in XZ plane
      let rightX = dirZ
      let rightZ = -dirX

      // On back side, flip left/right to maintain visual consistency
      // (from snake's perspective, its left side should stay on the same visual side)
      if (isBackSide) {
        rightX = -rightX
        rightZ = -rightZ
      }

      centerPoints.push(new THREE.Vector3(x, y, z))
      leftPoints.push(new THREE.Vector3(
        x - rightX * this.triangleHalfWidth,
        y,
        z - rightZ * this.triangleHalfWidth
      ))
      rightPoints.push(new THREE.Vector3(
        x + rightX * this.triangleHalfWidth,
        y,
        z + rightZ * this.triangleHalfWidth
      ))

      // Calculate apex point
      // When y > 0 (front): apex is above center (y increases)
      // When y < 0 (back): apex is below center (y decreases)
      // When y = 0 (floor edge): apex points outward along movement direction
      let apexX: number, apexY: number, apexZ: number
      if (Math.abs(y) < 0.001) {
        // At floor edge (y ≈ 0): apex points along movement direction
        apexX = x + dirX * this.triangleHeight
        apexY = 0
        apexZ = z + dirZ * this.triangleHeight
      } else if (y > 0) {
        // Front side: apex above
        apexX = x
        apexY = y + this.triangleHeight
        apexZ = z
      } else {
        // Back side: apex below
        apexX = x
        apexY = y - this.triangleHeight
        apexZ = z
      }
      apexPoints.push(new THREE.Vector3(apexX, apexY, apexZ))
    }

    // Process each path point
    for (let i = 0; i < this.pathPointsWithSide.length; i++) {
      const point = this.pathPointsWithSide[i]
      const prevPoint = i > 0 ? this.pathPointsWithSide[i - 1] : null
      const nextPoint = i < this.pathPointsWithSide.length - 1 ? this.pathPointsWithSide[i + 1] : null

      const worldPos = this.grid.gridToWorld(point.x, point.y)
      const isBackSide = point.backSide ?? false
      const baseY = isBackSide ? -this.floorOffset : this.floorOffset

      // Get world positions of neighbors for edge calculations
      const prevWorld = prevPoint ? this.grid.gridToWorld(prevPoint.x, prevPoint.y) : null
      const nextWorld = nextPoint ? this.grid.gridToWorld(nextPoint.x, nextPoint.y) : null

      // Calculate incoming direction (from prev to current)
      let inDirX = 0, inDirZ = 0
      if (prevWorld) {
        inDirX = worldPos.x - prevWorld.x
        inDirZ = worldPos.z - prevWorld.z
        const len = Math.sqrt(inDirX * inDirX + inDirZ * inDirZ)
        if (len > 0.001) {
          inDirX /= len
          inDirZ /= len
        }
      }

      // Calculate outgoing direction (from current to next)
      let outDirX = 0, outDirZ = 0
      if (nextWorld) {
        outDirX = nextWorld.x - worldPos.x
        outDirZ = nextWorld.z - worldPos.z
        const len = Math.sqrt(outDirX * outDirX + outDirZ * outDirZ)
        if (len > 0.001) {
          outDirX /= len
          outDirZ /= len
        }
      }

      // Check for flip transitions
      const isFlipFromPrev = prevPoint && prevPoint.backSide !== point.backSide
      const isFlipToNext = nextPoint && nextPoint.backSide !== point.backSide

      // First point: add tail position (center of cell)
      if (i === 0) {
        // Use outgoing direction for first point
        // Only use default if both components are zero (no valid direction)
        let dirX = outDirX
        let dirZ = outDirZ
        if (dirX === 0 && dirZ === 0) {
          dirX = 1
          dirZ = 0
        }
        addPoint(worldPos.x, baseY, worldPos.z, dirX, dirZ, isBackSide)
      }

      // Handle flip from previous cell
      if (isFlipFromPrev && prevPoint && prevWorld) {
        const prevIsBack = prevPoint.backSide ?? false

        // Check if flip happens at same grid position
        const samePosition = (prevPoint.x === point.x && prevPoint.y === point.y)

        // Get approach direction (from i-2 to i-1 for same position, or use inDir)
        let approachDirX = inDirX, approachDirZ = inDirZ
        if (samePosition && i >= 2) {
          const pp = this.pathPointsWithSide[i - 2]
          const ppWorld = this.grid.gridToWorld(pp.x, pp.y)
          approachDirX = prevWorld.x - ppWorld.x
          approachDirZ = prevWorld.z - ppWorld.z
          const len = Math.sqrt(approachDirX * approachDirX + approachDirZ * approachDirZ)
          if (len > 0.001) {
            approachDirX /= len
            approachDirZ /= len
          }
        }

        // Calculate edge position
        let edgeX: number, edgeZ: number
        if (samePosition) {
          // Same position flip: edge is at boundary of cell in approach direction
          let halfDist = this.grid.getCellSize() / 2

          // For hex grid, try to get actual distance from neighbor
          if (i >= 2) {
            const pp = this.pathPointsWithSide[i - 2]
            const ppWorld = this.grid.gridToWorld(pp.x, pp.y)
            const dist = Math.sqrt(
              Math.pow(prevWorld.x - ppWorld.x, 2) + Math.pow(prevWorld.z - ppWorld.z, 2)
            )
            if (dist > 0.001) {
              halfDist = dist / 2
            }
          }

          edgeX = prevWorld.x + approachDirX * halfDist
          edgeZ = prevWorld.z + approachDirZ * halfDist
        } else {
          // Different position flip: edge is midpoint between cell centers
          edgeX = (prevWorld.x + worldPos.x) / 2
          edgeZ = (prevWorld.z + worldPos.z) / 2
        }

        // Only add the point AFTER flip (point before flip was added by isFlipToNext handler)
        // Use prevIsBack for left/right consistency during the flip transition
        addPoint(edgeX, baseY, edgeZ, approachDirX, approachDirZ, prevIsBack)
      }

      // For non-first/last points: add entry edge and exit edge
      if (i > 0 && i < this.pathPointsWithSide.length - 1 && !isFlipFromPrev && !isFlipToNext) {
        // Check if turning (direction change)
        const isTurning = Math.abs(inDirX - outDirX) > 0.01 || Math.abs(inDirZ - outDirZ) > 0.01

        // Entry edge: midpoint between prev and current
        if (prevWorld && (inDirX !== 0 || inDirZ !== 0)) {
          const entryX = (prevWorld.x + worldPos.x) / 2
          const entryZ = (prevWorld.z + worldPos.z) / 2
          addPoint(entryX, baseY, entryZ, inDirX, inDirZ, isBackSide)
        }

        // At turns, add center point to prevent curve looping
        if (isTurning) {
          // Use average direction at the turn
          const avgDirX = inDirX + outDirX
          const avgDirZ = inDirZ + outDirZ
          const len = Math.sqrt(avgDirX * avgDirX + avgDirZ * avgDirZ)
          const normDirX = len > 0.001 ? avgDirX / len : inDirX
          const normDirZ = len > 0.001 ? avgDirZ / len : inDirZ
          addPoint(worldPos.x, baseY, worldPos.z, normDirX, normDirZ, isBackSide)
        }

        // Exit edge: midpoint between current and next
        if (nextWorld && (outDirX !== 0 || outDirZ !== 0)) {
          const exitX = (worldPos.x + nextWorld.x) / 2
          const exitZ = (worldPos.z + nextWorld.z) / 2
          addPoint(exitX, baseY, exitZ, outDirX, outDirZ, isBackSide)
        }
      } else if (i > 0 && !isFlipFromPrev && (isFlipToNext || i < this.pathPointsWithSide.length - 1)) {
        // Non-flip intermediate point (not last): add cell center
        // Last point is handled separately below
        // Only use default if both components are zero (no valid direction)
        let dirX = inDirX !== 0 ? inDirX : outDirX
        let dirZ = inDirZ !== 0 ? inDirZ : outDirZ
        if (dirX === 0 && dirZ === 0) {
          dirX = 1
          dirZ = 0
        }
        addPoint(worldPos.x, baseY, worldPos.z, dirX, dirZ, isBackSide)
      }

      // Handle flip to next cell - add edge point BEFORE flip
      if (isFlipToNext && nextPoint && nextWorld) {
        // Check if flip happens at same grid position
        const samePosition = (point.x === nextPoint.x && point.y === nextPoint.y)

        // Use incoming direction as the approach direction
        let approachDirX = inDirX, approachDirZ = inDirZ
        if (approachDirX === 0 && approachDirZ === 0) {
          approachDirX = outDirX
          approachDirZ = outDirZ
        }
        if (approachDirX === 0 && approachDirZ === 0) {
          approachDirX = 1
          approachDirZ = 0
        }

        // Calculate edge position
        let edgeX: number, edgeZ: number
        if (samePosition) {
          // Same position flip: edge is at boundary of cell
          let halfDist = this.grid.getCellSize() / 2

          // For hex grid, try to get actual distance from previous neighbor
          if (i >= 1) {
            const pp = this.pathPointsWithSide[i - 1]
            const ppWorld = this.grid.gridToWorld(pp.x, pp.y)
            const dist = Math.sqrt(
              Math.pow(worldPos.x - ppWorld.x, 2) + Math.pow(worldPos.z - ppWorld.z, 2)
            )
            if (dist > 0.001) {
              halfDist = dist / 2
            }
          }

          edgeX = worldPos.x + approachDirX * halfDist
          edgeZ = worldPos.z + approachDirZ * halfDist
        } else {
          // Different position flip: edge is midpoint
          edgeX = (worldPos.x + nextWorld.x) / 2
          edgeZ = (worldPos.z + nextWorld.z) / 2
        }

        // Add edge point on current side (before the flip)
        addPoint(edgeX, baseY, edgeZ, approachDirX, approachDirZ, isBackSide)

        // Add middle point at floor edge center (y = 0) to wrap around floor edge
        // Offset outward by floorOffset to create a smooth curve around the edge
        addPoint(
          edgeX + approachDirX * this.floorOffset,
          0,
          edgeZ + approachDirZ * this.floorOffset,
          approachDirX,
          approachDirZ,
          isBackSide
        )
      }

      // Last point: add head position (center of cell)
      if (i === this.pathPointsWithSide.length - 1 && !isFlipFromPrev) {
        // Only use default if both components are zero (no valid direction)
        let dirX = inDirX
        let dirZ = inDirZ
        if (dirX === 0 && dirZ === 0) {
          dirX = 1
          dirZ = 0
        }
        addPoint(worldPos.x, baseY, worldPos.z, dirX, dirZ, isBackSide)
      }
    }


    // Apply smooth movement interpolation
    // Offset all points by moveProgress * (target - head) for smooth forward movement
    if (this.targetWorldPos && this.moveProgress > 0 && centerPoints.length > 0) {
      const headCenter = centerPoints[centerPoints.length - 1]
      const offsetX = (this.targetWorldPos.x - headCenter.x) * this.moveProgress
      const offsetZ = (this.targetWorldPos.z - headCenter.z) * this.moveProgress

      // Apply offset to all control points
      for (let i = 0; i < centerPoints.length; i++) {
        centerPoints[i].x += offsetX
        centerPoints[i].z += offsetZ
        leftPoints[i].x += offsetX
        leftPoints[i].z += offsetZ
        rightPoints[i].x += offsetX
        rightPoints[i].z += offsetZ
        apexPoints[i].x += offsetX
        apexPoints[i].z += offsetZ
      }
    }

    // Store control points for direct access
    this.centerPoints = centerPoints
    this.leftPoints = leftPoints
    this.rightPoints = rightPoints
    this.apexPoints = apexPoints

    // Create curves
    this.centerCurve = new THREE.CatmullRomCurve3(centerPoints, false, 'catmullrom', 0.5)
    this.leftCurve = new THREE.CatmullRomCurve3(leftPoints, false, 'catmullrom', 0.5)
    this.rightCurve = new THREE.CatmullRomCurve3(rightPoints, false, 'catmullrom', 0.5)
    this.apexCurve = new THREE.CatmullRomCurve3(apexPoints, false, 'catmullrom', 0.5)
  }

  // Build the snake mesh
  private buildMesh(): void {
    this.disposeMesh()

    if (!this.centerCurve || this.pathPoints.length < 2) return

    // this.buildDebugCurves()
    this.buildSnake()
  }

  // Build entire snake: tail and head use curve sampling, body uses control points directly
  private buildSnake(): void {
    if (!this.centerCurve || !this.leftCurve || !this.rightCurve || !this.apexCurve) return
    if (this.centerPoints.length < 2) return

    const numPoints = this.centerPoints.length
    const curveLength = this.centerCurve.getLength()
    const cellSize = this.grid.getCellSize()
    const cellT = cellSize / curveLength

    // Tail and head each take one cell worth of t
    const tailT = cellT
    const headT = cellT
    const maxHeadScale = 2.0

    // Find which control point indices are in body region
    // Control point i is at approximately t = i / (numPoints - 1)
    const firstBodyIdx = Math.ceil(tailT * (numPoints - 1))
    const lastBodyIdx = Math.floor((1 - headT) * (numPoints - 1))

    const snakeGroup = new THREE.Group()
    const vertices: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    // Helper to add a segment
    const addSegment = (
      center: THREE.Vector3,
      left: THREE.Vector3,
      right: THREE.Vector3,
      apex: THREE.Vector3,
      t: number
    ) => {
      vertices.push(right.x, right.y, right.z)
      vertices.push(left.x, left.y, left.z)
      vertices.push(apex.x, apex.y, apex.z)

      // Compute normals
      const tangent = this.centerCurve!.getTangentAt(Math.min(Math.max(t, 0.001), 0.999))
      const isBackSide = center.y < 0
      const floorDir = isBackSide ? 1 : -1

      const rightToApex = new THREE.Vector3().subVectors(apex, right)
      const leftToApex = new THREE.Vector3().subVectors(apex, left)
      const rightNormal = new THREE.Vector3().crossVectors(tangent, rightToApex).normalize()
      const leftNormal = new THREE.Vector3().crossVectors(leftToApex, tangent).normalize()

      normals.push(rightNormal.x, rightNormal.y, rightNormal.z)
      normals.push(leftNormal.x, leftNormal.y, leftNormal.z)
      normals.push(0, -floorDir, 0)

      uvs.push(0, t)
      uvs.push(1, t)
      uvs.push(0.5, t)
    }

    // Helper to add scaled segment from curve
    const addScaledCurveSegment = (t: number, scale: number) => {
      const center = this.centerCurve!.getPointAt(t)
      const leftRaw = this.leftCurve!.getPointAt(t)
      const rightRaw = this.rightCurve!.getPointAt(t)
      const apexRaw = this.apexCurve!.getPointAt(t)

      const left = new THREE.Vector3(
        center.x + (leftRaw.x - center.x) * scale,
        center.y + (leftRaw.y - center.y) * scale,
        center.z + (leftRaw.z - center.z) * scale
      )
      const right = new THREE.Vector3(
        center.x + (rightRaw.x - center.x) * scale,
        center.y + (rightRaw.y - center.y) * scale,
        center.z + (rightRaw.z - center.z) * scale
      )
      const apex = new THREE.Vector3(
        center.x + (apexRaw.x - center.x) * scale,
        center.y + (apexRaw.y - center.y) * scale,
        center.z + (apexRaw.z - center.z) * scale
      )

      addSegment(center, left, right, apex, t)
    }

    // 1. TAIL: just 2 points - tip and connection to body
    addScaledCurveSegment(0, 0.01)  // Tail tip
    const tailEndT = firstBodyIdx / (numPoints - 1)
    addScaledCurveSegment(tailEndT, 1)  // Connection to body

    // 2. BODY: use control points directly (scale = 1)
    for (let i = firstBodyIdx; i <= lastBodyIdx; i++) {
      const t = i / (numPoints - 1)
      addSegment(
        this.centerPoints[i],
        this.leftPoints[i],
        this.rightPoints[i],
        this.apexPoints[i],
        t
      )
    }

    // 3. HEAD: transition from body width to widened head, then tip
    if (numPoints > 0) {
      const lastIdx = numPoints - 1

      // Add segments from after body end to last control point with increasing scale
      const headStartIdx = Math.max(lastBodyIdx + 1, 1)
      const headRange = lastIdx - headStartIdx + 1

      for (let i = headStartIdx; i <= lastIdx; i++) {
        const t = i / (numPoints - 1)
        // Progress from 0 to 1 within head region
        const progress = headRange > 1 ? (i - headStartIdx) / (headRange - 1) : 1
        // Scale increases from 1 to maxHeadScale
        const scale = 1 + (maxHeadScale - 1) * progress

        const center = this.centerPoints[i]
        const left = new THREE.Vector3(
          center.x + (this.leftPoints[i].x - center.x) * scale,
          center.y + (this.leftPoints[i].y - center.y) * scale,
          center.z + (this.leftPoints[i].z - center.z) * scale
        )
        const right = new THREE.Vector3(
          center.x + (this.rightPoints[i].x - center.x) * scale,
          center.y + (this.rightPoints[i].y - center.y) * scale,
          center.z + (this.rightPoints[i].z - center.z) * scale
        )
        const apex = new THREE.Vector3(
          center.x + (this.apexPoints[i].x - center.x) * scale,
          center.y + (this.apexPoints[i].y - center.y) * scale,
          center.z + (this.apexPoints[i].z - center.z) * scale
        )
        addSegment(center, left, right, apex, t)
      }

      // Head tip - slightly ahead of last point in direction of movement
      const lastCenter = this.centerPoints[lastIdx]
      const tipOffset = 0.3
      let tipDir: THREE.Vector3
      if (numPoints >= 2) {
        const prevCenter = this.centerPoints[lastIdx - 1]
        tipDir = new THREE.Vector3().subVectors(lastCenter, prevCenter).normalize()
      } else {
        tipDir = new THREE.Vector3(1, 0, 0)
      }
      const tipCenter = new THREE.Vector3(
        lastCenter.x + tipDir.x * tipOffset,
        lastCenter.y + tipDir.y * tipOffset,
        lastCenter.z + tipDir.z * tipOffset
      )
      addSegment(tipCenter, tipCenter.clone(), tipCenter.clone(), tipCenter.clone(), 1)
    }

    // Generate indices
    const actualSegments = Math.floor(vertices.length / 9)
    for (let i = 0; i < actualSegments - 1; i++) {
      const i0 = i * 3, i1 = i * 3 + 1, i2 = i * 3 + 2
      const j0 = (i + 1) * 3, j1 = (i + 1) * 3 + 1, j2 = (i + 1) * 3 + 2

      indices.push(i0, i1, j0)
      indices.push(j0, i1, j1)
      indices.push(i1, i2, j1)
      indices.push(j1, i2, j2)
      indices.push(i2, i0, j2)
      indices.push(j2, i0, j0)
    }

    if (vertices.length > 0) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      geometry.setIndex(indices)

      const material = new THREE.MeshStandardMaterial({
        color: this.bodyColor,
        emissive: this.edgeColor,
        emissiveIntensity: 0.1,
        roughness: 0.4,
        metalness: 0.1,
        side: THREE.DoubleSide,
      })

      snakeGroup.add(new THREE.Mesh(geometry, material))
      this.addEdgeLines(snakeGroup, vertices, actualSegments, 1)
    }

    this.mesh.add(snakeGroup)
  }

  // Add glowing edge lines
  private addEdgeLines(
    group: THREE.Group,
    vertices: number[] | Float32Array,
    segments: number,
    interval: number
  ): void {
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
    })

    for (let i = 0; i < segments; i += interval) {
      const idx = i * 9  // 3 vertices * 3 components
      if (idx + 8 >= vertices.length) continue

      const right = new THREE.Vector3(vertices[idx], vertices[idx + 1], vertices[idx + 2])
      const left = new THREE.Vector3(vertices[idx + 3], vertices[idx + 4], vertices[idx + 5])
      const apex = new THREE.Vector3(vertices[idx + 6], vertices[idx + 7], vertices[idx + 8])

      const points = [right, left, apex, right]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      group.add(new THREE.Line(geometry, edgeMaterial.clone()))
    }
  }

  getMesh(): THREE.Group {
    return this.mesh
  }

  getPath(): Array<{ x: number; y: number }> {
    return this.pathPoints
  }

  private disposeMesh(): void {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
      if (obj instanceof THREE.Line) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
    this.mesh.clear()
  }

  dispose(): void {
    this.disposeMesh()
  }
}
