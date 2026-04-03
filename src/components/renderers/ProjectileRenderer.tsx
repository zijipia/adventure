/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shape } from 'react-konva';
import { RENDER_DIST } from '../../constants';
import { Projectile, Position } from '../../types';

interface ProjectileRendererProps {
  projectiles: Projectile[];
  camera: Position;
  playerPos: Position;
}

export const ProjectileRenderer = ({ projectiles, camera, playerPos }: ProjectileRendererProps) => {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        projectiles.forEach(p => {
          const dx = p.x - playerPos.x;
          const dy = p.y - playerPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > RENDER_DIST) return;

          const x = p.x - camera.x;
          const y = p.y - camera.y;
          const radius = Math.max(0, p.type === 'ARROW' ? 3 : 4);

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = p.isMonster ? '#9b59b6' : (p.type === 'ARROW' ? '#f1c40f' : '#ecf0f1');
          context.fill();
        });
      }}
      listening={false}
    />
  );
};
