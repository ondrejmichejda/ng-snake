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
type NpcSnake = {
  id: string;
  segments: SnakeSegment[];
  direction: Direction;
  color: string;
};

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
  npcSnakes: NpcSnake[] = [];
  npcSet = new Set<string>();
  npcColors = new Map<string, string>();
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
  private readonly maxFoods = 5;
  private readonly npcCount = 2;
  private readonly initialSnakeColor = '#33ffd1';
  private readonly foodPalette = [
    '#ff4d6d',
    '#f9c74f',
    '#f8961e',
    '#b5179e',
    '#ff8fab',
    '#4cc9f0'
  ];

  private timerId: number | undefined;

  ngOnInit(): void {
    this.gridCells = Array.from({ length: this.gridSize * this.gridSize }, (_, i) => i);
    this.resetGame();
  }

  ngOnDestroy(): void {
    this.stopLoop();
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
    this.npcSet = new Set<string>();
    this.npcColors = new Map<string, string>();
    this.npcSnakes = this.createNpcSnakes();
    this.rebuildNpcSets();
    this.direction = { x: 1, y: 0 };
    this.requestedDirection = { x: 1, y: 0 };
    this.score = 0;
    this.speedMs = 140;
    this.gameOver = false;
    this.placeFoods();
    this.running = true;
    this.startLoop();
    this.scrollBoardIntoView();
  }

  @HostListener('window:keydown', ['$event'])
  handleKey(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

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

  isNpc(index: number): boolean {
    const pos = this.indexToPos(index);
    return this.npcSet.has(this.posKey(pos));
  }

  getNpcColor(index: number): string | null {
    const pos = this.indexToPos(index);
    return this.npcColors.get(this.posKey(pos)) ?? null;
  }

  getFoodColor(index: number): string | null {
    const pos = this.indexToPos(index);
    return this.foodColors.get(this.posKey(pos)) ?? null;
  }

  private tick(): void {
    if (!this.running) {
      return;
    }

    this.moveNpcSnakes();
    if (this.gameOver) {
      return;
    }

    const head = this.snake[0];
    const nextDirection = this.requestedDirection;
    const nextHead = {
      x: head.x + nextDirection.x,
      y: head.y + nextDirection.y
    };

    if (this.isOutOfBounds(nextHead)) {
      this.endGame();
      return;
    }

    const nextKey = this.posKey(nextHead);
    const tail = this.snake[this.snake.length - 1];
    const tailKey = tail ? this.posKey(tail) : '';
    const foodIndex = this.foodIndexAt(nextHead);
    const willGrow = foodIndex >= 0;

    if (this.npcSet.has(nextKey)) {
      this.endGame();
      return;
    }

    if (this.snakeSet.has(nextKey) && !(nextKey === tailKey && !willGrow)) {
      this.endGame();
      return;
    }

    const nextColor = head.color;
    const nextSegment: SnakeSegment = { ...nextHead, color: nextColor };

    this.snake.unshift(nextSegment);
    this.snakeSet.add(nextKey);
    this.snakeColors.set(nextKey, nextSegment.color);

    if (willGrow) {
      const eatenColor = this.foods[foodIndex]?.color ?? head.color;
      this.score += 1;
      this.increaseSpeed();
      this.consumeFoodAt(foodIndex);
      if (this.foods.length === 0) {
        this.placeFoods();
      } else {
        this.maybeSpawnBonusFood();
      }
      const removed = this.snake.pop();
      if (removed) {
        const removedKey = this.posKey(removed);
        this.snakeSet.delete(removedKey);
        this.snakeColors.delete(removedKey);
      }

      if (tail) {
        const tailSegment: SnakeSegment = { x: tail.x, y: tail.y, color: eatenColor };
        const tailSegmentKey = this.posKey(tailSegment);
        this.snake.push(tailSegment);
        this.snakeSet.add(tailSegmentKey);
        this.snakeColors.set(tailSegmentKey, eatenColor);
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

  private moveNpcSnakes(): void {
    if (this.npcSnakes.length === 0) {
      return;
    }

    const occupied = new Set([...this.snakeSet, ...this.npcSet]);
    const updatedSnakes: NpcSnake[] = [];

    for (const npc of this.npcSnakes) {
      for (const segment of npc.segments) {
        occupied.delete(this.posKey(segment));
      }

      const direction = this.chooseNpcDirection(npc, occupied);
      if (direction.x === 0 && direction.y === 0) {
        for (const segment of npc.segments) {
          occupied.add(this.posKey(segment));
        }
        updatedSnakes.push(npc);
        continue;
      }

      const head = npc.segments[0];
      const nextHead = {
        x: head.x + direction.x,
        y: head.y + direction.y
      };
      if (this.isOutOfBounds(nextHead)) {
        for (const segment of npc.segments) {
          occupied.add(this.posKey(segment));
        }
        updatedSnakes.push(npc);
        continue;
      }
      const nextKey = this.posKey(nextHead);
      const foodIndex = this.foodIndexAt(nextHead);
      const willGrow = foodIndex >= 0;

      if (!this.isNpcMoveSafe(npc, nextKey, willGrow, occupied)) {
        for (const segment of npc.segments) {
          occupied.add(this.posKey(segment));
        }
        updatedSnakes.push(npc);
        continue;
      }

      if (this.snakeSet.has(nextKey)) {
        this.endGame();
        return;
      }

      const nextSegment: SnakeSegment = { ...nextHead, color: head.color };
      const nextSegments = [nextSegment, ...npc.segments];

      if (willGrow) {
        this.consumeFoodAt(foodIndex);
        if (this.foods.length === 0) {
          this.placeFoods(occupied);
        } else {
          this.maybeSpawnBonusFood(occupied);
        }

        nextSegments.pop();
        const tail = npc.segments[npc.segments.length - 1];
        if (tail) {
          nextSegments.push({ x: tail.x, y: tail.y, color: npc.color });
        }
      } else {
        nextSegments.pop();
      }

      for (const segment of nextSegments) {
        occupied.add(this.posKey(segment));
      }

      updatedSnakes.push({
        ...npc,
        direction,
        segments: nextSegments
      });
    }

    this.npcSnakes = updatedSnakes;
    this.rebuildNpcSets();
  }

  private chooseNpcDirection(npc: NpcSnake, occupied: Set<string>): Direction {
    const head = npc.segments[0];
    const target = this.closestFood(head);
    const candidates = this.shuffledDirections();

    const scored = candidates
      .map((direction) => {
        const next = {
          x: head.x + direction.x,
          y: head.y + direction.y
        };
        const score = target ? this.manhattanDistance(next, target) : 0;
        return { direction, score };
      })
      .sort((a, b) => a.score - b.score);

    const preferred = scored.filter((item) => !this.isOpposite(item.direction, npc.direction));
    const chosen =
      this.pickNpcDirection(preferred, npc, occupied) ??
      this.pickNpcDirection(scored, npc, occupied);

    return chosen ?? { x: 0, y: 0 };
  }

  private pickNpcDirection(
    candidates: Array<{ direction: Direction; score: number }>,
    npc: NpcSnake,
    occupied: Set<string>
  ): Direction | null {
    for (const candidate of candidates) {
      const next = {
        x: npc.segments[0].x + candidate.direction.x,
        y: npc.segments[0].y + candidate.direction.y
      };
      if (this.isOutOfBounds(next)) {
        continue;
      }
      const nextKey = this.posKey(next);
      const willGrow = this.foodIndexAt(next) >= 0;

      if (this.isNpcMoveSafe(npc, nextKey, willGrow, occupied)) {
        return candidate.direction;
      }
    }

    return null;
  }

  private isNpcMoveSafe(
    npc: NpcSnake,
    nextKey: string,
    willGrow: boolean,
    occupied: Set<string>
  ): boolean {
    if (occupied.has(nextKey)) {
      return false;
    }

    const tail = npc.segments[npc.segments.length - 1];
    const tailKey = tail ? this.posKey(tail) : '';

    for (const segment of npc.segments) {
      const segmentKey = this.posKey(segment);
      if (segmentKey === nextKey) {
        return nextKey === tailKey && !willGrow;
      }
    }

    return true;
  }

  private shuffledDirections(): Direction[] {
    const directions: Direction[] = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 }
    ];

    for (let i = directions.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = directions[i];
      directions[i] = directions[j] ?? directions[i];
      directions[j] = temp ?? directions[j];
    }

    return directions;
  }

  private manhattanDistance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private closestFood(pos: Position): Position | null {
    if (this.foods.length === 0) {
      return null;
    }

    let nearest = this.foods[0];
    let bestDistance = this.manhattanDistance(pos, nearest);

    for (const food of this.foods) {
      const distance = this.manhattanDistance(pos, food);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = food;
      }
    }

    return nearest;
  }

  private createNpcSnakes(): NpcSnake[] {
    const snakes: NpcSnake[] = [];
    const palette = ['#ff8fab', '#ffd166', '#06d6a0', '#8ecae6'];

    for (let i = 0; i < this.npcCount; i += 1) {
      const npc = this.spawnNpcSnake(`npc-${i + 1}`, palette[i % palette.length] ?? '#ffd166');
      if (npc) {
        snakes.push(npc);
      }
    }

    return snakes;
  }

  private spawnNpcSnake(id: string, color: string): NpcSnake | null {
    const maxAttempts = 60;
    const length = 3;
    const directions = this.shuffledDirections();

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const direction = directions[attempt % directions.length] ?? { x: 1, y: 0 };
      const head: Position = {
        x: Math.floor(Math.random() * this.gridSize),
        y: Math.floor(Math.random() * this.gridSize)
      };

      const segments: SnakeSegment[] = [];
      let blocked = false;

      for (let i = 0; i < length; i += 1) {
        const segmentPos = {
          x: head.x - direction.x * i,
          y: head.y - direction.y * i
        };
        if (this.isOutOfBounds(segmentPos)) {
          blocked = true;
          break;
        }
        const key = this.posKey(segmentPos);

        if (this.snakeSet.has(key) || this.npcSet.has(key)) {
          blocked = true;
          break;
        }

        segments.push({ ...segmentPos, color });
      }

      if (!blocked) {
        return { id, segments, direction, color };
      }
    }

    return null;
  }

  private rebuildNpcSets(): void {
    this.npcSet = new Set<string>();
    this.npcColors = new Map<string, string>();

    for (const npc of this.npcSnakes) {
      for (const segment of npc.segments) {
        const key = this.posKey(segment);
        this.npcSet.add(key);
        this.npcColors.set(key, segment.color);
      }
    }
  }

  private currentOccupiedKeys(): Set<string> {
    return new Set([...this.snakeSet, ...this.npcSet]);
  }

  private placeFoods(blockedKeys?: Set<string>): void {
    this.foods = [];
    this.foodSet.clear();
    this.foodColors.clear();

    const blocked = blockedKeys ?? this.currentOccupiedKeys();
    let count = 2;
    if (Math.random() < 0.5) {
      count += 1;
    }
    if (Math.random() < 0.25) {
      count += 1;
    }
    if (Math.random() < 0.1) {
      count += 1;
    }

    const foodCount = Math.min(count, this.maxFoods);
    for (let i = 0; i < foodCount; i += 1) {
      this.addFood(blocked);
    }
  }

  private maybeSpawnBonusFood(blockedKeys?: Set<string>): void {
    if (this.foods.length >= this.maxFoods) {
      return;
    }

    if (Math.random() < 0.45) {
      this.addFood(blockedKeys ?? this.currentOccupiedKeys());
    }
  }

  private addFood(blockedKeys?: Set<string>): void {
    const blocked = blockedKeys ?? this.currentOccupiedKeys();
    let idx = 0;
    let next: Position = { x: 0, y: 0 };
    let nextKey = '';

    do {
      idx = Math.floor(Math.random() * this.gridSize * this.gridSize);
      next = { x: idx % this.gridSize, y: Math.floor(idx / this.gridSize) };
      nextKey = this.posKey(next);
    } while (
      blocked.has(nextKey) ||
      this.foodSet.has(nextKey)
    );

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

  private samePosition(a: Position, b: Position): boolean {
    return a.x === b.x && a.y === b.y;
  }

  private isOutOfBounds(pos: Position): boolean {
    return (
      pos.x < 0 ||
      pos.y < 0 ||
      pos.x >= this.gridSize ||
      pos.y >= this.gridSize
    );
  }
}
