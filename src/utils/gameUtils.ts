/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CHUNK_SIZE, TILE_SIZE, CHUNK_PIXELS, INITIAL_WORLD_SEED, PLAYER_SIZE, MAX_PARTICLES } from '../constants';
import { TileType, Chunk, Particle } from '../types';

export const getNoise = (x: number, y: number, s: number, scale: number = 0.005) => {
  const hash = (px: number, py: number) => {
    let h = Math.imul(px, 374761393) ^ Math.imul(py, 668265263) ^ Math.imul(s, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = (h ^ (h >>> 16));
    return (h >>> 0) / 4294967296;
  };

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const noise = (px: number, py: number) => {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const fx = px - ix;
    const fy = py - iy;
    const u = fade(fx);
    const v = fade(fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };

  const qx = noise(x * scale * 0.4 + 1.2, y * scale * 0.4 + 0.8) * 15;
  const qy = noise(x * scale * 0.4 + 5.2, y * scale * 0.4 + 1.3) * 15;
  const rx = noise((x + qx) * scale * 0.3 + 2.4, (y + qy) * scale * 0.3 + 1.7) * 10;
  const ry = noise((x + qx) * scale * 0.3 + 9.1, (y + qy) * scale * 0.3 + 2.8) * 10;
  const nx = (x + rx) * scale;
  const ny = (y + ry) * scale;

  let val = 0;
  let amp = 1;
  let freq = 1;
  let totalAmp = 0;
  for (let i = 0; i < 5; i++) {
    val += noise(nx * freq, ny * freq) * amp;
    totalAmp += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / totalAmp;
};

export const generateDungeonMaze = (seed: number): boolean[][] => {
  const size = 31; // Must be odd for walls/paths
  const maze: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
  
  let s = seed;
  const seededRandom = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const stack: [number, number][] = [[1, 1]];
  maze[1][1] = true;

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors: [number, number, number, number][] = [
      [cx + 2, cy, cx + 1, cy],
      [cx - 2, cy, cx - 1, cy],
      [cx, cy + 2, cx, cy + 1],
      [cx, cy - 2, cx, cy - 1]
    ].filter(([nx, ny]) => nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && !maze[ny][nx]) as any;

    if (neighbors.length > 0) {
      const [nx, ny, px, py] = neighbors[Math.floor(seededRandom() * neighbors.length)];
      maze[ny][nx] = true;
      maze[py][px] = true;
      stack.push([nx, ny]);
    } else {
      stack.pop();
    }
  }
  
  // Ensure center is clear
  const mid = Math.floor(size / 2);
  for (let y = mid - 1; y <= mid + 1; y++) {
    for (let x = mid - 1; x <= mid + 1; x++) {
      maze[y][x] = true;
    }
  }

  return maze;
};

export const getChunk = (cx: number, cy: number, chunksRef: React.MutableRefObject<Map<string, Chunk>>, stateRef: React.MutableRefObject<any>): Chunk => {
  const key = `${cx},${cy}`;
  if (chunksRef.current.has(key)) return chunksRef.current.get(key)!;

  const tiles: TileType[][] = [];
  let s = Math.abs((cx * 73856093) ^ (cy * 19349663) ^ INITIAL_WORLD_SEED);
  const seededRandom = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // Dungeon Dimension Check
  const isDungeonDimension = Math.abs(cx) >= 1000 || Math.abs(cy) >= 1000;

  if (isDungeonDimension) {
    const maze = stateRef.current.dungeon.maze;
    for (let y = 0; y < CHUNK_SIZE; y++) {
      tiles[y] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldY = cy * CHUNK_SIZE + y;
        
        if (maze) {
          // Map world coordinates to maze grid
          // Each maze cell is exactly 2x2 tiles (80x80 pixels)
          // We align the maze so that the center cell (15, 15) starts at the dungeon center tile
          const centerTile = 1000 * CHUNK_SIZE + CHUNK_SIZE / 2;
          const mazeX = Math.floor((worldX - centerTile) / 2) + 15;
          const mazeY = Math.floor((worldY - centerTile) / 2) + 15;
          
          if (mazeX >= 0 && mazeX < 31 && mazeY >= 0 && mazeY < 31) {
            tiles[y][x] = maze[mazeY][mazeX] ? 'DUNGEON_FLOOR' : 'DUNGEON_WALL';
          } else {
            tiles[y][x] = 'DUNGEON_WALL';
          }
        } else {
          tiles[y][x] = 'DUNGEON_FLOOR';
        }
      }
    }
  } else {
    const hasSafeZone = seededRandom() < 0.05;
    const szX = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;
    const szY = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;

    const hasDungeon = seededRandom() < 0.03 && !stateRef.current.clearedDungeons.has(key);
    const dgX = Math.floor(seededRandom() * (CHUNK_SIZE - 8)) + 4;
    const dgY = Math.floor(seededRandom() * (CHUNK_SIZE - 8)) + 4;

    for (let y = 0; y < CHUNK_SIZE; y++) {
      tiles[y] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldY = cy * CHUNK_SIZE + y;
        if (worldX === 0 && worldY === 0) {
          tiles[y][x] = 'SAFE_ZONE';
          continue;
        }
        const elevation = getNoise(worldX, worldY, INITIAL_WORLD_SEED, 0.002);
        const moisture = getNoise(worldX + 1000, worldY + 1000, INITIAL_WORLD_SEED, 0.002);
        const volcanicNoise = getNoise(worldX - 1000, worldY - 1000, INITIAL_WORLD_SEED, 0.005);
        const riverNoise = getNoise(worldX + 500, worldY - 500, INITIAL_WORLD_SEED + 1, 0.01);
        const jitter = (seededRandom() - 0.5) * 0.03;
        const e = elevation + jitter;
        const m = moisture + jitter;
        
        if (hasSafeZone && Math.abs(x - szX) < 3 && Math.abs(y - szY) < 3) {
          tiles[y][x] = 'SAFE_ZONE';
          continue;
        }

        if (hasDungeon && Math.abs(x - dgX) < 4 && Math.abs(y - dgY) < 4) {
          const dx = Math.abs(x - dgX);
          const dy = Math.abs(y - dgY);
          if (dx === 0 && dy === 0) tiles[y][x] = 'DUNGEON_ENTRANCE';
          else if (dx === 3 || dy === 3) {
            // Leave a gap for entrance
            if (x === dgX && y === dgY + 3) tiles[y][x] = 'DUNGEON_FLOOR';
            else tiles[y][x] = 'DUNGEON_WALL';
          }
          else tiles[y][x] = 'DUNGEON_FLOOR';
          continue;
        }

        if (volcanicNoise > 0.92) tiles[y][x] = 'LAVA';
        else if (e < 0.15) tiles[y][x] = 'OCEAN';
        else if (Math.abs(riverNoise - 0.5) < 0.02 && e > 0.22 && e < 0.75) tiles[y][x] = 'RIVER';
        else if (e < 0.22) tiles[y][x] = 'BEACH';
        else if (e > 0.88) tiles[y][x] = 'SNOW';
        else if (e > 0.75) tiles[y][x] = 'MOUNTAIN';
        else {
          if (m < 0.15) tiles[y][x] = 'DESERT';
          else if (m < 0.4) tiles[y][x] = 'GRASS';
          else if (m < 0.7) tiles[y][x] = 'FOREST';
          else tiles[y][x] = 'JUNGLE';
        }

        const walkable = ['GRASS', 'DESERT', 'FOREST', 'JUNGLE', 'BEACH', 'SNOW'];
        if (walkable.includes(tiles[y][x])) {
          const rand = seededRandom();
          if (rand < 0.04) tiles[y][x] = 'WALL';
          else if (rand < 0.06) tiles[y][x] = 'WATER';
        }
      }
    }
  }

  const offCanvas = document.createElement('canvas');
  offCanvas.width = CHUNK_PIXELS;
  offCanvas.height = CHUNK_PIXELS;
  const offCtx = offCanvas.getContext('2d')!;
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const type = tiles[y][x];
      let color = '#166534';
      if (type === 'WALL') color = '#6b7280';
      else if (type === 'MOUNTAIN') color = '#374151';
      else if (type === 'BOSS_FLOOR') color = '#450a0a';
      else if (type === 'WATER') color = '#3b82f6';
      else if (type === 'SAFE_ZONE') color = '#10b981';
      else if (type === 'DESERT') color = '#fef08a';
      else if (type === 'FOREST') color = '#065f46';
      else if (type === 'OCEAN') color = '#1d4ed8';
      else if (type === 'SNOW') color = '#f8fafc';
      else if (type === 'LAVA') color = '#dc2626';
      else if (type === 'JUNGLE') color = '#064e3b';
      else if (type === 'BEACH') color = '#fde047';
      else if (type === 'RIVER') color = '#60a5fa';
      else if (type === 'DUNGEON_FLOOR') color = '#1f2937';
      else if (type === 'DUNGEON_WALL') color = '#111827';
      else if (type === 'DUNGEON_ENTRANCE') color = '#7c3aed';
      offCtx.fillStyle = color;
      offCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  const chunk: Chunk = { tiles, canvas: offCanvas };
  if (chunksRef.current.size > 100) {
    const firstKey = chunksRef.current.keys().next().value;
    chunksRef.current.delete(firstKey);
  }
  chunksRef.current.set(key, chunk);
  return chunk;
};

