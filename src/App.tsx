/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Image as KonvaImage, Group, Text } from 'react-konva';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, Keyboard, Move, Info, Sword, Target, Zap, Heart, 
  Trophy, MousePointer2, Skull, RefreshCw, Play, Settings 
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Game Constants
const CHUNK_SIZE = 20;
const TILE_SIZE = 40;
const CHUNK_PIXELS = CHUNK_SIZE * TILE_SIZE;

const PLAYER_SIZE = 32;
const PLAYER_SPEED = 5;
const MONSTER_SIZE = 28;
const MONSTER_SPEED = 1.8;
const PROJECTILE_SPEED = 10;
const INITIAL_WORLD_SEED = Math.floor(Math.random() * 1000000); 

type WeaponType = 'SWORD' | 'BOW' | 'GUN';
type TileType = 'GRASS' | 'WALL' | 'MOUNTAIN' | 'BOSS_FLOOR' | 'WATER' | 'SAFE_ZONE' | 'DESERT' | 'FOREST' | 'OCEAN' | 'SNOW' | 'LAVA' | 'JUNGLE' | 'BEACH' | 'RIVER';

interface Item {
  id: number;
  x: number;
  y: number;
  type: 'HEALTH';
}

interface Position {
  x: number;
  y: number;
}

type MonsterType = 'SLIME' | 'ORC' | 'BOSS' | 'RANGED' | 'CHARGER' | 'HEALER';

interface Monster {
  id: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  type: MonsterType;
  stuckTime: number;
  stuckDir: { x: number, y: number } | null;
  lastSkillTime: number;
  isCharging?: boolean;
  chargeDir?: { x: number, y: number };
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'ARROW' | 'BULLET' | 'MONSTER_ORB';
  dead?: boolean;
  isMonster?: boolean;
}

interface Chunk {
  tiles: TileType[][];
  canvas: HTMLCanvasElement;
}

