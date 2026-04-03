/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Group, Rect } from 'react-konva';
import { PLAYER_SIZE } from '../../constants';
import { Position, WeaponType } from '../../types';

interface PlayerRendererProps {
  playerPos: Position;
  camera: Position;
  isAttacking: boolean;
  currentWeapon: WeaponType;
  stateRef: React.MutableRefObject<any>;
  isMobile: boolean;
}

export const PlayerRenderer = ({ 
  playerPos, 
  camera, 
  isAttacking, 
  currentWeapon, 
  stateRef,
  isMobile 
}: PlayerRendererProps) => {
  return (
    <Group x={playerPos.x - camera.x} y={playerPos.y - camera.y}>
      <Rect
        width={PLAYER_SIZE}
        height={PLAYER_SIZE}
        fill="#3b82f6"
        cornerRadius={6}
        stroke="#fff"
        strokeWidth={2}
        shadowBlur={isAttacking ? 15 : 0}
        shadowColor="#3b82f6"
      />
      {/* Sword Swing Visual */}
      {isAttacking && currentWeapon === 'SWORD' && (
        <Rect
          x={PLAYER_SIZE / 2}
          y={PLAYER_SIZE / 2}
          width={60}
          height={10}
          fill="#fff"
          opacity={0.6}
          rotation={(() => {
            const { playerPos: pPos, mousePos, camera: cam, joystick, aimJoystick } = stateRef.current;
            const playerCenterX = pPos.x + PLAYER_SIZE / 2;
            const playerCenterY = pPos.y + PLAYER_SIZE / 2;
            let dx = mousePos.x + cam.x - playerCenterX;
            let dy = mousePos.y + cam.y - playerCenterY;
            if (isMobile) {
              if (aimJoystick.x !== 0 || aimJoystick.y !== 0) {
                dx = aimJoystick.x;
                dy = aimJoystick.y;
              } else if (joystick.x !== 0 || joystick.y !== 0) {
                dx = joystick.x;
                dy = joystick.y;
              }
            }
            return Math.atan2(dy, dx) * 180 / Math.PI;
          })()}
          offsetY={5}
        />
      )}
    </Group>
  );
};
