import React, { useState, useEffect, useMemo } from 'react';
import ListingCard from './ListingCard';
import FilterModal from './FilterModal';

// This is the one and only component in this file.
const EateryGrid = () => {
  // --- STATE ---
  const [allEateries, setAllEateries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({ price: null, cuisines: [] });
  const [sortOrder, setSortOrder] = useState('default');
  const [placeholderText, setPlaceholderText] = useState('Search by name, cuisine, location...');

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchEateries = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/eateries');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setAllEateries(data);
      } catch (error) {
        console.error("Failed to fetch eateries:", error);
      }
    };

    fetchEateries();
  }, []); // Empty array means this runs only once on mount.

  // --- HANDLERS ---
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setPlaceholderText('Geolocation is not supported.');
      return;
    }
    setPlaceholderText('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPlaceholderText(`Location found! Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`);
      },
      (error) => {
        setPlaceholderText(`Could not get location. Try again.`);
        console.error("Geolocation error:", error);
      }
    );
  };
  
  const handleApplyFilters = (newFilters) => {
    setActiveFilters(newFilters);
  };

  // --- FILTERING & SORTING LOGIC ---
  const processedEateries = useMemo(() => {
    let eateriesToShow = [...allEateries];
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
        const searchContent = `${eatery.name} ${eatery.cuisine} ${eatery.neighborhood}`;
        return searchContent.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    switch (sortOrder) {
      case 'rating': eateriesToShow.sort((a, b) => b.rating - a.rating); break;
      case 'reviews': eateriesToShow.sort((a, b) => b.reviewCount - a.reviewCount); break;
      case 'name': eateriesToShow.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: break;
    }
    return eateriesToShow;
  }, [allEateries, activeFilters, searchTerm, sortOrder]);

  // --- RENDER ---
  return (
    <>
      <div className="eatery-grid-container">
        <div className="search-bar-container">
          <button className="location-icon-button" onClick={handleGetLocation} title="Use my current location">📍</button>
          <input type="text" placeholder={placeholderText} className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <select className="sort-dropdown" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="default">Sort by</option>
            <option value="rating">Highest Rating</option>
            <option value="reviews">Most Reviews</option>
            <option value="name">Name (A-Z)</option>
          </select>
          <button className="filter-button" onClick={() => setIsModalOpen(true)}>Filters</button>
        </div>
        <div className="eatery-grid">
          {processedEateries.map(eatery => <ListingCard key={eatery.id} eatery={eatery} />)}
          {processedEateries.length === 0 && <p className="no-results-message">No eateries found. Try adjusting your search or filters!</p>}
        </div>
      </div>
      <FilterModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onApply={handleApplyFilters} currentFilters={activeFilters} />
    </>
  );
}

// The one and only "Main Exit" for this file.
export default EateryGrid;