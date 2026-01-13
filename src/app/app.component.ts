import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

type Direction = { x: number; y: number };
type Position = { x: number; y: number };
type SnakeSegment = Position & { color: string };
type Food = Position & { color: string };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('boardShell') boardShell?: ElementRef<HTMLDivElement>;
  gridSize = 20;
  gridCells: number[] = [];

  snake: SnakeSegment[] = [];
  snakeSet = new Set<string>();
  snakeColors = new Map<string, string>();
  foods: Food[] = [];
  foodSet = new Set<string>();
  foodColors = new Map<string, string>();

  direction: Direction = { x: 1, y: 0 };
  requestedDirection: Direction = { x: 1, y: 0 };

  score = 0;
  running = false;
  gameOver = false;
  speedMs = 140;
  private readonly minSpeedMs = 60;
  private readonly speedStepMs = 5;
  private readonly maxFoods = 3;
  private readonly initialSnakeColor = '#41ffd9';
  private readonly foodPalette = [
    '#ff4d6d',
    '#f9c74f',
    '#4cc9f0',
    '#f8961e',
    '#b5179e',
    '#43aa8b'
  ];

  private timerId: number | undefined;

  ngOnInit(): void {
    this.gridCells = Array.from({ length: this.gridSize * this.gridSize }, (_, i) => i);
    this.resetGame();
  }

  ngOnDestroy(): void {
    this.stopLoop();
  }

  startGame(): void {
    if (this.running) {
      return;
    }

    if (this.gameOver) {
      this.resetGame();
    }

    this.running = true;
    this.startLoop();
    this.scrollBoardIntoView();
  }

  pauseGame(): void {
    this.running = false;
    this.stopLoop();
  }

  toggleGame(): void {
    if (this.running) {
      this.pauseGame();
      return;
    }

    this.startGame();
  }

  resetGame(): void {
    this.stopLoop();

    const mid = Math.floor(this.gridSize / 2);
    this.snake = [
      { x: mid, y: mid, color: this.initialSnakeColor },
      { x: mid - 1, y: mid, color: this.initialSnakeColor },
      { x: mid - 2, y: mid, color: this.initialSnakeColor }
    ];
    this.snakeSet = new Set(this.snake.map((segment) => this.posKey(segment)));
    this.snakeColors = new Map(
      this.snake.map((segment) => [this.posKey(segment), segment.color])
    );
    this.direction = { x: 1, y: 0 };
    this.requestedDirection = { x: 1, y: 0 };
    this.score = 0;
    this.speedMs = 140;
    this.gameOver = false;
    this.placeFoods();
    this.running = false;
  }

  @HostListener('window:keydown', ['$event'])
  handleKey(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (key === ' ' || key === 'enter') {
      event.preventDefault();
      this.toggleGame();
      return;
    }

    const next = this.keyToDirection(key);
    if (!next) {
      return;
    }

    event.preventDefault();

    if (this.snake.length > 1 && this.isOpposite(next, this.direction)) {
      return;
    }

    this.requestedDirection = next;
  }

  isSnake(index: number): boolean {
    return this.snakeSet.has(this.posKey(this.indexToPos(index)));
  }

  isHead(index: number): boolean {
    const head = this.snake[0];
    if (!head) {
      return false;
    }

    const pos = this.indexToPos(index);
    return head.x === pos.x && head.y === pos.y;
  }

  isTail(index: number): boolean {
    const tail = this.snake[this.snake.length - 1];
    if (!tail) {
      return false;
    }

    const pos = this.indexToPos(index);
    return tail.x === pos.x && tail.y === pos.y;
  }

  isFood(index: number): boolean {
    const pos = this.indexToPos(index);
    return this.foodSet.has(this.posKey(pos));
  }

  getSnakeColor(index: number): string | null {
    const pos = this.indexToPos(index);
    return this.snakeColors.get(this.posKey(pos)) ?? null;
  }

  getFoodColor(index: number): string | null {
    const pos = this.indexToPos(index);
    return this.foodColors.get(this.posKey(pos)) ?? null;
  }

  private tick(): void {
    if (!this.running) {
      return;
    }

    const head = this.snake[0];
    const nextDirection = this.requestedDirection;
    const nextHead = this.wrapPosition({
      x: head.x + nextDirection.x,
      y: head.y + nextDirection.y
    });

    const nextKey = this.posKey(nextHead);
    const tail = this.snake[this.snake.length - 1];
    const tailKey = tail ? this.posKey(tail) : '';
    const foodIndex = this.foodIndexAt(nextHead);
    const willGrow = foodIndex >= 0;

    if (this.snakeSet.has(nextKey) && !(nextKey === tailKey && !willGrow)) {
      this.endGame();
      return;
    }

    const nextColor = willGrow
      ? this.foods[foodIndex]?.color ?? head.color
      : head.color;
    const nextSegment: SnakeSegment = { ...nextHead, color: nextColor };

    this.snake.unshift(nextSegment);
    this.snakeSet.add(nextKey);
    this.snakeColors.set(nextKey, nextSegment.color);

    if (willGrow) {
      this.score += 1;
      this.increaseSpeed();
      this.consumeFoodAt(foodIndex);
      if (this.foods.length === 0) {
        this.placeFoods();
      } else {
        this.maybeSpawnBonusFood();
      }
    } else {
      const removed = this.snake.pop();
      if (removed) {
        const removedKey = this.posKey(removed);
        if (removedKey !== nextKey) {
          this.snakeSet.delete(removedKey);
          this.snakeColors.delete(removedKey);
        }
      }
    }

    this.direction = nextDirection;
  }

  private startLoop(): void {
    this.stopLoop();
    this.timerId = window.setInterval(() => this.tick(), this.speedMs);
  }

  private stopLoop(): void {
    if (this.timerId === undefined) {
      return;
    }

    window.clearInterval(this.timerId);
    this.timerId = undefined;
  }

  private endGame(): void {
    this.gameOver = true;
    this.running = false;
    this.stopLoop();
  }

  private increaseSpeed(): void {
    const nextSpeed = Math.max(this.minSpeedMs, this.speedMs - this.speedStepMs);
    if (nextSpeed === this.speedMs) {
      return;
    }

    this.speedMs = nextSpeed;
    if (this.running) {
      this.startLoop();
    }
  }

  private scrollBoardIntoView(): void {
    if (!this.boardShell) {
      return;
    }

    window.setTimeout(() => {
      this.boardShell?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 0);
  }

  private placeFoods(): void {
    this.foods = [];
    this.foodSet.clear();
    this.foodColors.clear();

    let count = 1;
    if (Math.random() < 0.35) {
      count += 1;
    }
    if (Math.random() < 0.15) {
      count += 1;
    }

    const foodCount = Math.min(count, this.maxFoods);
    for (let i = 0; i < foodCount; i += 1) {
      this.addFood();
    }
  }

  private maybeSpawnBonusFood(): void {
    if (this.foods.length >= this.maxFoods) {
      return;
    }

    if (Math.random() < 0.25) {
      this.addFood();
    }
  }

  private addFood(): void {
    let idx = 0;
    let next: Position = { x: 0, y: 0 };
    let nextKey = '';

    do {
      idx = Math.floor(Math.random() * this.gridSize * this.gridSize);
      next = { x: idx % this.gridSize, y: Math.floor(idx / this.gridSize) };
      nextKey = this.posKey(next);
    } while (this.snakeSet.has(nextKey) || this.foodSet.has(nextKey));

    const color = this.randomFoodColor();
    const food: Food = { ...next, color };
    this.foods.push(food);
    this.foodSet.add(nextKey);
    this.foodColors.set(nextKey, color);
  }

  private randomFoodColor(): string {
    const index = Math.floor(Math.random() * this.foodPalette.length);
    return this.foodPalette[index] ?? this.initialSnakeColor;
  }

  private consumeFoodAt(index: number): void {
    const food = this.foods[index];
    if (!food) {
      return;
    }

    this.foods.splice(index, 1);
    const foodKey = this.posKey(food);
    this.foodSet.delete(foodKey);
    this.foodColors.delete(foodKey);
  }

  private foodIndexAt(pos: Position): number {
    return this.foods.findIndex((food) => this.samePosition(food, pos));
  }

  private indexToPos(index: number): Position {
    return { x: index % this.gridSize, y: Math.floor(index / this.gridSize) };
  }

  private posKey(pos: Position): string {
    return `${pos.x},${pos.y}`;
  }

  private keyToDirection(key: string): Direction | null {
    switch (key) {
      case 'arrowup':
      case 'w':
        return { x: 0, y: -1 };
      case 'arrowdown':
      case 's':
        return { x: 0, y: 1 };
      case 'arrowleft':
      case 'a':
        return { x: -1, y: 0 };
      case 'arrowright':
      case 'd':
        return { x: 1, y: 0 };
      default:
        return null;
    }
  }

  private isOpposite(a: Direction, b: Direction): boolean {
    return a.x === -b.x && a.y === -b.y;
  }

  private wrapPosition(pos: Position): Position {
    const x = (pos.x + this.gridSize) % this.gridSize;
    const y = (pos.y + this.gridSize) % this.gridSize;
    return { x, y };
  }

  private samePosition(a: Position, b: Position): boolean {
    return a.x === b.x && a.y === b.y;
  }
}
