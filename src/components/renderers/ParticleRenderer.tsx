/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shape } from 'react-konva';
import { Particle, Position } from '../../types';

interface ParticleRendererProps {
  particles: Particle[];
  camera: Position;
}

export const ParticleRenderer = ({ particles, camera }: ParticleRendererProps) => {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        particles.forEach(p => {
          const x = p.x - camera.x;
          const y = p.y - camera.y;
          const radius = Math.max(0, 2 * p.life);

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = p.color;
          context.globalAlpha = p.life;
          context.fill();
          context.globalAlpha = 1;
        });
      }}
      listening={false}
    />
  );
};
