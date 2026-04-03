/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Sword, Zap } from 'lucide-react';
import { JoystickState, WeaponType } from '../../types';

interface MobileControlsProps {
  isMobile: boolean;
  isGameRunning: boolean;
  gameOver: boolean;
  joystick: JoystickState;
  setJoystick: React.Dispatch<React.SetStateAction<JoystickState>>;
  aimJoystick: JoystickState;
  setAimJoystick: React.Dispatch<React.SetStateAction<JoystickState>>;
  currentWeapon: WeaponType;
  setCurrentWeapon: (weapon: WeaponType) => void;
  playerStamina: number;
  stateRef: React.MutableRefObject<any>;
  handleAttack: () => void;
}

export const MobileControls = ({
  isMobile,
  isGameRunning,
  gameOver,
  joystick,
  setJoystick,
  aimJoystick,
  setAimJoystick,
  currentWeapon,
  setCurrentWeapon,
  playerStamina,
  stateRef,
  handleAttack
}: MobileControlsProps) => {
  if (!isMobile || !isGameRunning || gameOver) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[80]">
      {/* Joystick Area */}
      <div 
        className="absolute bottom-12 left-12 w-40 h-40 bg-white/5 rounded-full border border-white/10 pointer-events-auto flex items-center justify-center select-none touch-none"
        onTouchStart={(e) => {
          e.preventDefault();
          const touch = e.changedTouches[0];
          const rect = e.currentTarget.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          setJoystick({ active: true, x: 0, y: 0, startX: centerX, startY: centerY, currentX: touch.clientX, currentY: touch.clientY, identifier: touch.identifier });
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          if (!joystick.active) return;
          
          let touch = null;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystick.identifier) {
              touch = e.changedTouches[i];
              break;
            }
          }
          if (!touch) return;

          const dx = touch.clientX - joystick.startX;
          const dy = touch.clientY - joystick.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 60;
          const normalizedDx = dx / Math.max(dist, 1);
          const normalizedDy = dy / Math.max(dist, 1);
          const finalDist = Math.min(dist, maxDist);
          
          stateRef.current.joystick = {
            x: normalizedDx * (finalDist / maxDist),
            y: normalizedDy * (finalDist / maxDist)
          };
          setJoystick(prev => ({ ...prev, currentX: touch.clientX, currentY: touch.clientY }));
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          let touchEnded = false;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystick.identifier) {
              touchEnded = true;
              break;
            }
          }
          if (touchEnded) {
            setJoystick({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
            stateRef.current.joystick = { x: 0, y: 0 };
          }
        }}
      >
        <div className="w-16 h-16 bg-white/10 rounded-full border border-white/20 flex items-center justify-center">
          {joystick.active && (
            <motion.div 
              className="w-10 h-10 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"
              style={{
                x: Math.min(Math.max(joystick.currentX - joystick.startX, -60), 60),
                y: Math.min(Math.max(joystick.currentY - joystick.startY, -60), 60),
              }}
            />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-12 right-12 flex flex-col gap-4 pointer-events-auto items-end select-none touch-none">
        <div className="flex gap-4 items-end">
          <button 
            className="w-16 h-16 bg-blue-600/80 rounded-full border-2 border-white/20 flex items-center justify-center active:scale-90 transition-transform shadow-xl touch-none"
            onTouchStart={(e) => {
              e.preventDefault();
              const weapons: WeaponType[] = ['SWORD', 'BOW', 'GUN'];
              const nextIdx = (weapons.indexOf(currentWeapon) + 1) % weapons.length;
              setCurrentWeapon(weapons[nextIdx]);
            }}
          >
            <RefreshCw className="w-8 h-8 text-white" />
          </button>
          
          {/* Aiming/Attack Joystick */}
          <div 
            className="w-32 h-32 bg-red-600/20 rounded-full border-2 border-red-500/30 flex items-center justify-center relative touch-none"
            onTouchStart={(e) => {
              e.preventDefault();
              const touch = e.changedTouches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              setAimJoystick({ active: true, x: 0, y: 0, startX: centerX, startY: centerY, currentX: touch.clientX, currentY: touch.clientY, identifier: touch.identifier });
              stateRef.current.aimJoystick.active = true;
              handleAttack();
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              if (!aimJoystick.active) return;

              let touch = null;
              for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === aimJoystick.identifier) {
                  touch = e.changedTouches[i];
                  break;
                }
              }
              if (!touch) return;

              const dx = touch.clientX - aimJoystick.startX;
              const dy = touch.clientY - aimJoystick.startY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const maxDist = 60;
              const normalizedDx = dx / Math.max(dist, 1);
              const normalizedDy = dy / Math.max(dist, 1);
              const finalDist = Math.min(dist, maxDist);
              
              stateRef.current.aimJoystick = {
                x: normalizedDx * (finalDist / maxDist),
                y: normalizedDy * (finalDist / maxDist),
                active: true
              };
              setAimJoystick(prev => ({ ...prev, currentX: touch.clientX, currentY: touch.clientY }));
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              let touchEnded = false;
              for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === aimJoystick.identifier) {
                  touchEnded = true;
                  break;
                }
              }
              if (touchEnded) {
                setAimJoystick({ active: false, x: 0, y: 0, startX: 0, startY: 0, currentX: 0, currentY: 0, identifier: -1 });
                stateRef.current.aimJoystick = { x: 0, y: 0, active: false };
              }
            }}
          >
            <div className="w-16 h-16 bg-red-600/40 rounded-full border border-red-500/50 flex items-center justify-center">
              {aimJoystick.active ? (
                <motion.div 
                  className="w-10 h-10 bg-red-500 rounded-full shadow-lg shadow-red-500/50"
                  style={{
                    x: Math.min(Math.max(aimJoystick.currentX - aimJoystick.startX, -60), 60),
                    y: Math.min(Math.max(aimJoystick.currentY - aimJoystick.startY, -60), 60),
                  }}
                />
              ) : (
                <Sword className="w-8 h-8 text-white" />
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center active:scale-90 transition-transform touch-none ${stateRef.current.playerStamina >= 10 ? 'bg-yellow-500/80 border-white/20' : 'bg-gray-800/80 border-white/10 opacity-50'}`}
            onTouchStart={(e) => { 
              e.preventDefault();
              stateRef.current.keys['sprint'] = true; 
            }}
            onTouchEnd={(e) => { 
              e.preventDefault();
              stateRef.current.keys['sprint'] = false; 
            }}
          >
            <Zap className="w-8 h-8 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
