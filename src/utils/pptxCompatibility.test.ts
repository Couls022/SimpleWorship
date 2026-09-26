import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { PresentationCoordinateSystem } from './pptxCoordinateSystem';
import { deconflictAndDeduplicateSlideObjects, parsePptx } from './pptxParser';
import { SlideObject } from '../types';

describe('PPTX Presentation Engine Compatibility & Forensic Tests', () => {
  describe('PresentationCoordinateSystem', () => {
    it('accurately converts 16:9 1920x1080 standard OpenXML EMUs to logical screen pixels', () => {
      const coord = new PresentationCoordinateSystem(12192000, 6858000, 1920, 1080);

      const bounds = coord.toLogicalBounds({
        offX: 1219200, // 10% from left
        offY: 685800,  // 10% from top
        extCx: 9753600, // 80% width
        extCy: 5486400, // 80% height
        rotationDeg: 0
      });

      expect(bounds.x).toBe(192);
      expect(bounds.y).toBe(108);
      expect(bounds.width).toBe(1536);
      expect(bounds.height).toBe(864);
    });

    it('correctly computes nested group transforms (p:grpSp)', () => {
      const coord = new PresentationCoordinateSystem(12192000, 6858000, 1920, 1080);

      // Parent group located at (1000, 2000) with size (5000, 4000) and child bounds (0, 0, 5000, 4000)
      const groupCtx = coord.computeGroupTransform(
        1219200, 685800, 6096000, 3429000,
        0, 0, 6096000, 3429000
      );

      const childBounds = coord.toLogicalBounds({
        offX: 609600, // 10% inside the group
        offY: 342900,
        extCx: 3048000,
        extCy: 1714500,
      }, groupCtx);

      expect(childBounds.x).toBe(288); // 192 + 96
      expect(childBounds.y).toBe(162); // 108 + 54
      expect(childBounds.width).toBe(480);
      expect(childBounds.height).toBe(270);
    });
  });

  describe('Real OpenXML PPTX Fixture: "THE SAVING FAITH" Slide 12 Forensic Test', () => {
    it('correctly inherits layout/master placeholder geometry and guarantees vertical separation without overlap', async () => {
      const zip = new JSZip();

      // 1. presentation.xml (16:9 standard dimensions)
      zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`);

      // 2. Theme
      zip.file('ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Montserrat"/></a:majorFont>
      <a:minorFont><a:latin typeface="Inter"/></a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`);

      // 3. slideMaster1.xml
      zip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="1" name="Title Placeholder 1"/><p:cNvSpPr><p:ph type="title"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1143000" y="685800"/><a:ext cx="9906000" cy="1143000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr anchor="t"/><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Body Placeholder 2"/><p:cNvSpPr><p:ph type="body" idx="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1143000" y="2400300"/><a:ext cx="9906000" cy="3810000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr anchor="t"/><a:p><a:r><a:t>Body</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldMaster>`);

      // 4. slideLayout1.xml
      zip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="1" name="Title 1"/><p:cNvSpPr><p:ph type="title"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1143000" y="685800"/><a:ext cx="9906000" cy="1143000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr anchor="t"/><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Content 2"/><p:cNvSpPr><p:ph type="body" idx="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1143000" y="2400300"/><a:ext cx="9906000" cy="3810000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr anchor="t"/><a:p><a:r><a:t>Content</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`);

      zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

      // 5. slide1.xml (Slide 12: THE SAVING FAITH)
      zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><p:ph type="title"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr anchor="t"/>
          <a:p>
            <a:r>
              <a:rPr sz="4400" b="1"><a:solidFill><a:srgbClr val="F59E0B"/></a:solidFill></a:rPr>
              <a:t>TRUTH:</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content Placeholder 2"/><p:cNvSpPr><p:ph idx="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr anchor="t"/>
          <a:p>
            <a:r>
              <a:rPr sz="3200"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
              <a:t>New birth conversion is not a long process; it is a supernatural life-changing one-time event.</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`);

      zip.file('ppt/slides/_rels/slide1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);

      const pptxBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      const parsedSlides = await parsePptx(pptxBuffer);

      expect(parsedSlides.length).toBe(1);
      const slide = parsedSlides[0];
      const objects = slide.objects || [];

      expect(objects.length).toBe(2);

      const titleObj = objects.find(o => o.text === 'TRUTH:');
      const bodyObj = objects.find(o => o.text?.startsWith('New birth conversion'));

      expect(titleObj).toBeDefined();
      expect(bodyObj).toBeDefined();

      // Shape Geometry Assertions:
      // Title: x=180, y=108, width=1560, height=180
      // Body: x=180, y=378, width=1560, height=600
      expect(titleObj!.y).toBeLessThan(bodyObj!.y);
      expect(bodyObj!.y).toBeGreaterThanOrEqual(titleObj!.y + titleObj!.height);

      // Text Vertical Alignment Assertion:
      expect(titleObj!.style?.alignVertical).toBe('top');
      expect(bodyObj!.style?.alignVertical).toBe('top');

      // Text Content Box Assertions:
      const titleTextTop = titleObj!.y + (titleObj!.style?.paddingTop ?? 8);
      const titleEstimatedBottom = titleTextTop + (titleObj!.style?.fontSize || 44) * 1.2;
      const bodyTextTop = bodyObj!.y + (bodyObj!.style?.paddingTop ?? 8);

      // Strict non-collision check:
      expect(bodyTextTop).toBeGreaterThan(titleEstimatedBottom);
    });
  });

  describe('Screenshot Regression: "THE SAVING FAITH" / "TRUTH:" Layout Protection', () => {
    it('preserves authentic distinct coordinates for Title and Body text boxes without artificial mutation', () => {
      const originalObjects: SlideObject[] = [
        {
          id: 'shape-header-1',
          type: 'text',
          x: 180,
          y: 220,
          width: 800,
          height: 120,
          text: 'TRUTH:',
          style: {
            fontFamily: 'Montserrat, sans-serif',
            fontSize: 44,
            fontWeight: 'bold',
            fontColor: '#F59E0B',
            alignVertical: 'top'
          }
        },
        {
          id: 'shape-body-2',
          type: 'text',
          x: 180,
          y: 380,
          width: 1400,
          height: 480,
          text: 'New birth conversion is not a long process; it is a supernatural life-changing one-time event.',
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: 32,
            fontWeight: 'normal',
            fontColor: '#FFFFFF',
            alignVertical: 'top'
          }
        }
      ];

      const processed = deconflictAndDeduplicateSlideObjects(originalObjects);

      expect(processed.length).toBe(2);
      
      const titleObj = processed.find(o => o.text === 'TRUTH:');
      const bodyObj = processed.find(o => o.text?.startsWith('New birth conversion'));

      expect(titleObj).toBeDefined();
      expect(bodyObj).toBeDefined();

      // Ensure exact author coordinates are faithfully kept without arbitrary relocation
      expect(titleObj!.x).toBe(180);
      expect(titleObj!.y).toBe(220);
      expect(bodyObj!.x).toBe(180);
      expect(bodyObj!.y).toBe(380);

      // Verify no vertical collision between Title and Body
      expect(bodyObj!.y).toBeGreaterThanOrEqual(titleObj!.y + titleObj!.height);
    });

    it('safely filters out zero-delta duplicate clones without affecting distinct layout objects', () => {
      const duplicatedObjects: SlideObject[] = [
        {
          id: 'shape-1',
          type: 'text',
          x: 200,
          y: 200,
          width: 500,
          height: 100,
          text: 'CANVA HEADER',
          style: { fontSize: 40, fontColor: '#FFFFFF' }
        },
        {
          id: 'shape-1-clone',
          type: 'text',
          x: 201,
          y: 201,
          width: 500,
          height: 100,
          text: 'CANVA HEADER',
          style: { fontSize: 40, fontColor: '#FFFFFF' }
        },
        {
          id: 'shape-body',
          type: 'text',
          x: 200,
          y: 350,
          width: 1200,
          height: 400,
          text: 'Distinct body paragraph content',
          style: { fontSize: 28, fontColor: '#E2E8F0' }
        }
      ];

      const cleaned = deconflictAndDeduplicateSlideObjects(duplicatedObjects);
      expect(cleaned.length).toBe(2);
      expect(cleaned.map(o => o.text)).toEqual(['CANVA HEADER', 'Distinct body paragraph content']);
    });
  });
});

