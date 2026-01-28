import { Game } from './game/Game'
import { Menu } from './ui/Menu'
import { LevelLoader } from './core/LevelLoader'

// Level JSON file paths
const LEVEL_PATHS = [
  '/levels/level-1-square.json',
  '/levels/level-2-hex.json',
  '/levels/test-square.json',
  '/levels/test-hex.json',
]

async function initGame() {
  // Load levels from JSON files
  const loader = LevelLoader.getInstance()
  await loader.loadLevels(LEVEL_PATHS)

  if (loader.getLevelCount() === 0) {
    throw new Error('No levels loaded. Please check the level JSON files.')
  }

  console.log(`Loaded ${loader.getLevelCount()} levels from JSON`)

  // Get container
  const container = document.getElementById('game-container')!

  // Initialize game
  new Game(container)

  // Initialize menu
  new Menu(container)

  console.log('Snakes game initialized!')
}

// Start initialization
initGame().catch((error) => {
  console.error('Failed to initialize game:', error)
  // Show error to user
  const container = document.getElementById('game-container')
  if (container) {
    container.innerHTML = `
      <div style="color: red; padding: 20px; font-family: monospace;">
        <h2>Failed to load game</h2>
        <p>${error.message}</p>
      </div>
    `
  }
})