export const redrawChunkCanvas = (chunk: Chunk) => {
  const offCtx = chunk.canvas.getContext('2d')!;
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const type = chunk.tiles[y][x];
      let color = '#166534';
      if (type === 'WALL') color = '#6b7280';
      else if (type === 'MOUNTAIN') color = '#374151';
      else if (type === 'BOSS_FLOOR') color = '#450a0a';
      else if (type === 'WATER') color = '#3b82f6';
      else if (type === 'SAFE_ZONE') color = '#10b981';
      else if (type === 'DESERT') color = '#fef08a';
      else if (type === 'FOREST') color = '#065f46';
      else if (type === 'OCEAN') color = '#1d4ed8';
      else if (type === 'SNOW') color = '#f8fafc';
      else if (type === 'LAVA') color = '#dc2626';
      else if (type === 'JUNGLE') color = '#064e3b';
      else if (type === 'BEACH') color = '#fde047';
      else if (type === 'RIVER') color = '#60a5fa';
      else if (type === 'DUNGEON_FLOOR') color = '#1f2937';
      else if (type === 'DUNGEON_WALL') color = '#111827';
      else if (type === 'DUNGEON_ENTRANCE') color = '#7c3aed';
      offCtx.fillStyle = color;
      offCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
};

export const getTileAt = (worldX: number, worldY: number, chunksRef: React.MutableRefObject<Map<string, Chunk>>, stateRef: React.MutableRefObject<any>): TileType => {
  const cx = Math.floor(worldX / CHUNK_PIXELS);
  const cy = Math.floor(worldY / CHUNK_PIXELS);
  const chunk = getChunk(cx, cy, chunksRef, stateRef);
  const tx = Math.floor((worldX % CHUNK_PIXELS + CHUNK_PIXELS) % CHUNK_PIXELS / TILE_SIZE);
  const ty = Math.floor((worldY % CHUNK_PIXELS + CHUNK_PIXELS) % CHUNK_PIXELS / TILE_SIZE);
  return chunk.tiles[ty][tx];
};

