/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WeaponType = 'SWORD' | 'BOW' | 'GUN';

export type TileType = 'GRASS' | 'WALL' | 'MOUNTAIN' | 'BOSS_FLOOR' | 'WATER' | 'SAFE_ZONE' | 'DESERT' | 'FOREST' | 'OCEAN' | 'SNOW' | 'LAVA' | 'JUNGLE' | 'BEACH' | 'RIVER';

export interface Item {
  id: number;
  x: number;
  y: number;
  type: 'HEALTH' | 'XP';
  value: number;
}

export interface Position {
  x: number;
  y: number;
}

export type MonsterType = 'SLIME' | 'ORC' | 'BOSS' | 'RANGED' | 'CHARGER' | 'HEALER' | 'SUMMONER' | 'EXPLODER' | 'GHOST' | 'SPLITTER' | 'SHIELDBEARER';

export interface Monster {
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
  invisible?: boolean;
  isExploding?: boolean;
  explosionTimer?: number;
  size?: number; // For splitters
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'ARROW' | 'BULLET' | 'MONSTER_ORB';
  dead?: boolean;
  isMonster?: boolean;
}

export interface Chunk {
  tiles: TileType[][];
  canvas: HTMLCanvasElement;
}

export interface GameStats {
  maxHealth: number;
  maxStamina: number;
  damage: number;
  speed: number;
  attackSpeed: number;
  range: number;
}

export interface JoystickState {
  active: boolean;
  x: number;
  y: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  identifier: number;
}
