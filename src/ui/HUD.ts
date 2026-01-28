import { gameState } from '../core/GameState'

export class HUD {
  private container: HTMLElement
  private hudElement: HTMLElement | null = null
  private scoreElement: HTMLElement | null = null
  private livesElement: HTMLElement | null = null
  private timeElement: HTMLElement | null = null
  private multiplierElement: HTMLElement | null = null

  private timeRemaining: number = 0
  private timeLimit: number = 0
  private multiplier: number = 1

  constructor(container: HTMLElement) {
    this.container = container
    this.createHUDElement()
    this.bindGameState()
  }

  private createHUDElement(): void {
    this.hudElement = document.createElement('div')
    this.hudElement.id = 'game-hud'
    this.hudElement.innerHTML = `
      <div class="hud-top">
        <div class="hud-left">
          <span class="lives-label">LIVES</span>
          <span class="lives-value" id="hud-lives">x3</span>
        </div>
        <div class="hud-center">
          <span class="score-value" id="hud-score">000000</span>
          <span class="multiplier" id="hud-multiplier">x1</span>
        </div>
        <div class="hud-right">
          <button class="pause-btn" id="pause-btn">PAUSE</button>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="time-display">
          <span class="time-current" id="hud-time">00:00</span>
          <span class="time-limit" id="hud-time-limit">/ 01:00</span>
        </div>
      </div>
    `

    this.applyStyles()
    this.container.appendChild(this.hudElement)

    // Get references to elements
    this.scoreElement = document.getElementById('hud-score')
    this.livesElement = document.getElementById('hud-lives')
    this.timeElement = document.getElementById('hud-time')
    this.multiplierElement = document.getElementById('hud-multiplier')

    this.bindEvents()
  }

  private applyStyles(): void {
    const style = document.createElement('style')
    style.textContent = `
      #game-hud {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        z-index: 100;
      }

      #game-hud.hidden {
        display: none;
      }

      .hud-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 20px 30px;
      }

      .hud-left, .hud-right {
        min-width: 120px;
      }

      .hud-center {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .lives-label {
        color: #888;
        font-size: 12px;
        margin-right: 8px;
      }

      .lives-value {
        color: #00ffff;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 0 0 10px #00ffff;
      }

      .score-value {
        color: #ffffff;
        font-size: 48px;
        font-weight: bold;
        text-shadow:
          0 0 10px rgba(255, 255, 255, 0.5),
          0 0 20px rgba(0, 255, 255, 0.3);
        letter-spacing: 3px;
      }

      .multiplier {
        color: #ffff00;
        font-size: 28px;
        font-weight: bold;
        text-shadow: 0 0 10px #ffff00;
      }

      .pause-btn {
        pointer-events: auto;
        background: transparent;
        border: 1px solid #00ffff;
        color: #00ffff;
        padding: 8px 16px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        text-transform: uppercase;
        letter-spacing: 2px;
      }

      .pause-btn:hover {
        background: rgba(0, 255, 255, 0.2);
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      }

      .hud-bottom {
        position: absolute;
        bottom: 20px;
        right: 30px;
      }

      .time-display {
        text-align: right;
      }

      .time-current {
        color: #00ffff;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 0 0 10px #00ffff;
      }

      .time-limit {
        color: #666;
        font-size: 16px;
        margin-left: 5px;
      }
    `
    document.head.appendChild(style)
  }

  private bindEvents(): void {
    const pauseBtn = document.getElementById('pause-btn')
    pauseBtn?.addEventListener('click', () => {
      // TODO: Implement pause functionality
      console.log('Pause clicked')
    })
  }

  private bindGameState(): void {
    gameState.on('scoreChange', () => this.updateScore())
    gameState.on('livesChange', () => this.updateLives())
  }

  private updateScore(): void {
    if (this.scoreElement) {
      const score = gameState.getScore()
      this.scoreElement.textContent = score.toString().padStart(6, '0')
    }
  }

  private updateLives(): void {
    if (this.livesElement) {
      this.livesElement.textContent = `x${gameState.getLives()}`
    }
  }

  updateTime(elapsed: number): void {
    if (this.timeElement) {
      const remaining = Math.max(0, this.timeLimit - elapsed)
      this.timeRemaining = remaining

      const minutes = Math.floor(remaining / 60)
      const seconds = Math.floor(remaining % 60)
      this.timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

      // Change color when time is running low
      if (remaining < 10) {
        this.timeElement.style.color = '#ff4444'
        this.timeElement.style.textShadow = '0 0 10px #ff4444'
      } else {
        this.timeElement.style.color = '#00ffff'
        this.timeElement.style.textShadow = '0 0 10px #00ffff'
      }
    }
  }

  setTimeLimit(limit: number): void {
    this.timeLimit = limit
    const timeLimitEl = document.getElementById('hud-time-limit')
    if (timeLimitEl) {
      const minutes = Math.floor(limit / 60)
      const seconds = Math.floor(limit % 60)
      timeLimitEl.textContent = `/ ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
  }

  setMultiplier(multiplier: number): void {
    this.multiplier = multiplier
    if (this.multiplierElement) {
      this.multiplierElement.textContent = `x${multiplier}`
    }
  }

  show(): void {
    this.hudElement?.classList.remove('hidden')
  }

  hide(): void {
    this.hudElement?.classList.add('hidden')
  }

  dispose(): void {
    this.hudElement?.remove()
  }
}
