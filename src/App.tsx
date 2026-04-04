/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Stage, Layer } from 'react-konva';
import { motion, AnimatePresence } from 'motion/react';
import { Keyboard, MousePointer2 } from 'lucide-react';
import confetti from 'canvas-confetti';

import { 
  WeaponType, TileType, Item, Position, MonsterType, Monster, 
  Particle, Projectile, Chunk, GameStats, JoystickState 
} from './types';
import { 
  CHUNK_SIZE, TILE_SIZE, CHUNK_PIXELS, PLAYER_SIZE, MONSTER_SIZE, 
  PROJECTILE_SPEED, MAX_MONSTERS, UPDATE_DIST, RENDER_DIST, 
  DESPAWN_DIST, INITIAL_WORLD_SEED, MONSTER_SPEED, GRID_SIZE 
} from './constants';
import { ItemRenderer } from './components/renderers/ItemRenderer';
import { ProjectileRenderer } from './components/renderers/ProjectileRenderer';
import { ParticleRenderer } from './components/renderers/ParticleRenderer';
import { MonsterRenderer } from './components/renderers/MonsterRenderer';
import { PlayerRenderer } from './components/renderers/PlayerRenderer';
import { TerrainRenderer } from './components/renderers/TerrainRenderer';
import { HUD } from './components/ui/HUD';
import { WeaponSelector } from './components/ui/WeaponSelector';
import { MobileControls } from './components/ui/MobileControls';
import { LevelUpScreen } from './components/ui/LevelUpScreen';
import { StartScreen } from './components/ui/StartScreen';
import { GameOverScreen } from './components/ui/GameOverScreen';
import { BossWarning } from './components/ui/BossWarning';
import { DungeonStatus } from './components/ui/DungeonStatus';
import { Minimap } from './components/ui/Minimap';
import { useGameLoop } from './hooks/useGameLoop';
import { useGameSpawning } from './hooks/useGameSpawning';
import { useInput } from './hooks/useInput';
import { getChunk, getTileAt, checkCollision, createParticles, getRandomUpgrades } from './utils/gameUtils';

