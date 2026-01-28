import { gameState, GameScreen, LEVELS, LevelConfig } from '../core/GameState'

export class Menu {
  private container: HTMLElement
  private menuElement: HTMLElement | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.createMenuElement()
  }

  private createMenuElement(): void {
    this.menuElement = document.createElement('div')
    this.menuElement.id = 'main-menu'
    this.menuElement.innerHTML = `
      <div class="menu-content">
        <h1 class="game-title">SNAKE REDUX</h1>

        <div class="level-select">
          <h2>Select Level</h2>
          <div class="level-buttons">
            ${LEVELS.map(
              (level) => `
              <button class="level-btn" data-level-id="${level.id}">
                <span class="level-name">${level.name}</span>
                <span class="level-info">${level.gridSize.width}x${level.gridSize.height} • ${level.timeLimit}s</span>
              </button>
            `
            ).join('')}
          </div>
        </div>

        <div class="controls-info">
          <h3>Controls</h3>
          <p>← → Arrow Keys to turn</p>
          <p>↑ Boost • ↓ Slow</p>
          <p>ESC to pause</p>
        </div>
      </div>
    `

    this.applyStyles()
    this.container.appendChild(this.menuElement)
    this.bindEvents()
  }

  private applyStyles(): void {
    const style = document.createElement('style')
    style.textContent = `
      #main-menu {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background: radial-gradient(ellipse at center, #001122 0%, #000000 100%);
        z-index: 1000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      #main-menu.hidden {
        display: none;
      }

      .menu-content {
        text-align: center;
        color: #fff;
      }

      .game-title {
        font-size: 72px;
        font-weight: bold;
        color: #00ffff;
        text-shadow:
          0 0 10px #00ffff,
          0 0 20px #00ffff,
          0 0 40px #00aaaa,
          0 0 80px #008888;
        margin: 0;
        letter-spacing: 20px;
        animation: glow 2s ease-in-out infinite alternate;
      }

      @keyframes glow {
        from {
          text-shadow:
            0 0 10px #00ffff,
            0 0 20px #00ffff,
            0 0 40px #00aaaa,
            0 0 80px #008888;
        }
        to {
          text-shadow:
            0 0 20px #00ffff,
            0 0 30px #00ffff,
            0 0 60px #00aaaa,
            0 0 100px #008888;
        }
      }

      .subtitle {
        font-size: 16px;
        color: #00aaaa;
        margin: 10px 0 40px 0;
        letter-spacing: 3px;
      }

      .level-select h2 {
        font-size: 24px;
        color: #ffffff;
        margin-bottom: 20px;
        text-transform: uppercase;
        letter-spacing: 5px;
      }

      .level-buttons {
        display: flex;
        gap: 20px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .level-btn {
        background: transparent;
        border: 2px solid #00ffff;
        color: #00ffff;
        padding: 20px 40px;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        min-width: 200px;
      }

      .level-btn:hover {
        background: rgba(0, 255, 255, 0.1);
        box-shadow:
          0 0 20px rgba(0, 255, 255, 0.5),
          inset 0 0 20px rgba(0, 255, 255, 0.1);
        transform: scale(1.05);
      }

      .level-btn:active {
        transform: scale(0.98);
      }

      .level-name {
        font-weight: bold;
        font-size: 20px;
      }

      .level-info {
        font-size: 14px;
        color: #00aaaa;
      }

      .controls-info {
        margin-top: 50px;
        color: #666;
      }

      .controls-info h3 {
        color: #888;
        margin-bottom: 10px;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 3px;
      }

      .controls-info p {
        margin: 5px 0;
        font-size: 14px;
      }
    `
    document.head.appendChild(style)
  }

  private bindEvents(): void {
    if (!this.menuElement) return

    const levelButtons = this.menuElement.querySelectorAll('.level-btn')
    levelButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement
        const levelId = target.dataset.levelId
        const level = LEVELS.find((l) => l.id === levelId)
        if (level) {
          this.selectLevel(level)
        }
      })
    })
  }

  private selectLevel(level: LevelConfig): void {
    gameState.selectLevel(level)
    gameState.reset()
    gameState.setScreen(GameScreen.PLAYING)
    this.hide()
  }

  show(): void {
    this.menuElement?.classList.remove('hidden')
  }

  hide(): void {
    this.menuElement?.classList.add('hidden')
  }

  dispose(): void {
    this.menuElement?.remove()
  }
}
