import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { gameState, GameScreen, LevelConfig } from '../core/GameState'
import { Level } from './Level'
import { HUD } from '../ui/HUD'
import { LevelLoader } from '../core/LevelLoader'

export class Game {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private controls: OrbitControls

  private level: Level | null = null
  private hud: HUD

  private isRunning: boolean = false
  private startTime: number = 0
  private elapsedTime: number = 0
  private gameTime: number = 0 // For animations

  // Camera follow mode
  private useFollowCamera: boolean = true
  private cameraDistance: number = 8    // Distance behind snake
  private cameraHeight: number = 5      // Height above snake
  private cameraLookAhead: number = 3   // How far ahead to look
  private cameraSmoothness: number = 5  // Camera smoothing factor

  // Smooth camera state
  private smoothCameraPos: THREE.Vector3 = new THREE.Vector3()
  private smoothCameraTarget: THREE.Vector3 = new THREE.Vector3()
  private cameraInitialized: boolean = false

  constructor(container: HTMLElement) {
    this.container = container

    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000011)

    // Camera setup - behind view perspective
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.container.appendChild(this.renderer.domElement)

    // Orbit controls for preview mode - allows viewing both sides of the map
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 5
    this.controls.maxDistance = 50
    this.controls.target.set(0, 0, 0)

    // HUD
    this.hud = new HUD(container)
    this.hud.hide()

    // Lighting
    this.setupLighting()

    // Events
    this.setupEventListeners()

