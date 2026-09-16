import fs from 'fs';
let content = fs.readFileSync('src/core/CameraManager.ts', 'utf8');

content = content.replace(
  'navigator.mediaDevices.ondevicechange = () => {',
  'navigator.mediaDevices.addEventListener("devicechange", () => {'
);
content = content.replace(
  'this.enumerateCameras().catch(console.error);\n      };',
  'this.enumerateCameras().catch(console.error);\n      });'
);

content = content.replace(
  'public async enumerateCameras(): Promise<CameraDeviceInfo[]> {',
  `public async requestCameraPermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.warn('Camera permission denied or unavailable:', err);
      return false;
    }
  }

  public async enumerateCameras(): Promise<CameraDeviceInfo[]> {`
);

content = content.replace(
  'const devices = await navigator.mediaDevices.enumerateDevices();',
  `let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter(device => device.kind === 'videoinput');

      // If we have video devices but no labels, we need to request permission
      if (videoDevices.length > 0 && videoDevices.some(d => !d.label)) {
        const granted = await this.requestCameraPermission();
        if (granted) {
          devices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = devices.filter(device => device.kind === 'videoinput');
        }
      }`
);

content = content.replace(
  `.filter(device => device.kind === 'videoinput')
        .map(device => ({`,
  `videoDevices = devices.filter(device => device.kind === 'videoinput');
      this.deviceCache = videoDevices.map(device => ({`
);

fs.writeFileSync('src/core/CameraManager.ts', content);
