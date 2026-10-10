/**
 * SURAKSHA Interactive Safety Map - map.js
 * Powered by Leaflet.js and OpenStreetMap
 */

const MapController = {
  map: null,
  markersLayer: null,
  zonesLayer: null,
  resourcesLayer: null,
  currentFilter: 'all',
  incidentsData: [],
  userLocationMarker: null,

  init(mapContainerId = 'leaflet-map') {
    const container = document.getElementById(mapContainerId);
    if (!container) return;

    // Default coordinates: Meerut City Center (28.9845, 77.7064)
    this.map = L.map(mapContainerId, {
      zoomControl: true,
      maxZoom: 18,
      minZoom: 10
    }).setView([28.9845, 77.7064], 14);

    // Standard OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
    this.zonesLayer = L.layerGroup().addTo(this.map);
    this.resourcesLayer = L.layerGroup().addTo(this.map);

    this.initFilterEvents();
    this.initControls();
    this.loadMapData();

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 200);
  },

  initControls() {
    const locateBtn = document.getElementById('btn-locate-me');
    if (locateBtn) {
      locateBtn.addEventListener('click', () => this.locateUser());
    }

    const reportFloatBtn = document.getElementById('btn-float-report');
    if (reportFloatBtn) {
      reportFloatBtn.addEventListener('click', () => {
        window.location.href = '/report.html';
      });
    }
  },

  initFilterEvents() {
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filterCategory = pill.getAttribute('data-filter') || 'all';
        this.currentFilter = filterCategory;
        this.applyFilter();
      });
    });

    window.addEventListener('languageChanged', () => {
      this.applyFilter();
    });
  },

  async loadMapData() {
    try {
      // 1. Fetch Incidents
      this.incidentsData = await ApiClient.map.getIncidents();
      this.renderIncidentMarkers(this.incidentsData);

      // 2. Fetch Activity / Danger Zones
      const zones = await ApiClient.map.getZones();
      this.renderActivityZones(zones);

      // 3. Fetch Emergency Resources
      const resources = await ApiClient.map.getResources();
      this.renderResources(resources);
    } catch (err) {
      console.warn('[Map] Could not load telemetry:', err);
    }
  },

  getCategoryIcon(iconName) {
    switch (iconName) {
      case 'flame': return '🔥';
      case 'car-crash': return '🚗';
      case 'alert-triangle': return '⚠️';
      case 'heart-pulse': return '🏥';
      case 'user-search': return '🔎';
      case 'check-circle': return '✓';
      case 'alert-octagon': return '🚨';
      default: return '📍';
    }
  },

  getTranslatedCategory(category) {
    if (typeof I18n === 'undefined') return category;
    const catLower = (category || '').toLowerCase();
    if (catLower.includes('fire')) return I18n.t('categories.fire');
    if (catLower.includes('accident')) return I18n.t('categories.accident');
    if (catLower.includes('suspicious')) return I18n.t('categories.suspicious');
    if (catLower.includes('medical')) return I18n.t('categories.medical');
    if (catLower.includes('missing')) return I18n.t('categories.missing');
    if (catLower.includes('harass')) return I18n.t('categories.harassment');
    return category;
  },

  getTranslatedSeverity(severity) {
    if (typeof I18n === 'undefined') return severity;
    const sevLower = (severity || '').toLowerCase();
    if (sevLower === 'low') return I18n.t('severity.low');
    if (sevLower === 'moderate') return I18n.t('severity.moderate');
    if (sevLower === 'high') return I18n.t('severity.high');
    if (sevLower === 'critical') return I18n.t('severity.critical');
    return severity;
  },

  getTranslatedStatus(status) {
    if (typeof I18n === 'undefined') return status;
    const stLower = (status || '').toLowerCase();
    if (stLower.includes('pending')) return I18n.t('status.pending');
    if (stLower.includes('officer') || stLower.includes('investigat')) return I18n.t('status.investigating');
    if (stLower.includes('resolved')) return I18n.t('status.resolved');
    if (stLower.includes('flagged') || stLower.includes('reject')) return I18n.t('status.rejected');
    return status;
  },

  renderIncidentMarkers(incidents) {
    this.markersLayer.clearLayers();

    incidents.forEach(inc => {
      // Determine accessible icon & styling
      const iconSymbol = this.getCategoryIcon(inc.icon);
      const translatedCat = this.getTranslatedCategory(inc.category);
      const translatedSev = this.getTranslatedSeverity(inc.severity);
      const translatedSt = this.getTranslatedStatus(inc.status);
      const statusLabel = typeof I18n !== 'undefined' ? I18n.t('map.popup_status') : 'Status:';
      const trackLabel = typeof I18n !== 'undefined' ? I18n.t('map.popup_track') : 'Track Report →';

      const customIcon = L.divIcon({
        className: 'custom-pin-wrapper',
        html: `
          <div class="custom-pin" style="background-color: ${inc.color};" title="${translatedCat}: ${inc.title}">
            <span>${iconSymbol}</span>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([inc.latitude, inc.longitude], { icon: customIcon });

      const popupContent = `
        <div class="map-popup-card">
          <div class="map-popup-header">
            <span class="badge" style="background-color: ${inc.color}20; color: ${inc.color}; border: 1px solid ${inc.color}50;">
              ${iconSymbol} ${translatedCat}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: ${inc.severity === 'Critical' ? '#DC2626' : '#64748B'};">
              ${translatedSev}
            </span>
          </div>
          <div class="map-popup-title">${inc.title}</div>
          <div class="map-popup-address">📍 ${inc.address}</div>
          <p style="font-size: 12px; color: var(--navy-700); margin-bottom: 8px;">
            ${inc.description}
          </p>
          <div class="map-popup-footer">
            <span>${statusLabel} <strong>${translatedSt}</strong></span>
            <a href="/reports.html?ref=${inc.reference_id}" style="font-weight: 700;">${trackLabel}</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      this.markersLayer.addLayer(marker);
    });
  },

  renderActivityZones(zones) {
    this.zonesLayer.clearLayers();

    zones.forEach(zone => {
      // Draw gentle translucent circle with responsible phrasing
      const circle = L.circle([zone.latitude, zone.longitude], {
        color: '#DC2626',
        fillColor: '#EF4444',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '4, 4',
        radius: zone.radius_meters
      });

      const tooltipContent = `
        <div style="padding: 4px; font-size: 12px;">
          <strong>⚠️ ${zone.label}</strong><br>
          <span style="color: #64748B;">${zone.description}</span>
        </div>
      `;
      circle.bindTooltip(tooltipContent, { sticky: true });
      this.zonesLayer.addLayer(circle);
    });
  },

  renderResources(resources) {
    this.resourcesLayer.clearLayers();

    resources.forEach(res => {
      let icon = '🛡️';
      if (res.type.includes('Hospital')) icon = '🏥';
      if (res.type.includes('Fire')) icon = '🚒';

      const resIcon = L.divIcon({
        className: 'resource-pin-wrapper',
        html: `
          <div style="background-color: #0F172A; color: white; border-radius: 6px; padding: 4px 6px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px; border: 1px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap;">
            <span>${icon}</span>
            <span>${res.name.split(' ')[0]}</span>
          </div>
        `,
        iconAnchor: [30, 15]
      });

      const marker = L.marker([res.latitude, res.longitude], { icon: resIcon });
      marker.bindPopup(`
        <div style="font-size: 13px;">
          <strong>${res.name}</strong><br>
          <span style="color: #64748B;">${res.type}</span><br>
          📞 Phone: <a href="tel:${res.contact}"><strong>${res.contact}</strong></a>
        </div>
      `);
      this.resourcesLayer.addLayer(marker);
    });
  },

  applyFilter() {
    let filtered = this.incidentsData;
    if (this.currentFilter === 'critical') {
      filtered = filtered.filter(i => i.severity === 'Critical');
    } else if (this.currentFilter === 'resolved') {
      filtered = filtered.filter(i => i.status === 'Resolved');
    } else if (this.currentFilter !== 'all') {
      filtered = filtered.filter(i => i.category.toLowerCase() === this.currentFilter.toLowerCase());
    }

    this.renderIncidentMarkers(filtered);
  },

  locateUser() {
    if (!navigator.geolocation) {
      App.showToast("Geolocation is not supported by your browser.", "warning");
      return;
    }

    App.showToast("Acquiring your location...", "info");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (this.userLocationMarker) {
          this.map.removeLayer(this.userLocationMarker);
        }

        const userPin = L.divIcon({
          className: 'user-location-pin',
          html: `
            <div style="width: 20px; height: 20px; background-color: #2563EB; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.35);"></div>
          `,
          iconAnchor: [10, 10]
        });

        this.userLocationMarker = L.marker([lat, lng], { icon: userPin }).addTo(this.map);
        this.userLocationMarker.bindPopup("<strong>You are here</strong>").openPopup();

        this.map.flyTo([lat, lng], 15, { duration: 1.5 });
        App.showToast("Centered on your current location.", "success");
      },
      (err) => {
        App.showToast("Unable to fetch your location. Using Meerut city sector.", "warning");
        this.map.flyTo([28.9845, 77.7064], 14);
      },
      { timeout: 5000 }
    );
  }
};

window.MapController = MapController;
