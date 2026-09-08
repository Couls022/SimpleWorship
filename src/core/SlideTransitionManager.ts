import { SlideTransition, SlideTransitionType, Slide, SystemOptions } from '../types';

export interface TransitionMotionConfig {
  initial: Record<string, any>;
  animate: Record<string, any>;
  exit: Record<string, any>;
  transition: {
    duration: number;
    ease: any;
  };
}

export class SlideTransitionManager {
  /**
   * Resolves the active transition for a slide, falling back to system output options or default fade
   */
  public static resolveTransition(
    slide?: Slide | null,
    systemOptions?: SystemOptions | null,
    customOverride?: SlideTransition | null
  ): SlideTransition {
    if (customOverride) {
      return customOverride;
    }

    if (slide?.transition && slide.transition.type !== 'none') {
      return slide.transition;
    }

    // Check system options default transitions
    const sysTrans = systemOptions?.mainOutput?.transitions;
    const defaultDuration = sysTrans?.duration || 500;
    const defaultEasing = (sysTrans?.easing || 'easeInOut') as any;

    return {
      type: 'fade',
      durationMs: defaultDuration,
      easing: defaultEasing === 'linear' ? 'linear' : defaultEasing === 'easeIn' ? 'ease-in' : defaultEasing === 'easeOut' ? 'ease-out' : 'ease-in-out',
    };
  }

  /**
   * Generates Framer Motion variant and transition object
   */
  public static getMotionConfig(
    transition: SlideTransition,
    isForward: boolean = true
  ): TransitionMotionConfig {
    const durationSec = Math.max(0.001, (transition.durationMs ?? 500) / 1000);
    const ease = this.mapEasing(transition.easing);

    switch (transition.type) {
      case 'cut':
      case 'none':
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 1 },
          transition: { duration: 0.001, ease: 'linear' },
        };

      case 'push-left':
        return {
          initial: { x: isForward ? '100%' : '-100%', opacity: 1 },
          animate: { x: '0%', opacity: 1 },
          exit: { x: isForward ? '-100%' : '100%', opacity: 1 },
          transition: { duration: durationSec, ease },
        };

      case 'push-right':
        return {
          initial: { x: isForward ? '-100%' : '100%', opacity: 1 },
          animate: { x: '0%', opacity: 1 },
          exit: { x: isForward ? '100%' : '-100%', opacity: 1 },
          transition: { duration: durationSec, ease },
        };

      case 'push-up':
        return {
          initial: { y: isForward ? '100%' : '-100%', opacity: 1 },
          animate: { y: '0%', opacity: 1 },
          exit: { y: isForward ? '-100%' : '100%', opacity: 1 },
          transition: { duration: durationSec, ease },
        };

      case 'push-down':
        return {
          initial: { y: isForward ? '-100%' : '100%', opacity: 1 },
          animate: { y: '0%', opacity: 1 },
          exit: { y: isForward ? '100%' : '-100%', opacity: 1 },
          transition: { duration: durationSec, ease },
        };

      case 'wipe-left':
        return {
          initial: { clipPath: isForward ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)', opacity: 1 },
          animate: { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 },
          exit: { clipPath: isForward ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)', opacity: 1 },
          transition: { duration: durationSec, ease },
        };

      case 'wipe-right':
        return {
          initial: { clipPath: isForward ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)', opacity: 1 },
          animate: { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 },
          exit: { clipPath: isForward ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)', opacity: 1 },
          transition: { duration: durationSec, ease },
        };

      case 'wipe-up':
        return {
          initial: { clipPath: 'inset(100% 0% 0% 0%)', opacity: 1 },
          animate: { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 },
          exit: { clipPath: 'inset(0% 0% 100% 0%)', opacity: 1 },
          transition: { duration: durationSec, ease },
        };

      case 'wipe-down':
        return {
          initial: { clipPath: 'inset(0% 0% 100% 0%)', opacity: 1 },
          animate: { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 },
          exit: { clipPath: 'inset(100% 0% 0% 0%)', opacity: 1 },
          transition: { duration: durationSec, ease },
        };

      case 'zoom-in':
        return {
          initial: { scale: 0.8, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 1.15, opacity: 0 },
          transition: { duration: durationSec, ease },
        };

      case 'zoom-out':
        return {
          initial: { scale: 1.2, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.85, opacity: 0 },
          transition: { duration: durationSec, ease },
        };

