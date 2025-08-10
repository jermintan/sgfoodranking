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
    isVegetarian: false,
  });
  const [sortOrder, setSortOrder] = useState('default'); // 'default' | 'reviews' | 'name'
  const [locationFilter, setLocationFilter] = useState(null); // { lat, lon, radius }
  const [locationStatus, setLocationStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const prevDebouncedSearchTermRef = useRef(debouncedSearchTerm);
  const prevActiveFiltersRef = useRef(activeFilters);
  const prevLocationFilterRef = useRef(locationFilter);
  const prevSortOrderRef = useRef(sortOrder);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const API_BASE_URL =
    process.env.NODE_ENV === 'production'
      ? (process.env.REACT_APP_API_URL || window.location.origin)
      : 'http://localhost:3001';

  const fetchEateries = useCallback(
    async (pageToFetch = 1) => {
      setIsLoading(true);

      const q = new URLSearchParams();
      q.set('page', String(pageToFetch));
      q.set('limit', String(eateriesData.itemsPerPage));

      // map UI sort → API sort
      const sortMap = {
        default: 'rating_desc',
        reviews: 'reviews_desc',
        name: 'name_asc',
      };
      q.set('sort', sortMap[sortOrder] || 'rating_desc');

      if (activeFilters.isHalal) q.set('is_halal', 'true');
      if (activeFilters.isVegetarian) q.set('is_vegetarian', 'true');
      if (activeFilters.price) q.set('price', activeFilters.price);

      if (debouncedSearchTerm.trim() !== '') {
        q.set('searchTerm', debouncedSearchTerm.trim());
      }

      if (locationFilter) {
        const { lat, lon, radius } = locationFilter;
        const latN = Number(lat);
        const lonN = Number(lon);
        const radN = Number(radius);
        if (Number.isFinite(latN) && Number.isFinite(lonN) && Number.isFinite(radN) && radN > 0) {
          q.set('latitude', String(latN));
          q.set('longitude', String(lonN));
          q.set('radius', String(radN));
        }
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/api/eateries?${q.toString()}`);
        if (!resp.ok) throw new Error(`Request failed (${resp.status})`);
        const data = await resp.json();

        setEateriesData(prev => ({
          list: (data.eateries ?? data.list) || [],
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 0,
          itemsPerPage: data.itemsPerPage || prev.itemsPerPage,
        }));
      } catch (err) {
        console.error('Failed to fetch eateries:', err);
        setEateriesData(prev => ({ ...prev, list: [], totalPages: 0, currentPage: 1 }));
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE_URL, activeFilters, debouncedSearchTerm, eateriesData.itemsPerPage, locationFilter, sortOrder]
  );

  useEffect(() => {
    const searchChanged  = debouncedSearchTerm !== prevDebouncedSearchTermRef.current;
    const filtersChanged = JSON.stringify(activeFilters) !== JSON.stringify(prevActiveFiltersRef.current);
    const locChanged     = JSON.stringify(locationFilter) !== JSON.stringify(prevLocationFilterRef.current);
    const sortChanged    = sortOrder !== prevSortOrderRef.current;

    let pageToFetch = eateriesData.currentPage;
    let reset = false;

    if (searchChanged || filtersChanged || locChanged || sortChanged) {
      pageToFetch = 1;
      reset = true;
      prevDebouncedSearchTermRef.current = debouncedSearchTerm;
      prevActiveFiltersRef.current = activeFilters;
      prevLocationFilterRef.current = locationFilter;
      prevSortOrderRef.current = sortOrder;
    }

    fetchEateries(pageToFetch);

    if (reset && eateriesData.currentPage !== 1) {
      setEateriesData(prev => ({ ...prev, currentPage: 1 }));
    }
  }, [debouncedSearchTerm, activeFilters, locationFilter, sortOrder, eateriesData.currentPage, fetchEateries]);

  const handleApplyFilters = newFilters => setActiveFilters(newFilters);

  const handlePageChange = newPage => {
    if (newPage !== eateriesData.currentPage) {
      setEateriesData(prev => ({ ...prev, currentPage: newPage }));
      window.scrollTo(0, 0);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported.');
      return;
    }
    setLocationStatus('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const updated = { lat: pos.coords.latitude, lon: pos.coords.longitude, radius: 2 };
        setLocationFilter(updated);
        setLocationStatus('');
      },
      err => {
        console.error('Geolocation error:', err);
        setLocationStatus(`Error: ${err.message}`);
      }
    );
  };

  const clearLocationFilter = () => {
    setLocationFilter(null);
    setLocationStatus('');
  };

  // server now returns globally-sorted data; no client-side resorting
  const processedEateries = useMemo(() => eateriesData.list, [eateriesData.list]);

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
          {locationFilter && (
            <div className="location-filter-active">
              <span>Showing results within {locationFilter.radius}km of your location.</span>
              <button onClick={clearLocationFilter} className="clear-location-filter">Clear</button>
            </div>
          )}
          {activeFilters.isHalal && <span className="active-filter-tag">Halal</span>}
          {activeFilters.isVegetarian && <span className="active-filter-tag">Vegetarian</span>}
          {activeFilters.price && <span className="active-filter-tag">Price: {activeFilters.price}</span>}
        </div>

        {isLoading ? (
          <p className="loading-message">Loading eateries...</p>
        ) : processedEateries.length > 0 ? (
          <div className="eatery-grid">
            {processedEateries.map(eatery => (
              <ListingCard key={eatery.id || eatery.place_id || eatery.name} eatery={eatery} />
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
