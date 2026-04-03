/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Image as KonvaImage } from 'react-konva';
import { CHUNK_PIXELS } from '../../constants';
import { Position, Chunk } from '../../types';

interface TerrainRendererProps {
  visibleChunks: { cx: number; cy: number; chunk: Chunk }[];
  camera: Position;
}

export const TerrainRenderer = ({ visibleChunks, camera }: TerrainRendererProps) => {
  return (
    <>
      {visibleChunks.map(({ cx, cy, chunk }) => (
        <KonvaImage
          key={`${cx},${cy}`}
          image={chunk.canvas}
          x={cx * CHUNK_PIXELS - camera.x}
          y={cy * CHUNK_PIXELS - camera.y}
          width={CHUNK_PIXELS}
          height={CHUNK_PIXELS}
        />
      ))}
    </>
  );
};
