// FILE: src/components/EateryGrid.js

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ListingCard from './ListingCard';
import FilterModal from './FilterModal';
import PaginationControls from './PaginationControls';

// Haversine distance function
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const EateryGrid = () => {
  const [eateriesData, setEateriesData] = useState({
    list: [],
    currentPage: 1,
    totalPages: 0,
    itemsPerPage: 20, // Your chosen default
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    price: null, // Price will be sent to server
    isHalal: false,
    isVegetarian: false
  });
  const [sortOrder, setSortOrder] = useState('default');
  const [locationFilter, setLocationFilter] = useState(null); // Client-side
  const [locationStatus, setLocationStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const prevDebouncedSearchTermRef = useRef(debouncedSearchTerm);
  const prevActiveFiltersRef = useRef(activeFilters);

  // Debounce search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  // Fetch eateries function
  const fetchEateries = useCallback(async (pageToFetch = 1) => {
    setIsLoading(true);
    const API_BASE_URL = process.env.NODE_ENV === 'production'
      ? process.env.REACT_APP_API_URL
      : 'http://localhost:3001';

    const queryParams = new URLSearchParams();
    queryParams.append('page', pageToFetch.toString());
    queryParams.append('limit', eateriesData.itemsPerPage.toString());

    if (activeFilters.isHalal) queryParams.append('is_halal', 'true');
    if (activeFilters.isVegetarian) queryParams.append('is_vegetarian', 'true');
    if (activeFilters.price) queryParams.append('price', activeFilters.price); // Send price to server

    if (debouncedSearchTerm && debouncedSearchTerm.trim() !== '') {
      queryParams.append('searchTerm', debouncedSearchTerm.trim());
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/eateries?${queryParams.toString()}`);
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      const data = await response.json();
      
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
  }, [activeFilters, eateriesData.itemsPerPage, debouncedSearchTerm]);

  // Main useEffect for fetching data and handling page resets
  useEffect(() => {
    const searchChanged = debouncedSearchTerm !== prevDebouncedSearchTermRef.current;
    const filtersChanged = JSON.stringify(activeFilters) !== JSON.stringify(prevActiveFiltersRef.current);

    let pageToFetch = eateriesData.currentPage;

    if (searchChanged || filtersChanged) {
      pageToFetch = 1; // Reset to page 1 if search or filters change
      // Update refs immediately if we decide to fetch page 1
      prevDebouncedSearchTermRef.current = debouncedSearchTerm;
      prevActiveFiltersRef.current = activeFilters;
    }
    
    fetchEateries(pageToFetch);

    // If we reset page to 1 due to filter/search change, update the state
    // This ensures the pagination controls reflect page 1 immediately
    // This condition prevents resetting if only currentPage changed due to pagination click
    if ((searchChanged || filtersChanged) && eateriesData.currentPage !== 1) {
        setEateriesData(prev => ({ ...prev, currentPage: 1 }));
    }

  }, [debouncedSearchTerm, activeFilters, eateriesData.currentPage, fetchEateries]);


  // Handler for applying filters from modal
  const handleApplyFilters = (newFilters) => {
    setActiveFilters(newFilters);
    // The main useEffect will detect activeFilters change and reset page / re-fetch.
  };
  
  // Handler for page changes from PaginationControls
  const handlePageChange = (newPage) => {
    if (newPage !== eateriesData.currentPage) {
        setEateriesData(prev => ({ ...prev, currentPage: newPage }));
        window.scrollTo(0, 0);
        // The main useEffect will detect currentPage change and re-fetch.
    }
  };

  // Location handlers
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported.'); return;
    }
    setLocationStatus('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationStatus('');
        setLocationFilter({ lat: latitude, lon: longitude, radius: 1 }); // Default 1km radius
      },
      (error) => { setLocationStatus(`Error: ${error.message}`); }
    );
  };

  const clearLocationFilter = () => {
    setLocationFilter(null);
    setLocationStatus('');
  };

  // Client-side filtering and sorting (applied AFTER data for the current page is fetched)
  const processedEateries = useMemo(() => {
    let eateriesToShow = [...eateriesData.list];

    // Client-side location filter (operates on current page's data)
    if (locationFilter) {
      eateriesToShow = eateriesToShow.filter(eatery => {
        if (eatery.latitude === null || eatery.longitude === null) return false;
        const distance = getDistance(locationFilter.lat, locationFilter.lon, eatery.latitude, eatery.longitude);
        return distance <= locationFilter.radius;
      });
    }

    // PRICE FILTER IS NOW SERVER-SIDE, so removed from client-side processing here.

    // Client-side sorting (operates on current page's data)
    const localSortOrder = sortOrder;
    if (localSortOrder !== 'default') {
        eateriesToShow = [...eateriesToShow].sort((a, b) => {
            if (localSortOrder === 'reviews') return (b.review_count || 0) - (a.review_count || 0);
            if (localSortOrder === 'name') return (a.name || '').localeCompare(b.name || '');
            return 0;
        });
    }
    return eateriesToShow;
  }, [eateriesData.list, activeFilters.price, sortOrder, locationFilter]); 
  // activeFilters.price is kept because if price filter changes, the list from server changes.
  // More broadly, activeFilters itself could be a dependency.

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