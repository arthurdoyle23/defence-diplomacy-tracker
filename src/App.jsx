import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxglSpiderifier from 'mapboxgl-spiderifier';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';
import './SpiderifierStyles.css';
import { registerPopups, parseCategoryList, parseCountryList, createPopupHTML } from './popups';

// ========== CONFIGURATION ==========
// Icon configuration for different categories
const categoryIcons = {
  // Exact matches as specified in the configuration
  'Arms control':                  { id: 'icon-arms-control',            url: './icons/icon-arms-control.png' },
  'Cultural Diplomacy (Defence)':  { id: 'icon-cultural-diplomacy',      url: './icons/icon-cultural.png' },
  'Defence Cooperation':           { id: 'icon-defence-cooperation',     url: './icons/icon-defencecoop.png' },
  'Defence Infrastructure':        { id: 'icon-defence-infrastructure',  url: './icons/icon-infrastructure.png' },
  'HADR – Disaster Response':      { id: 'icon-hadr',                    url: './icons/icon-disaster.png' },
  'Maritime Security':             { id: 'icon-maritime-security',       url: './icons/icon-maritime.png' },
  'Military Exercises':            { id: 'icon-military-exercises',      url: './icons/icon-exercises.png' },
  'Military Medical Diplomacy':    { id: 'icon-military-medical',        url: './icons/icon-medical.png' },
  'MIL-POL Engagement':            { id: 'icon-milpol',                  url: './icons/icon-milpol.png' },
  'MIL - POL Engagement':          { id: 'icon-milpol',                  url: './icons/icon-milpol.png' },
  'Public Diplomacy':              { id: 'icon-public-diplomacy',        url: './icons/icon-public.png' },
  'Sports Diplomacy (Defence)':    { id: 'icon-sports-diplomacy',        url: './icons/icon-sports.png' },
  'Training':                      { id: 'icon-training',                url: './icons/icon-training.png' },
  'Visit Diplomacy (Defence)':     { id: 'icon-visit-diplomacy',         url: './icons/icon-visit.png' },
  'Griffith':                      { id: 'icon-griffith',                url: './icons/Griffith.png' },
  
  // Add common variations that might appear in the data
  'Cultural Diplomacy':            { id: 'icon-cultural-diplomacy',      url: './icons/icon-cultural.png' },
  'Sports Diplomacy':              { id: 'icon-sports-diplomacy',        url: './icons/icon-sports.png' },
  'Visit Diplomacy':               { id: 'icon-visit-diplomacy',         url: './icons/icon-visit.png' },
  'Medical Diplomacy':             { id: 'icon-military-medical',        url: './icons/icon-medical.png' },
  'Disaster Response':             { id: 'icon-hadr',                    url: './icons/icon-disaster.png' },
  'HADR':                          { id: 'icon-hadr',                    url: './icons/icon-disaster.png' },
  'HADR - Disaster Response':      { id: 'icon-hadr',                    url: './icons/icon-disaster.png' },
  'MIL POL Engagement':            { id: 'icon-milpol',                  url: '/.icons/icon-milpol.png' }
};
const defaultIcon = { id: 'default', url: '/icons/default.png' };

// Map view parameters
const MAP_CONFIG = {
  CENTER: [163.7482, -12.7648],
  INITIAL_ZOOM: 3.5,
  INTERMEDIATE_ZOOM: 7.5,
  MIN_SPIDERIFY_ZOOM: 4.5,
  MAX_ZOOM: 15,
  MAX_SPIDERIFY_POINTS: 45, // Maximum points to spiderify before zooming in
  MAPBOX_TOKEN: 'pk.eyJ1IjoiYXJ0aHVyZG95bGUiLCJhIjoiY2xydjZ5eWtxMHBnZjJsbGVnem45bThkMSJ9.hdDK5cGCjnsrRacePPlabQ'
};


// Primary theme color
const PRIMARY_COLOR = '#e51f30';