export default function App() {
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('SWORD');
  const [bossSpawned, setBossSpawned] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Refs for high-performance game state
  const stateRef = useRef({
    playerPos: { x: 0, y: 0 },
    mousePos: { x: 0, y: 0 },
    monsters: [] as Monster[],
    projectiles: [] as Projectile[],
    isAttacking: false,
    attackTimer: 0,
    lastShotTime: 0,
    score: 0,
    xp: 0,
    level: 1,
    playerHealth: 100,
    camera: { x: 0, y: 0 },
    bossSpawned: false,
    items: [] as Item[],
    particles: [] as Particle[],
    screenShake: 0,
    keys: {} as { [key: string]: boolean },
  });

  // State for rendering (updated via requestAnimationFrame)
  const [renderState, setRenderState] = useState({
    playerPos: { x: 0, y: 0 },
    monsters: [] as Monster[],
    projectiles: [] as Projectile[],
    items: [] as Item[],
    particles: [] as Particle[],
    camera: { x: 0, y: 0 },
    isAttacking: false,
  });

  const chunksRef = useRef<Map<string, Chunk>>(new Map());

  // Terrain Generation Logic (Deterministic)
  const getNoise = (x: number, y: number, s: number, scale: number = 0.005) => {
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

  const getChunk = (cx: number, cy: number): Chunk => {
    const key = `${cx},${cy}`;
    if (chunksRef.current.has(key)) return chunksRef.current.get(key)!;

    const tiles: TileType[][] = [];
    let s = Math.abs((cx * 73856093) ^ (cy * 19349663) ^ INITIAL_WORLD_SEED);
    const seededRandom = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const hasSafeZone = seededRandom() < 0.05;
    const szX = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;
    const szY = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;

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

  const getTileAt = (worldX: number, worldY: number): TileType => {
    const cx = Math.floor(worldX / CHUNK_PIXELS);
    const cy = Math.floor(worldY / CHUNK_PIXELS);
    const chunk = getChunk(cx, cy);
    const tx = Math.floor((worldX % CHUNK_PIXELS + CHUNK_PIXELS) % CHUNK_PIXELS / TILE_SIZE);
    const ty = Math.floor((worldY % CHUNK_PIXELS + CHUNK_PIXELS) % CHUNK_PIXELS / TILE_SIZE);
    return chunk.tiles[ty][tx];
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      stateRef.current.particles.push({
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

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = true;
      if (e.key === '1') setCurrentWeapon('SWORD');
      if (e.key === '2') setCurrentWeapon('BOW');
      if (e.key === '3') setCurrentWeapon('GUN');
      if (e.key === ' ' && isGameRunning && !gameOver) handleAttack();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
    };
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
    };
  }, [isGameRunning, gameOver]);

  const handleAttack = () => {
    const now = Date.now();
    const { playerPos, mousePos, camera } = stateRef.current;
    const playerCenterX = playerPos.x + PLAYER_SIZE / 2;
    const playerCenterY = playerPos.y + PLAYER_SIZE / 2;
    const mouseWorldX = mousePos.x + camera.x;
    const mouseWorldY = mousePos.y + camera.y;
    const dx = mouseWorldX - playerCenterX;
    const dy = mouseWorldY - playerCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const dirX = dx / dist;
    const dirY = dy / dist;

    if (currentWeapon === 'SWORD') {
      if (!stateRef.current.isAttacking) {
        stateRef.current.isAttacking = true;
        stateRef.current.attackTimer = 12;
      }
    } else {
      const cooldown = currentWeapon === 'BOW' ? 400 : 120;
      if (now - stateRef.current.lastShotTime > cooldown) {
        stateRef.current.lastShotTime = now;
        stateRef.current.projectiles.push({
          id: now,
          x: playerCenterX,
          y: playerCenterY,
          vx: dirX * PROJECTILE_SPEED,
          vy: dirY * PROJECTILE_SPEED,
          type: currentWeapon === 'BOW' ? 'ARROW' : 'BULLET',
        });
      }
    }
  };

  // Game Loop
  useEffect(() => {
    if (!isGameRunning || gameOver) return;

    let animationFrameId: number;
    const update = () => {
      const { keys, playerPos, monsters, projectiles, particles, camera } = stateRef.current;
      
      // Player Movement
      let moveX = 0;
      let moveY = 0;
      const tileAtPlayer = getTileAt(playerPos.x + PLAYER_SIZE / 2, playerPos.y + PLAYER_SIZE / 2);
      
      if (tileAtPlayer === 'SAFE_ZONE') {
        stateRef.current.playerHealth = Math.min(100, stateRef.current.playerHealth + 0.05);
        setPlayerHealth(Math.floor(stateRef.current.playerHealth));
      }
      if (tileAtPlayer === 'LAVA') {
        stateRef.current.playerHealth = Math.max(0, stateRef.current.playerHealth - 0.2);
        setPlayerHealth(Math.floor(stateRef.current.playerHealth));
        if (stateRef.current.playerHealth <= 0) setGameOver(true);
      }

      let speed = PLAYER_SPEED;
      if (tileAtPlayer === 'OCEAN') speed *= 0.3;
      else if (tileAtPlayer === 'WATER' || tileAtPlayer === 'RIVER') speed *= 0.6;
      else if (tileAtPlayer === 'SNOW') speed *= 0.7;
      else if (tileAtPlayer === 'DESERT') speed *= 0.8;

      if (keys['w'] || keys['arrowup']) moveY -= speed;
      if (keys['s'] || keys['arrowdown']) moveY += speed;
      if (keys['a'] || keys['arrowleft']) moveX -= speed;
      if (keys['d'] || keys['arrowright']) moveX += speed;

      const checkCollision = (nx: number, ny: number) => {
        const points = [
          { x: nx, y: ny }, { x: nx + PLAYER_SIZE, y: ny },
          { x: nx, y: ny + PLAYER_SIZE }, { x: nx + PLAYER_SIZE, y: ny + PLAYER_SIZE }
        ];
        return points.some(p => {
          const t = getTileAt(p.x, p.y);
          return t === 'WALL' || t === 'MOUNTAIN';
        });
      };

      const nextPos = { ...playerPos };
      if (!checkCollision(playerPos.x + moveX, playerPos.y)) nextPos.x += moveX;
      if (!checkCollision(playerPos.x, playerPos.y + moveY)) nextPos.y += moveY;
      stateRef.current.playerPos = nextPos;

      // Camera
      stateRef.current.camera = {
        x: nextPos.x - viewport.width / 2 + PLAYER_SIZE / 2,
        y: nextPos.y - viewport.height / 2 + PLAYER_SIZE / 2,
      };

      // Attack
      if (stateRef.current.isAttacking) {
        stateRef.current.attackTimer--;
        if (stateRef.current.attackTimer <= 0) stateRef.current.isAttacking = false;
      }

      // Projectiles
      stateRef.current.projectiles = projectiles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        const t = getTileAt(p.x, p.y);
        if (t === 'WALL' || t === 'MOUNTAIN') return false;
        if (p.isMonster) {
          const dist = Math.sqrt((p.x - (playerPos.x + PLAYER_SIZE / 2)) ** 2 + (p.y - (playerPos.y + PLAYER_SIZE / 2)) ** 2);
          if (dist < PLAYER_SIZE / 2 + 5) {
            stateRef.current.playerHealth -= 10;
            stateRef.current.screenShake = 8;
            setPlayerHealth(Math.max(0, Math.floor(stateRef.current.playerHealth)));
            if (stateRef.current.playerHealth <= 0) setGameOver(true);
            return false;
          }
        }
        return Math.sqrt((p.x - playerPos.x) ** 2 + (p.y - playerPos.y) ** 2) < 1000;
      });

      // Monsters
      stateRef.current.monsters.forEach(m => {
        const dx = playerPos.x - m.x;
        const dy = playerPos.y - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const mSpeed = m.type === 'BOSS' ? MONSTER_SPEED * 0.7 : MONSTER_SPEED;
        
        if (dist < (m.type === 'BOSS' ? 80 : PLAYER_SIZE)) {
          stateRef.current.playerHealth -= m.type === 'BOSS' ? 1.5 : 0.4;
          setPlayerHealth(Math.max(0, Math.floor(stateRef.current.playerHealth)));
          if (stateRef.current.playerHealth <= 0) setGameOver(true);
        }

        if (dist > 5) {
          const mvX = (dx / dist) * mSpeed;
          const mvY = (dy / dist) * mSpeed;
          const canX = !['WALL', 'MOUNTAIN'].includes(getTileAt(m.x + mvX + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2));
          const canY = !['WALL', 'MOUNTAIN'].includes(getTileAt(m.x + MONSTER_SIZE / 2, m.y + mvY + MONSTER_SIZE / 2));
          if (canX) m.x += mvX;
          if (canY) m.y += mvY;
        }

        // Monster Combat
        if (stateRef.current.isAttacking && currentWeapon === 'SWORD') {
          const mCenterX = m.x + (m.type === 'BOSS' ? 60 : MONSTER_SIZE / 2);
          const mCenterY = m.y + (m.type === 'BOSS' ? 60 : MONSTER_SIZE / 2);
          const pCenterX = playerPos.x + PLAYER_SIZE / 2;
          const pCenterY = playerPos.y + PLAYER_SIZE / 2;
          const distToP = Math.sqrt((mCenterX - pCenterX) ** 2 + (mCenterY - pCenterY) ** 2);
          if (distToP < 80) {
            m.health -= 5;
            createParticles(mCenterX, mCenterY, '#e74c3c', 2);
          }
        }

        stateRef.current.projectiles.forEach(p => {
          if (!p.isMonster) {
            const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
            const distToProj = Math.sqrt((p.x - (m.x + mSize / 2)) ** 2 + (p.y - (m.y + mSize / 2)) ** 2);
            if (distToProj < mSize / 2 + 5) {
              m.health -= p.type === 'ARROW' ? 15 : 10;
              p.dead = true;
              createParticles(p.x, p.y, '#e74c3c', 3);
            }
          }
        });
      });

      // Death & XP
      stateRef.current.monsters = stateRef.current.monsters.filter(m => {
        if (m.health <= 0) {
          const xpGain = m.type === 'BOSS' ? 500 : 20;
          stateRef.current.xp += xpGain;
          stateRef.current.score += xpGain * 10;
          setScore(stateRef.current.score);
          setXp(stateRef.current.xp);
          if (m.type === 'BOSS') {
            stateRef.current.bossSpawned = false;
            setBossSpawned(false);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          }
          return false;
        }
        return true;
      });

      // Level Up
      if (stateRef.current.xp >= stateRef.current.level * 100) {
        stateRef.current.xp -= stateRef.current.level * 100;
        stateRef.current.level++;
        setLevel(stateRef.current.level);
        setXp(stateRef.current.xp);
      }

      // Particles
      stateRef.current.particles = particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        return p.life > 0;
      });

      // Update Render State
      setRenderState({
        playerPos: { ...stateRef.current.playerPos },
        monsters: [...stateRef.current.monsters],
        projectiles: [...stateRef.current.projectiles],
        items: [...stateRef.current.items],
        particles: [...stateRef.current.particles],
        camera: { ...stateRef.current.camera },
        isAttacking: stateRef.current.isAttacking,
      });

      animationFrameId = requestAnimationFrame(update);
    };
    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isGameRunning, gameOver, viewport, currentWeapon]);

  // Spawning Logic
  useEffect(() => {
    if (!isGameRunning || gameOver) return;
    const spawnTimer = setInterval(() => {
      const { playerPos, monsters } = stateRef.current;
      if (monsters.length < 25) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 600;
        const x = playerPos.x + Math.cos(angle) * dist;
        const y = playerPos.y + Math.sin(angle) * dist;
        const tile = getTileAt(x, y);
        if (['GRASS', 'FOREST', 'JUNGLE', 'DESERT'].includes(tile)) {
          const type: MonsterType = Math.random() < 0.2 ? 'ORC' : 'SLIME';
          const health = type === 'ORC' ? 80 : 30;
          stateRef.current.monsters.push({
            id: Math.random(), x, y, health, maxHealth: health, type,
            stuckTime: 0, stuckDir: null, lastSkillTime: Date.now()
          });
        }
      }
    }, 2000);
    return () => clearInterval(spawnTimer);
  }, [isGameRunning, gameOver]);

  // Boss Spawn
  useEffect(() => {
    if (!isGameRunning || gameOver || stateRef.current.bossSpawned) return;
    const bossTimer = setInterval(() => {
      if (stateRef.current.score > 0 && stateRef.current.score % 2000 < 100 && !stateRef.current.bossSpawned) {
        stateRef.current.bossSpawned = true;
        setBossSpawned(true);
        const angle = Math.random() * Math.PI * 2;
        const x = stateRef.current.playerPos.x + Math.cos(angle) * 700;
        const y = stateRef.current.playerPos.y + Math.sin(angle) * 700;
        stateRef.current.monsters.push({
          id: 999, x, y, health: 1000, maxHealth: 1000, type: 'BOSS',
          stuckTime: 0, stuckDir: null, lastSkillTime: Date.now()
        });
      }
    }, 5000);
    return () => clearInterval(bossTimer);
  }, [isGameRunning, gameOver]);

  const visibleChunks = useMemo(() => {
    const chunks = [];
    const startCX = Math.floor(renderState.camera.x / CHUNK_PIXELS);
    const startCY = Math.floor(renderState.camera.y / CHUNK_PIXELS);
    const endCX = Math.floor((renderState.camera.x + viewport.width) / CHUNK_PIXELS);
    const endCY = Math.floor((renderState.camera.y + viewport.height) / CHUNK_PIXELS);

    for (let cx = startCX; cx <= endCX; cx++) {
      for (let cy = startCY; cy <= endCY; cy++) {
        chunks.push({ cx, cy, chunk: getChunk(cx, cy) });
      }
    }
    return chunks;
  }, [renderState.camera, viewport]);

  const startGame = () => {
    setIsGameRunning(true);
    setGameOver(false);
    setPlayerHealth(100);
    setScore(0);
    setLevel(1);
    setXp(0);
    stateRef.current = {
      ...stateRef.current,
      playerPos: { x: 0, y: 0 },
      monsters: [],
      projectiles: [],
      particles: [],
      playerHealth: 100,
      score: 0,
      xp: 0,
      level: 1,
      bossSpawned: false,
    };
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Game Stage */}
      <Stage 
        width={viewport.width} 
        height={viewport.height}
        onMouseMove={(e) => {
          const stage = e.target.getStage();
          if (stage) {
            const pos = stage.getPointerPosition();
            if (pos) stateRef.current.mousePos = pos;
          }
        }}
        onMouseDown={handleAttack}
      >
        <Layer>
          {/* Terrain */}
          {visibleChunks.map(({ cx, cy, chunk }) => (
            <KonvaImage
              key={`${cx},${cy}`}
              image={chunk.canvas}
              x={cx * CHUNK_PIXELS - renderState.camera.x}
              y={cy * CHUNK_PIXELS - renderState.camera.y}
              width={CHUNK_PIXELS}
              height={CHUNK_PIXELS}
            />
          ))}

          {/* Items */}
          {renderState.items.map(item => (
            <Circle
              key={item.id}
              x={item.x - renderState.camera.x}
              y={item.y - renderState.camera.y}
              radius={8}
              fill="#2ecc71"
              shadowBlur={5}
              shadowColor="#2ecc71"
            />
          ))}

          {/* Monsters */}
          {renderState.monsters.map(m => (
            <Group key={m.id} x={m.x - renderState.camera.x} y={m.y - renderState.camera.y}>
              <Rect
                width={m.type === 'BOSS' ? 120 : MONSTER_SIZE}
                height={m.type === 'BOSS' ? 120 : MONSTER_SIZE}
                fill={m.type === 'BOSS' ? '#991b1b' : (m.type === 'ORC' ? '#1e3a8a' : '#166534')}
                cornerRadius={4}
                stroke="#000"
                strokeWidth={2}
              />
              {/* Health Bar */}
              <Rect
                y={-10}
                width={m.type === 'BOSS' ? 120 : MONSTER_SIZE}
                height={4}
                fill="#333"
              />
              <Rect
                y={-10}
                width={(m.type === 'BOSS' ? 120 : MONSTER_SIZE) * (m.health / m.maxHealth)}
                height={4}
                fill="#e74c3c"
              />
            </Group>
          ))}

          {/* Projectiles */}
          {renderState.projectiles.map(p => (
            <Circle
              key={p.id}
              x={p.x - renderState.camera.x}
              y={p.y - renderState.camera.y}
              radius={p.type === 'ARROW' ? 3 : 4}
              fill={p.isMonster ? '#9b59b6' : (p.type === 'ARROW' ? '#f1c40f' : '#ecf0f1')}
              shadowBlur={3}
              shadowColor={p.isMonster ? '#9b59b6' : '#fff'}
            />
          ))}

          {/* Particles */}
          {renderState.particles.map(p => (
            <Circle
              key={p.id}
              x={p.x - renderState.camera.x}
              y={p.y - renderState.camera.y}
              radius={2 * p.life}
              fill={p.color}
              opacity={p.life}
            />
          ))}

          {/* Player */}
          <Group x={renderState.playerPos.x - renderState.camera.x} y={renderState.playerPos.y - renderState.camera.y}>
            <Rect
              width={PLAYER_SIZE}
              height={PLAYER_SIZE}
              fill="#3b82f6"
              cornerRadius={6}
              stroke="#fff"
              strokeWidth={2}
              shadowBlur={renderState.isAttacking ? 15 : 0}
              shadowColor="#3b82f6"
            />
            {/* Sword Swing Visual */}
            {renderState.isAttacking && currentWeapon === 'SWORD' && (
              <Rect
                x={PLAYER_SIZE / 2}
                y={PLAYER_SIZE / 2}
                width={60}
                height={10}
                fill="#fff"
                opacity={0.6}
                rotation={Math.atan2(stateRef.current.mousePos.y + renderState.camera.y - (renderState.playerPos.y + PLAYER_SIZE / 2), stateRef.current.mousePos.x + renderState.camera.x - (renderState.playerPos.x + PLAYER_SIZE / 2)) * 180 / Math.PI}
                offsetY={5}
              />
            )}
          </Group>
        </Layer>
      </Stage>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 pointer-events-none flex justify-between items-start">
        <div className="flex flex-col gap-4">
          {/* Health Bar */}
          <div className="w-64 h-6 bg-gray-900/80 rounded-full border-2 border-white/20 overflow-hidden backdrop-blur-md">
            <motion.div 
              className="h-full bg-gradient-to-r from-red-600 to-red-400"
              initial={{ width: '100%' }}
              animate={{ width: `${playerHealth}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest">
              <Heart className="w-3 h-3 mr-1 fill-white" /> {Math.ceil(playerHealth)} HP
            </div>
          </div>

          {/* XP Bar */}
          <div className="w-64 h-3 bg-gray-900/80 rounded-full border border-white/10 overflow-hidden backdrop-blur-md">
            <motion.div 
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
              animate={{ width: `${(xp / (level * 100)) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-4 text-sm font-mono">
            <div className="bg-black/60 px-3 py-1 rounded border border-white/10 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span>{score.toLocaleString()}</span>
            </div>
            <div className="bg-black/60 px-3 py-1 rounded border border-white/10">
              LVL {level}
            </div>
          </div>
        </div>

        {/* Weapon Selector */}
        <div className="flex gap-2 pointer-events-auto">
          {(['SWORD', 'BOW', 'GUN'] as WeaponType[]).map((w, i) => (
            <button
              key={w}
              onClick={() => setCurrentWeapon(w)}
              className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                currentWeapon === w 
                ? 'bg-blue-600 border-white scale-110 shadow-lg shadow-blue-500/50' 
                : 'bg-black/60 border-white/20 hover:border-white/50'
              }`}
            >
              {w === 'SWORD' && <Sword className="w-6 h-6" />}
              {w === 'BOW' && <Target className="w-6 h-6" />}
              {w === 'GUN' && <Zap className="w-6 h-6" />}
              <span className="absolute -bottom-1 -right-1 bg-black text-[8px] px-1 rounded border border-white/20">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Boss Warning */}
      <AnimatePresence>
        {bossSpawned && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-8 py-3 rounded-full border-2 border-white shadow-2xl flex items-center gap-3 z-50"
          >
            <Skull className="w-6 h-6 animate-pulse" />
            <span className="font-bold uppercase tracking-[0.2em] text-lg">Boss Approaching!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Screen */}
      <AnimatePresence>
        {!isGameRunning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100]"
          >
            <div className="max-w-md w-full p-12 text-center space-y-8">
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="space-y-2"
              >
                <h1 className="text-6xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
                  Forest<br/>Adventure
                </h1>
                <p className="text-gray-400 font-mono text-xs tracking-widest uppercase">Survival RPG Engine v2.0</p>
              </motion.div>

              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Move className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Movement</span>
                  </div>
                  <p className="text-xs text-gray-400">WASD or Arrow Keys to explore the infinite forest.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <Sword className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Combat</span>
                  </div>
                  <p className="text-xs text-gray-400">Mouse Click or Space to attack. Keys 1-3 to switch weapons.</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="w-full py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full flex items-center justify-center gap-2 hover:bg-blue-500 hover:text-white transition-colors"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Adventure
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Screen */}
      <AnimatePresence>
        {gameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-red-950/90 backdrop-blur-2xl flex items-center justify-center z-[200]"
          >
            <div className="text-center space-y-8 p-12">
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-red-500/50"
              >
                <Skull className="w-12 h-12 text-white" />
              </motion.div>
              
              <div className="space-y-2">
                <h2 className="text-5xl font-black uppercase tracking-tighter italic">Defeated</h2>
                <p className="text-red-300/60 font-mono text-xs uppercase tracking-widest">Your journey ends here</p>
              </div>

              <div className="bg-black/40 p-6 rounded-2xl border border-white/10 grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Final Score</p>
                  <p className="text-3xl font-black italic">{score.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Level Reached</p>
                  <p className="text-3xl font-black italic">{level}</p>
                </div>
              </div>

              <button
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full flex items-center justify-center gap-2 mx-auto hover:bg-red-500 hover:text-white transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Hint */}
      {!isGameRunning && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 text-gray-500">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Keyboard Recommended</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <MousePointer2 className="w-4 h-4" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Mouse for Aiming</span>
          </div>
        </div>
      )}
    </div>
  );
}
