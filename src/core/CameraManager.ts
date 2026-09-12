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
  
  private liveStreams: Map<string, { stream: MediaStream, count: number }> = new Map();
  
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
      if (typeof this.currentPreviewStream.getTracks === 'function') {
        this.currentPreviewStream.getTracks().forEach(track => track.stop());
      }
      this.currentPreviewStream = null;
    }
  }

  // Live projectors call getUserMedia. We cache by deviceId to prevent hardware locks if multiple canvases mount the same camera.
  public async getLiveStream(deviceId: string): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error("navigator.mediaDevices is not available");
    }

    const existing = this.liveStreams.get(deviceId);
    if (existing) {
      existing.count++;
      return existing.stream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });

    // When the stream ends, remove it
    if (stream && typeof stream.getVideoTracks === 'function') {
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          this.liveStreams.delete(deviceId);
        };
      });
    }

    this.liveStreams.set(deviceId, { stream, count: 1 });
    return stream;
  }

  // Release a live stream, stopping it if the count reaches zero
  public releaseLiveStream(deviceId: string) {
    const existing = this.liveStreams.get(deviceId);
    if (existing) {
      existing.count--;
      if (existing.count <= 0) {
        if (existing.stream && typeof existing.stream.getTracks === 'function') {
          existing.stream.getTracks().forEach(track => track.stop());
        }
        this.liveStreams.delete(deviceId);
      }
    }
  }
}

export const cameraManager = CameraManager.getInstance();
