// FILE: src/components/EateryGrid.js

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // Added useRef
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
    itemsPerPage: 20, // Or your chosen default
  });
  const [searchTerm, setSearchTerm] = useState(''); // Immediate search input value
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // Value used for API calls
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    price: null,
    isHalal: false,
    isVegetarian: false
  });
  const [sortOrder, setSortOrder] = useState('default');
  const [locationFilter, setLocationFilter] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Refs to store previous values of dependencies for smart page reset
  const prevDebouncedSearchTermRef = useRef(debouncedSearchTerm);
  const prevActiveFiltersRef = useRef(activeFilters);

  // Debounce search term: Update debouncedSearchTerm after user stops typing
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timerId); // Cleanup timer if searchTerm changes again quickly
    };
  }, [searchTerm]);


  // Fetch eateries function (now includes debouncedSearchTerm)
  const fetchEateries = useCallback(async (pageToFetch = 1) => {
    setIsLoading(true);
    // console.log(`Fetching page: ${pageToFetch}, Filters:`, activeFilters, `Search: '${debouncedSearchTerm}'`);
    const API_BASE_URL = process.env.NODE_ENV === 'production'
      ? process.env.REACT_APP_API_URL
      : 'http://localhost:3001';

    const queryParams = new URLSearchParams();
    queryParams.append('page', pageToFetch);
    queryParams.append('limit', String(eateriesData.itemsPerPage)); // Ensure limit is a string

    if (activeFilters.isHalal) queryParams.append('is_halal', 'true');
    if (activeFilters.isVegetarian) queryParams.append('is_vegetarian', 'true');
    // if (activeFilters.price) queryParams.append('price', activeFilters.price); // If server-side price filtering

    if (debouncedSearchTerm && debouncedSearchTerm.trim() !== '') {
      queryParams.append('searchTerm', debouncedSearchTerm.trim());
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/eateries?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      const data = await response.json();
      // console.log("API Response Data:", data);
      
      setEateriesData({
        list: data.eateries || [],
        currentPage: data.currentPage || 1,
        totalPages: data.totalPages || 0,
        itemsPerPage: data.itemsPerPage || eateriesData.itemsPerPage,
      });

    } catch (error) {
      console.error("Failed to fetch eateries:", error);
      setEateriesData(prev => ({ ...prev, list: [], totalPages: 0, currentPage: 1 })); // Reset on error
    } finally {
      setIsLoading(false);
    }
  }, [activeFilters, eateriesData.itemsPerPage, debouncedSearchTerm]); // Dependencies for useCallback

  // Main useEffect for fetching data and handling page resets
  useEffect(() => {
    // Check if key search/filter parameters have actually changed
    const searchChanged = debouncedSearchTerm !== prevDebouncedSearchTermRef.current;
    // For objects/arrays, a simple !== might not be enough if mutated, but for this state it should be okay
    // A more robust check for activeFilters would be a deep comparison if it were more complex
    const filtersChanged = JSON.stringify(activeFilters) !== JSON.stringify(prevActiveFiltersRef.current);

    if (searchChanged || filtersChanged) {
      // If search term or filters changed, fetch page 1
      // console.log("Search or filters changed, fetching page 1");
      // Update refs *before* setting state that might trigger another fetch
      prevDebouncedSearchTermRef.current = debouncedSearchTerm;
      prevActiveFiltersRef.current = activeFilters;
      // Set currentPage to 1, which will then trigger the fetchEateries with page 1
      // due to currentPage being in the dependency array of the *next* useEffect block.
      // To avoid multiple triggers, we can call fetchEateries(1) directly here.
      fetchEateries(1);
    } else {
      // If only page changed (or initial load with default page 1)
      // console.log("Fetching current page:", eateriesData.currentPage);
      fetchEateries(eateriesData.currentPage);
    }
  }, [debouncedSearchTerm, activeFilters, eateriesData.currentPage, fetchEateries]); 
   // Note: fetchEateries is memoized by useCallback, so it only changes if its own deps change.


  // Handler for applying filters from modal
  const handleApplyFilters = (newFilters) => {
    // console.log("Applying filters:", newFilters);
    setActiveFilters(newFilters);
    // The main useEffect will detect this change and reset to page 1 / re-fetch.
  };
  
  // Handler for page changes from PaginationControls
  const handlePageChange = (newPage) => {
    if (newPage !== eateriesData.currentPage) {
        // console.log("Changing page to:", newPage);
        setEateriesData(prev => ({ ...prev, currentPage: newPage }));
        window.scrollTo(0, 0); // Scroll to top on page change
        // The main useEffect will detect currentPage change and re-fetch.
    }
  };

  // Location handlers (no change to their internal logic)
  const handleGetLocation = () => {
    console.log("handleGetLocation CALLED");
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported.'); return;
    }
    setLocationStatus('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationStatus('');
        setLocationFilter({ lat: latitude, lon: longitude, radius: 1 });
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
    let eateriesToShow = [...eateriesData.list]; // Start with the fetched list for the current page

    // Client-side location filter
    if (locationFilter) {
      eateriesToShow = eateriesToShow.filter(eatery => {
        if (eatery.latitude === null || eatery.longitude === null) return false;
        const distance = getDistance(locationFilter.lat, locationFilter.lon, eatery.latitude, eatery.longitude);
        return distance <= locationFilter.radius;
      });
    }

    // Client-side filtering for price (if not handled by server)
    const { price } = activeFilters;
    if (price) {
        eateriesToShow = eateriesToShow.filter(eatery => eatery.price === price);
    }

    // SERVER NOW HANDLES SEARCH TERM, so client-side search is removed from here.

    // Client-side sorting
    const localSortOrder = sortOrder;
    if (localSortOrder !== 'default') {
        eateriesToShow = [...eateriesToShow].sort((a, b) => {
            if (localSortOrder === 'reviews') return (b.review_count || 0) - (a.review_count || 0);
            if (localSortOrder === 'name') return (a.name || '').localeCompare(b.name || '');
            return 0;
        });
    }
    // console.log("Processed eateries for display:", eateriesToShow.length);
    return eateriesToShow;
  }, [eateriesData.list, activeFilters, /* searchTerm removed */ sortOrder, locationFilter]); // searchTerm removed from deps

  return (
    <>
      <div className="eatery-grid-container">
        <div className="search-bar-container">
          <button className="location-icon-button" onClick={handleGetLocation} title="Find eateries near me">📍</button>
          <input
            type="text"
            placeholder="Search all eateries..."
            className="search-input"
            value={searchTerm} // Input updates immediate searchTerm state
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
        
        {/* Pagination Controls only at the bottom as per your previous request */}

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