export const checkCollision = (nx: number, ny: number, chunksRef: React.MutableRefObject<Map<string, Chunk>>, stateRef: React.MutableRefObject<any>) => {
  const points = [
    { x: nx, y: ny }, { x: nx + PLAYER_SIZE, y: ny },
    { x: nx, y: ny + PLAYER_SIZE }, { x: nx + PLAYER_SIZE, y: ny + PLAYER_SIZE }
  ];
  return points.some(p => {
    const t = getTileAt(p.x, p.y, chunksRef, stateRef);
    return t === 'WALL' || t === 'MOUNTAIN' || t === 'DUNGEON_WALL';
  });
};

export const createParticles = (x: number, y: number, color: string, count: number, particles: Particle[]) => {
  if (particles.length >= MAX_PARTICLES) return;
  const actualCount = Math.min(count, MAX_PARTICLES - particles.length);
  for (let i = 0; i < actualCount; i++) {
    particles.push({
      id: Math.random(),
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1.0,
      color,
    });
  }
};

export const getRandomUpgrades = (count: number = 3): string[] => {
  const possibleUpgrades = [
    'Increase Max Health',
    'Increase Max Stamina',
    'Increase Damage',
    'Increase Speed',
    'Increase Attack Speed',
    'Increase Attack Range'
  ];
  const selected = [];
  const pool = [...possibleUpgrades];
  for (let i = 0; i < Math.min(count, possibleUpgrades.length); i++) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(idx, 1)[0]);
  }
  return selected;
};
