/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CameraMetadata } from '../types';

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
}

class CameraManager {
  private static instance: CameraManager;
  private currentPreviewStream: MediaStream | null = null;
  private deviceCache: CameraDeviceInfo[] = [];
  
  private constructor() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = () => {
        this.enumerateCameras().catch(console.error);
      };
    }
  }

  public static getInstance(): CameraManager {
    if (!CameraManager.instance) {
      CameraManager.instance = new CameraManager();
    }
    return CameraManager.instance;
  }

  public async enumerateCameras(): Promise<CameraDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.deviceCache = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera (${device.deviceId.slice(0, 5)}...)`,
          kind: device.kind
        }));
      return this.deviceCache;
    } catch (err) {
      console.error('Failed to enumerate cameras', err);
      return [];
    }
  }

  public async getPreviewStream(deviceId: string): Promise<MediaStream | null> {
    this.stopPreviewStream();
    
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return null;

    try {
      this.currentPreviewStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false // No audio to prevent feedback loop
      });
      return this.currentPreviewStream;
    } catch (err) {
      console.error('Failed to get preview stream', err);
      throw err;
    }
  }

  public stopPreviewStream() {
    if (this.currentPreviewStream) {
      this.currentPreviewStream.getTracks().forEach(track => track.stop());
      this.currentPreviewStream = null;
    }
  }

  // Live projectors call getUserMedia independently directly, using the same constraint.
  public async getLiveStream(deviceId: string): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error("navigator.mediaDevices is not available");
    }
    return navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });
  }
}

export const cameraManager = CameraManager.getInstance();
