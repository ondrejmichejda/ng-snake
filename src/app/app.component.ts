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

  snake: Position[] = [];
  snakeSet = new Set<string>();
  food: Position = { x: 0, y: 0 };

  direction: Direction = { x: 1, y: 0 };
  requestedDirection: Direction = { x: 1, y: 0 };

  score = 0;
  running = false;
  gameOver = false;
  speedMs = 140;

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
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid }
    ];
    this.snakeSet = new Set(this.snake.map((segment) => this.posKey(segment)));
    this.direction = { x: 1, y: 0 };
    this.requestedDirection = { x: 1, y: 0 };
    this.score = 0;
    this.gameOver = false;
    this.placeFood();
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

  isFood(index: number): boolean {
    const pos = this.indexToPos(index);
    return this.food.x === pos.x && this.food.y === pos.y;
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
    const willGrow = this.samePosition(nextHead, this.food);

    if (this.snakeSet.has(nextKey) && !(nextKey === tailKey && !willGrow)) {
      this.endGame();
      return;
    }

    this.snake.unshift(nextHead);
    this.snakeSet.add(nextKey);

    if (willGrow) {
      this.score += 1;
      this.placeFood();
    } else {
      const removed = this.snake.pop();
      if (removed) {
        this.snakeSet.delete(this.posKey(removed));
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

  private placeFood(): void {
    let idx = 0;
    let next: Position = { x: 0, y: 0 };

    do {
      idx = Math.floor(Math.random() * this.gridSize * this.gridSize);
      next = { x: idx % this.gridSize, y: Math.floor(idx / this.gridSize) };
    } while (this.snakeSet.has(this.posKey(next)));

    this.food = next;
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
