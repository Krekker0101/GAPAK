/**
 * EscapingButton
 * GAPAK — a lighthearted nudge for incomplete forms.
 *
 * While `evade` is true, the wrapped element dodges the cursor whenever it
 * gets close, with a spring-based translate + a soft opacity/blur fade so it
 * reads as "not ready yet" rather than just being annoying. As soon as
 * `evade` becomes false it eases back to its resting spot and full opacity.
 *
 * Purely presentational: it does not disable the button itself — pair it
 * with `disabled` on the wrapped control so it can never be triggered by an
 * accidental catch mid-flee, and so keyboard/tap users (who never trigger
 * the dodge) still get a normal disabled affordance.
 *
 * Automatically no-ops on touch/coarse-pointer devices, where "evading the
 * cursor" has no meaning — the button just sits still there.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

interface EscapingButtonProps {
  evade: boolean;
  children: React.ReactNode;
  className?: string;
}

const FLEE_RADIUS = 120; // px — cursor proximity that triggers a dodge
const MAX_TRAVEL = 46; // px — clamp so the button stays comfortably in view

const usesFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

export const EscapingButton: React.FC<EscapingButtonProps> = ({ evade, children, className = '' }) => {
  const zoneRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [finePointer, setFinePointer] = useState(false);
  const [isFleeing, setIsFleeing] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 320, damping: 22, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 320, damping: 22, mass: 0.5 });

  const opacity = useMotionValue(1);
  const springOpacity = useSpring(opacity, { stiffness: 220, damping: 26 });

  useEffect(() => {
    setFinePointer(usesFinePointer());
  }, []);

  useEffect(() => {
    if (!evade) {
      x.set(0);
      y.set(0);
      opacity.set(1);
      setIsFleeing(false);
    }
  }, [evade, x, y, opacity]);

  if (!finePointer || !evade) {
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = centerX - event.clientX;
    const dy = centerY - event.clientY;
    const distance = Math.hypot(dx, dy);

    if (distance < FLEE_RADIUS) {
      const angle = Math.atan2(dy, dx);
      const strength = (1 - distance / FLEE_RADIUS) * MAX_TRAVEL + 18;
      const currentX = x.get();
      const currentY = y.get();
      const nextX = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, currentX + Math.cos(angle) * strength * 0.6));
      const nextY = Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, currentY + Math.sin(angle) * strength * 0.6));
      x.set(nextX);
      y.set(nextY);
      opacity.set(0.62);
      setIsFleeing(true);
    } else if (isFleeing) {
      x.set(0);
      y.set(0);
      opacity.set(1);
      setIsFleeing(false);
    }
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
    opacity.set(1);
    setIsFleeing(false);
  };

  return (
    <div
      ref={zoneRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative ${className}`}
      style={{ padding: MAX_TRAVEL, margin: -MAX_TRAVEL }}
    >
      <motion.div
        ref={targetRef}
        style={{
          x: springX,
          y: springY,
          opacity: springOpacity,
          willChange: 'transform, opacity, filter',
        }}
        animate={{ filter: isFleeing ? 'blur(1.5px)' : 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      >
        {children}
      </motion.div>
    </div>
  );
};