export default function App() {
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [playerStamina, setPlayerStamina] = useState(100);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [upgrades, setUpgrades] = useState<string[]>([]);
  const [stats, setStats] = useState({
    maxHealth: 100,
    maxStamina: 100,
    damage: 1,
    speed: 5,
    attackSpeed: 1,
    range: 1
  });
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('SWORD');
  const [bossSpawned, setBossSpawned] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isMobile, setIsMobile] = useState(false);
  const [joystick, setJoystick] = useState({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
  const [aimJoystick, setAimJoystick] = useState({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });

  const chunksRef = useRef<Map<string, Chunk>>(new Map());

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
    playerStamina: 100,
    camera: { x: 0, y: 0 },
    bossSpawned: false,
    items: [] as Item[],
    particles: [] as Particle[],
    screenShake: 0,
    keys: {} as { [key: string]: boolean },
    joystick: { x: 0, y: 0 },
    aimJoystick: { x: 0, y: 0, active: false },
    dungeon: {
      active: false,
      center: { x: 0, y: 0 },
      monsterIds: [] as number[],
      radius: 400,
      preDungeonPos: { x: 0, y: 0 } as Position | null,
      lastDungeonTime: 0,
      entranceChunk: null as { cx: number, cy: number } | null,
      maze: null as boolean[][] | null
    },
    clearedDungeons: new Set<string>()
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
    dungeon: {
      active: false,
      monsterCount: 0,
      maze: null as boolean[][] | null
    }
  });

  const handleAttack = useCallback(() => {
    const now = Date.now();
    const { playerPos, mousePos, camera, joystick, aimJoystick } = stateRef.current;
    const playerCenterX = playerPos.x + PLAYER_SIZE / 2;
    const playerCenterY = playerPos.y + PLAYER_SIZE / 2;
    const mouseWorldX = mousePos.x + camera.x;
    const mouseWorldY = mousePos.y + camera.y;
    
    let dx = mouseWorldX - playerCenterX;
    let dy = mouseWorldY - playerCenterY;

    if (isMobile) {
      if (aimJoystick.x !== 0 || aimJoystick.y !== 0) {
        dx = aimJoystick.x;
        dy = aimJoystick.y;
      } else if (joystick.x !== 0 || joystick.y !== 0) {
        dx = joystick.x;
        dy = joystick.y;
      }
    }

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const dirX = dx / dist;
    const dirY = dy / dist;

    if (currentWeapon === 'SWORD') {
      const cooldown = 250 / stats.attackSpeed;
      if (!stateRef.current.isAttacking && now - stateRef.current.lastShotTime > cooldown) {
        stateRef.current.isAttacking = true;
        stateRef.current.attackTimer = 12;
        stateRef.current.lastShotTime = now;
      }
    } else {
      const cooldown = (currentWeapon === 'BOW' ? 400 : 120) / stats.attackSpeed;
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
  }, [isMobile, currentWeapon, stats]);

  // Use Custom Hooks
  useInput({
    isGameRunning,
    gameOver,
    stateRef,
    setCurrentWeapon,
    handleAttack,
    isMobile,
    setIsMobile,
    setViewport
  });

  useGameLoop({
    isGameRunning,
    gameOver,
    setGameOver,
    setPlayerHealth,
    setPlayerStamina,
    setScore,
    setLevel,
    setXp,
    setUpgrades,
    setShowLevelUp,
    setIsGameRunning,
    setRenderState,
    stateRef,
    chunksRef,
    viewport,
    currentWeapon,
    stats,
    handleAttack,
    isMobile
  });

  useGameSpawning({
    isGameRunning,
    gameOver,
    stateRef,
    chunksRef,
    setBossSpawned
  });

  const visibleChunks = useMemo(() => {
    const chunks = [];
    const startCX = Math.floor(renderState.camera.x / CHUNK_PIXELS);
    const startCY = Math.floor(renderState.camera.y / CHUNK_PIXELS);
    const endCX = Math.floor((renderState.camera.x + viewport.width) / CHUNK_PIXELS);
    const endCY = Math.floor((renderState.camera.y + viewport.height) / CHUNK_PIXELS);

    for (let cx = startCX; cx <= endCX; cx++) {
      for (let cy = startCY; cy <= endCY; cy++) {
        chunks.push({ cx, cy, chunk: getChunk(cx, cy, chunksRef, stateRef) });
      }
    }
    return chunks;
  }, [renderState.camera, viewport]);

  const startGame = useCallback(() => {
    setIsGameRunning(true);
    setGameOver(false);
    setPlayerHealth(100);
    setScore(0);
    setLevel(1);
    setXp(0);
    setShowLevelUp(false);
    setStats({
      maxHealth: 100,
      maxStamina: 100,
      damage: 1,
      speed: 5,
      attackSpeed: 1,
      range: 1
    });
    setJoystick({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
    setAimJoystick({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
    stateRef.current = {
      ...stateRef.current,
      playerPos: { x: 0, y: 0 },
      monsters: [],
      projectiles: [],
      items: [],
      particles: [],
      playerHealth: 100,
      playerStamina: 100,
      score: 0,
      xp: 0,
      level: 1,
      bossSpawned: false,
      joystick: { x: 0, y: 0 },
      aimJoystick: { x: 0, y: 0, active: false },
    };
    setPlayerStamina(100);
  }, []);

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
        style={{ touchAction: 'none' }}
      >
        <Layer>
          {/* Terrain */}
          <TerrainRenderer 
            visibleChunks={visibleChunks} 
            camera={renderState.camera} 
          />

          {/* Items */}
          <ItemRenderer 
            items={renderState.items} 
            camera={renderState.camera} 
            playerPos={renderState.playerPos} 
          />

          {/* Monsters */}
          <MonsterRenderer 
            monsters={renderState.monsters} 
            camera={renderState.camera} 
            playerPos={renderState.playerPos} 
          />

          {/* Projectiles */}
          <ProjectileRenderer 
            projectiles={renderState.projectiles} 
            camera={renderState.camera} 
            playerPos={renderState.playerPos} 
          />

          {/* Particles */}
          <ParticleRenderer 
            particles={renderState.particles} 
            camera={renderState.camera} 
          />

          {/* Player */}
          <PlayerRenderer 
            playerPos={renderState.playerPos}
            camera={renderState.camera}
            isAttacking={renderState.isAttacking}
            currentWeapon={currentWeapon}
            stateRef={stateRef}
            isMobile={isMobile}
          />
        </Layer>
      </Stage>

      {/* UI Overlay */}
      <div className="absolute top-8 left-8 flex flex-col gap-4 pointer-events-none z-[100]">
        <HUD 
          playerHealth={playerHealth}
          playerStamina={playerStamina}
          xp={xp}
          level={level}
          score={score}
          stats={stats}
        />
      </div>

      <div className="absolute top-8 right-8 z-[100]">
        <WeaponSelector 
          currentWeapon={currentWeapon}
          setCurrentWeapon={setCurrentWeapon}
          isMobile={isMobile}
        />
      </div>

      {/* Mobile Controls */}
      <MobileControls 
        isMobile={isMobile}
        isGameRunning={isGameRunning}
        gameOver={gameOver}
        joystick={joystick}
        setJoystick={setJoystick}
        aimJoystick={aimJoystick}
        setAimJoystick={setAimJoystick}
        currentWeapon={currentWeapon}
        setCurrentWeapon={setCurrentWeapon}
        playerStamina={playerStamina}
        stateRef={stateRef}
        handleAttack={handleAttack}
      />

      {/* Boss Warning */}
      <BossWarning bossSpawned={bossSpawned} />

      {/* Dungeon Status */}
      <DungeonStatus 
        active={renderState.dungeon.active} 
        monsterCount={renderState.dungeon.monsterCount} 
      />

      {/* Minimap */}
      <Minimap 
        playerPos={renderState.playerPos} 
        monsters={renderState.monsters} 
        inDungeon={renderState.dungeon.active} 
        maze={renderState.dungeon.maze}
      />

      {/* Level Up Screen */}
      <LevelUpScreen 
        showLevelUp={showLevelUp}
        setShowLevelUp={setShowLevelUp}
        setIsGameRunning={setIsGameRunning}
        setStats={setStats}
        setPlayerHealth={setPlayerHealth}
        setPlayerStamina={setPlayerStamina}
        stateRef={stateRef}
        upgrades={upgrades}
      />

      {/* Start Screen */}
      <StartScreen 
        isGameRunning={isGameRunning}
        showLevelUp={showLevelUp}
        startGame={startGame}
      />

      {/* Game Over Screen */}
      <GameOverScreen 
        gameOver={gameOver}
        score={score}
        level={level}
        startGame={startGame}
      />

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
