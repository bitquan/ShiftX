import L from 'leaflet';

export const driverCarIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 34px; height: 34px;
      border-radius: 999px;
      background: rgba(255,255,255,0.95);
      box-shadow: 0 6px 16px rgba(0,0,0,0.35);
      display:flex; align-items:center; justify-content:center;
      border: 2px solid rgba(0,0,0,0.15);
    ">
      <div style="font-size:18px; line-height:18px;">🚗</div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

export const pickupCircleIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 18px; height: 18px;
      border-radius: 999px;
      background: rgba(0,255,140,0.95);
      border: 3px solid rgba(0,0,0,0.25);
      box-shadow: 0 6px 16px rgba(0,0,0,0.25);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export const dropoffCircleIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 18px; height: 18px;
      border-radius: 999px;
      background: rgba(80,160,255,0.95);
      border: 3px solid rgba(0,0,0,0.25);
      box-shadow: 0 6px 16px rgba(0,0,0,0.25);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
