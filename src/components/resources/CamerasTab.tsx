/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Camera, RefreshCw, Play, MonitorUp } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cameraManager, CameraDeviceInfo } from '../../core/CameraManager';
import { PresentationItem } from '../../types';
import CameraLiveRenderer from '../CameraLiveRenderer';
import { v4 as uuidv4 } from 'uuid';

export default function CamerasTab() {
  const store = useStore();
  const { availableCameras, setAvailableCameras, goLiveItem, activeControlGroupId, setPreviewItem, addScheduleItem } = store;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const refreshCameras = async () => {
    setIsRefreshing(true);
    try {
      const devices = await cameraManager.enumerateCameras();
      setAvailableCameras(devices);
    } catch (err) {
      console.error('Error refreshing cameras', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshCameras();
  }, []);

  const handleDragStart = (e: React.DragEvent, camera: CameraDeviceInfo) => {
    const item: Partial<PresentationItem> = {
      type: 'camera',
      contentId: camera.deviceId,
      name: camera.label,
      data: {
        deviceId: camera.deviceId,
        deviceLabel: camera.label
      }
    };
    const payload = {
      source: 'cameras',
      item: item
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const fireLive = (camera: CameraDeviceInfo) => {
    const item: PresentationItem = {
      id: uuidv4(),
      type: 'camera',
      contentId: camera.deviceId,
      name: camera.label,
      data: {
        deviceId: camera.deviceId,
        deviceLabel: camera.label
      }
    };
    setPreviewItem(item.id, 0);
    goLiveItem(item.id, 0, activeControlGroupId || undefined, item);
  };

  return (
    <div className="h-full flex flex-col bg-[#141519] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar flex flex-col">
        {availableCameras.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-xs flex flex-col items-center justify-center p-6 border border-[#2b2f3d] bg-[#171922]/80 rounded-xl shadow-md">
              <div className="w-12 h-12 rounded-xl bg-pink-950/40 border border-pink-500/30 flex items-center justify-center mb-3 text-pink-400 shadow-inner">
                <Camera size={22} />
              </div>
              <h4 className="font-bold text-gray-200 text-xs mb-1">No Cameras Detected</h4>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
                Connect a USB webcam or start DroidCam to broadcast live video.
              </p>
              <button 
                onClick={refreshCameras}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#262b38] hover:bg-[#323746] text-gray-200 border border-[#3c4355] rounded-md text-xs font-semibold transition-all shadow cursor-pointer active:scale-95"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Scan for Cameras</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-end">
              <button
                onClick={refreshCameras}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-[#1c1e26] hover:bg-[#282b37] border border-[#2a2d39] transition-colors cursor-pointer shadow-xs"
                title="Refresh Camera List"
              >
                <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Rescan Cameras</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableCameras.map((cam: CameraDeviceInfo) => {
              const isPreviewing = activePreviewId === cam.deviceId;
              const isSelected = selectedCameraId === cam.deviceId;

              return (
                <div
                  key={cam.deviceId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, cam)}
                  onClick={() => setSelectedCameraId(cam.deviceId)}
                  onDoubleClick={() => fireLive(cam)}
                  className={`bg-[#1c1e26] border rounded overflow-hidden flex flex-col transition-all cursor-grab active:cursor-grabbing group ${
                    isSelected
                      ? 'border-pink-500 ring-2 ring-pink-500/40 shadow-md'
                      : 'border-[#2a2d39] hover:border-[#3c4252]'
                  }`}
                >
                  {/* Aspect Ratio Container for Camera Feed */}
                  <div className="w-full aspect-video bg-black relative">
                    {isPreviewing ? (
                      <CameraLiveRenderer deviceId={cam.deviceId} isLiveOutput={false} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Camera size={24} className="text-gray-600" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePreviewId(isPreviewing ? null : cam.deviceId);
                        }}
                        className="w-8 h-8 rounded-full bg-[#2a2d39] hover:bg-gray-600 flex items-center justify-center text-white"
                        title={isPreviewing ? "Stop Preview" : "Start Preview"}
                      >
                        {isPreviewing ? <RefreshCw size={14} /> : <Play size={14} className="ml-0.5" />}
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fireLive(cam);
                        }}
                        className="w-8 h-8 rounded-full bg-red-600/80 hover:bg-red-500 flex items-center justify-center text-white"
                        title="Send to Live"
                      >
                        <MonitorUp size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-2 flex flex-col gap-0.5 bg-[#181a20]">
                    <div className="text-xs text-gray-200 font-bold truncate" title={cam.label}>
                      {cam.label}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold tracking-wide">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981] animate-pulse" />
                      Status: Available
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
