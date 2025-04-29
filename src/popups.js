// --------- File: src/popups.js ---------
import mapboxgl from 'mapbox-gl';

/**
 * Helper function to parse country list
 * @param {string} countryString Semicolon-separated countries list
 * @returns {string[]} Array of country names
 */
export function parseCountryList(countryString) {
  if (!countryString) return [];
  return countryString.split(';').map(c => c.trim()).filter(c => c);
}

/**
 * Helper function to parse category list
 * @param {string} categoryString Semicolon-separated category list
 * @returns {string[]} Array of category names
 */
export function parseCategoryList(categoryString) {
  if (!categoryString) return [];
  return categoryString.split(';').map(c => c.trim()).filter(c => c);
}

/**
 * Get the most appropriate icon ID for a feature with multiple categories
 * @param {Object} props Feature properties
 * @returns {string} Icon ID to use
 */
export function getIconIdForFeature(props) {
  const categoryString = props.Diplomacy_category;
  if (!categoryString) return 'default';
  
  // Parse categories
  const categories = parseCategoryList(categoryString);
  
  // Priority order - this matches the order in your provided list
  const priorityCategories = [
    { name: 'Arms control', id: 'icon-arms-control' },
    { name: 'Cultural Diplomacy (Defence)', id: 'icon-cultural-diplomacy' },
    { name: 'Cultural Diplomacy', id: 'icon-cultural-diplomacy' },
    { name: 'Defence Cooperation', id: 'icon-defence-cooperation' },
    { name: 'Defence Infrastructure', id: 'icon-defence-infrastructure' },
    { name: 'HADR – Disaster Response', id: 'icon-hadr' },
    { name: 'HADR - Disaster Response', id: 'icon-hadr' },
    { name: 'Maritime Security', id: 'icon-maritime-security' },
    { name: 'Military Exercises', id: 'icon-military-exercises' },
    { name: 'Military Medical Diplomacy', id: 'icon-military-medical' },
    { name: 'MIL-POL Engagement', id: 'icon-milpol' },
    { name: 'MIL - POL Engagement', id: 'icon-milpol' },
    { name: 'MIL POL Engagement', id: 'icon-milpol' },
    { name: 'Public Diplomacy', id: 'icon-public-diplomacy' },
    { name: 'Sports Diplomacy (Defence)', id: 'icon-sports-diplomacy' },
    { name: 'Sports Diplomacy', id: 'icon-sports-diplomacy' },
    { name: 'Training', id: 'icon-training' },
    { name: 'Visit Diplomacy (Defence)', id: 'icon-visit-diplomacy' },
    { name: 'Visit Diplomacy', id: 'icon-visit-diplomacy' },
    { name: 'Griffith', id: 'icon-griffith' }
  ];
  
  // First, try to find an exact match in priority order
  for (const priorityCat of priorityCategories) {
    if (categories.includes(priorityCat.name)) {
      return priorityCat.id;
    }
  }
  
  // If no exact match, try to find partial matches
  for (const category of categories) {
    // Check for partial matches for each category
    if (category.includes('Arms')) return 'icon-arms-control';
    if (category.includes('Cultural')) return 'icon-cultural-diplomacy';
    if (category.includes('Defence Coop')) return 'icon-defence-cooperation';
    if (category.includes('Infrastructure')) return 'icon-defence-infrastructure';
    if (category.includes('HADR') || category.includes('Disaster')) return 'icon-hadr';
    if (category.includes('Maritime')) return 'icon-maritime-security';
    if (category.includes('Exercise')) return 'icon-military-exercises';
    if (category.includes('Medical')) return 'icon-military-medical';
    if (category.includes('MIL-POL') || category.includes('MIL POL') || category.includes('MIL - POL')) 
      return 'icon-milpol';
    if (category.includes('Public')) return 'icon-public-diplomacy';
    if (category.includes('Sports')) return 'icon-sports-diplomacy';
    if (category.includes('Training')) return 'icon-training';
    if (category.includes('Visit')) return 'icon-visit-diplomacy';
    if (category.includes('Griffith')) return 'icon-griffith';
  }
  
  // Default icon if no matches
  return 'default';
}

/**
 * Format category label for display, handling multiple categories
 * @param {string} categoryString Semicolon-separated category list
 * @returns {string} Formatted category display string
 */
export function formatCategoryLabel(categoryString) {
  if (!categoryString) return 'Unknown Category';
  
  const categories = parseCategoryList(categoryString);
  if (categories.length === 1) {
    return categories[0];
  } else {
    // Create a multi-category display format
    return categories.join(' / ');
  }
}

/**
 * Create HTML content for popups with improved styling, centered text and source link
 * @param {Object} props Feature properties
 * @returns {HTMLElement} Popup DOM content
 */
