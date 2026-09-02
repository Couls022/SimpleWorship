import JSZip from 'jszip';

export interface ParsedSlide {
  title: string;
  text: string;
}

/**
 * Parses a pure XML PPTX file inside the browser.
 * Extracts slide text content sequentially.
 * 
 * LIMITATIONS KNOWN & DOCUMENTED:
 * - This is a pure-text heuristic extractor.
 * - Does not preserve slide dimensions, shapes, raster images, or exact spatial layout.
 * - Fonts, colors, and animations are stripped.
 * - Renders into standard SimpleWorship presentation models (Slide[]).
 */
export async function parsePptxOffline(file: File | Blob): Promise<ParsedSlide[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  // Find all slide files in the PPTX archive
  const slideFiles = Object.keys(loadedZip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  
  // Sort them numerically so Slide 2 comes before Slide 10
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
    const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
    return numA - numB;
  });

  const slides: ParsedSlide[] = [];
  const parser = new DOMParser();

  for (const fileName of slideFiles) {
    const xmlString = await loadedZip.files[fileName].async('text');
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // In DrawingML (PPTX), text is stored in <a:t> elements
    const textNodes = xmlDoc.getElementsByTagName('a:t');
    let textContent = '';
    for (let i = 0; i < textNodes.length; i++) {
      textContent += textNodes[i].textContent + '\n';
    }
    
    // Simple heuristic: group paragraphs, first logical grouping is title
    const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length > 0) {
      slides.push({
        title: lines[0],
        text: lines.slice(1).join('\n')
      });
    } else {
      slides.push({
        title: `Slide ${slides.length + 1}`,
        text: ''
      });
    }
  }
  return slides;
}
