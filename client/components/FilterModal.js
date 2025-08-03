// src/components/FilterModal.js
import React, { useState, useEffect } from 'react';

// Cuisines array is no longer needed here
// const Cuisines = [ ... ];
const Prices = ["$", "$$", "$$$", "$$$$"];

const FilterModal = ({ isOpen, onClose, onApply, currentFilters }) => {
  // tempFilters will now handle price, isHalal, isVegetarian
  const [tempFilters, setTempFilters] = useState({
    price: null,
    // cuisines: [], // REMOVED
    isHalal: false,
    isVegetarian: false,
    ...currentFilters // Spread currentFilters last
  });

  useEffect(() => {
    if (isOpen) {
      setTempFilters(prev => ({
        price: null,
        // cuisines: [], // REMOVED
        isHalal: false,
        isVegetarian: false,
        ...currentFilters
      }));
    }
  }, [isOpen, currentFilters]);

  if (!isOpen) {
    return null;
  }

  const handlePriceChange = (price) => {
    setTempFilters(prev => ({ ...prev, price: prev.price === price ? null : price }));
  };

  // handleCuisineChange is no longer needed

  const handleDietaryChange = (filterName) => {
    setTempFilters(prev => ({ ...prev, [filterName]: !prev[filterName] }));
  };

  const handleClear = () => {
    // Only clears price and dietary options
    setTempFilters({ price: null, isHalal: false, isVegetarian: false });
  };

  const handleApplyClick = () => {
    onApply(tempFilters);
    onClose();
  };

  return (
    <div className="filter-modal-overlay" onClick={onClose}>
      <div className="filter-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Filters</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {/* Price Range Section */}
          <div className="filter-section">
            <h4>Price Range</h4>
            <div className="button-group">
              {Prices.map(p => (
                <button
                  key={p}
                  className={`price-button ${tempFilters.price === p ? 'active' : ''}`}
                  onClick={() => handlePriceChange(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Cuisine Section REMOVED */}
          {/*
          <div className="filter-section">
            <h4>Cuisine</h4>
            <div className="checkbox-group"> ... </div>
          </div>
          */}

          {/* Dietary Options Section (KEEP THIS) */}
          <div className="filter-section">
            <h4>Dietary Options</h4>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={tempFilters.isHalal || false}
                  onChange={() => handleDietaryChange('isHalal')}
                />
                Halal
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={tempFilters.isVegetarian || false}
                  onChange={() => handleDietaryChange('isVegetarian')}
                />
                Vegetarian
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="clear-button" onClick={handleClear}>Clear All</button>
          <button className="apply-button" onClick={handleApplyClick}>Apply Filters</button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;