export function createPopupHTML(props) {
  const popupContent = document.createElement('div');
  popupContent.className = 'popup-container';

  // Heading with category - Updated to handle multiple categories
  const headingEl = document.createElement('h2');
  headingEl.textContent = formatCategoryLabel(props.Diplomacy_category) || 'Unknown Category';
  headingEl.style.fontSize = '13px';
  headingEl.style.margin = '0 0 3px 0';
  headingEl.style.padding = '0 0 3px 0';
  headingEl.style.borderBottom = '1px solid #eee';
  headingEl.style.textAlign = 'center';
  headingEl.style.fontWeight = 'bold';
  headingEl.style.color = '#e51f30';
  popupContent.appendChild(headingEl);

  // Description (full text for taller popups)
  if (props.Comments) {
    const descEl = document.createElement('p');
    // Allow more text to fill taller popup
    let commentText = props.Comments;
    if (commentText.length > 250) {
      commentText = commentText.substring(0, 247) + '...';
    }
    descEl.textContent = commentText;
    descEl.style.fontSize = '11px';
    descEl.style.margin = '3px 0';
    descEl.style.padding = '0 0 3px 0';
    descEl.style.borderBottom = '1px solid #eee';
    descEl.style.textAlign = 'center'; // CENTERED text
    descEl.style.lineHeight = '1.3';
    descEl.style.flex = '1';
    descEl.style.overflowY = 'auto';
    descEl.style.maxHeight = '150px';
    popupContent.appendChild(descEl);
  }

  // Create a compact grid for metadata
  const metadataGrid = document.createElement('div');
  metadataGrid.style.display = 'grid';
  metadataGrid.style.gridTemplateColumns = '1fr';
  metadataGrid.style.fontSize = '10px';
  metadataGrid.style.gap = '2px';
  metadataGrid.style.padding = '3px 0';
  metadataGrid.style.marginTop = 'auto'; // Push to bottom of container
  metadataGrid.style.textAlign = 'center'; // Center all grid text

  // From country - Updated to handle multiple countries
  const fromDiv = document.createElement('div');
  fromDiv.style.textAlign = 'center'; // Ensure center alignment
  const fromLabel = document.createElement('strong');
  fromLabel.textContent = 'From: ';
  fromDiv.appendChild(fromLabel);
  
  // Format the country list nicely for display
  const countries = parseCountryList(props.Delivering_Country);
  const countryText = countries.length > 0 
    ? countries.join(', ') 
    : 'Unknown';
  
  fromDiv.appendChild(document.createTextNode(countryText));
  metadataGrid.appendChild(fromDiv);

  // To country
  const toDiv = document.createElement('div');
  toDiv.style.textAlign = 'center'; // Ensure center alignment
  const toLabel = document.createElement('strong');
  toLabel.textContent = 'To: ';
  toDiv.appendChild(toLabel);
  
  // Also handle multi-country receiving list
  const receivingCountries = parseCountryList(props.Receiving_Countries);
  const receivingText = receivingCountries.length > 0 
    ? receivingCountries.join(', ') 
    : 'Unknown';
    
  toDiv.appendChild(document.createTextNode(receivingText));
  metadataGrid.appendChild(toDiv);

  // Year
  if (props.Year) {
    const yearDiv = document.createElement('div');
    yearDiv.style.textAlign = 'center'; // Ensure center alignment
    const yearLabel = document.createElement('strong');
    yearLabel.textContent = 'Year: ';
    yearDiv.appendChild(yearLabel);
    yearDiv.appendChild(document.createTextNode(props.Year));
    metadataGrid.appendChild(yearDiv);
  }

  popupContent.appendChild(metadataGrid);

  // Source button (if available)
  if (props.Source) {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.textAlign = 'center';
    buttonContainer.style.marginTop = '8px';
    
    const sourceButton = document.createElement('button');
    sourceButton.textContent = 'Source';
    sourceButton.style.backgroundColor = '#e51f30';
    sourceButton.style.color = 'white';
    sourceButton.style.border = 'none';
    sourceButton.style.borderRadius = '4px';
    sourceButton.style.padding = '3px 6px';
    sourceButton.style.fontSize = '10px';
    sourceButton.style.fontWeight = 'bold';
    sourceButton.style.cursor = 'pointer';
    sourceButton.style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
    sourceButton.style.width = '100%';
    sourceButton.style.textAlign = 'center'; // Ensure center alignment
    
    sourceButton.onclick = (e) => {
      e.stopPropagation(); // Prevent popup from closing when clicking the button
      window.open(props.Source, '_blank');
    };
    
    buttonContainer.appendChild(sourceButton);
    popupContent.appendChild(buttonContainer);
  }

  // Style the entire container - UPDATED FOR TALLER, NARROWER APPEARANCE with CENTERED TEXT & FULL OPACITY
  popupContent.style.maxWidth = '150px';  // REDUCED from 180px
  popupContent.style.minHeight = '200px'; // ADDED for taller appearance
  popupContent.style.padding = '8px';
  popupContent.style.display = 'flex';
  popupContent.style.flexDirection = 'column';
  popupContent.style.backgroundColor = 'rgb(255, 255, 255)'; // UPDATED: Full opacity
  popupContent.style.backdropFilter = 'blur(5px)';
  popupContent.style.borderRadius = '4px';
  popupContent.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
  popupContent.style.border = '1px solid rgba(0, 0, 0, 0.1)';
  popupContent.style.textAlign = 'center'; // CENTERED all text content

  return popupContent;
}

