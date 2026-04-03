/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shape } from 'react-konva';
import { RENDER_DIST, MONSTER_SIZE } from '../../constants';
import { Monster, Position } from '../../types';

interface MonsterRendererProps {
  monsters: Monster[];
  camera: Position;
  playerPos: Position;
}

export const MonsterRenderer = ({ monsters, camera, playerPos }: MonsterRendererProps) => {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        monsters.forEach(m => {
          const dx = m.x - playerPos.x;
          const dy = m.y - playerPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > RENDER_DIST) return;

          const x = m.x - camera.x;
          const y = m.y - camera.y;
          const size = m.size || 1;
          const baseSize = m.type === 'BOSS' ? 120 : MONSTER_SIZE;
          const mSize = baseSize * size;

          context.save();
          context.translate(x, y);
          context.globalAlpha = m.invisible ? 0.2 : 1;

          // Body
          context.beginPath();
          // context.fillStyle = ... (color logic)
          context.fillStyle = 
            m.type === 'BOSS' ? '#991b1b' : 
            m.type === 'ORC' ? '#1e3a8a' : 
            m.type === 'RANGED' ? '#7c3aed' : 
            m.type === 'CHARGER' ? '#ea580c' : 
            m.type === 'HEALER' ? '#059669' : 
            m.type === 'SUMMONER' ? '#f59e0b' :
            m.type === 'EXPLODER' ? '#f39c12' :
            m.type === 'GHOST' ? '#94a3b8' :
            m.type === 'SPLITTER' ? '#be185d' :
            m.type === 'SHIELDBEARER' ? '#475569' :
            '#166534';
          
          context.fillRect(0, 0, mSize, mSize);
          
          if (m.isCharging || m.isExploding) {
            context.strokeStyle = '#fff';
            context.lineWidth = 3;
            context.strokeRect(0, 0, mSize, mSize);
          } else {
            context.strokeStyle = '#000';
            context.lineWidth = 2;
            context.strokeRect(0, 0, mSize, mSize);
          }

          // Eyes
          context.fillStyle = '#fff';
          const eyeSize = (m.type === 'BOSS' ? 15 : 4) * size;
          const eyeOffset1 = (m.type === 'BOSS' ? 30 : 6) * size;
          const eyeOffset2 = (m.type === 'BOSS' ? 75 : 18) * size;
          const eyeY = (m.type === 'BOSS' ? 30 : 6) * size;
          context.fillRect(eyeOffset1, eyeY, eyeSize, eyeSize);
          context.fillRect(eyeOffset2, eyeY, eyeSize, eyeSize);

          // Health Bar
          context.fillStyle = '#333';
          context.fillRect(0, -10, mSize, 4);
          context.fillStyle = '#e74c3c';
          context.fillRect(0, -10, mSize * (m.health / m.maxHealth), 4);

          // Explosion Warning
          if (m.isExploding) {
            context.beginPath();
            const explosionRadius = Math.max(0, 40 * (1 - (m.explosionTimer || 0) / 60));
            context.arc(mSize / 2, mSize / 2, explosionRadius, 0, Math.PI * 2);
            context.fillStyle = "#f39c12";
            context.globalAlpha = 0.3;
            context.fill();
          }

          context.restore();
        });
      }}
      listening={false}
    />
  );
};
