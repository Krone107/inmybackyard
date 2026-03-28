/* ============================================================
   NEIGHBOURHOOD EXPLORER — map.js

   SECTION A  Your data — the only part you normally edit
   SECTION B  Map logic — leave this as-is

   QUICK REFERENCE
   ───────────────────────────────────────────────────────────
   API key          → A1 below
   Add a location   → A2, copy and paste a LOCATIONS block
   Add a place      → A2, add a line to the places[] array
   Rename a category→ A3, change the label field
   Add a category   → A3, add a new line; also add colour
                       rules to styles.css section 2
   Change map style → A4 (or use Cloud Console Map ID)
   ============================================================ */


/* ============================================================
   SECTION A — YOUR DATA
   ============================================================ */


/* ── A1. API Key ──────────────────────────────────────────────
   Paste your Google Maps API key below.
   Get one at: console.cloud.google.com → Credentials
   ──────────────────────────────────────────────────────────── */

const API_KEY = 'AIzaSyDceIdNgTVhCezG-BwEFypqhS7oHPM1Xso';


/* ── A2. Locations ────────────────────────────────────────────
   Each block is one MRT station and its list of places.

   Location fields:
     id       unique text ID, no spaces (used internally)
     name     shown in the dropdown menu
     code     MRT code shown on the hub marker, e.g. EW17
     lat/lng  coordinates of the MRT station
     zoom     map zoom level (16 = neighbourhood scale)
     kmlFile  optional — path to a KML file to auto-load,
              e.g. 'kml/ang-mo-kio.kml'
              Remove this line if you have no KML for this location.

   Place fields (one line per place inside places:[]):
     id       unique number — never reuse
     name     shown in the popup title
     cat      must match a key in CATEGORIES (section A3)
     lat/lng  coordinates — right-click any spot in Google Maps to copy
     desc     one or two sentences for the popup
     hours    opening hours for the popup
     rating   star rating shown in the popup, e.g. 4.5
   ──────────────────────────────────────────────────────────── */

const LOCATIONS = [
   {
    id: 'ang-mo-kio', name: 'Ang Mo Kio',
    lat: 1.36990, lng: 103.84950, zoom: 15,
    center: { lat: 1.375961353068184, lng: 103.84662835139028},
    kmlFile: 'kml/AMK V4.kml',
    stations: [
      { name: 'Ang Mo Kio',  code: 'NS16', color: '#D42E12', lat: 1.36990, lng: 103.84950 },
      { name: 'Yio Chu Kang', code: 'NS15', color: '#D42E12', lat: 1.38183, lng: 103.84492 },
      { name: 'Mayflower', code: 'TE6', color: '#9D5B25', lat: 1.37264, lng: 103.83702 },
    ],
    places: [
      
    ],
  },
];


/* ── A3. Categories ───────────────────────────────────────────
   Defines the place types used in the cat field above.

   label   shown in popups and filter pills
   color   hex colour used for connection lines on the map
           (marker and pill colours are set in styles.css section 2)

   TO ADD A CATEGORY:
   1. Add a new line here, e.g:  sports: { label:'Sports', color:'#E76F51' },
   2. Add matching colour rules to styles.css section 2
   3. Use the key in the cat field of any place
   ──────────────────────────────────────────────────────────── */

const CATEGORIES = {
  food:      { label: 'Food',      color: '#ff6528' },
  retail:    { label: 'Play',    color: '#ff67b6' },
  nature:    { label: 'Parks',    color: '#56e116' },
  culture:   { label: 'Landmarks',    color: '#6B3FA0' },
  health:    { label: 'Fitness', color: '#fde52d' },
  community: { label: 'Community',         color: '#1A6EA8' },
  imported:  { label: 'Imported',          color: '#555555' },
};



/* ============================================================
   SECTION B — MAP LOGIC
   You don't need to edit anything below this line.
   ============================================================ */

let gMap            = null;
let openInfoWindow  = null;
let activeConnLine  = null;  // connection line shown when a KML marker is clicked
let activeConnLabel = null; // distance label shown at midpoint of connection line
let activeMarker    = null; // the marker whose popup is currently open (for toggle-close)
let directionsRenderer = null; // Google Directions renderer
let currentLocation = null;
let poiMarkers      = {};
let connectionLines = {};
let radiusOverlays  = [];

LOCATIONS.forEach(loc => { loc.kmlLayers = []; });

