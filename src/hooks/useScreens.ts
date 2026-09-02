import { useState, useEffect } from 'react';

export function useScreens() {
  const [screens, setScreens] = useState<any[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if ('getScreenDetails' in window) {
      navigator.permissions.query({ name: 'window-management' as PermissionName })
        .then((result) => {
          if (result.state === 'granted') {
            setPermissionGranted(true);
            fetchScreens();
          }
        })
        .catch(console.error);
    }
  }, []);

  const fetchScreens = async () => {
    try {
      const screenDetails = await (window as any).getScreenDetails();
      setScreens(screenDetails.screens);
      screenDetails.addEventListener('screenschange', () => {
        setScreens(screenDetails.screens);
      });
    } catch (e) {
      console.error(e);
    }
  };

  const requestAccess = async () => {
    if (!('getScreenDetails' in window)) {
      alert('Your browser does not support the Multi-Screen Window Placement API.');
      return false;
    }
    try {
      await fetchScreens();
      setPermissionGranted(true);
      return true;
    } catch (err) {
      console.error('Failed to get screen details:', err);
      alert('Permission to access screen details was denied.');
      return false;
    }
  };

  return { screens, permissionGranted, requestAccess };
}