export default function App() { 
  // ========== STATE AND REFS ==========
  const mapRef = useRef(null);
  const spiderifierRef = useRef(null);
  const mapContainerRef = useRef(null);
  const originalDataRef = useRef(null);
  const markersLayerRef = useRef([]);
  const lastClickedClusterRef = useRef(null);
  const [center, setCenter] = useState(MAP_CONFIG.CENTER);
  const [zoom, setZoom] = useState(MAP_CONFIG.INITIAL_ZOOM);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Filter states
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState({});
  const [selectedCountries, setSelectedCountries] = useState({});
  const [categoryList, setCategoryList] = useState([]);
  const [countryList, setCountryList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Year filter specific states
  const [yearRange, setYearRange] = useState([0, 3000]); // Default for filter popup
  const [availableYearRange, setAvailableYearRange] = useState([0, 3000]);
  const [selectedYear, setSelectedYear] = useState(null); // For year slider at map bottom
  const [showAllYears, setShowAllYears] = useState(true);
  const [availableYears, setAvailableYears] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [activeYear, setActiveYear] = useState(null);

  // Function to toggle sidebar
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Function to manually unspiderfy
  const unspiderfyManually = () => {
    if (spiderifierRef.current) {
      console.log("Manually unspiderfying");
      spiderifierRef.current.unspiderfy();
      lastClickedClusterRef.current = null;
    }
  };

  // Function to fetch and process the data
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/data/mock-nyc-points.geojson');
      const data = await response.json();
      
      // Store the original data
      originalDataRef.current = data;
      
      // Pre-process data to add simple category for icon display
      // This doesn't affect filtering - only icon display
      if (data.features && data.features.length > 0) {
        data.features.forEach(feature => {
          if (feature.properties.Diplomacy_category) {
            // Get the first category from the semicolon separated list for icon display
            const categories = feature.properties.Diplomacy_category.split(';');
            feature.properties.primaryCategory = categories[0].trim();
          }
        });
      }
      
      // Extract features for list view
      const features = data.features || [];
      setAllData(features);
      setFilteredData(features);
      
      // Extract unique categories, countries, and years
      const categories = new Set();
      const countries = new Set();
      const years = [];
      const uniqueYears = new Set();
      
      features.forEach(feature => {
        const categoryString = feature.properties.Diplomacy_category;
        const countryString = feature.properties.Delivering_Country;
        const year = feature.properties.Year;
        
        // Handle semicolon-separated category lists
        if (categoryString) {
          const categoryList = parseCategoryList(categoryString);
          categoryList.forEach(category => {
            if (category) categories.add(category);
          });
        }
        
        // Handle semicolon-separated country lists
        if (countryString) {
          const countryList = parseCountryList(countryString);
          countryList.forEach(country => {
            if (country) countries.add(country);
          });
        }
        
        if (year && !isNaN(parseInt(year))) {
          const numYear = parseInt(year, 10);
          years.push(numYear);
          uniqueYears.add(numYear);
        }
      });
      
      // Determine year range
      const minYear = years.length ? Math.min(...years) : 0;
      const maxYear = years.length ? Math.max(...years) : 3000;
      setAvailableYearRange([minYear, maxYear]);
      setYearRange([minYear, maxYear]);
      
      // Set available years for the bottom slider (sorted)
      const sortedYears = Array.from(uniqueYears).sort((a, b) => a - b);
      setAvailableYears(sortedYears);
      setActiveYear(sortedYears[0] || null);
      
      // Convert sets to sorted arrays
      const categoriesArray = Array.from(categories).sort();
      const countriesArray = Array.from(countries).sort();
      
      // Initialize all checkboxes as selected
      const initialCategoryState = {};
      const initialCountryState = {};
      
      categoriesArray.forEach(cat => {
        initialCategoryState[cat] = true;
      });
      
      countriesArray.forEach(country => {
        initialCountryState[country] = true;
      });
      
      setCategoryList(categoriesArray);
      setCountryList(countriesArray);
      setSelectedCategories(initialCategoryState);
      setSelectedCountries(initialCountryState);
      setIsDataLoaded(true);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  // Apply filters to the data
  const applyFilters = useCallback(() => {
    if (!originalDataRef.current) return;
    
    // Copy original data
    const newData = {
      type: 'FeatureCollection',
      features: []
    };
    
    // Filter features based on selected categories, countries, and searchQuery
    let filteredFeatures = originalDataRef.current.features.filter(feature => {
      const categoryString = feature.properties.Diplomacy_category;
      const countryString = feature.properties.Delivering_Country;
      
      // For categories, check if ANY of the categories match the filter
      let categoryMatch = true;
      if (categoryString) {
        const categories = parseCategoryList(categoryString);
        categoryMatch = categories.some(category => selectedCategories[category]);
      }
      
      // For countries, check if ANY of the delivering countries match the filter
      let countryMatch = true;
      if (countryString) {
        const countries = parseCountryList(countryString);
        countryMatch = countries.some(country => selectedCountries[country]);
      }
      
      // Search query filter
      let searchMatch = true;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const props = feature.properties;
        searchMatch = 
          (props.Diplomacy_category && props.Diplomacy_category.toLowerCase().includes(query)) ||
          (props.Delivering_Country && props.Delivering_Country.toLowerCase().includes(query)) ||
          (props.Receiving_Countries && props.Receiving_Countries.toLowerCase().includes(query)) ||
          (props.Comments && props.Comments.toLowerCase().includes(query)) ||
          (props.Year && props.Year.toString().includes(query));
      }
      
      return categoryMatch && countryMatch && searchMatch;
    });
    
    // Apply year filtering (from the bottom slider) if not showing all years
    if (!showAllYears && selectedYear !== null) {
      filteredFeatures = filteredFeatures.filter(feature => {
        const featureYear = feature.properties.Year ? parseInt(feature.properties.Year, 10) : null;
        return featureYear === selectedYear;
      });
    }
    
    // Update the filtered list for the sidebar
    setFilteredData(filteredFeatures);
    
    // Add filtered features to new data object
    newData.features = filteredFeatures;
    
    // Update the map source if map exists
    if (mapRef.current) {
      const source = mapRef.current.getSource('markers');
      if (source) {
        source.setData(newData);
      }
      
      // Unspiderfy when filters change
      if (spiderifierRef.current) {
        spiderifierRef.current.unspiderfy();
        lastClickedClusterRef.current = null;
      }
    }
  }, [selectedCategories, selectedCountries, searchQuery, selectedYear, showAllYears]);

  // Handle category filter change
  const handleCategoryChange = (category, checked) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: checked
    }));
  };

  // Handle country filter change
  const handleCountryChange = (country, checked) => {
    setSelectedCountries(prev => ({
      ...prev,
      [country]: checked
    }));
  };

  // Handle search query change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Select/Deselect all categories
  const handleSelectAllCategories = (select) => {
    const newState = {};
    categoryList.forEach(cat => {
      newState[cat] = select;
    });
    setSelectedCategories(newState);
  };

  // Select/Deselect all countries
  const handleSelectAllCountries = (select) => {
    const newState = {};
    countryList.forEach(country => {
      newState[country] = select;
    });
    setSelectedCountries(newState);
  };

  // Toggle filter popup
  const toggleFilterPopup = () => {
    setShowFilterPopup(!showFilterPopup);
  };

  // Toggle statistics panel
  const toggleStats = () => {
    setShowStats(!showStats);
  };

  // Toggle showing all years vs specific year
  const toggleAllYears = () => {
    setShowAllYears(!showAllYears);
    if (showAllYears) {
      // If switching from all years to specific year, select the first available
      setSelectedYear(availableYears.length > 0 ? activeYear || availableYears[0] : null);
    } else {
      // If switching to all years, clear the selection
      setSelectedYear(null);
    }
  };

  // Set the selected year and ensure all years mode is off
  const handleYearChange = (e) => {
    const year = parseInt(e.target.value, 10);
    setSelectedYear(year);
    setActiveYear(year);
    setShowAllYears(false); // Automatically uncheck the box when slider is moved
  };

  // Handle click on a list item to fly to its location
  const handleListItemClick = (feature) => {
    if (mapRef.current) {
      const coordinates = feature.geometry.coordinates.slice();
      
      // Unspiderfy first
      if (spiderifierRef.current) {
        spiderifierRef.current.unspiderfy();
        lastClickedClusterRef.current = null;
      }
      
      // Fly to the location
      mapRef.current.flyTo({
        center: coordinates,
        zoom: 10,
        speed: 1.2
      });
      
      // Show popup after a short delay to ensure map has moved
      setTimeout(() => {
        const popup = new mapboxgl.Popup({
          offset: [0, -40],
          anchor: 'bottom',
          closeButton: true,
          closeOnClick: false,
          className: 'feature-popup'
        })
        .setLngLat(coordinates)
        .setDOMContent(createPopupHTML(feature.properties))
        .addTo(mapRef.current);
      }, 1000);
    }
  };

  // Apply filters whenever selected filters change
  useEffect(() => {
    if (isDataLoaded) {
      applyFilters();
      
      // Count active filters (excluding year filter which is now at bottom)
      let count = 0;
      
      // Count unchecked categories
      Object.values(selectedCategories).forEach(isSelected => {
        if (!isSelected) count++;
      });
      
      // Count unchecked countries
      Object.values(selectedCountries).forEach(isSelected => {
        if (!isSelected) count++;
      });
      
      // Check search query
      if (searchQuery) count++;
      
      setActiveFilterCount(count);
    }
  }, [applyFilters, isDataLoaded, selectedCategories, selectedCountries, searchQuery, selectedYear, showAllYears]);

  useEffect(() => {
    // Fetch data when component mounts
    fetchData();
    
    // ========== MAP INITIALIZATION ==========
    mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

    const map = mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: MAP_CONFIG.CENTER,
      zoom: MAP_CONFIG.INITIAL_ZOOM,
      maxZoom: MAP_CONFIG.MAX_ZOOM
    });

    // Update state when map moves
    map.on('move', () => {
      const { lng, lat } = map.getCenter();
      setCenter([lng, lat]);
      setZoom(map.getZoom());
    });

    map.on('load', () => {
      // ========== LOADING INDICATOR ==========
      const loadingEl = createLoadingIndicator();
      mapContainerRef.current.appendChild(loadingEl);
      
      console.log("Map loaded - beginning icon loading process");
      
      // ========== ICON LOADING ==========
      loadAllIcons(map)
        .then(() => {
          // Remove loading indicator
          if (mapContainerRef.current?.contains(loadingEl)) {
            mapContainerRef.current.removeChild(loadingEl);
          }
          
          // ========== DATA SOURCE SETUP ==========
          addDataSource(map);
          
          // ========== LAYER SETUP ==========
          addClusterLayers(map);
          addUnclusteredPointLayer(map);
          
          // Debug log the layer information
          const layers = map.getStyle().layers;
          console.log("All map layers:", layers.map(l => l.id));
          
          // ========== VERIFY ICONS ==========
          const images = map.listImages();
          console.log("All loaded images:", images);
          
          // ========== EVENT HANDLERS ==========
          setupUnclusteredPointHandlers(map);
          
          // ========== SPIDERIFIER SETUP ==========
          const spiderifier = setupSpiderifier(map);
          spiderifierRef.current = spiderifier;
          
          // In case the icons still don't show, try forcing a re-render
          setTimeout(() => {
            console.log("Forcing map render refresh");
            map.triggerRepaint();
          }, 1000);
        })
        .catch(err => {
          console.error("Error loading icons:", err);
          if (mapContainerRef.current?.contains(loadingEl)) {
            mapContainerRef.current.removeChild(loadingEl);
          }
        });
    });

    return () => {
      // Clean up all mapbox resources
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [fetchData]);

  return (
    <>
      <div className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          {/* Logo space - UPDATED WITH ACTUAL LOGO */}
          <div className="logo-container">
            <img src="/icons/Griffith.png" alt="Griffith Logo" className="logo-image" />
          </div>
          <h2>Defence Diplomacy Tracker</h2>
          <div className="sidebar-actions">
            <button 
              className={`action-button ${activeFilterCount > 0 ? 'has-active-filters' : ''}`}
              onClick={toggleFilterPopup}
            >
              <span className="button-icon">🔍</span>
              Filters {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            </button>
            <button 
              className="action-button"
              onClick={toggleStats}
            >
              <span className="button-icon">📊</span>
              Stats
            </button>
          </div>
        </div>
        
        <div className="entries-list">
          <h3>Events ({filteredData.length})</h3>
          {filteredData.length === 0 ? (
            <p>No events match your filters.</p>
          ) : (
            filteredData.map((feature, index) => {
              // Format the category display (for multiple categories)
              const categoryText = feature.properties.Diplomacy_category ? 
                parseCategoryList(feature.properties.Diplomacy_category).join(' / ') : 
                'Unknown Category';
              
              // Format the countries display (for multiple countries)
              const deliveringPartners = feature.properties.Delivering_Country ?
                parseCountryList(feature.properties.Delivering_Country).join(', ') :
                'Unknown';
                
              return (
                <div 
                  key={index} 
                  className="entry-item" 
                  onClick={() => handleListItemClick(feature)}
                >
                  <div className="entry-title">
                    {categoryText}
                  </div>
                  <div className="entry-subtitle">
                    {deliveringPartners} → {feature.properties.Receiving_Countries || 'Unknown'}
                    {feature.properties.Year ? ` (${feature.properties.Year})` : ''}
                  </div>
                  {feature.properties.Comments && (
                    <div className="entry-description">
                      {feature.properties.Comments.length > 100 
                        ? `${feature.properties.Comments.substring(0, 100)}...` 
                        : feature.properties.Comments}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        {/* Filter Popup */}
        {showFilterPopup && (
          <div className="filter-popup">
            <div className="filter-popup-header">
              <h3>Filter Options</h3>
              <button className="close-button" onClick={toggleFilterPopup}>×</button>
            </div>
            
            <div className="filter-popup-content">
              {/* Search input removed as requested */}
              
              <div className="filter-group">
                <h3>
                  Diplomacy Categories
                  <div className="filter-buttons">
                    <button onClick={() => handleSelectAllCategories(true)}>All</button>
                    <button onClick={() => handleSelectAllCategories(false)}>None</button>
                  </div>
                </h3>
                <div className="checkbox-container">
                  {categoryList.map(category => (
                    <div key={category} className="checkbox-item">
                      <input
                        type="checkbox"
                        id={`category-${category}`}
                        checked={selectedCategories[category] || false}
                        onChange={(e) => handleCategoryChange(category, e.target.checked)}
                      />
                      <label htmlFor={`category-${category}`}>{category}</label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="filter-group">
                <h3>
                  Delivering Partners
                  <div className="filter-buttons">
                    <button onClick={() => handleSelectAllCountries(true)}>All</button>
                    <button onClick={() => handleSelectAllCountries(false)}>None</button>
                  </div>
                </h3>
                <div className="checkbox-container">
                  {countryList.map(country => (
                    <div key={country} className="checkbox-item">
                      <input
                        type="checkbox"
                        id={`country-${country}`}
                        checked={selectedCountries[country] || false}
                        onChange={(e) => handleCountryChange(country, e.target.checked)}
                      />
                      <label htmlFor={`country-${country}`}>{country}</label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="filter-actions">
                <button 
                  className="filter-reset-button" 
                  onClick={() => {
                    handleSelectAllCategories(true);
                    handleSelectAllCountries(true);
                    setYearRange([availableYearRange[0], availableYearRange[1]]);
                    setSearchQuery('');
                    toggleFilterPopup();
                  }}
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Statistics Panel */}
        {showStats && (
          <div className="stats-panel">
            <div className="stats-panel-header">
              <h3>Event Statistics</h3>
              <button className="close-button" onClick={toggleStats}>×</button>
            </div>
            
            <div className="stats-panel-content">
              <div className="stats-summary">
                <div className="stat-box">
                  <span className="stat-value">{allData.length}</span>
                  <span className="stat-label">Total Events</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{countryList.length}</span>
                  <span className="stat-label">Partners</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">{categoryList.length}</span>
                  <span className="stat-label">Categories</span>
                </div>
              </div>
              
              <div className="stats-chart">
                <h4>Events by Category</h4>
                <div className="chart-container category-chart">
                  {categoryList.map(category => {
                    // Count events that include this category (even if multiple categories)
                    const count = allData.filter(f => {
                      const categories = parseCategoryList(f.properties.Diplomacy_category || '');
                      return categories.includes(category);
                    }).length;
                    
                    const percentage = allData.length > 0 
                      ? Math.round((count / allData.length) * 100) 
                      : 0;
                    
                    return (
                      <div key={category} className="chart-bar-item">
                        <div className="chart-bar-label">{category}</div>
                        <div className="chart-bar-container">
                          <div 
                            className="chart-bar" 
                            style={{width: `${percentage}%`}}
                          ></div>
                          <span className="chart-bar-value">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="stats-chart">
                <h4>Top Delivering Partners</h4>
                <div className="chart-container country-chart">
                  {countryList
                    .map(country => ({
                      name: country,
                      count: allData.filter(f => {
                        const countries = parseCountryList(f.properties.Delivering_Country || '');
                        return countries.includes(country);
                      }).length
                    }))
                    .sort((a, b) => b.count - a.count) // Sort by count in descending order
                    .slice(0, 5) // Take top 5
                    .map(({name: country, count}) => {
                      const percentage = allData.length > 0 
                        ? Math.round((count / allData.length) * 100) 
                        : 0;
                      
                      return (
                        <div key={country} className="chart-bar-item">
                          <div className="chart-bar-label">{country}</div>
                          <div className="chart-bar-container">
                            <div 
                              className="chart-bar" 
                              style={{width: `${percentage}%`}}
                            ></div>
                            <span className="chart-bar-value">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              
              <div className="stats-chart">
                <h4>Events Timeline</h4>
                <div className="chart-container timeline-chart">
                  <div className="timeline-years">
                    {Array.from(new Set(allData
                      .map(f => f.properties.Year)
                      .filter(year => year !== undefined && year !== null)
                      .sort((a, b) => parseInt(a) - parseInt(b)))).map(year => {
                        const yearCount = allData.filter(f => f.properties.Year == year).length;
                        const maxCount = Math.max(1, ...Array.from(new Set(allData
                          .map(f => f.properties.Year)
                          .filter(y => y !== undefined && y !== null)))
                          .map(y => allData.filter(f => f.properties.Year == y).length));
                        
                        // Ensure height is at least 10% and at most 90% of available space
                        const heightPercentage = Math.max(10, Math.min(90, (yearCount / maxCount) * 100));
                        
                        return (
                          <div key={year} className="timeline-year">
                            <div 
                              className="timeline-bar" 
                              style={{height: `${heightPercentage}px`}}
                              title={`${yearCount} events in ${year}`}
                            >
                              {/* Add the count number on top of the bar */}
                              <span className="timeline-count">{yearCount}</span>
                            </div>
                            <div className="timeline-year-label">{year}</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <button 
        className={`sidebar-toggle ${sidebarCollapsed ? 'toggle-expanded' : ''}`}
        onClick={toggleSidebar}
      >
        {sidebarCollapsed ? '»' : '«'}
      </button>
      
      <div 
        id="map-container" 
        ref={mapContainerRef} 
        className={sidebarCollapsed ? 'map-expanded' : ''}
      />
      
      {/* UPDATED: Redesigned square year slider with centered elements and Reset option */}
      {availableYears.length > 0 && (
        <div className="sliderbar" id="sliderbar">
          <div className="sliderbar-content">
            <div className="year-display">
              Year: <span id="active-year">{showAllYears ? 'All Years' : activeYear}</span>
            </div>
            
            <div className="slider-container">
              <input 
                id="slider" 
                className="square-slider" 
                type="range" 
                min={availableYearRange[0]} 
                max={availableYearRange[1]} 
                step="1" 
                value={activeYear || availableYearRange[0]} 
                onChange={handleYearChange}
              />
            </div>
            
            <div className="reset-option">
              <input 
                type="checkbox" 
                id="reset-years" 
                checked={showAllYears}
                onChange={toggleAllYears}
              />
              <label htmlFor="reset-years">Reset</label>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ========== HELPER FUNCTIONS ==========

  // Creates a loading indicator element
  function createLoadingIndicator() {
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading-indicator';
    loadingEl.innerHTML = `
      <div class="loading-spinner"></div>
      <span>Loading map data...</span>
    `;
    loadingEl.style.position = 'absolute';
    loadingEl.style.top = '50%';
    loadingEl.style.left = '50%';
    loadingEl.style.transform = 'translate(-50%, -50%)';
    loadingEl.style.padding = '15px 20px';
    loadingEl.style.borderRadius = '5px';
    loadingEl.style.backgroundColor = 'rgba(255,255,255,0.8)';
    loadingEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.15)';
    loadingEl.style.zIndex = '1000';
    loadingEl.style.display = 'flex';
    loadingEl.style.alignItems = 'center';
    loadingEl.style.gap = '10px';

    // Add CSS for spinner
    const style = document.createElement('style');
    style.textContent = `
      .loading-spinner {
        width: 20px;
        height: 20px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #e51f30;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    return loadingEl;
  }

  // Creates a fallback circle icon - SIMPLIFIED VERSION
  function createFallbackCircleIcon(map, iconId) {
    console.log(`Creating fallback circle icon for: ${iconId}`);
    
    // Create a simple DOM Image element
    const size = 40; // Make it larger for better visibility
    const img = new Image(size, size);
    
    // Set a simple SVG as the source (red circle with white border)
    img.src = `data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="%23e51f30" stroke="white" stroke-width="3"/></svg>`;
    
    // When the image loads, add it to the map
    img.onload = () => {
      try {
        map.addImage(iconId, img);
        console.log(`Added fallback image for ${iconId}`);
      } catch (err) {
        console.error(`Failed to add fallback image for ${iconId}:`, err);
      }
    };
  }

  // Creates a fallback hover icon (slightly larger)
  function createFallbackLargerCircleIcon(map, iconId) {
    // Create a DOM Image element instead of using canvas
    const size = 24; // Increased size from 16 to 24
    const img = new Image(size, size);
    
    // Set a simple SVG as the source (red circle with white border, positioned to appear shifted up)
    img.src = `data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="10" fill="%23e51f30" stroke="white" stroke-width="2"/></svg>`;
    
    // When the image loads, add it to the map
    img.onload = () => {
      map.addImage(iconId, img);
    };
  }

  // Simplified icon loading with better error handling
  function loadIcon(map, url, id) {
    return new Promise((resolve) => {
      try {
        console.log(`Loading icon: ${id} from ${url}`);
        
        // First, check if image is already loaded
        if (map.hasImage(id)) {
          console.log(`Icon ${id} already loaded`);
          resolve();
          return;
        }
        
        // Create an Image object directly
        const img = new Image();
        img.crossOrigin = "anonymous"; // Handle CORS issues
        
        img.onload = () => {
          try {
            console.log(`Successfully loaded icon: ${id}`);
            map.addImage(id, img);
            resolve();
          } catch (err) {
            console.error(`Error adding icon ${id} to map:`, err);
            createFallbackCircleIcon(map, id);
            resolve();
          }
        };
        
        img.onerror = () => {
          console.error(`Failed to load image for ${id}`);
          createFallbackCircleIcon(map, id);
          resolve();
        };
        
        img.src = url;
      } catch (error) {
        console.error(`Error in loadIcon for ${id}:`, error);
        createFallbackCircleIcon(map, id);
        resolve();
      }
    });
  }

  // Simplified larger icon loading that avoids canvas operations
  function loadLargerIcon(map, url, id) {
    return new Promise((resolve) => {
      try {
        map.loadImage(url, (err, img) => {
          if (err) {
            console.error(`Icon ${id} is not accessible - using fallback`);
            createFallbackLargerCircleIcon(map, id);
          } else {
            // If successful, we'll just use the regular image for the hover state
            map.addImage(id, img);
          }
          resolve();
        });
      } catch (error) {
        console.error(`Error loading hover icon ${id}:`, error);
        createFallbackLargerCircleIcon(map, id);
        resolve();
      }
    });
  }

  // Loads all icons (category icons, default icon, cluster icon)
  function loadAllIcons(map) {
    console.log("Starting to load icons");
    return new Promise((resolve, reject) => {
      const iconPromises = [];

      // Load default icon
      iconPromises.push(loadIcon(map, defaultIcon.url, defaultIcon.id));

      // Load category icons
      Object.values(categoryIcons).forEach(icon => {
        iconPromises.push(loadIcon(map, icon.url, icon.id));
        
        // Also load the hover version of each icon (larger version)
        iconPromises.push(loadLargerIcon(map, icon.url, `${icon.id}-hover`));
      });

      // Load hover version of default icon
      iconPromises.push(loadLargerIcon(map, defaultIcon.url, `${defaultIcon.id}-hover`));

      // Load cluster icon
      iconPromises.push(
        loadIcon(
          map, 
          'https://raw.githubusercontent.com/nazka/map-gl-js-spiderfy/dev/demo/img/circle-yellow.png',
          'cluster-icon'
        )
      );

      // Wait for all icons to load
      Promise.all(iconPromises)
        .then(() => {
          console.log("All icons loaded successfully");
          resolve();
        })
        .catch((err) => {
          console.error("Error loading icons:", err);
          reject(err);
        });
    });
  }

  // Add the data source to the map
  function addDataSource(map) {
    console.log("Adding data source");
    map.addSource('markers', {
      type: 'geojson',
      data: '/data/mock-nyc-points.geojson',
      cluster: true,
      clusterMaxZoom: 15  ,
      clusterRadius: 50,
      clusterMinPoints: 2 // ADDED: Only cluster 6 or more points
    });
  }

  // Add cluster layers to the map
  function addClusterLayers(map) {
    console.log("Adding cluster layers");
    // Cluster symbol layer - INCREASED SIZE
    map.addLayer({
      id: 'clusters', 
      type: 'symbol', 
      source: 'markers', 
      filter: ['has', 'point_count'],
      layout: { 
        'icon-image': 'cluster-icon', 
        'icon-size': 1, // INCREASED from 1.6 to 2.0
        'icon-allow-overlap': true 
      }
    });

    // Cluster count layer - TEXT COLOR CHANGED TO BLACK
    map.addLayer({
      id: 'cluster-count', 
      type: 'symbol', 
      source: 'markers',
      filter: ['has', 'point_count'],
      layout: { 
        'text-field': ['get', 'point_count_abbreviated'], 
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 
        'text-size': 12 // Increased from 12 to 14
      },
      paint: {
        'text-color': '#000000' // Black text
      }
    });
  }

  // Replace this function in App.jsx (near line 500)
function addUnclusteredPointLayer(map) {
  console.log("Adding unclustered point layer with improved multi-category handling");
  
  // Create a source with a unique id to store only the hovered feature
  map.addSource('hover-point', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  // Regular unclustered points layer with IMPROVED MULTI-CATEGORY HANDLING
  map.addLayer({
    id: 'unclustered-point',
    type: 'symbol',
    source: 'markers',
    filter: ['!', ['has', 'point_count']],
    layout: {
      // IMPROVED: Use a nested case statement to handle semicolon-separated categories
      'icon-image': [
        'let',
        'category', ['get', 'Diplomacy_category'],
        [
          'case',
          // First check if primaryCategory exists and use it
          ['has', 'primaryCategory'],
          [
            'match',
            ['get', 'primaryCategory'],
            'Arms control', 'icon-arms-control',
            'Cultural Diplomacy (Defence)', 'icon-cultural-diplomacy',
            'Cultural Diplomacy', 'icon-cultural-diplomacy',
            'Defence Cooperation', 'icon-defence-cooperation',
            'Defence Infrastructure', 'icon-defence-infrastructure',
            'HADR – Disaster Response', 'icon-hadr',
            'HADR - Disaster Response', 'icon-hadr',
            'HADR', 'icon-hadr',
            'Disaster Response', 'icon-hadr',
            'Maritime Security', 'icon-maritime-security',
            'Military Exercises', 'icon-military-exercises',
            'Military Medical Diplomacy', 'icon-military-medical',
            'Medical Diplomacy', 'icon-military-medical',
            'MIL-POL Engagement', 'icon-milpol',
            'MIL - POL Engagement', 'icon-milpol',
            'MIL POL Engagement', 'icon-milpol',
            'Public Diplomacy', 'icon-public-diplomacy',
            'Sports Diplomacy (Defence)', 'icon-sports-diplomacy',
            'Sports Diplomacy', 'icon-sports-diplomacy',
            'Training', 'icon-training',
            'Visit Diplomacy (Defence)', 'icon-visit-diplomacy',
            'Visit Diplomacy', 'icon-visit-diplomacy',
            'Griffith', 'icon-griffith',
            'default'
          ],
          // NEW IMPROVED PROCESSING FOR MULTI-CATEGORY STRINGS          
          // Check if category contains Cultural Diplomacy
          ['in', 'Cultural Diplomacy', ['var', 'category']], 'icon-cultural-diplomacy',
          // Check if category contains Arms control
          ['in', 'Arms control', ['var', 'category']], 'icon-arms-control',
          // Check if category contains Defence Cooperation
          ['in', 'Defence Cooperation', ['var', 'category']], 'icon-defence-cooperation',
          // Check if category contains Defence Infrastructure
          ['in', 'Defence Infrastructure', ['var', 'category']], 'icon-defence-infrastructure',
          // Check if category contains HADR or Disaster Response
          ['any', ['in', 'HADR', ['var', 'category']], ['in', 'Disaster Response', ['var', 'category']]], 'icon-hadr',
          // Check if category contains Maritime Security
          ['in', 'Maritime Security', ['var', 'category']], 'icon-maritime-security',
          // Check if category contains Military Exercises
          ['in', 'Military Exercises', ['var', 'category']], 'icon-military-exercises',
          // Check if category contains Medical
          ['in', 'Medical', ['var', 'category']], 'icon-military-medical',
          // Check if category contains MIL-POL, MIL POL or MIL - POL
          ['any', ['in', 'MIL-POL', ['var', 'category']], ['in', 'MIL POL', ['var', 'category']], ['in', 'MIL - POL', ['var', 'category']]], 'icon-milpol',
          // Check if category contains Public Diplomacy
          ['in', 'Public Diplomacy', ['var', 'category']], 'icon-public-diplomacy',
          // Check if category contains Sports Diplomacy
          ['in', 'Sports Diplomacy', ['var', 'category']], 'icon-sports-diplomacy',
          // Check if category contains Training
          ['in', 'Training', ['var', 'category']], 'icon-training',
          // Check if category contains Visit Diplomacy
          ['in', 'Visit Diplomacy', ['var', 'category']], 'icon-visit-diplomacy',
          // Check if category contains Griffith
          ['in', 'Griffith', ['var', 'category']], 'icon-griffith',
          // Default fallback
          'default'
        ]
      ],
      'icon-size': 0.088,
      'icon-allow-overlap': true,
      'icon-anchor': 'bottom',
      'icon-offset': [0, 0]
    },
    paint: {
      'icon-opacity': 1
    }
  });

  // Hover layer using the special hover icons - IMPROVED MULTI-CATEGORY HANDLING
  map.addLayer({
    id: 'unclustered-point-hover',
    type: 'symbol',
    source: 'hover-point',
    layout: {
      // Same improved approach but with -hover suffix
      'icon-image': [
        'let',
        'category', ['get', 'Diplomacy_category'],
        [
          'case',
          // First check if primaryCategory exists and use it
          ['has', 'primaryCategory'],
          [
            'match',
            ['get', 'primaryCategory'],
            'Arms control', 'icon-arms-control-hover',
            'Cultural Diplomacy (Defence)', 'icon-cultural-diplomacy-hover',
            'Cultural Diplomacy', 'icon-cultural-diplomacy-hover',
            'Defence Cooperation', 'icon-defence-cooperation-hover',
            'Defence Infrastructure', 'icon-defence-infrastructure-hover',
            'HADR – Disaster Response', 'icon-hadr-hover',
            'HADR - Disaster Response', 'icon-hadr-hover',
            'HADR', 'icon-hadr-hover',
            'Disaster Response', 'icon-hadr-hover',
            'Maritime Security', 'icon-maritime-security-hover',
            'Military Exercises', 'icon-military-exercises-hover',
            'Military Medical Diplomacy', 'icon-military-medical-hover',
            'Medical Diplomacy', 'icon-military-medical-hover',
            'MIL-POL Engagement', 'icon-milpol-hover',
            'MIL - POL Engagement', 'icon-milpol-hover',
            'MIL POL Engagement', 'icon-milpol-hover',
            'Public Diplomacy', 'icon-public-diplomacy-hover',
            'Sports Diplomacy (Defence)', 'icon-sports-diplomacy-hover',
            'Sports Diplomacy', 'icon-sports-diplomacy-hover',
            'Training', 'icon-training-hover',
            'Visit Diplomacy (Defence)', 'icon-visit-diplomacy-hover',
            'Visit Diplomacy', 'icon-visit-diplomacy-hover',
            'Griffith', 'icon-griffith-hover',
            'default-hover'
          ],
          // NEW IMPROVED PROCESSING FOR MULTI-CATEGORY STRINGS          
          // Check if category contains Cultural Diplomacy
          ['in', 'Cultural Diplomacy', ['var', 'category']], 'icon-cultural-diplomacy-hover',
          // Check if category contains Arms control
          ['in', 'Arms control', ['var', 'category']], 'icon-arms-control-hover',
          // Check if category contains Defence Cooperation
          ['in', 'Defence Cooperation', ['var', 'category']], 'icon-defence-cooperation-hover',
          // Check if category contains Defence Infrastructure
          ['in', 'Defence Infrastructure', ['var', 'category']], 'icon-defence-infrastructure-hover',
          // Check if category contains HADR or Disaster Response
          ['any', ['in', 'HADR', ['var', 'category']], ['in', 'Disaster Response', ['var', 'category']]], 'icon-hadr-hover',
          // Check if category contains Maritime Security
          ['in', 'Maritime Security', ['var', 'category']], 'icon-maritime-security-hover',
          // Check if category contains Military Exercises
          ['in', 'Military Exercises', ['var', 'category']], 'icon-military-exercises-hover',
          // Check if category contains Medical
          ['in', 'Medical', ['var', 'category']], 'icon-military-medical-hover',
          // Check if category contains MIL-POL, MIL POL or MIL - POL
          ['any', ['in', 'MIL-POL', ['var', 'category']], ['in', 'MIL POL', ['var', 'category']], ['in', 'MIL - POL', ['var', 'category']]], 'icon-milpol-hover',
          // Check if category contains Public Diplomacy
          ['in', 'Public Diplomacy', ['var', 'category']], 'icon-public-diplomacy-hover',
          // Check if category contains Sports Diplomacy
          ['in', 'Sports Diplomacy', ['var', 'category']], 'icon-sports-diplomacy-hover',
          // Check if category contains Training
          ['in', 'Training', ['var', 'category']], 'icon-training-hover',
          // Check if category contains Visit Diplomacy
          ['in', 'Visit Diplomacy', ['var', 'category']], 'icon-visit-diplomacy-hover',
          // Check if category contains Griffith
          ['in', 'Griffith', ['var', 'category']], 'icon-griffith-hover',
          // Default fallback
          'default-hover'
        ]
      ],
      'icon-size': 0.098,
      'icon-allow-overlap': true,
      'icon-anchor': 'bottom',
      'icon-offset': [0, 50]
    },
    paint: {
      'icon-opacity': 1
    }
  });
}

  // Setup event handlers for unclustered points - UPDATED VERSION
  function setupUnclusteredPointHandlers(map) {
    let activePopup = null;
    let hoverPopup = null;

    // Hover handler for unclustered points
    map.on('mouseenter', 'unclustered-point', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features[0];
      
      // Update the hover point source with this feature
      map.getSource('hover-point').setData({
        type: 'FeatureCollection',
        features: [feature]
      });
      
      // If there's no active popup (from click), show a hover popup
      if (!activePopup) {
        const coords = feature.geometry.coordinates.slice();
        const popupContent = createPopupHTML(feature.properties);
        
        // Create hover popup
        hoverPopup = new mapboxgl.Popup({
          offset: [0, -40], // DOUBLED from -20 to raise popup higher
          anchor: 'bottom',
          closeButton: false,
          closeOnClick: false,
          className: 'hover-popup'
        })
        .setLngLat(coords)
        .setDOMContent(popupContent)
        .addTo(map);
      }
    });

    // Mouse leave handler for unclustered points
    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = '';
      
      // Clear the hover state by emptying the source
      map.getSource('hover-point').setData({
        type: 'FeatureCollection',
        features: []
      });
      
      // Remove hover popup if it exists
      if (hoverPopup && !activePopup) {
        hoverPopup.remove();
        hoverPopup = null;
      }
    });

    // Click handler for unclustered points
    map.on('click', 'unclustered-point', (e) => {
      e.originalEvent.stopPropagation(); // Prevent event bubbling
      const feature = e.features[0];
      
      // Remove previous popups
      if (hoverPopup) {
        hoverPopup.remove();
        hoverPopup = null;
      }
      
      if (activePopup) {
        activePopup.remove();
      }
      
      // Create and show the popup
      activePopup = new mapboxgl.Popup({
        offset: [0, -40],
        anchor: 'bottom',
        closeButton: true,
        closeOnClick: false,
        className: 'feature-popup'
      })
      .setLngLat(feature.geometry.coordinates)
      .setDOMContent(createPopupHTML(feature.properties))
      .addTo(map);
      
      // Remove active popup when it's closed
      activePopup.on('close', () => {
        activePopup = null;
      });
    });

    // Handle click anywhere on the map to close active popup
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { 
        layers: ['unclustered-point', 'clusters'] 
      });
      
      // If click is not on a feature and there's an active popup, remove it
      if (features.length === 0 && activePopup) {
        activePopup.remove();
        activePopup = null;
      }
    });
  }

 // This function needs to replace the setupSpiderifier function in App.jsx
function setupSpiderifier(map) {
  console.log("Setting up spiderifier with improved flag display");
  let activeCluster = null;
  let activePopups = []; // Track all active popups
  
  // Helper function to get the correct flag filename format
  const getCountryKeyForFlag = (countryName) => {
    // Standard country name mappings to flag filenames
    const countryMappings = {
      // North America
      "United States": "USA",
      "United States of America": "USA",
      "USA": "USA",
      "Canada": "Canada",
      "Mexico": "Mexico",
      
      // Europe
      "United Kingdom": "UK",
      "UK": "UK",
      "Great Britain": "UK",
      "Vatican City": "VaticanCity",
      "Holy See": "VaticanCity",
      "France": "France",
      "Germany": "Germany",
      "Netherlands": "Netherlands",
      "Italy": "Italy",
      "Spain": "Spain",
      "Portugal": "Portugal",
      "Greece": "Greece",
      "Switzerland": "Switzerland",
      "Sweden": "Sweden",
      "Norway": "Norway",
      "Finland": "Finland",
      "Denmark": "Denmark",
      "Belgium": "Belgium",
      "Austria": "Austria",
      "Ireland": "Ireland",
      
      // Asia
      "Republic of Korea": "SouthKorea",
      "South Korea": "SouthKorea",
      "Korea": "SouthKorea",
      "China": "China",
      "Japan": "Japan",
      "India": "India",
      "Indonesia": "Indonesia",
      "Philippines": "Philippines",
      "Vietnam": "Vietnam",
      "Thailand": "Thailand",
      "Singapore": "Singapore",
      "Malaysia": "Malaysia",
      "Nepal": "Nepal",
      
      // Oceania
      "Australia": "Australia",
      "New Zealand": "NewZealand",
      "Papua New Guinea": "PapuaNewGuinea",
      "Fiji": "Fiji",
      
      // South America
      "Brazil": "Brazil",
      "Argentina": "Argentina",
      "Chile": "Chile",
      "Colombia": "Colombia",
      "Peru": "Peru",
      
      // Africa
      "South Africa": "SouthAfrica",
      "Egypt": "Egypt",
      "Kenya": "Kenya",
      "Nigeria": "Nigeria",
    };
    
    // Check if we have a direct mapping for this country
    if (countryMappings[countryName]) {
      return countryMappings[countryName];
    }
    
    // Otherwise try to normalize the name by removing spaces
    // This is a fallback option
    const normalized = countryName.replace(/\s+/g, '');
    return normalized;
  };
  
  // Create a fallback flag element when the image fails to load
  const createFallbackFlagElement = (element, country) => {
    // Generate a color based on country name for visual distinction
    const hash = country.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const hue = Math.abs(hash) % 360;
    
    // Set a colored background with the first letter
    element.style.backgroundColor = `hsl(${hue}, 70%, 60%)`;
    element.style.color = 'white';
    element.style.fontWeight = 'bold';
    element.style.textAlign = 'center';
    element.style.lineHeight = '14px';
    element.style.fontSize = '10px';
    element.textContent = country.charAt(0).toUpperCase();
  };

  // Function to determine the icon for a feature with multiple categories
  const getIconForFeature = (feature) => {
    const categoryString = feature.properties.Diplomacy_category;
    if (!categoryString) return defaultIcon;
    
    // Parse categories
    const categories = parseCategoryList(categoryString);
    
    // Check if any of the categories match our priority list
    for (const category of categories) {
      if (categoryIcons[category]) {
        return categoryIcons[category];
      }
    }
    
    // If no exact match, try to match by substring
    for (const category of categories) {
      if (category.includes('Arms')) return categoryIcons['Arms control'] || defaultIcon;
      if (category.includes('Cultural')) return categoryIcons['Cultural Diplomacy (Defence)'] || defaultIcon;
      if (category.includes('Defence Coop')) return categoryIcons['Defence Cooperation'] || defaultIcon;
      if (category.includes('Infrastructure')) return categoryIcons['Defence Infrastructure'] || defaultIcon;
      if (category.includes('HADR') || category.includes('Disaster')) return categoryIcons['HADR – Disaster Response'] || defaultIcon;
      if (category.includes('Maritime')) return categoryIcons['Maritime Security'] || defaultIcon;
      if (category.includes('Exercise')) return categoryIcons['Military Exercises'] || defaultIcon;
      if (category.includes('Medical')) return categoryIcons['Military Medical Diplomacy'] || defaultIcon;
      if (category.includes('MIL-POL') || category.includes('MIL POL') || category.includes('MIL - POL')) 
        return categoryIcons['MIL-POL Engagement'] || defaultIcon;
      if (category.includes('Public')) return categoryIcons['Public Diplomacy'] || defaultIcon;
      if (category.includes('Sports')) return categoryIcons['Sports Diplomacy (Defence)'] || defaultIcon;
      if (category.includes('Training')) return categoryIcons['Training'] || defaultIcon;
      if (category.includes('Visit')) return categoryIcons['Visit Diplomacy (Defence)'] || defaultIcon;
      if (category.includes('Griffith')) return categoryIcons['Griffith'] || defaultIcon;
    }
    
    // Default icon if no matches
    return defaultIcon;
  };

  // Initialize the spiderifier with custom pin options and IMPROVED SPIRAL config
  const spiderifier = new MapboxglSpiderifier(map, {
    animate: true,
    animationSpeed: 200,
    customPin: true,
    
    circleSpiralSwitchover: 9,       // Switch to spiral after 9 points
    circleFootSeparation: 70,        // DECREASED from 90 to 70 for tighter circle
    spiralFootSeparation: 60,        // INCREASED from 45 to 60 for more space along the spiral
    spiralLengthStart: 30,           // INCREASED from 25 to 30 to start the spiral a bit wider
    spiralLengthFactor: 8,           // INCREASED from 6 to 8 for faster outward expansion
    spiralFootAngle: 1.2,            // INCREASED from 1.0 to 1.2 for more curvature and spacing
    
    // This function is called for each leg when it's created
    initializeLeg: function(spiderLeg) {
      // Get the feature for this leg
      const feature = spiderLeg.feature;
      
      // Get icon information based on categories
      const icon = getIconForFeature(feature);
      
      // Clean up any existing elements
      while (spiderLeg.elements.pin.firstChild) {
        spiderLeg.elements.pin.removeChild(spiderLeg.elements.pin.firstChild);
      }
      
      // Store reference to the leg in the container for later use
      spiderLeg.elements.pin.spiderLeg = spiderLeg;
      
      // Make spiderfied icons BIGGER
      spiderLeg.elements.pin.style.width = '60px';
      spiderLeg.elements.pin.style.height = '60px';
      spiderLeg.elements.pin.style.margin = '0';
      spiderLeg.elements.pin.style.padding = '0';
      spiderLeg.elements.pin.style.overflow = 'visible';
      spiderLeg.elements.pin.style.position = 'absolute';
      spiderLeg.elements.pin.style.transform = 'translate(-30px, -30px)';
      spiderLeg.elements.pin.style.pointerEvents = 'auto';
      spiderLeg.elements.pin.style.transition = 'transform 0.3s ease';
      
      // Set the icon as the background of the pin element
      const iconUrl = icon.url;
      spiderLeg.elements.pin.style.backgroundImage = `url(${iconUrl})`;
      spiderLeg.elements.pin.style.backgroundSize = 'contain';
      spiderLeg.elements.pin.style.backgroundRepeat = 'no-repeat';
      spiderLeg.elements.pin.style.backgroundPosition = 'center';
      
      // Add flags for this pin - MAIN FEATURE BEING INTEGRATED
      const countryString = feature.properties.Delivering_Country || '';
      const countries = parseCountryList(countryString);
      
      if (countries.length > 0) {
        // Calculate grid layout based on number of countries
        let cols = Math.min(countries.length, 2); // Default to 2 columns max
        if (countries.length === 1) cols = 1;
        else if (countries.length > 6) cols = 3;
        
        // Calculate number of rows to adjust position
        const numRows = Math.ceil(countries.length / cols);
        
        // Create flags container
        const flagsContainer = document.createElement('div');
        flagsContainer.className = 'spider-leg-flags';
        flagsContainer.style.position = 'absolute';
        
        // Position flags at consistent height regardless of number of rows
        // Each flag row is about 16px high (14px + 2px gap), so offset by (numRows-1) × height
        // This ensures the bottom row stays at a fixed position while additional rows build upward
        flagsContainer.style.top = numRows > 1 ? `${5 - (numRows-1) * 16}px` : '5px';
        
        flagsContainer.style.left = '50%';
        flagsContainer.style.transform = 'translateX(-50%)';
        flagsContainer.style.display = 'grid';
        flagsContainer.style.gap = '2px';
        flagsContainer.style.zIndex = '10';
        
        flagsContainer.style.gridTemplateColumns = `repeat(${cols}, 20px)`; // Sized for visibility
        
        // The last flag should be centered if there's an odd number and more than one row
        const shouldCenterLast = countries.length % cols !== 0 && countries.length > cols;
        
        // Add each flag
        countries.forEach((country, index) => {
          const flagElement = document.createElement('div');
          flagElement.className = 'spider-flag';
          flagElement.style.width = '20px';
          flagElement.style.height = '14px';
          flagElement.style.backgroundSize = 'cover';
          flagElement.style.backgroundPosition = 'center';
          flagElement.style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
          flagElement.style.borderRadius = '2px';
          flagElement.style.transition = 'transform 0.2s ease';
          
          // Improved flag handling with better fallback and naming convention
          const countryKey = getCountryKeyForFlag(country);
          flagElement.style.backgroundImage = `url(/icons/${countryKey}.png)`;
          flagElement.title = country;
          
          // Add error handling for flag loading
          flagElement.onerror = () => {
            console.warn(`Flag for ${country} not found, using fallback`);
            createFallbackFlagElement(flagElement, country);
          };
          
          // Center the last flag if needed
          if (shouldCenterLast && index === countries.length - 1) {
            flagElement.style.gridColumnStart = Math.ceil(cols / 2);
            flagElement.style.gridColumnEnd = Math.ceil(cols / 2) + 1;
          }
          
          flagsContainer.appendChild(flagElement);
        });
        
        // NO CONNECTOR LINE - removed as requested
        
        // Add flags to the pin (no connector)
        spiderLeg.elements.pin.appendChild(flagsContainer);
      }
      
      // Add hover effect
      spiderLeg.elements.pin.addEventListener('mouseenter', function() {
        spiderLeg.elements.pin.style.transform = 'translate(-30px, -30px) scale(1.15)';
        spiderLeg.elements.pin.style.zIndex = '10';
        
        // Scale up flags
        const flags = spiderLeg.elements.pin.querySelectorAll('.spider-flag');
        flags.forEach(flag => {
          flag.style.transform = 'scale(1.2)';
        });
        
        // Show popup
        const popupContent = createPopupHTML(feature.properties);
        const pinRect = spiderLeg.elements.pin.getBoundingClientRect();
        const mapContainer = map.getContainer();
        const mapRect = mapContainer.getBoundingClientRect();
        const point = new mapboxgl.Point(
          pinRect.left + (pinRect.width / 2) - mapRect.left,
          pinRect.top - mapRect.top
        );
        
        const lngLat = map.unproject(point);
        
        // Create popup
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          anchor: 'bottom',
          offset: [0, -30],
          className: 'hover-popup'
        })
        .setLngLat(lngLat)
        .setDOMContent(popupContent)
        .addTo(map);
        
        spiderLeg.elements.pin.popup = popup;
        activePopups.push(popup); // Track this popup
      });
      
      // Reset on mouse leave
      spiderLeg.elements.pin.addEventListener('mouseleave', function() {
        spiderLeg.elements.pin.style.transform = 'translate(-30px, -30px)';
        spiderLeg.elements.pin.style.zIndex = '';
        
        // Reset flag transforms
        const flags = spiderLeg.elements.pin.querySelectorAll('.spider-flag');
        flags.forEach(flag => {
          flag.style.transform = '';
        });
        
        // Remove popup
        if (spiderLeg.elements.pin.popup) {
          spiderLeg.elements.pin.popup.remove();
          spiderLeg.elements.pin.popup = null;
          // Remove from activePopups array
          activePopups = activePopups.filter(p => p !== spiderLeg.elements.pin.popup);
        }
      });
      
      // Handle click on spiderfied icon
      spiderLeg.elements.pin.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent event from bubbling to map
        
        if (spiderLeg.elements.pin.popup) {
          spiderLeg.elements.pin.popup.remove();
          spiderLeg.elements.pin.popup = null;
          // Remove from activePopups array
          activePopups = activePopups.filter(p => p !== spiderLeg.elements.pin.popup);
        }
        
        // Position the popup
        const pinRect = spiderLeg.elements.pin.getBoundingClientRect();
        const mapContainer = map.getContainer();
        const mapRect = mapContainer.getBoundingClientRect();
        const point = new mapboxgl.Point(
          pinRect.left + (pinRect.width / 2) - mapRect.left,
          pinRect.top - mapRect.top
        );
        
        const lngLat = map.unproject(point);
        
        // Create popup
        const popupContent = createPopupHTML(feature.properties);
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          anchor: 'bottom',
          offset: [0, -30],
          className: 'feature-popup'
        })
        .setLngLat(lngLat)
        .setDOMContent(popupContent)
        .addTo(map);
        
        // Track this popup
        activePopups.push(popup);
        
        // Remove from tracking when closed
        popup.on('close', () => {
          activePopups = activePopups.filter(p => p !== popup);
        });
      });
      
      // Style the connecting line
      if (spiderLeg.elements.line) {
        spiderLeg.elements.line.setAttribute('stroke', '#e51f30');
        spiderLeg.elements.line.setAttribute('stroke-width', '2');
        spiderLeg.elements.line.setAttribute('stroke-opacity', '0.8');
      }
    }
  });

  // Rest of the click handlers and event setup for clusters
  
  // Set up click handler for clusters
  map.on('click', 'clusters', (e) => {
    e.originalEvent.stopPropagation(); // Prevent event from bubbling
    
    const currentZoom = map.getZoom();
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    if (!features.length) return;
    
    const clusterId = features[0].properties.cluster_id;
    const pointCount = features[0].properties.point_count;
    const clusterCoords = features[0].geometry.coordinates.slice();
    
    // Check if we're at spiderify zoom level
    if (currentZoom >= MAP_CONFIG.MIN_SPIDERIFY_ZOOM && currentZoom <= MAP_CONFIG.MAX_ZOOM) {
      // For large clusters, just zoom in instead of showing a popup
      if (pointCount >= MAP_CONFIG.MAX_SPIDERIFY_POINTS) {
        // Zoom in to break up the cluster
        map.easeTo({
          center: clusterCoords,
          zoom: Math.min(currentZoom + 1.5, MAP_CONFIG.MAX_ZOOM)
        });
        return;
      }
      
      // Check if we're clicking on an already spiderfied cluster
      if (lastClickedClusterRef.current === clusterId) {
        // Toggle spiderify state (close it)
        spiderifier.unspiderfy();
        lastClickedClusterRef.current = null;
        return;
      }
      
      // Get points in the cluster and spiderify
      map.getSource('markers').getClusterLeaves(
        clusterId,
        pointCount,
        0,
        (err, leafFeatures) => {
          if (err) {
            console.error('Error getting cluster leaves:', err);
            return;
          }
          
          // Clear existing spiderifier
          spiderifier.unspiderfy();
          
          // Store reference to current cluster
          lastClickedClusterRef.current = clusterId;
          
          // Sort features for better display
          const sortedFeatures = [...leafFeatures].sort((a, b) => {
            // Sort by category first
            const categoryA = a.properties.Diplomacy_category || '';
            const categoryB = b.properties.Diplomacy_category || '';
            
            if (categoryA !== categoryB) {
              return categoryA.localeCompare(categoryB);
            }
            
            // Then by year
            const yearA = a.properties.Year || 0;
            const yearB = b.properties.Year || 0;
            
            const numYearA = typeof yearA === 'string' ? parseInt(yearA, 10) : yearA;
            const numYearB = typeof yearB === 'string' ? parseInt(yearB, 10) : yearB;
            
            return numYearA - numYearB;
          });
          
          // Debug log point count to verify spiral behavior
          console.log(`Spiderfying ${sortedFeatures.length} points. Should use ${sortedFeatures.length > 9 ? 'spiral' : 'circle'}`);
          
          // Spiderify with sorted features
          spiderifier.spiderfy(clusterCoords, sortedFeatures);
        }
      );
    } else if (currentZoom < MAP_CONFIG.INTERMEDIATE_ZOOM) {
      // From initial zoom to intermediate zoom
      spiderifier.unspiderfy();
      lastClickedClusterRef.current = null;
      map.easeTo({
        center: clusterCoords,
        zoom: MAP_CONFIG.INTERMEDIATE_ZOOM
      });
    } else if (currentZoom < MAP_CONFIG.MIN_SPIDERIFY_ZOOM) {
      // From intermediate zoom to spiderfy zoom
      spiderifier.unspiderfy();
      lastClickedClusterRef.current = null;
      map.easeTo({
        center: clusterCoords,
        zoom: MAP_CONFIG.MIN_SPIDERIFY_ZOOM
      });
    }
  });

  // Unspiderfy when clicking elsewhere on the map
  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    if (features.length === 0) {
      spiderifier.unspiderfy();
      lastClickedClusterRef.current = null;
      
      // Clean up all popups
      activePopups.forEach(popup => {
        if (popup) popup.remove();
      });
      activePopups = [];
    }
  });

  // Unspiderfy when zooming or dragging
  map.on('zoomstart', () => {
    spiderifier.unspiderfy();
    lastClickedClusterRef.current = null;
    
    // Clean up all popups
    activePopups.forEach(popup => {
      if (popup) popup.remove();
    });
    activePopups = [];
  });
  
  map.on('dragstart', () => {
    spiderifier.unspiderfy();
    lastClickedClusterRef.current = null;
    
    // Clean up all popups
    activePopups.forEach(popup => {
      if (popup) popup.remove();
    });
    activePopups = [];
  });
  
  // Add wheel event handler to close popups when zooming with mouse wheel
  map.getCanvas().addEventListener('wheel', () => {
    // Clean up all popups
    activePopups.forEach(popup => {
      if (popup) popup.remove();
    });
    activePopups = [];
    
    // Also unspiderfy to prevent orphaned elements
    spiderifier.unspiderfy();
    lastClickedClusterRef.current = null;
  }, { passive: true }); // Using passive true for better scroll performance

  // Add ESC key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      spiderifier.unspiderfy();
      lastClickedClusterRef.current = null;
      
      // Clean up all popups
      activePopups.forEach(popup => {
        if (popup) popup.remove();
      });
      activePopups = [];
    }
  });

  return spiderifier;
}}