      case 'split-horizontal':
        return {
          initial: { clipPath: 'polygon(0% 50%, 100% 50%, 100% 50%, 0% 50%)', opacity: 0.8 },
          animate: { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: durationSec, ease },
        };

      case 'split-vertical':
        return {
          initial: { clipPath: 'polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)', opacity: 0.8 },
          animate: { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: durationSec, ease },
        };

      case 'dissolve':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: durationSec, ease },
        };

      case 'flip-left':
        return {
          initial: { rotateY: isForward ? 90 : -90, opacity: 0 },
          animate: { rotateY: 0, opacity: 1 },
          exit: { rotateY: isForward ? -90 : 90, opacity: 0 },
          transition: { duration: durationSec, ease },
        };

      case 'flip-right':
        return {
          initial: { rotateY: isForward ? -90 : 90, opacity: 0 },
          animate: { rotateY: 0, opacity: 1 },
          exit: { rotateY: isForward ? 90 : -90, opacity: 0 },
          transition: { duration: durationSec, ease },
        };

      case 'cube-left':
        return {
          initial: { rotateY: isForward ? 45 : -45, x: isForward ? '60%' : '-60%', opacity: 0.5 },
          animate: { rotateY: 0, x: '0%', opacity: 1 },
          exit: { rotateY: isForward ? -45 : 45, x: isForward ? '-60%' : '60%', opacity: 0.5 },
          transition: { duration: durationSec, ease },
        };

      case 'cube-right':
        return {
          initial: { rotateY: isForward ? -45 : 45, x: isForward ? '-60%' : '60%', opacity: 0.5 },
          animate: { rotateY: 0, x: '0%', opacity: 1 },
          exit: { rotateY: isForward ? 45 : -45, x: isForward ? '60%' : '-60%', opacity: 0.5 },
          transition: { duration: durationSec, ease },
        };

      case 'gallery':
        return {
          initial: { scale: 0.9, x: isForward ? '80%' : '-80%', opacity: 0.4 },
          animate: { scale: 1, x: '0%', opacity: 1 },
          exit: { scale: 0.9, x: isForward ? '-80%' : '80%', opacity: 0.4 },
          transition: { duration: durationSec, ease },
        };

      case 'morph':
        return {
          initial: { scale: 0.96, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 1.04, opacity: 0 },
          transition: { duration: durationSec, ease: [0.16, 1, 0.3, 1] },
        };

      case 'fade-through-black':
        return {
          initial: { opacity: 0, scale: 0.98 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 1.02 },
          transition: { duration: durationSec, ease },
        };

      case 'smooth-fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: durationSec, ease: [0.25, 0.1, 0.25, 1] },
        };

      case 'fade':
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: durationSec, ease },
        };
    }
  }

  /**
   * Returns a friendly display name for a transition type
   */
  public static getTransitionLabel(type: SlideTransitionType): string {
    switch (type) {
      case 'none': return 'None';
      case 'cut': return 'Cut';
      case 'fade': return 'Fade';
      case 'fade-through-black': return 'Fade Through Black';
      case 'smooth-fade': return 'Smooth Fade';
      case 'push-left': return 'Push Left';
      case 'push-right': return 'Push Right';
      case 'push-up': return 'Push Up';
      case 'push-down': return 'Push Down';
      case 'wipe-left': return 'Wipe Left';
      case 'wipe-right': return 'Wipe Right';
      case 'wipe-up': return 'Wipe Up';
      case 'wipe-down': return 'Wipe Down';
      case 'zoom-in': return 'Zoom In';
      case 'zoom-out': return 'Zoom Out';
      case 'split-horizontal': return 'Split Horizontal';
      case 'split-vertical': return 'Split Vertical';
      case 'dissolve': return 'Dissolve';
      case 'flip-left': return 'Flip Left';
      case 'flip-right': return 'Flip Right';
      case 'cube-left': return 'Cube Left';
      case 'cube-right': return 'Cube Right';
      case 'gallery': return 'Gallery';
      case 'morph': return 'Morph';
      default: return 'Fade';
    }
  }

  private static mapEasing(easing?: string): any {
    switch (easing) {
      case 'linear': return 'linear';
      case 'ease-in': return 'easeIn';
      case 'ease-out': return 'easeOut';
      case 'ease-in-out':
      default:
        return [0.4, 0, 0.2, 1]; // Smooth cubic bezier
    }
  }
}
