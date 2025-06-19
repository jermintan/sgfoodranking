import React, { useState, useEffect, useMemo } from 'react';
import ListingCard from './ListingCard';
import FilterModal from './FilterModal';

// Haversine distance formula
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
  // --- STATE ---
  const [allEateries, setAllEateries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({ price: null, cuisines: [] });
  const [sortOrder, setSortOrder] = useState('default');
  const [locationFilter, setLocationFilter] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchEateries = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/eateries');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setAllEateries(data);
      } catch (error) {
        console.error("Failed to fetch eateries:", error);
      }
    };
    fetchEateries();
  }, []);

  // --- HANDLERS ---
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported.');
      return;
    }
    setLocationStatus('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationStatus('');
        setLocationFilter({ lat: latitude, lon: longitude, radius: 1 });
      },
      (error) => {
        setLocationStatus(`Error: ${error.message}`);
      }
    );
  };

  const clearLocationFilter = () => {
    setLocationFilter(null);
    setLocationStatus('');
  };

  const handleApplyFilters = (newFilters) => {
    setActiveFilters(newFilters);
  };

  // --- FILTERING & SORTING LOGIC ---
  const processedEateries = useMemo(() => {
    let eateriesToShow = [...allEateries];

    if (locationFilter) {
      eateriesToShow = eateriesToShow.filter(eatery => {
        if (eatery.latitude === null || eatery.longitude === null) return false;
        const distance = getDistance(
          locationFilter.lat, locationFilter.lon,
          eatery.latitude, eatery.longitude
        );
        return distance <= locationFilter.radius;
      });
    }

    const { price, cuisines } = activeFilters;
    if (price || cuisines.length > 0) {
      eateriesToShow = eateriesToShow.filter(eatery => {
        if (price && eatery.price !== price) return false;
        if (cuisines.length > 0 && !cuisines.includes(eatery.cuisine)) return false;
        return true;
      });
    }

    if (searchTerm) {
      eateriesToShow = eateriesToShow.filter(eatery => {
        const searchContent = `${eatery.name} ${eatery.cuisine} ${eatery.neighbourhood}`;
        return searchContent.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    switch (sortOrder) {
      case 'rating': eateriesToShow.sort((a, b) => b.rating - a.rating); break;
      case 'reviews': eateriesToShow.sort((a, b) => b.review_count - a.review_count); break;
      case 'name': eateriesToShow.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: break;
    }

    return eateriesToShow;
  }, [allEateries, activeFilters, searchTerm, sortOrder, locationFilter]);

  // --- RENDER ---
  return (
    <>
      <div className="eatery-grid-container">
        <div className="search-bar-container">
          <button className="location-icon-button" onClick={handleGetLocation} title="Find eateries near me">📍</button>
          <input 
            type="text" 
            placeholder="Search by name, cuisine, location..." 
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          <select 
            className="sort-dropdown" 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="default">Sort by</option>
            <option value="rating">Highest Rating</option>
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
        </div>

        <div className="eatery-grid">
          {processedEateries.map(eatery => (
            <ListingCard key={eatery.id} eatery={eatery} />
          ))}
          {processedEateries.length === 0 && (
            <p className="no-results-message">No eateries found. Try adjusting your search or filters!</p>
          )}
        </div>
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