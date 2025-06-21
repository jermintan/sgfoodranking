// FILE: src/components/EateryGrid.js

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ListingCard from './ListingCard';
import FilterModal from './FilterModal';
import PaginationControls from './PaginationControls';

const EateryGrid = () => {
  const [eateriesData, setEateriesData] = useState({
    list: [],
    currentPage: 1,
    totalPages: 0,
    itemsPerPage: 20,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    price: null,
    isHalal: false,
    isVegetarian: false
  });
  const [sortOrder, setSortOrder] = useState('default');
  const [locationFilter, setLocationFilter] = useState(null); // Server-side filter trigger
  const [locationStatus, setLocationStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const prevDebouncedSearchTermRef = useRef(debouncedSearchTerm);
  const prevActiveFiltersRef = useRef(activeFilters);
  const prevLocationFilterRef = useRef(locationFilter); // Ref for location filter

  // Debounce search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  // Fetch eateries function
  const fetchEateries = useCallback(async (pageToFetch = 1) => {
    console.log("fetchEateries called with page:", pageToFetch, "Current locationFilter:", locationFilter); // DEBUG
    setIsLoading(true);
    const API_BASE_URL = process.env.NODE_ENV === 'production'
      ? process.env.REACT_APP_API_URL
      : 'http://localhost:3001';

    const queryParams = new URLSearchParams();
    queryParams.append('page', pageToFetch.toString());
    queryParams.append('limit', eateriesData.itemsPerPage.toString());

    if (activeFilters.isHalal) queryParams.append('is_halal', 'true');
    if (activeFilters.isVegetarian) queryParams.append('is_vegetarian', 'true');
    if (activeFilters.price) queryParams.append('price', activeFilters.price);

    if (debouncedSearchTerm && debouncedSearchTerm.trim() !== '') {
      queryParams.append('searchTerm', debouncedSearchTerm.trim());
    }

    // *** ADD LOCATION PARAMS TO API CALL ***
    if (locationFilter) {
      queryParams.append('latitude', locationFilter.lat.toString());
      queryParams.append('longitude', locationFilter.lon.toString());
      queryParams.append('radius', locationFilter.radius.toString());
    }

    try {
      console.log("Fetching API with params:", queryParams.toString()); // DEBUG
      const response = await fetch(`${API_BASE_URL}/api/eateries?${queryParams.toString()}`);
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      const data = await response.json();
      console.log("API Data Received:", data); // DEBUG
      
      setEateriesData({
        list: data.eateries || [],
        currentPage: data.currentPage || 1,
        totalPages: data.totalPages || 0,
        itemsPerPage: data.itemsPerPage || eateriesData.itemsPerPage,
      });

    } catch (error) {
      console.error("Failed to fetch eateries:", error);
      setEateriesData(prev => ({ ...prev, list: [], totalPages: 0, currentPage: 1 }));
    } finally {
      setIsLoading(false);
    }
  // *** ADD locationFilter TO useCallback DEPENDENCIES ***
  }, [activeFilters, eateriesData.itemsPerPage, debouncedSearchTerm, locationFilter]);

  // Main useEffect for fetching data and handling page resets
  useEffect(() => {
    console.log("Main useEffect triggered. Deps:", {debouncedSearchTerm, activeFilters, locationFilter, currentPage: eateriesData.currentPage}); // DEBUG
    const searchChanged = debouncedSearchTerm !== prevDebouncedSearchTermRef.current;
    const filtersChanged = JSON.stringify(activeFilters) !== JSON.stringify(prevActiveFiltersRef.current);
    // *** USE JSON.stringify FOR OBJECT COMPARISON FOR locationFilterChanged ***
    const locationFilterChanged = JSON.stringify(locationFilter) !== JSON.stringify(prevLocationFilterRef.current);

    let pageToFetch = eateriesData.currentPage;
    let needsPageReset = false;

    if (searchChanged || filtersChanged || locationFilterChanged) {
      console.log("Change detected:", {searchChanged, filtersChanged, locationFilterChanged}); // DEBUG
      pageToFetch = 1;
      needsPageReset = true;
      // Update refs *after* determining a change has occurred
      prevDebouncedSearchTermRef.current = debouncedSearchTerm;
      prevActiveFiltersRef.current = activeFilters;
      prevLocationFilterRef.current = locationFilter;
    }
    
    fetchEateries(pageToFetch);

    if (needsPageReset && eateriesData.currentPage !== 1) {
        console.log("Resetting currentPage state to 1"); // DEBUG
        setEateriesData(prev => ({ ...prev, currentPage: 1 }));
    }
  // *** ADD locationFilter TO useEffect DEPENDENCIES ***
  }, [debouncedSearchTerm, activeFilters, locationFilter, eateriesData.currentPage, fetchEateries]);


  const handleApplyFilters = (newFilters) => {
    setActiveFilters(newFilters);
  };
  
  const handlePageChange = (newPage) => {
    if (newPage !== eateriesData.currentPage) {
        setEateriesData(prev => ({ ...prev, currentPage: newPage }));
        window.scrollTo(0, 0);
    }
  };

  const handleGetLocation = () => {
    console.log("handleGetLocation called"); // DEBUG
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported.'); return;
    }
    setLocationStatus('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = { lat: position.coords.latitude, lon: position.coords.longitude, radius: 1 };
        console.log("Location obtained, setting filter:", newLocation); // DEBUG
        setLocationStatus('');
        setLocationFilter(newLocation);
      },
      (error) => { 
        console.error("Error getting location:", error); // DEBUG
        setLocationStatus(`Error: ${error.message}`); 
      }
    );
  };

  const clearLocationFilter = () => {
    console.log("clearLocationFilter called"); // DEBUG
    setLocationFilter(null);
    setLocationStatus('');
  };

  const processedEateries = useMemo(() => {
    // Server handles all filtering (Halal, Veg, Search, Price, Location).
    // This list is the direct result from the server for the current page.
    let eateriesToShow = [...eateriesData.list];

    // Client-side sorting can still be applied to the server-filtered, paginated list.
    const localSortOrder = sortOrder;
    if (localSortOrder !== 'default') {
        eateriesToShow = [...eateriesToShow].sort((a, b) => {
            if (localSortOrder === 'reviews') return (b.review_count || 0) - (a.review_count || 0);
            if (localSortOrder === 'name') return (a.name || '').localeCompare(b.name || '');
            return 0;
        });
    }
    return eateriesToShow;
  // Dependencies now only reflect what client-side processing is done on eateriesData.list
  }, [eateriesData.list, sortOrder]);


  return (
    <>
      <div className="eatery-grid-container">
        <div className="search-bar-container">
          <button className="location-icon-button" onClick={handleGetLocation} title="Find eateries near me">📍</button>
          <input
            type="text"
            placeholder="Search all eateries..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="sort-dropdown" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="default">Sort by (Rating default)</option>
            <option value="reviews">Most Reviews</option>
            <option value="name">Name (A-Z)</option>
          </select>
          <button className="filter-button" onClick={() => setIsModalOpen(true)}>Filters</button>
        </div>

        <div className="active-filters-container">
          {locationStatus && <p className="location-status">{locationStatus}</p>}
          {locationFilter && ( <div className="location-filter-active"><span>Showing results within {locationFilter.radius}km of your location.</span><button onClick={clearLocationFilter} className="clear-location-filter">Clear</button></div>)}
          {activeFilters.isHalal && <span className="active-filter-tag">Halal</span>}
          {activeFilters.isVegetarian && <span className="active-filter-tag">Vegetarian</span>}
          {activeFilters.price && <span className="active-filter-tag">Price: {activeFilters.price}</span>}
        </div>
        
        {isLoading ? (
          <p className="loading-message">Loading eateries...</p>
        ) : processedEateries.length > 0 ? (
          <div className="eatery-grid">
            {processedEateries.map(eatery => (
              <ListingCard key={eatery.id || eatery.name} eatery={eatery} />
            ))}
          </div>
        ) : (
          <p className="no-results-message">No eateries found. Try adjusting your search or filters!</p>
        )}

        <PaginationControls
          currentPage={eateriesData.currentPage}
          totalPages={eateriesData.totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      <FilterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApply={handleApplyFilters}
        currentFilters={activeFilters}
      />
    </>
  );
};

export default EateryGrid;