    // Start animation loop
    this.animate()
  }

  private setupLighting(): void {
    // Ambient light - slightly brighter for better visibility
    const ambientLight = new THREE.AmbientLight(0x444455, 1.2)
    this.scene.add(ambientLight)

    // Main directional light from above-front
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(5, 20, 15)
    this.scene.add(directionalLight)

    // Secondary fill light from the side
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    fillLight.position.set(-10, 10, -5)
    this.scene.add(fillLight)

    // Light from below for viewing the back side of the map
    const bottomLight = new THREE.DirectionalLight(0xffaa88, 0.8)
    bottomLight.position.set(5, -20, 15)
    this.scene.add(bottomLight)

    // Hemisphere light for natural ambient gradient
    const hemiLight = new THREE.HemisphereLight(0x444466, 0x442222, 0.5)
    this.scene.add(hemiLight)
  }

  private setupEventListeners(): void {
    // Window resize
    window.addEventListener('resize', () => this.onResize())

    // Game state changes
    gameState.on('screenChange', () => this.onScreenChange())
    gameState.on('levelSelect', () => this.onLevelSelect())

    // Keyboard input
    window.addEventListener('keydown', (e) => this.onKeyDown(e))
    window.addEventListener('keyup', (e) => this.onKeyUp(e))
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private onScreenChange(): void {
    const screen = gameState.getCurrentScreen()

    switch (screen) {
      case GameScreen.PLAYING:
        this.startLevel()
        break
      case GameScreen.MENU:
        this.stopLevel()
        break
      case GameScreen.PAUSED:
        this.pauseLevel()
        break
    }
  }

  private onLevelSelect(): void {
    const levelConfig = gameState.getSelectedLevel()
    if (levelConfig) {
      this.loadLevel(levelConfig)
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Toggle camera mode with Tab (works anytime)
    if (e.key === 'Tab') {
      e.preventDefault()
      this.useFollowCamera = !this.useFollowCamera
      this.controls.enabled = !this.useFollowCamera
      console.log(`Camera mode: ${this.useFollowCamera ? 'Follow' : 'Orbit'}`)
      return
    }

    if (gameState.getCurrentScreen() !== GameScreen.PLAYING) return

    const controller = this.level?.getSnakeController()

    switch (e.key) {
      case 'Escape':
        // Toggle pause
        if (gameState.getCurrentScreen() === GameScreen.PLAYING) {
          gameState.setScreen(GameScreen.PAUSED)
        }
        break
      case 'ArrowLeft':
      case 'a':
      case 'A':
        // Turn left
        controller?.turnLeft()
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        // Turn right
        controller?.turnRight()
        break
      case 'ArrowUp':
      case 'w':
      case 'W':
        // Boost (TODO: implement boost system)
        controller?.setSpeedMultiplier(2)
        break
      case 'ArrowDown':
      case 's':
      case 'S':
        // Slow (TODO: implement boost system)
        controller?.setSpeedMultiplier(0.5)
        break
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (gameState.getCurrentScreen() !== GameScreen.PLAYING) return

    const controller = this.level?.getSnakeController()

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
      case 'ArrowDown':
      case 's':
      case 'S':
        // Reset speed
        controller?.setSpeedMultiplier(1)
        break
    }
  }

  loadLevel(config: LevelConfig): void {
    // Clear previous level
    if (this.level) {
      this.scene.remove(this.level.getGrid().getMesh())
      this.scene.remove(this.level.getElementsGroup())
      this.level.dispose()
    }

    // Get level data from JSON
    const loader = LevelLoader.getInstance()
    const levelData = loader.getLevel(config.id)

    if (!levelData) {
      throw new Error(`Level data not found for "${config.id}". Make sure the level JSON file is loaded.`)
    }

    this.level = Level.fromLevelData(levelData)

    // Add grid and elements to scene
    this.scene.add(this.level.getGrid().getMesh())
    this.scene.add(this.level.getElementsGroup())

    // Position camera based on grid size
    this.setupCamera(config)

    // Setup HUD
    this.hud.setTimeLimit(config.timeLimit)
  }

  private setupCamera(config: LevelConfig): void {
    const gridWidth = config.gridSize.width
    const gridHeight = config.gridSize.height
    const maxDimension = Math.max(gridWidth, gridHeight)

    // Behind-view camera angle like original game
    // More dramatic angle - looking down at the grid
    const distance = maxDimension * 0.9
    const height = maxDimension * 0.7

    this.camera.position.set(0, height, distance)
    this.camera.lookAt(0, 0, -distance * 0.3) // Look slightly ahead
    this.camera.fov = 55 // Slightly narrower FOV
    this.camera.updateProjectionMatrix()
  }

  startLevel(): void {
    this.isRunning = true
    this.startTime = performance.now()
    this.elapsedTime = 0
    this.hud.show()

    // Start snake gameplay
    this.level?.startGameplay()

    // Enable follow camera and disable orbit controls
    this.useFollowCamera = true
    this.controls.enabled = false
    this.cameraInitialized = false
  }

  stopLevel(): void {
    this.isRunning = false
    this.hud.hide()

    // Re-enable orbit controls for menu
    this.useFollowCamera = false
    this.controls.enabled = true
  }

  pauseLevel(): void {
    this.isRunning = false
  }

  private update(deltaTime: number): void {
    // Always update game time for animations (even when paused for visual feedback)
    this.gameTime += deltaTime

    // Update level elements (animations)
    if (this.level) {
      this.level.update(this.gameTime, deltaTime)
    }

    if (!this.isRunning) return

    // Update elapsed time
    this.elapsedTime = (performance.now() - this.startTime) / 1000
    this.hud.updateTime(this.elapsedTime)

    // Check time limit
    const levelConfig = gameState.getSelectedLevel()
    if (levelConfig && this.elapsedTime >= levelConfig.timeLimit) {
      // Time's up!
      console.log("Time's up!")
      // TODO: Handle game over
    }

    // Update snake movement
    if (this.level) {
      this.level.updateSnake(deltaTime)

      // Update follow camera
      if (this.useFollowCamera) {
        this.updateFollowCamera(deltaTime)
      }
    }
  }

  /**
   * Update the follow camera to track the snake head
   */
  private updateFollowCamera(deltaTime: number): void {
    const controller = this.level?.getSnakeController()
    if (!controller) return

    // Get snake head position and direction
    const headPos = controller.getInterpolatedHeadPosition()
    const headDir = controller.getHeadWorldDirection()

    // Account for grid offset (elements group position)
    const gridOffset = this.level?.getElementsGroup().position || new THREE.Vector3()
    const worldHeadPos = headPos.clone().add(gridOffset)

    // Calculate target camera position (behind and above the snake)
    const isOnBackSide = controller.getIsOnBackSide()
    const heightMultiplier = isOnBackSide ? -1 : 1

    const targetCameraPos = new THREE.Vector3(
      worldHeadPos.x - headDir.x * this.cameraDistance,
      worldHeadPos.y + this.cameraHeight * heightMultiplier,
      worldHeadPos.z - headDir.z * this.cameraDistance
    )

    // Calculate target look-at position (ahead of the snake)
    const targetLookAt = new THREE.Vector3(
      worldHeadPos.x + headDir.x * this.cameraLookAhead,
      worldHeadPos.y,
      worldHeadPos.z + headDir.z * this.cameraLookAhead
    )

    // Initialize camera position on first frame
    if (!this.cameraInitialized) {
      this.smoothCameraPos.copy(targetCameraPos)
      this.smoothCameraTarget.copy(targetLookAt)
      this.cameraInitialized = true
    }

    // Smooth camera movement
    const smoothFactor = 1 - Math.exp(-this.cameraSmoothness * deltaTime)
    this.smoothCameraPos.lerp(targetCameraPos, smoothFactor)
    this.smoothCameraTarget.lerp(targetLookAt, smoothFactor)

    // Apply camera position
    this.camera.position.copy(this.smoothCameraPos)

    // Set camera up vector based on which side we're on
    // On back side, flip the up vector so the view appears right-side-up
    this.camera.up.set(0, heightMultiplier, 0)

    // Apply camera rotation
    this.camera.lookAt(this.smoothCameraTarget)
  }

  private lastTime = 0

  private animate = (): void => {
    requestAnimationFrame(this.animate)

    const currentTime = performance.now()
    const deltaTime = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime

    // Update orbit controls
    this.controls.update()

    this.update(deltaTime)
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.level?.dispose()
    this.hud.dispose()
    this.controls.dispose()
    this.renderer.dispose()
  }
}
