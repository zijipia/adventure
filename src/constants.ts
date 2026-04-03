/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const CHUNK_SIZE = 20;
export const TILE_SIZE = 40;
export const CHUNK_PIXELS = CHUNK_SIZE * TILE_SIZE;

export const PLAYER_SIZE = 32;
export const PLAYER_SPEED = 5;
export const MONSTER_SIZE = 28;
export const MONSTER_SPEED = 1.8;
export const PROJECTILE_SPEED = 10;
export const MAX_MONSTERS = 40;
export const MAX_PARTICLES = 60;
export const UPDATE_DIST = 1000;
export const RENDER_DIST = 800;
export const DESPAWN_DIST = 3000;
export const GRID_SIZE = 100;
export const INITIAL_WORLD_SEED = Math.floor(Math.random() * 11500) + 15200;
