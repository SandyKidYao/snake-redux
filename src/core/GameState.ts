import { LevelLoader } from './LevelLoader'

export enum GameScreen {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over',
}

export enum GridType {
  SQUARE = 'square',
  HEXAGONAL = 'hexagonal',
}

export interface LevelConfig {
  id: string
  name: string
  gridType: GridType
  gridSize: { width: number; height: number }
  timeLimit: number // seconds
}

/**
 * Get levels from LevelLoader
 */
export function getLevels(): LevelConfig[] {
  return LevelLoader.getInstance().getLevelConfigs()
}

// For backward compatibility - dynamically returns levels from LevelLoader
export const LEVELS: LevelConfig[] = new Proxy([] as LevelConfig[], {
  get(_target, prop) {
    const levels = LevelLoader.getInstance().getLevelConfigs()
    const value = (levels as unknown as Record<string | symbol, unknown>)[prop]
    // Bind array methods to the actual levels array
    if (typeof value === 'function') {
      return (value as Function).bind(levels)
    }
    return value
  },
})

class GameState {
  private currentScreen: GameScreen = GameScreen.MENU
  private selectedLevel: LevelConfig | null = null
  private score: number = 0
  private lives: number = 3
  private listeners: Map<string, Set<() => void>> = new Map()

  getCurrentScreen(): GameScreen {
    return this.currentScreen
  }

  setScreen(screen: GameScreen): void {
    this.currentScreen = screen
    this.emit('screenChange')
  }

  getSelectedLevel(): LevelConfig | null {
    return this.selectedLevel
  }

  selectLevel(level: LevelConfig): void {
    this.selectedLevel = level
    this.emit('levelSelect')
  }

  getScore(): number {
    return this.score
  }

  addScore(points: number): void {
    this.score += points
    this.emit('scoreChange')
  }

  resetScore(): void {
    this.score = 0
    this.emit('scoreChange')
  }

  getLives(): number {
    return this.lives
  }

  loseLife(): boolean {
    this.lives--
    this.emit('livesChange')
    return this.lives > 0
  }

  resetLives(): void {
    this.lives = 3
    this.emit('livesChange')
  }

  // Event system
  on(event: string, callback: () => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: () => void): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string): void {
    this.listeners.get(event)?.forEach((callback) => callback())
  }

  // Reset for new game
  reset(): void {
    this.score = 0
    this.lives = 3
    this.emit('scoreChange')
    this.emit('livesChange')
  }
}

export const gameState = new GameState()