/**
 * Format the source URL to display a cleaner name
 * @param {string} source Source URL
 * @returns {string} Formatted source name
 */
function formatSourceName(source) {
  if (!source) return '';
  
  try {
    // If it's a URL, extract domain name
    if (source.startsWith('http')) {
      const url = new URL(source);
      return url.hostname.replace('www.', '');
    }
    
    // Otherwise just return the source as is
    return source;
  } catch (e) {
    return source; // If URL parsing fails, return original
  }
}

/**
 * Show a popup for a given GeoJSON feature.
 * @param {mapboxgl.Map} map
 * @param {Object} feature
 * @returns {mapboxgl.Popup} The created popup
 */
export function showFeaturePopup(map, feature) {
  // Remove any existing popups first
  const existingPopups = document.querySelectorAll('.mapboxgl-popup');
  existingPopups.forEach(popup => popup.remove());
  
  const coords = feature.geometry.coordinates;
  const popupContent = createPopupHTML(feature.properties);
  
  const popup = new mapboxgl.Popup({
    offset: [0, -40], // DOUBLED from -20 to raise popup higher
    anchor: 'bottom',
    closeButton: true,
    closeOnClick: false, // CHANGED to false to prevent propagation
    className: 'feature-popup'
  })
  .setLngLat(coords)
  .setDOMContent(popupContent)
  .addTo(map);
  
  return popup;
}

/**
 * Register popups and cursor interactions
 * @param {mapboxgl.Map} map
 */
export function registerPopups(map) {
  // Handle clicks on unclustered points
  map.on('click', 'unclustered-point', (e) => {
    e.originalEvent.stopPropagation(); // Prevent the event from bubbling up
    showFeaturePopup(map, e.features[0]);
  });
  
  // Change cursor to pointer when hovering over points
  map.on('mouseenter', 'unclustered-point', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  
  // Reset cursor when leaving points
  map.on('mouseleave', 'unclustered-point', () => {
    map.getCanvas().style.cursor = '';
  });
  
  // Global delegate event handler for country flags
  document.addEventListener('click', (e) => {
    // Handle clicks on regular marker flags
    if (e.target.classList.contains('marker-flag')) {
      e.stopPropagation(); // Prevent the click from propagating
      
      // Find the marker element
      const markerElement = e.target.closest('.custom-marker');
      if (markerElement && markerElement.featureData) {
        // Remove any existing popups
        const existingPopups = document.querySelectorAll('.mapboxgl-popup');
        existingPopups.forEach(popup => popup.remove());
        
        // Show popup for this feature
        const feature = markerElement.featureData;
        showFeaturePopup(map, feature);
      }
    }
    
    // Handle clicks on spiderfied flags
    if (e.target.classList.contains('spider-flag')) {
      e.stopPropagation(); // Prevent the click from propagating
      
      // Find the spider leg container
      const pinElement = e.target.closest('.spider-leg-pin-container');
      if (pinElement && pinElement.spiderLeg) {
        // Remove any existing popups
        const existingPopups = document.querySelectorAll('.mapboxgl-popup');
        existingPopups.forEach(popup => popup.remove());
        
        // Get the feature data
        const feature = pinElement.spiderLeg.feature;
        if (feature) {
          // Calculate the position for the popup
          const pinRect = pinElement.getBoundingClientRect();
          const mapContainer = map.getContainer();
          const mapRect = mapContainer.getBoundingClientRect();
          const point = new mapboxgl.Point(
            pinRect.left + (pinRect.width / 2) - mapRect.left,
            pinRect.top - mapRect.top
          );
          
          const lngLat = map.unproject(point);
          
          // Create and show popup
          const popupContent = createPopupHTML(feature.properties);
          new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: false, // CHANGED to false to prevent propagation
            anchor: 'bottom',
            offset: [0, -40], // INCREASED from -15 to -40 for higher positioning
            className: 'feature-popup'
          })
          .setLngLat(lngLat)
          .setDOMContent(popupContent)
          .addTo(map);
        }
      }
    }
  });
  
  // Enhance hover behavior for all markers and flags
  document.addEventListener('mouseenter', (e) => {
    if (e.target.classList.contains('custom-marker') || 
        e.target.classList.contains('marker-flag') ||
        e.target.classList.contains('spider-flag')) {
      
      // Increase z-index to ensure this element is on top
      e.target.style.zIndex = '20';
    }
  }, true);
  
  document.addEventListener('mouseleave', (e) => {
    if (e.target.classList.contains('custom-marker')) {
      // Reset z-index
      e.target.style.zIndex = '5';
    } else if (e.target.classList.contains('marker-flag') || 
               e.target.classList.contains('spider-flag')) {
      // Reset z-index for flags
      e.target.style.zIndex = '';
    }
  }, true);
}