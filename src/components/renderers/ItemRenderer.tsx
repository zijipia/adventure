/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shape } from 'react-konva';
import { RENDER_DIST } from '../../constants';
import { Item, Position } from '../../types';

interface ItemRendererProps {
  items: Item[];
  camera: Position;
  playerPos: Position;
}

export const ItemRenderer = ({ items, camera, playerPos }: ItemRendererProps) => {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        items.forEach(item => {
          const dx = item.x - playerPos.x;
          const dy = item.y - playerPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > RENDER_DIST) return;

          const x = item.x - camera.x;
          const y = item.y - camera.y;
          const radius = Math.max(0, item.type === 'HEALTH' ? 6 : 4);

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = item.type === 'HEALTH' ? '#e74c3c' : '#3498db';
          context.fill();
        });
      }}
      listening={false}
    />
  );
};