const KML_PALETTE      = ['#2E86AB','#E84855','#3BB273','#F18F01','#9B5DE5','#F15BB5','#06A77D','#845EC2'];
const kmlPaletteIndex  = {};
LOCATIONS.forEach(loc => { kmlPaletteIndex[loc.id] = 0; });

const KML_CATEGORY_MAP = {
  food: 'food', retail: 'retail', shops: 'retail', play: 'retail',
  nature: 'nature', parks: 'nature', garden: 'nature',
  fitness: 'health', health: 'health', wellness: 'health',
  culture: 'culture', arts: 'culture', landmarks: 'culture',
  community: 'community', mrt: 'community',
};


// Load the Google Maps script
(function () {
  const s   = document.createElement('script');
  s.src     = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=marker,directions&callback=initMap`;
  s.async   = true;
  s.onerror = () => {
    document.getElementById('map').innerHTML =
      '<p style="padding:40px;color:#D94F3D;font-family:sans-serif;">⚠ Could not load Google Maps. Check your API key in Section A1.</p>';
  };
  document.head.appendChild(s);
})();


// Google Maps calls this automatically once the script loads
window.initMap = function () {
  currentLocation = LOCATIONS[0];

  gMap = new google.maps.Map(document.getElementById('map'), {
    center:           currentLocation.center,
    zoom:             currentLocation.zoom,
    minZoom:          15,
    maxZoom:          18,
    mapId:           'b4002d6617857cb7f777d3ee',  // ← replace with mapId: 'YOUR_MAP_ID' to use Cloud styling
    disableDefaultUI: true,
    zoomControl:      true,
    zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
    gestureHandling:  'greedy',
    clickableIcons:   false,
  });

  buildDropdown();
  renderLocation(currentLocation);
  renderKmlPills(currentLocation);

  // Directions renderer — draws the route on the map
  directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers:    true,
    polylineOptions:    { strokeColor: '#1a1a1a', strokeWeight: 2, strokeOpacity: 0.8 },
  });
  directionsRenderer.setMap(gMap);

  // Apply panning restriction for the initial location
  applyRestriction(currentLocation);
};


// Fill the location dropdown and handle switching
function buildDropdown() {
  const sel = document.getElementById('location-select');
  LOCATIONS.forEach(loc => {
    const opt       = document.createElement('option');
    opt.value       = loc.id;
    opt.textContent = loc.name;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => {
    const loc = LOCATIONS.find(l => l.id === sel.value);
    if (loc) switchLocation(loc);
  });
}


// Switch to a new location
function switchLocation(newLoc) {
  if (openInfoWindow) { openInfoWindow.close(); openInfoWindow = null; }

  // Remove built-in markers and lines
  Object.values(poiMarkers).forEach(({ marker }) => { marker.map = null; });
  poiMarkers = {};
  Object.values(connectionLines).forEach(l => l.setMap(null));
  connectionLines = {};
  radiusOverlays.forEach(o => o.setMap(null));
  radiusOverlays = [];

  // Hide KML markers from old location and clear any active connection line
  clearActiveConnLine();
  if (currentLocation) {
    currentLocation.kmlLayers.forEach(layer => {
      layer.markers.forEach(({ marker }) => { marker.map = null; });
      (layer.polys || []).forEach(p => p.setMap(null));
    });
  }

  currentLocation = newLoc;
  gMap.panTo({ lat: newLoc.center.lat, lng: newLoc.center.lng });
  gMap.setZoom(newLoc.zoom);

  // Clear any active directions route
  if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });

  applyRestriction(newLoc);

  renderLocation(newLoc);

  // Restore KML markers for new location
  newLoc.kmlLayers.forEach(layer => {
    layer.markers.forEach(({ marker, el }) => {
      marker.map             = gMap;
      el.style.opacity       = layer.visible ? '1' : '0';
      el.style.pointerEvents = layer.visible ? 'auto' : 'none';
    });
    (layer.polys || []).forEach(p => p.setMap(layer.visible ? gMap : null));
  });

  renderKmlPills(newLoc);
  document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
}


function renderLocation(loc) {
  loc.stations.forEach(station => {
    drawMRTMarker(station);
  });
  
  if (loc.kmlFile && loc.kmlLayers.length === 0) loadKmlFile(loc);
}


// Restrict panning to a padded bounding box around the location's center.
// Uses loc.bounds if defined, otherwise auto-derives a ~1 km box.
// Add a `bounds` field to any LOCATION entry to set a custom box:
//   bounds: { north: 1.395, south: 1.355, east: 103.870, west: 103.825 }
function applyRestriction(loc) {
  let nb;
  if (loc.bounds) {
    nb = loc.bounds;
  } else {
    // ~0.009 deg ≈ 1 km at Singapore latitudes — roughly 2 km total padding
    const pad = 0.025;
    nb = {
      north: loc.center.lat + pad,
      south: loc.center.lat - pad,
      east:  loc.center.lng + pad,
      west:  loc.center.lng - pad,
    };
  }
  gMap.setOptions({
    restriction: {
      latLngBounds: nb,
      strictBounds: false,  // allows slight overpan for UX, snaps back on release
    },
  });
}


// MRT hub marker
// If no color is set on a station, falls back to var(--text) via CSS.
function drawMRTMarker(loc) {
  const color  = loc.color || '';   // loc.color set per-station in LOCATIONS data
  const el     = document.createElement('div');
  el.innerHTML = `<div class="mrt-marker"${color ? ` style="--station-color: ${color};"` : ''}>
                    <div class="mrt-dot"></div>
                    <div class="mrt-label">${loc.name}</div>
                  </div>`;
  new google.maps.marker.AdvancedMarkerElement({ map: gMap, position: { lat: loc.lat, lng: loc.lng }, content: el, zIndex: 1000 });
}


// Auto-load KML file linked to a location
async function loadKmlFile(loc) {
  try {
    const res = await fetch(loc.kmlFile);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid KML');

    let layers    = [];
    const folders = Array.from(doc.querySelectorAll('Folder'));
    if (folders.length > 0) {
      folders.forEach(f => {
        const name           = getKmlName(f);
        const { places, lines } = extractFeatures(f);
        if (places.length || lines.length) layers.push({ name, places, lines });
      });
    } else {
      const { places, lines } = extractFeatures(doc);
      if (places.length || lines.length) layers.push({ name: getKmlName(doc.querySelector('Document')) || loc.name, places, lines });
    }

    const isActive = loc.id === currentLocation?.id;
    layers.forEach(layer => {
      const catKey        = KML_CATEGORY_MAP[layer.name.toLowerCase()] || 'imported';
      const color         = CATEGORIES[catKey]?.color || KML_PALETTE[kmlPaletteIndex[loc.id]++ % KML_PALETTE.length];
      // visible: false — markers are hidden on load, user turns them on via pills
      const { markers, polys } = renderKmlLayer(layer, loc, color, catKey, false);
      loc.kmlLayers.push({ name: layer.name, color, catKey, markers, polys, visible: false });
    });

    if (isActive) { renderKmlPills(loc); }
  } catch (err) {
    console.warn('KML load failed for', loc.name + ':', err.message);
  }
}


// Returns the nearest station in loc.stations to a given lat/lng point.
// Falls back to loc itself (lat/lng) for single-station locations.
function nearestStation(loc, placeLat, placeLng) {
  const hubs = loc.stations || [{ lat: loc.lat, lng: loc.lng }];
  return hubs.reduce((best, hub) => {
    const d    = Math.hypot(placeLat - hub.lat, placeLng - hub.lng);
    const dBest = Math.hypot(placeLat - best.lat, placeLng - best.lng);
    return d < dBest ? hub : best;
  });
}


// Clears any active connection line drawn on marker click
function clearActiveConnLine() {
  if (activeConnLine) {
    activeConnLine.setMap(null);
    activeConnLine = null;
  }
  if (activeConnLabel) {
    activeConnLabel.map = null;
    activeConnLabel = null;
  }
}

// Clears the directions route from the map
function clearDirections() {
  if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
}

// Calculates the straight-line distance in metres between two lat/lng points
// using the Haversine formula (accounts for Earth's curvature)
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R   = 6371000;  // Earth radius in metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLam = (lng2 - lng1) * Math.PI / 180;
  const a   = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}


// Create markers and KML polylines for one KML layer.
// Connection lines are NOT drawn here — they are drawn on marker click.
function renderKmlLayer(layer, loc, color, catKey, isActive) {
  const cat     = CATEGORIES[catKey];
  const markers = [];
  const polys   = [];

  // Point markers — hidden by default, shown when pill is toggled on
  (layer.places || []).forEach(place => {

    // Skip places with missing coordinates
    if (!place.lat || !place.lng) return;

    const hub     = nearestStation(loc, place.lat, place.lng);
    const distM   = haversineMetres(place.lat, place.lng, hub.lat, hub.lng);
    const distStr = distM < 1000
      ? `${distM}m`
      : `${(distM / 1000).toFixed(1)}km`;

    const el     = document.createElement('div');
    el.innerHTML = `<div class="marker-wrap"><div class="marker-dot" data-cat="${catKey}"></div></div>`;

    const popupId = `popup-${place.name.replace(/\W/g,'-')}-${Math.random().toString(36).slice(2,7)}`;

    const hubAbove  = hub.lat > place.lat;
    const yOffset   = hubAbove ? 185 : 0;
    const popup  = new google.maps.InfoWindow({
      disableAutoPan: false,
      pixelOffset:    new google.maps.Size(0, yOffset),
      content: `<div class="popup-card">
        <div class="popup-name">${place.name}</div>
        <div class="popup-cat" data-cat="${catKey}">${cat ? cat.label : 'Imported'}</div>
        ${place.desc ? `<p class="popup-desc">${place.desc}</p>` : ''}
        <div class="popup-footer">
          <span class="popup-directions-btn" onclick="requestDirections(${hub.lat},${hub.lng},${place.lat},${place.lng},'${place.name.replace(/'/g,"\\'")}','${(hub.name||'MRT').replace(/'/g,"\\'")}',${distM})">Directions</span>
        </div>
      </div>`,
    });

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map:      null,
      position: { lat: place.lat, lng: place.lng },
      content:  el,
      zIndex:   80,
    });

    marker.addListener('click', () => {
      // Toggle-close: clicking the same marker again closes the popup
      if (openInfoWindow === popup) {
        popup.close();
        openInfoWindow = null;
        activeMarker   = null;
        clearActiveConnLine();
        clearDirections();
        return;
      }

      // Close any previously open popup and line
      if (openInfoWindow) openInfoWindow.close();
      clearActiveConnLine();

      activeMarker   = marker;
      openInfoWindow = popup;
      popup.open({ map: gMap, anchor: marker });

      // Draw connection line from marker to nearest station
      activeConnLine = new google.maps.Polyline({
        map:           gMap,
        path:          [{ lat: hub.lat, lng: hub.lng }, { lat: place.lat, lng: place.lng }],
        strokeColor:   '#1A1A1A',
        strokeOpacity: 1,
        strokeWeight:  2,
        clickable:     false,
        zIndex:        60,
      });

      // Place distance label at midpoint, rotated parallel to the line
      const midLat = (hub.lat + place.lat) / 2;
      const midLng = (hub.lng + place.lng) / 2;

      // Project both endpoints to pixel space to compute screen angle
      const proj    = gMap.getProjection();
      const scale   = Math.pow(2, gMap.getZoom());
      const toPixel = latLng => {
        const p = proj.fromLatLngToPoint(new google.maps.LatLng(latLng.lat, latLng.lng));
        return { x: p.x * scale, y: p.y * scale };
      };
      const pHub   = toPixel({ lat: hub.lat,   lng: hub.lng   });
      const pPlace = toPixel({ lat: place.lat, lng: place.lng });
      // atan2 gives angle in radians; screen-y is inverted vs math so negate dy
      let angleDeg = Math.atan2(pHub.y - pPlace.y, pHub.x - pPlace.x) * (180 / Math.PI);
      // Keep text readable — never upside-down
      if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

      const labelEl = document.createElement('div');
      labelEl.textContent = `${distM}m`;
      // translateY(-10px) lifts the label just above the line
      labelEl.style.cssText = [
        'padding:2px 6px',
        'font-size:11px',
        'font-weight:600',
        'color:#1A1A1A',
        'white-space:nowrap',
        'pointer-events:none',
        `transform:rotate(${angleDeg}deg) translateY(20px)`,
        'transform-origin:center center',
      ].join(';');
      activeConnLabel = new google.maps.marker.AdvancedMarkerElement({
        map:      gMap,
        position: { lat: midLat, lng: midLng },
        content:  labelEl,
        zIndex:   65,
      });

      // Zoom map to fit both the marker and its nearest station
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: place.lat, lng: place.lng });
      bounds.extend({ lat: hub.lat,   lng: hub.lng   });
      gMap.fitBounds(bounds, { top: 80, right: 40, bottom: 40, left: 40 });
    });

    // Clear line, directions and activeMarker when popup is closed (X or programmatic)
    popup.addListener('closeclick', () => {
      clearActiveConnLine();
      clearDirections();
      openInfoWindow = null;
      activeMarker   = null;
    });

    markers.push({ marker, el, iw: popup });
  });

  // KML polylines (routes drawn in My Maps)
  (layer.lines || []).forEach(line => {
    const poly = new google.maps.Polyline({
      map: isActive ? gMap : null, path: line.path,
      strokeColor: color, strokeOpacity: 0.85, strokeWeight: 3, zIndex: 70,
    });
    poly.addListener('click', e => {
      if (openInfoWindow) openInfoWindow.close();
      clearActiveConnLine();
      const iw = new google.maps.InfoWindow({
        position: e.latLng,
        content: `<div class="popup-card"><div class="popup-name">${line.name}</div><div class="popup-cat" data-cat="${catKey}">${cat ? cat.label : 'Imported'}</div>${line.desc ? `<p class="popup-desc">${line.desc}</p>` : ''}</div>`,
      });
      iw.open(gMap);
      openInfoWindow = iw;
    });
    polys.push(poly);
  });

  return { markers, polys };
}


// KML category filter pills — toggling driven purely by CSS classes
function renderKmlPills(loc) {
  document.querySelectorAll('.kml-pill').forEach(p => p.remove());
  if (!loc) return;
  const container = document.getElementById('cat-pills');
  loc.kmlLayers.forEach(layer => {
    const pill      = document.createElement('button');
    pill.className  = `cat-pill kml-pill${layer.visible ? ' active' : ''}`;
    pill.dataset.cat = layer.catKey;
    pill.innerHTML  = `<span class="pill-label">${layer.name}</span>`;

    pill.addEventListener('click', () => {
      // Dismiss the "Start exploring" prompt on first pill interaction
      document.getElementById('cat-pills').closest('[data-pills-wrap]')?.setAttribute('data-explored', '');
      layer.visible = !layer.visible;
      pill.classList.toggle('active', layer.visible);
      // If hiding the layer, also close any open popup and clear active line
      if (!layer.visible) {
        clearActiveConnLine();
        layer.markers.forEach(({ iw }) => {
          if (openInfoWindow === iw) { iw.close(); openInfoWindow = null; }
        });
      }
      layer.markers.forEach(({ marker, el }) => {
        marker.map             = layer.visible ? gMap : null;
        el.style.opacity       = layer.visible ? '1' : '0';
        el.style.pointerEvents = layer.visible ? 'auto' : 'none';
      });
      (layer.polys || []).forEach(p => p.setMap(layer.visible ? gMap : null));
    });
    container.appendChild(pill);
  });
}


// KML parsing helpers
function getKmlName(el) {
  if (!el) return '';
  return el.querySelector(':scope > name')?.textContent?.trim() ||
         el.querySelector(':scope > n')?.textContent?.trim() || '';
}

function extractFeatures(parent) {
  const places = [], lines = [];
  Array.from(parent.querySelectorAll('Placemark')).forEach(pm => {
    const name  = pm.querySelector('name')?.textContent?.trim() || pm.querySelector('n')?.textContent?.trim() || 'Unnamed';
    const rawDescHtml = pm.querySelector('description')?.textContent?.trim() || '';
    const rawDesc = stripHtml(rawDescHtml.replace(/<br\s*\/?>/gi, '\n'));
    const desc = rawDesc
      .split(/[\n\r]+/)
      .filter(line => {
        const l = line.trim();
        if (!l) return false;                    // blank lines
        if (/^coordinates:/i.test(l)) return false;  // "Coordinates: 1.37, 103.84" label only
        return true;
      })
      .join(' ')
      .trim();

    // Line
    const lineEl = pm.querySelector('LineString coordinates');
    if (lineEl) {
      const path = lineEl.textContent.trim().split(/\s+/).map(t => {
        const [lng, lat] = t.split(',').map(Number);
        return (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null;
      }).filter(Boolean);
      if (path.length >= 2) lines.push({ name, desc, path });
      return;
    }

    // Point — three fallback strategies
    const ptEl = pm.querySelector('Point coordinates');
    if (ptEl) {
      const [lng, lat] = ptEl.textContent.trim().split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) { places.push({ name, desc, lat, lng }); return; }
    }
    let extLat = null, extLng = null;
    pm.querySelectorAll('ExtendedData Data').forEach(d => {
      const k   = d.getAttribute('name')?.toLowerCase() || '';
      const raw = d.querySelector('value')?.textContent?.trim() || '';

      // Separate Latitude / Longitude fields
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        if (k === 'latitude')                        extLat = num;
        if (k === 'longitude' || k === 'longtitude') extLng = num;
      }

      // Combined "Coordinates" field: "lat, lng" — used when My Maps was given
      // a single coordinates column instead of separate lat/lng columns
      if (k === 'coordinates') {
        const parts = raw.split(',').map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          extLat = parts[0];
          extLng = parts[1];
        }
      }
    });
    if (extLat !== null && extLng !== null) { places.push({ name, desc, lat: extLat, lng: extLng }); return; }
    const addr  = pm.querySelector('address')?.textContent?.trim() || '';
    const match = addr.match(/^(-?\d+\.\d+)\s+(-?\d+\.\d+)$/);
    if (match) {
      const lat = parseFloat(match[1]), lng = parseFloat(match[2]);
      if (lat > 1.1 && lat < 1.5 && lng > 103.6 && lng < 104.1) places.push({ name, desc, lat, lng });
    }
  });
  return { places, lines };
}

// Called by the "Get directions" button inside a popup card.
// Routes on foot from the nearest MRT station to the destination marker.
// If directions are already rendered, clears them (toggle behaviour).
window.requestDirections = function(originLat, originLng, destLat, destLng, destName, stationName, distM) {
  const btn = document.querySelector('.popup-directions-btn');

  // Toggle off if directions are already shown — restore connection line
  if (directionsRenderer?.getDirections()?.routes?.length) {
    clearDirections();

    // Redraw the straight-line connection
    activeConnLine = new google.maps.Polyline({
      map:           gMap,
      path:          [{ lat: originLat, lng: originLng }, { lat: destLat, lng: destLng }],
      strokeColor:   '#1A1A1A',
      strokeOpacity: 0.6,
      strokeWeight:  2,
      clickable:     false,
      zIndex:        60,
    });

    // Redraw the distance label at the midpoint, rotated to match the line
    const midLat  = (originLat + destLat) / 2;
    const midLng  = (originLng + destLng) / 2;
    const proj    = gMap.getProjection();
    const scale   = Math.pow(2, gMap.getZoom());
    const toPixel = latLng => {
      const p = proj.fromLatLngToPoint(new google.maps.LatLng(latLng.lat, latLng.lng));
      return { x: p.x * scale, y: p.y * scale };
    };
    const pOrigin = toPixel({ lat: originLat, lng: originLng });
    const pDest   = toPixel({ lat: destLat,   lng: destLng   });
    let angleDeg  = Math.atan2(pOrigin.y - pDest.y, pOrigin.x - pDest.x) * (180 / Math.PI);
    if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

    const labelEl = document.createElement('div');
    labelEl.textContent = `${distM}m`;
    labelEl.style.cssText = [
      'padding:2px 6px',
      'font-size:11px',
      'font-weight:600',
      'color:#1A1A1A',
      'white-space:nowrap',
      'pointer-events:none',
      `transform:rotate(${angleDeg}deg) translateY(20px)`,
      'transform-origin:center center',
    ].join(';');
    activeConnLabel = new google.maps.marker.AdvancedMarkerElement({
      map:      gMap,
      position: { lat: midLat, lng: midLng },
      content:  labelEl,
      zIndex:   65,
    });

    if (btn) { btn.textContent = `Directions`; btn.disabled = false; }
    return;
  }

  // Clear the straight-line connection — the route replaces it
  clearActiveConnLine();

  if (btn) { btn.textContent = 'Loading…'; btn.disabled = true; }

  const svc = new google.maps.DirectionsService();
  svc.route(
    {
      origin:      { lat: originLat, lng: originLng },
      destination: { lat: destLat,   lng: destLng   },
      travelMode:  google.maps.TravelMode.WALKING,
    },
    (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);
        const leg = result.routes[0]?.legs[0];
        if (btn) {
          // btn.textContent = `${leg?.distance?.text} · ${leg?.duration?.text}`;
          btn.textContent = `Directions`;
          btn.disabled    = false;
        }
      } else {
        if (btn) { btn.textContent = 'Directions unavailable'; btn.disabled = false; }
        console.warn('Directions failed:', status);
      }
    }
  );
};


function stripHtml(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el.textContent || el.innerText || '';
}
