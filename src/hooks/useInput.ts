/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { WeaponType } from '../types';

interface InputProps {
  isGameRunning: boolean;
  gameOver: boolean;
  stateRef: React.MutableRefObject<any>;
  setCurrentWeapon: (w: WeaponType) => void;
  handleAttack: () => void;
  isMobile: boolean;
  setIsMobile: (v: boolean) => void;
  setViewport: (v: { width: number; height: number }) => void;
}

export const useInput = ({
  isGameRunning,
  gameOver,
  stateRef,
  setCurrentWeapon,
  handleAttack,
  isMobile,
  setIsMobile,
  setViewport
}: InputProps) => {
  // Handle mobile detection and viewport resizing
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
      if (mobile !== isMobile) {
        setIsMobile(mobile);
      }
    };

    const handleResize = () => {
      const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setViewport({ width, height });
      checkMobile();
    };

    // Initial check
    checkMobile();

    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [isMobile, setIsMobile, setViewport]);

  // Handle keyboard and touch interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = true;
      if (e.key === '1') setCurrentWeapon('SWORD');
      if (e.key === '2') setCurrentWeapon('BOW');
      if (e.key === '3') setCurrentWeapon('GUN');
      if (e.key === ' ' && isGameRunning && !gameOver) handleAttack();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
    };

    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('touchstart', preventZoom, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('touchstart', preventZoom);
    };
  }, [isGameRunning, gameOver, setCurrentWeapon, handleAttack]);
};
