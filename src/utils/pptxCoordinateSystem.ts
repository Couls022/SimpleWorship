/**
 * Presentation Coordinate System & EMU Geometry Engine
 * 
 * Centralized, canonical coordinate conversion from OpenXML EMUs (English Metric Units)
 * to Logical Presentation Viewport (1920x1080 canonical logical units) and output device targets.
 * 
 * Standard PPTX specs:
 * 1 inch = 914,400 EMUs
 * 1 point = 12,700 EMUs
 * 1 pixel at 96 DPI = 9,525 EMUs
 */

export interface EmuBounds {
  offX: number;
  offY: number;
  extCx: number;
  extCy: number;
  rotationDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export interface LogicalBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipH?: boolean;
  flipV?: boolean;
}

export interface GroupTransformContext {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
}

export class PresentationCoordinateSystem {
  readonly slideWidthEmu: number;
  readonly slideHeightEmu: number;
  readonly baseWidth: number;
  readonly baseHeight: number;

  constructor(slideWidthEmu = 12192000, slideHeightEmu = 6858000, baseWidth = 1920, baseHeight = 1080) {
    this.slideWidthEmu = slideWidthEmu > 0 ? slideWidthEmu : 12192000;
    this.slideHeightEmu = slideHeightEmu > 0 ? slideHeightEmu : 6858000;
    this.baseWidth = baseWidth;
    this.baseHeight = baseHeight;
  }

  /**
   * Convert EMU coordinates directly to logical 1920x1080 presentation canvas space.
   */
  toLogicalBounds(emu: EmuBounds, groupCtx?: GroupTransformContext): LogicalBounds {
    let effectiveOffX = emu.offX;
    let effectiveOffY = emu.offY;
    let effectiveExtCx = emu.extCx;
    let effectiveExtCy = emu.extCy;
    let effectiveRot = emu.rotationDeg || 0;

    if (groupCtx) {
      effectiveOffX = groupCtx.offsetX + (emu.offX * groupCtx.scaleX);
      effectiveOffY = groupCtx.offsetY + (emu.offY * groupCtx.scaleY);
      effectiveExtCx = emu.extCx * groupCtx.scaleX;
      effectiveExtCy = emu.extCy * groupCtx.scaleY;
      effectiveRot = (effectiveRot + groupCtx.rotationDeg) % 360;
    }

    const x = Math.round((effectiveOffX / this.slideWidthEmu) * this.baseWidth);
    const y = Math.round((effectiveOffY / this.slideHeightEmu) * this.baseHeight);
    const width = Math.max(1, Math.round((effectiveExtCx / this.slideWidthEmu) * this.baseWidth));
    const height = Math.max(1, Math.round((effectiveExtCy / this.slideHeightEmu) * this.baseHeight));

    return {
      x,
      y,
      width,
      height,
      rotation: effectiveRot,
      flipH: emu.flipH,
      flipV: emu.flipV
    };
  }

  /**
   * Compute child transformation matrix inside a group shape (p:grpSp).
   */
  computeGroupTransform(
    grpOffX: number,
    grpOffY: number,
    grpExtCx: number,
    grpExtCy: number,
    chOffX: number,
    chOffY: number,
    chExtCx: number,
    chExtCy: number,
    parentCtx?: GroupTransformContext
  ): GroupTransformContext {
    const rawScaleX = chExtCx > 0 ? (grpExtCx / chExtCx) : 1;
    const rawScaleY = chExtCy > 0 ? (grpExtCy / chExtCy) : 1;

    const rawOffX = grpOffX - (chOffX * rawScaleX);
    const rawOffY = grpOffY - (chOffY * rawScaleY);

    if (!parentCtx) {
      return {
        offsetX: rawOffX,
        offsetY: rawOffY,
        scaleX: rawScaleX,
        scaleY: rawScaleY,
        rotationDeg: 0,
      };
    }

    return {
      offsetX: parentCtx.offsetX + (rawOffX * parentCtx.scaleX),
      offsetY: parentCtx.offsetY + (rawOffY * parentCtx.scaleY),
      scaleX: parentCtx.scaleX * rawScaleX,
      scaleY: parentCtx.scaleY * rawScaleY,
      rotationDeg: parentCtx.rotationDeg,
    };
  }
}
