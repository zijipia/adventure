/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Keyboard, Move, Info, Sword, Target, Zap, Heart, Trophy, MousePointer2, Skull } from 'lucide-react';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerPos, setPlayerPos] = useState<Position>({ x: 0, y: 0 });
  const [playerHealth, setPlayerHealth] = useState(100);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('SWORD');
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [isAttacking, setIsAttacking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [bossSpawned, setBossSpawned] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Map state: Map of "chunkX,chunkY" -> Chunk
  const chunksRef = useRef<Map<string, Chunk>>(new Map());
  
  // Refs for game state to avoid stale closures in requestAnimationFrame
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
    viewport: { width: window.innerWidth, height: window.innerHeight },
  });

  const [items, setItems] = useState<Item[]>([]);

  // Improved deterministic noise function using a robust integer hash and Perlin-like gradients
  // to eliminate circular patterns and ensure natural, varied terrain.
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

    // Multi-layered domain warping to break any geometric regularity
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
    
    // 5 octaves for high detail
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

    // Generate new chunk
    const tiles: TileType[][] = [];
    
    // Seeded random for local details
    let s = Math.abs((cx * 73856093) ^ (cy * 19349663) ^ INITIAL_WORLD_SEED);
    const seededRandom = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    // Determine if this chunk has a safe zone (rare)
    const hasSafeZone = seededRandom() < 0.05;
    const szX = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;
    const szY = Math.floor(seededRandom() * (CHUNK_SIZE - 6)) + 3;

    for (let y = 0; y < CHUNK_SIZE; y++) {
      tiles[y] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldY = cy * CHUNK_SIZE + y;

        // Ensure starting tile is safe but not a perfect circle
        if (worldX === 0 && worldY === 0) {
          tiles[y][x] = 'SAFE_ZONE';
          continue;
        }
        
        // Use the new fractal noise with domain warping
        const elevation = getNoise(worldX, worldY, INITIAL_WORLD_SEED, 0.002);
        const moisture = getNoise(worldX + 1000, worldY + 1000, INITIAL_WORLD_SEED, 0.002);
        const volcanicNoise = getNoise(worldX - 1000, worldY - 1000, INITIAL_WORLD_SEED, 0.005);
        const riverNoise = getNoise(worldX + 500, worldY - 500, INITIAL_WORLD_SEED + 1, 0.01);
        
        // Add a bit of local jitter to the noise values to make edges jagged
        const jitter = (seededRandom() - 0.5) * 0.03;
        const e = elevation + jitter;
        const m = moisture + jitter;
        
        // Safe zone cluster
        if (hasSafeZone && Math.abs(x - szX) < 3 && Math.abs(y - szY) < 3) {
          tiles[y][x] = 'SAFE_ZONE';
          continue;
        }

        // Determine biome based on noise
        if (volcanicNoise > 0.92) {
          tiles[y][x] = 'LAVA';
        } else if (e < 0.15) {
          tiles[y][x] = 'OCEAN';
        } else if (Math.abs(riverNoise - 0.5) < 0.02 && e > 0.22 && e < 0.75) {
          tiles[y][x] = 'RIVER';
        } else if (e < 0.22) {
          tiles[y][x] = 'BEACH';
        } else if (e > 0.88) {
          tiles[y][x] = 'SNOW';
        } else if (e > 0.75) {
          tiles[y][x] = 'MOUNTAIN';
        } else {
          // Moderate elevation: determine by moisture
          if (m < 0.15) {
            tiles[y][x] = 'DESERT';
          } else if (m < 0.4) {
            tiles[y][x] = 'GRASS';
          } else if (m < 0.7) {
            tiles[y][x] = 'FOREST';
          } else {
            tiles[y][x] = 'JUNGLE';
          }
        }

        // Add local obstacles (only on walkable ground)
        const walkable = ['GRASS', 'DESERT', 'FOREST', 'JUNGLE', 'BEACH', 'SNOW'];
        if (walkable.includes(tiles[y][x])) {
          const rand = seededRandom();
          if (rand < 0.04) tiles[y][x] = 'WALL';
          else if (rand < 0.06) tiles[y][x] = 'WATER';
        }
      }
    }

    // Pre-render chunk to offscreen canvas
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
    
    // Limit cache size to prevent memory leaks
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

  // Handle keyboard and mouse input
  useEffect(() => {
    const handleResize = () => {
      const newViewport = { width: window.innerWidth, height: window.innerHeight };
      setViewport(newViewport);
      stateRef.current.viewport = newViewport;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
      if (e.key === '1') setCurrentWeapon('SWORD');
      if (e.key === '2') setCurrentWeapon('BOW');
      if (e.key === '3') setCurrentWeapon('GUN');
      if (e.key === ' ' && isGameRunning && !gameOver) {
        handleAttack();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      stateRef.current.mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && isGameRunning && !gameOver) {
        handleAttack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isGameRunning, gameOver, currentWeapon]);

  const handleAttack = () => {
    const now = Date.now();
    const { playerPos, mousePos, camera } = stateRef.current;

    // Calculate direction vector from player center to mouse (in world space)
    const playerCenterX = playerPos.x + PLAYER_SIZE / 2;
    const playerCenterY = playerPos.y + PLAYER_SIZE / 2;
    
    // Mouse position in world space
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
        setIsAttacking(true);
      }
    } else if (currentWeapon === 'BOW' || currentWeapon === 'GUN') {
      const cooldown = currentWeapon === 'BOW' ? 400 : 120;
      if (now - stateRef.current.lastShotTime > cooldown) {
        stateRef.current.lastShotTime = now;
        
        const newProjectile: Projectile = {
          id: now,
          x: playerCenterX,
          y: playerCenterY,
          vx: dirX * PROJECTILE_SPEED,
          vy: dirY * PROJECTILE_SPEED,
          type: currentWeapon === 'BOW' ? 'ARROW' : 'BULLET',
        };
        stateRef.current.projectiles.push(newProjectile);
        setProjectiles([...stateRef.current.projectiles]);
      }
    }
  };

  // Spawn monsters and items
  useEffect(() => {
    if (!isGameRunning || gameOver) return;

    const spawnInterval = setInterval(() => {
      const { playerPos, monsters, items } = stateRef.current;
      
      // Despawn monsters too far from player
      stateRef.current.monsters = monsters.filter(m => {
        const dx = m.x - playerPos.x;
        const dy = m.y - playerPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < 1200 || m.type === 'BOSS'; // Don't despawn boss
      });
      setMonsters([...stateRef.current.monsters]);

      // Spawn Monsters
      if (stateRef.current.monsters.length < 30) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 500 + Math.random() * 200;
        const x = playerPos.x + Math.cos(angle) * dist;
        const y = playerPos.y + Math.sin(angle) * dist;

        const tile = getTileAt(x, y);
        if (tile === 'GRASS' || tile === 'BOSS_FLOOR') {
          const rand = Math.random();
          let type: MonsterType = 'SLIME';
          let health = 30;
          if (rand < 0.2) { type = 'ORC'; health = 80; }
          else if (rand < 0.35) { type = 'RANGED'; health = 50; }
          else if (rand < 0.5) { type = 'CHARGER'; health = 60; }
          else if (rand < 0.6) { type = 'HEALER'; health = 40; }

          const newMonster: Monster = {
            id: Date.now() + Math.random(),
            x,
            y,
            health,
            maxHealth: health,
            type,
            stuckTime: 0,
            stuckDir: null,
            lastSkillTime: Date.now() + Math.random() * 2000,
          };
          stateRef.current.monsters.push(newMonster);
          setMonsters([...stateRef.current.monsters]);
        }
      }

      // Spawn Items (Health)
      if (items.length < 8 && Math.random() < 0.2) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 200 + Math.random() * 400;
        const x = playerPos.x + Math.cos(angle) * dist;
        const y = playerPos.y + Math.sin(angle) * dist;
        
        if (getTileAt(x, y) === 'GRASS') {
          const newItem: Item = {
            id: Date.now() + Math.random(),
            x,
            y,
            type: 'HEALTH',
          };
          stateRef.current.items.push(newItem);
          setItems([...stateRef.current.items]);
        }
      }
    }, 1500);

    return () => clearInterval(spawnInterval);
  }, [isGameRunning, gameOver]);

  // Boss Spawn Logic (Dynamic)
  useEffect(() => {
    if (!isGameRunning || gameOver || stateRef.current.bossSpawned) return;

    const checkBoss = setInterval(() => {
      const { score } = stateRef.current;
      // Spawn boss every 2000 points
      if (score > 0 && score % 2000 < 50 && !stateRef.current.bossSpawned) {
        stateRef.current.bossSpawned = true;
        setBossSpawned(true);
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 600;
        const { playerPos } = stateRef.current;

        const boss: Monster = {
          id: 9999 + Math.random(),
          x: playerPos.x + Math.cos(angle) * dist,
          y: playerPos.y + Math.sin(angle) * dist,
          health: 1200 + (stateRef.current.level * 200),
          maxHealth: 1200 + (stateRef.current.level * 200),
          type: 'BOSS',
          stuckTime: 0,
          stuckDir: null,
          lastSkillTime: Date.now(),
        };
        stateRef.current.monsters.push(boss);
        setMonsters([...stateRef.current.monsters]);
      }
    }, 2000);

    return () => clearInterval(checkBoss);
  }, [isGameRunning, gameOver]);

  // Game Loop
  useEffect(() => {
    if (!isGameRunning || gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = () => {
      // Update Screen Shake
      if (stateRef.current.screenShake > 0) {
        stateRef.current.screenShake *= 0.9;
        if (stateRef.current.screenShake < 0.1) stateRef.current.screenShake = 0;
      }

      // Update Particles
      stateRef.current.particles = stateRef.current.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        return p.life > 0;
      });

      const { playerPos, monsters, projectiles, mousePos, camera } = stateRef.current;

      // Handle weapon switching
      if (keys['1']) setCurrentWeapon('SWORD');
      if (keys['2']) setCurrentWeapon('BOW');
      if (keys['3']) setCurrentWeapon('GUN');

      // Update Player Position with Collision
      const nextPos = { ...playerPos };
      let moveX = 0;
      let moveY = 0;
      
      // Check if player is on water or safe zone
      const tileAtPlayer = getTileAt(playerPos.x + PLAYER_SIZE / 2, playerPos.y + PLAYER_SIZE / 2);
      const isOnWater = tileAtPlayer === 'WATER';
      const isOnOcean = tileAtPlayer === 'OCEAN';
      const isOnSafeZone = tileAtPlayer === 'SAFE_ZONE';
      const isOnDesert = tileAtPlayer === 'DESERT';
      const isOnSnow = tileAtPlayer === 'SNOW';
      const isOnLava = tileAtPlayer === 'LAVA';
      const isOnJungle = tileAtPlayer === 'JUNGLE';
      const isOnRiver = tileAtPlayer === 'RIVER';
      
      if (isOnSafeZone) {
        stateRef.current.playerHealth = Math.min(100, stateRef.current.playerHealth + 0.05);
        setPlayerHealth(Math.floor(stateRef.current.playerHealth));
      }

      if (isOnLava) {
        stateRef.current.playerHealth = Math.max(0, stateRef.current.playerHealth - 0.2);
        setPlayerHealth(Math.floor(stateRef.current.playerHealth));
        if (stateRef.current.playerHealth <= 0) setGameOver(true);
      }

      let currentSpeed = PLAYER_SPEED;
      if (isOnOcean) currentSpeed *= 0.3;
      else if (isOnWater) currentSpeed *= 0.6;
      else if (isOnRiver) currentSpeed *= 0.5;
      else if (isOnLava) currentSpeed *= 0.5;
      else if (isOnSnow) currentSpeed *= 0.7;
      else if (isOnDesert) currentSpeed *= 0.8;
      else if (isOnJungle) currentSpeed *= 0.85;

      if (keys['w'] || keys['arrowup']) moveY -= currentSpeed;
      if (keys['s'] || keys['arrowdown']) moveY += currentSpeed;
      if (keys['a'] || keys['arrowleft']) moveX -= currentSpeed;
      if (keys['d'] || keys['arrowright']) moveX += currentSpeed;

      // Collision detection for tiles
      const checkCollision = (nx: number, ny: number) => {
        const tilesToCheck = [
          { x: nx, y: ny },
          { x: nx + PLAYER_SIZE, y: ny },
          { x: nx, y: ny + PLAYER_SIZE },
          { x: nx + PLAYER_SIZE, y: ny + PLAYER_SIZE }
        ];

        for (const t of tilesToCheck) {
          const tile = getTileAt(t.x, t.y);
          if (tile === 'WALL' || tile === 'MOUNTAIN') return true;
        }
        return false;
      };

      if (!checkCollision(playerPos.x + moveX, playerPos.y)) nextPos.x += moveX;
      if (!checkCollision(playerPos.x, playerPos.y + moveY)) nextPos.y += moveY;

      stateRef.current.playerPos = nextPos;
      setPlayerPos(nextPos);

      // Update Camera
      stateRef.current.camera = {
        x: nextPos.x - stateRef.current.viewport.width / 2 + PLAYER_SIZE / 2,
        y: nextPos.y - stateRef.current.viewport.height / 2 + PLAYER_SIZE / 2,
      };

      // Update Attack Timer
      if (stateRef.current.isAttacking) {
        stateRef.current.attackTimer--;
        if (stateRef.current.attackTimer <= 0) {
          stateRef.current.isAttacking = false;
          setIsAttacking(false);
        }
      }

      // Update Projectiles
      stateRef.current.projectiles = projectiles.filter(p => {
        if (p.dead) return false;
        p.x += p.vx;
        p.y += p.vy;
        
        // Wall collision for projectiles
        const tile = getTileAt(p.x, p.y);
        if (tile === 'WALL' || tile === 'MOUNTAIN') return false;

        // Collision with player (if monster projectile)
        if (p.isMonster) {
          const pdx = p.x - (playerPos.x + PLAYER_SIZE / 2);
          const pdy = p.y - (playerPos.y + PLAYER_SIZE / 2);
          const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pDist < PLAYER_SIZE / 2 + 5) {
            stateRef.current.playerHealth -= 10;
            stateRef.current.screenShake = 8;
            setPlayerHealth(Math.max(0, Math.floor(stateRef.current.playerHealth)));
            if (stateRef.current.playerHealth <= 0) setGameOver(true);
            return false;
          }
        }

        // Distance limit for projectiles
        const dx = p.x - playerPos.x;
        const dy = p.y - playerPos.y;
        return dx * dx + dy * dy < 1000000;
      });
      setProjectiles([...stateRef.current.projectiles]);

      // Update Monsters (Improved AI)
      stateRef.current.monsters.forEach(m => {
        const dx = playerPos.x - m.x;
        const dy = playerPos.y - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const speed = m.type === 'BOSS' ? MONSTER_SPEED * 0.7 : (m.type === 'ORC' ? MONSTER_SPEED * 0.8 : MONSTER_SPEED * 1.2);
        
        // Monster Skills & Item Pickup
        const now = Date.now();
        
        // Item Pickup for Monsters
        stateRef.current.items = stateRef.current.items.filter(item => {
          const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
          const idx = item.x - (m.x + mSize / 2);
          const idy = item.y - (m.y + mSize / 2);
          const iDist = Math.sqrt(idx * idx + idy * idy);
          if (iDist < mSize / 2 + 10) {
            if (item.type === 'HEALTH') {
              m.health = Math.min(m.maxHealth, m.health + 20);
              createParticles(item.x, item.y, '#2ecc71', 5);
            }
            return false;
          }
          return true;
        });

        // Skill Logic
        if (now - m.lastSkillTime > (m.type === 'BOSS' ? 2000 : 3000)) {
          if (m.type === 'RANGED' && dist < 400) {
            // Shoot at player
            const proj: Projectile = {
              id: now + Math.random(),
              x: m.x + MONSTER_SIZE / 2,
              y: m.y + MONSTER_SIZE / 2,
              vx: (dx / dist) * 5,
              vy: (dy / dist) * 5,
              type: 'MONSTER_ORB',
              isMonster: true,
            };
            stateRef.current.projectiles.push(proj);
            m.lastSkillTime = now;
          } else if (m.type === 'CHARGER' && dist < 300 && !m.isCharging) {
            // Charge at player
            m.isCharging = true;
            m.chargeDir = { x: dx / dist, y: dy / dist };
            m.lastSkillTime = now;
            setTimeout(() => { m.isCharging = false; }, 1000);
          } else if (m.type === 'HEALER' && dist < 500) {
            // Heal self and nearby monsters
            m.health = Math.min(m.maxHealth, m.health + 10);
            createParticles(m.x + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2, '#2ecc71', 8);
            stateRef.current.monsters.forEach(other => {
              const odx = other.x - m.x;
              const ody = other.y - m.y;
              const oDist = Math.sqrt(odx * odx + ody * ody);
              if (oDist < 200 && other.id !== m.id) {
                other.health = Math.min(other.maxHealth, other.health + 5);
                createParticles(other.x + MONSTER_SIZE / 2, other.y + MONSTER_SIZE / 2, '#2ecc71', 3);
              }
            });
            m.lastSkillTime = now;
          } else if (m.type === 'BOSS') {
            // Boss skills (multi-shot)
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2;
              const proj: Projectile = {
                id: now + i,
                x: m.x + 60,
                y: m.y + 60,
                vx: Math.cos(angle) * 4,
                vy: Math.sin(angle) * 4,
                type: 'MONSTER_ORB',
                isMonster: true,
              };
              stateRef.current.projectiles.push(proj);
            }
            m.lastSkillTime = now;
          }
        }

        // Apply charging speed
        const currentMoveSpeed = (m.isCharging && m.chargeDir) ? speed * 4 : speed;

        // Monsters avoid safe zones
        const tileAtMonster = getTileAt(m.x + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2);
        const inSafeZone = tileAtMonster === 'SAFE_ZONE';

        if (dist > 5) {
          let mvX = (dx / dist) * currentMoveSpeed;
          let mvY = (dy / dist) * currentMoveSpeed;
          
          if (m.isCharging && m.chargeDir) {
            mvX = m.chargeDir.x * currentMoveSpeed;
            mvY = m.chargeDir.y * currentMoveSpeed;
          }

          if (inSafeZone) {
            // Push out of safe zone
            mvX = -mvX;
            mvY = -mvY;
          }

          // Stuck logic: If stuck for too long, try to move perpendicular
          if (m.stuckTime > 30) {
            if (!m.stuckDir) {
              const perpX = -dy / dist;
              const perpY = dx / dist;
              m.stuckDir = Math.random() > 0.5 ? { x: perpX, y: perpY } : { x: -perpX, y: -perpY };
            }
            mvX = m.stuckDir.x * speed;
            mvY = m.stuckDir.y * speed;
            m.stuckTime--;
            if (m.stuckTime <= 0) m.stuckDir = null;
          }

          // Improved AI: Sliding along walls
          const canMoveX = getTileAt(m.x + mvX + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2) !== 'WALL' && 
                           getTileAt(m.x + mvX + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2) !== 'MOUNTAIN';
          const canMoveY = getTileAt(m.x + MONSTER_SIZE / 2, m.y + mvY + MONSTER_SIZE / 2) !== 'WALL' && 
                           getTileAt(m.x + MONSTER_SIZE / 2, m.y + mvY + MONSTER_SIZE / 2) !== 'MOUNTAIN';

          let moved = false;
          if (canMoveX) { m.x += mvX; moved = true; }
          if (canMoveY) { m.y += mvY; moved = true; }
          
          if (!moved) {
            m.stuckTime++;
            // Jitter
            m.x += (Math.random() - 0.5) * speed * 2;
            m.y += (Math.random() - 0.5) * speed * 2;
          } else {
            if (m.stuckTime > 0 && !m.stuckDir) m.stuckTime--;
          }
        }

        // Collision with player
        const hitDist = m.type === 'BOSS' ? 80 : PLAYER_SIZE;
        if (dist < hitDist) {
          const damage = m.type === 'BOSS' ? 1.5 : (m.type === 'ORC' ? 0.8 : 0.4);
          stateRef.current.playerHealth -= damage;
          stateRef.current.screenShake = 5;
          setPlayerHealth(Math.max(0, Math.floor(stateRef.current.playerHealth)));
          if (stateRef.current.playerHealth <= 0) setGameOver(true);
        }

        // Collision with Sword
        if (stateRef.current.isAttacking) {
          const swordRange = 80;
          const pCenterX = playerPos.x + PLAYER_SIZE / 2;
          const pCenterY = playerPos.y + PLAYER_SIZE / 2;
          const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
          const mCenterX = m.x + mSize / 2;
          const mCenterY = m.y + mSize / 2;
          
          const distToPlayer = Math.sqrt(Math.pow(mCenterX - pCenterX, 2) + Math.pow(mCenterY - pCenterY, 2));
          
          if (distToPlayer < swordRange) {
            const mouseWorldX = mousePos.x + camera.x;
            const mouseWorldY = mousePos.y + camera.y;
            const angleToMouse = Math.atan2(mouseWorldY - pCenterY, mouseWorldX - pCenterX);
            const angleToMonster = Math.atan2(mCenterY - pCenterY, mCenterX - pCenterX);
            let diff = Math.abs(angleToMouse - angleToMonster);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff < Math.PI / 2) {
              const damage = 3 * (1 + (stateRef.current.level - 1) * 0.2);
              m.health -= damage;
              createParticles(mCenterX, mCenterY, '#fff', 2);
            }
          }
        }

        // Collision with Projectiles
        stateRef.current.projectiles.forEach(p => {
          if (p.dead || p.isMonster) return;
          const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
          const pdx = p.x - (m.x + mSize / 2);
          const pdy = p.y - (m.y + mSize / 2);
          const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pDist < mSize / 2 + 5) {
            const baseDamage = p.type === 'ARROW' ? 15 : 10;
            const damage = baseDamage * (1 + (stateRef.current.level - 1) * 0.2);
            m.health -= damage;
            createParticles(p.x, p.y, p.type === 'ARROW' ? '#f1c40f' : '#fff', 3);
            p.dead = true;
          }
        });
      });

      // Filter dead monsters
      const aliveMonsters = stateRef.current.monsters.filter(m => {
        if (m.health <= 0) {
          const xpGain = m.type === 'BOSS' ? 500 : (m.type === 'ORC' ? 25 : 10);
          stateRef.current.xp += xpGain;
          stateRef.current.score += m.type === 'BOSS' ? 1000 : (m.type === 'ORC' ? 30 : 10);
          
          // Level Up Logic
          const nextLevelXp = stateRef.current.level * 100;
          if (stateRef.current.xp >= nextLevelXp) {
            stateRef.current.xp -= nextLevelXp;
            stateRef.current.level += 1;
            stateRef.current.playerHealth = Math.min(100, stateRef.current.playerHealth + 20);
            setLevel(stateRef.current.level);
            setPlayerHealth(Math.floor(stateRef.current.playerHealth));
          }
          
          setXp(stateRef.current.xp);
          setScore(stateRef.current.score);
          createParticles(m.x + MONSTER_SIZE / 2, m.y + MONSTER_SIZE / 2, m.type === 'BOSS' ? '#ef4444' : '#8b4513', 15);
          if (m.type === 'BOSS') {
            stateRef.current.bossSpawned = false;
            setBossSpawned(false);
          }
          return false;
        }
        return true;
      });
      stateRef.current.monsters = aliveMonsters;
      setMonsters([...aliveMonsters]);

      // Update Items (Collision with player)
      stateRef.current.items = stateRef.current.items.filter(item => {
        const dx = playerPos.x + PLAYER_SIZE / 2 - item.x;
        const dy = playerPos.y + PLAYER_SIZE / 2 - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 30) {
          if (item.type === 'HEALTH') {
            stateRef.current.playerHealth = Math.min(100, stateRef.current.playerHealth + 30);
            setPlayerHealth(stateRef.current.playerHealth);
          }
          return false;
        }
        return true;
      });
      setItems([...stateRef.current.items]);
    };

    const draw = () => {
      const { viewport } = stateRef.current;
      ctx.clearRect(0, 0, viewport.width, viewport.height);
      const { camera, playerPos, monsters, projectiles, isAttacking, mousePos, screenShake, particles } = stateRef.current;

      ctx.save();
      
      // Apply Screen Shake
      if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
      }

      ctx.translate(-camera.x, -camera.y);

      // Draw Tiles (Infinite)
      const startCX = Math.floor(camera.x / CHUNK_PIXELS);
      const endCX = Math.floor((camera.x + viewport.width) / CHUNK_PIXELS);
      const startCY = Math.floor(camera.y / CHUNK_PIXELS);
      const endCY = Math.floor((camera.y + viewport.height) / CHUNK_PIXELS);

      for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
          const chunk = getChunk(cx, cy);
          const tx = cx * CHUNK_PIXELS;
          const ty = cy * CHUNK_PIXELS;
          ctx.drawImage(chunk.canvas, tx, ty);
        }
      }

      // Draw Items
      stateRef.current.items.forEach(item => {
        if (item.type === 'HEALTH') {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'white';
          ctx.fillRect(item.x - 6, item.y - 2, 12, 4);
          ctx.fillRect(item.x - 2, item.y - 6, 4, 12);
        }
      });

      // Draw Monsters
      monsters.forEach(m => {
        const mSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
        if (m.type === 'BOSS') ctx.fillStyle = '#ef4444';
        else if (m.type === 'ORC') ctx.fillStyle = '#1e293b';
        else if (m.type === 'RANGED') ctx.fillStyle = '#9333ea';
        else if (m.type === 'CHARGER') ctx.fillStyle = '#f97316';
        else if (m.type === 'HEALER') ctx.fillStyle = '#22c55e';
        else ctx.fillStyle = '#8b4513';

        ctx.beginPath();
        ctx.roundRect(m.x, m.y, mSize, mSize, m.type === 'BOSS' ? 16 : 4);
        ctx.fill();

        if (m.isCharging) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.strokeRect(m.x - 2, m.y - 2, mSize + 4, mSize + 4);
        }

        // Health bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(m.x, m.y - 15, mSize, 6);
        ctx.fillStyle = m.type === 'BOSS' ? '#facc15' : '#22c55e';
        ctx.fillRect(m.x, m.y - 15, (m.health / m.maxHealth) * mSize, 6);

        if (m.type === 'BOSS') {
          ctx.fillStyle = 'black';
          ctx.fillRect(m.x + 20, m.y + 30, 20, 20);
          ctx.fillRect(m.x + mSize - 40, m.y + 30, 20, 20);
          ctx.fillStyle = 'red';
          ctx.fillRect(m.x + 25, m.y + 35, 10, 10);
          ctx.fillRect(m.x + mSize - 35, m.y + 35, 10, 10);
        }
      });

      // Draw Particles
      particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw Projectiles
      // Draw Projectiles
      stateRef.current.projectiles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        
        if (p.type === 'ARROW') {
          ctx.strokeStyle = '#a52a2a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(10, 0);
          ctx.stroke();
          // Arrow head
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(5, -3);
          ctx.lineTo(5, 3);
          ctx.closePath();
          ctx.fillStyle = '#a52a2a';
          ctx.fill();
        } else if (p.type === 'BULLET') {
          // Bullet
          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          // Glow
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#f1c40f';
          ctx.fill();
        } else if (p.type === 'MONSTER_ORB') {
          ctx.fillStyle = '#e11d48';
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#e11d48';
          ctx.fill();
        }
        ctx.restore();
      });

      // Draw Sword Swing
      if (isAttacking && currentWeapon === 'SWORD') {
        const mouseWorldX = mousePos.x + camera.x;
        const mouseWorldY = mousePos.y + camera.y;
        const angle = Math.atan2(mouseWorldY - (playerPos.y + PLAYER_SIZE / 2), mouseWorldX - (playerPos.x + PLAYER_SIZE / 2));
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(playerPos.x + PLAYER_SIZE / 2, playerPos.y + PLAYER_SIZE / 2, 60, angle - Math.PI / 3, angle + Math.PI / 3);
        ctx.stroke();
      }

      // Draw Player
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.roundRect(playerPos.x, playerPos.y, PLAYER_SIZE, PLAYER_SIZE, 8);
      ctx.fill();

      // Eyes
      const mouseWorldX = mousePos.x + camera.x;
      const mouseWorldY = mousePos.y + camera.y;
      const angle = Math.atan2(mouseWorldY - (playerPos.y + PLAYER_SIZE / 2), mouseWorldX - (playerPos.x + PLAYER_SIZE / 2));
      const eyeOffsetX = Math.cos(angle) * 3;
      const eyeOffsetY = Math.sin(angle) * 3;
      ctx.fillStyle = 'white';
      ctx.fillRect(playerPos.x + 6 + eyeOffsetX, playerPos.y + 8 + eyeOffsetY, 6, 6);
      ctx.fillRect(playerPos.x + 20 + eyeOffsetX, playerPos.y + 8 + eyeOffsetY, 6, 6);
      
      ctx.restore();

      // Draw HUD (Static)
      // Local Radar (Minimap)
      const mmSize = 150;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(viewport.width - mmSize - 20, 20, mmSize, mmSize);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(viewport.width - mmSize - 20, 20, mmSize, mmSize);

      // Draw terrain on radar
      const tilesPerRadar = 30; // 30x30 tiles on radar
      const radarTileSize = mmSize / tilesPerRadar;
      const playerTileX = Math.floor(playerPos.x / TILE_SIZE);
      const playerTileY = Math.floor(playerPos.y / TILE_SIZE);

      for (let ty = -tilesPerRadar/2; ty < tilesPerRadar/2; ty++) {
        for (let tx = -tilesPerRadar/2; tx < tilesPerRadar/2; tx++) {
          const worldTX = (playerTileX + tx) * TILE_SIZE;
          const worldTY = (playerTileY + ty) * TILE_SIZE;
          const type = getTileAt(worldTX, worldTY);
          
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
          
          ctx.fillStyle = color;
          const rx = viewport.width - mmSize/2 - 20 + tx * radarTileSize;
          const ry = 20 + mmSize/2 + ty * radarTileSize;
          ctx.fillRect(rx, ry, radarTileSize, radarTileSize);
        }
      }

      // Draw player on radar (center)
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(viewport.width - mmSize / 2 - 20, 20 + mmSize / 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Coordinates
      ctx.fillStyle = 'white';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`X: ${Math.floor(playerPos.x)} Y: ${Math.floor(playerPos.y)}`, viewport.width - 20, 20 + mmSize + 15);

      // Crosshair
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mousePos.x - 10, mousePos.y);
      ctx.lineTo(mousePos.x + 10, mousePos.y);
      ctx.moveTo(mousePos.x, mousePos.y - 10);
      ctx.lineTo(mousePos.x, mousePos.y + 10);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(() => {
        update();
        draw();
      });
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isGameRunning, gameOver, keys, currentWeapon]);

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      stateRef.current.particles.push({
        id: Math.random(),
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1,
        color,
      });
    }
  };

  const restartGame = () => {
    chunksRef.current.clear();
    stateRef.current = {
      playerPos: { x: 0, y: 0 },
      mousePos: stateRef.current.mousePos,
      monsters: [],
      projectiles: [],
      isAttacking: false,
      attackTimer: 0,
      lastShotTime: 0,
      score: 0,
      xp: 0,
      level: 1,
      playerHealth: 100,
      camera: { x: 0, y: 0 },
      bossSpawned: false,
      items: [],
      particles: [],
      screenShake: 0,
    };
    setPlayerPos(stateRef.current.playerPos);
    setMonsters([]);
    setProjectiles([]);
    setItems([]);
    setScore(0);
    setXp(0);
    setLevel(1);
    setPlayerHealth(100);
    setGameOver(false);
    setBossSpawned(false);
    setIsGameRunning(true);
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden font-sans text-white cursor-none">
      {/* Game Container */}
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          width={viewport.width}
          height={viewport.height}
          className="block bg-black"
        />

        {/* HUD Overlay */}
        <div className="absolute top-6 left-6 pointer-events-none z-20">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-green-400 flex items-center gap-2 drop-shadow-lg">
              <Skull className="w-10 h-10" />
              Forest Legend
            </h1>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-red-500/30 shadow-lg">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                <span className="font-mono font-bold text-xl">{playerHealth}%</span>
              </div>
              <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-yellow-500/30 shadow-lg">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span className="font-mono font-bold text-xl">{score}</span>
              </div>
              <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-blue-500/30 shadow-lg">
                <Zap className="w-5 h-5 text-blue-400" />
                <span className="font-mono font-bold text-xl">LVL {level}</span>
              </div>
            </div>
            {/* XP Bar */}
            <div className="w-64 bg-black/40 backdrop-blur-sm h-2 mt-4 rounded-full overflow-hidden border border-white/10">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${(xp / (level * 100)) * 100}%` }}
              />
            </div>
          </motion.div>
        </div>

        {/* Weapon Selector Overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-20">
          {[
            { id: 'SWORD', icon: Sword, key: '1', color: 'text-blue-400' },
            { id: 'BOW', icon: Target, key: '2', color: 'text-green-400' },
            { id: 'GUN', icon: Zap, key: '3', color: 'text-yellow-400' }
          ].map((w) => (
            <button
              key={w.id}
              onClick={() => setCurrentWeapon(w.id as WeaponType)}
              className={`p-5 rounded-2xl border-2 transition-all backdrop-blur-xl flex flex-col items-center gap-2 group ${
                currentWeapon === w.id 
                  ? 'bg-white/20 border-white shadow-[0_0_30px_rgba(255,255,255,0.3)] scale-110' 
                  : 'bg-black/40 border-white/10 hover:bg-white/10'
              }`}
            >
              <w.icon className={`w-8 h-8 ${w.color} group-hover:scale-110 transition-transform`} />
              <span className="text-[10px] font-black opacity-50 tracking-widest uppercase">{w.key}</span>
            </button>
          ))}
        </div>

        {/* Boss Alert & Distance */}
        <AnimatePresence>
          {bossSpawned && !gameOver && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-8 left-0 right-0 text-center pointer-events-none z-10"
            >
              <h2 className="text-4xl font-black text-red-600 italic tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
                BOSS DETECTED
              </h2>
              {stateRef.current.monsters.find(m => m.type === 'BOSS') && (
                <p className="text-white font-mono tracking-widest uppercase text-sm mt-2">
                  Distance: {Math.floor(Math.sqrt(
                    Math.pow(stateRef.current.playerPos.x - stateRef.current.monsters.find(m => m.type === 'BOSS')!.x, 2) +
                    Math.pow(stateRef.current.playerPos.y - stateRef.current.monsters.find(m => m.type === 'BOSS')!.y, 2)
                  ))}m
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay UI */}
        <AnimatePresence>
          {(!isGameRunning || gameOver) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center z-50"
            >
              {gameOver ? (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                  <Skull className="w-24 h-24 mx-auto mb-4 text-red-600" />
                  <h2 className="text-7xl font-black mb-2 text-red-600 italic tracking-tighter uppercase">Defeated</h2>
                  <p className="text-3xl font-mono mb-10 text-gray-400">Legendary Score: {score}</p>
                  <button
                    onClick={restartGame}
                    className="bg-white text-black px-16 py-5 rounded-full font-black text-2xl hover:bg-green-400 transition-all uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                  >
                    Resurrect
                  </button>
                </motion.div>
              ) : (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                  <div className="mb-8 flex justify-center gap-4">
                    <Sword className="w-12 h-12 text-blue-500" />
                    <Skull className="w-12 h-12 text-red-500" />
                    <Target className="w-12 h-12 text-yellow-500" />
                  </div>
                  <h2 className="text-6xl font-black mb-6 italic tracking-tighter uppercase bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                    Forest Legend
                  </h2>
                  
                  <p className="text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
                    Explore a vast procedural world. Find the <span className="text-red-500 font-bold">Boss Arena</span> in the top-right corner. Survive the horde and defeat the Ancient Guardian.
                  </p>

                  <div className="flex flex-col items-center gap-6">
                    <div className="flex gap-10 text-xs font-mono text-gray-500 uppercase tracking-widest">
                      <div className="flex flex-col items-center gap-2"><div className="bg-white/10 px-3 py-2 rounded-lg border border-white/10 text-white">WASD</div> Move</div>
                      <div className="flex flex-col items-center gap-2"><div className="bg-white/10 px-3 py-2 rounded-lg border border-white/10 text-white">CLICK</div> Attack</div>
                      <div className="flex flex-col items-center gap-2"><div className="bg-white/10 px-3 py-2 rounded-lg border border-white/10 text-white">1 - 3</div> Weapon</div>
                    </div>
                    <button
                      onClick={() => setIsGameRunning(true)}
                      className="bg-green-600 text-white px-20 py-6 rounded-full font-black text-3xl hover:bg-green-500 transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(34,197,94,0.4)] uppercase tracking-widest"
                    >
                      Start Adventure
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
