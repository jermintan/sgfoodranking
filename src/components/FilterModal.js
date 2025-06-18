import React, { useState, useEffect } from 'react';

// We get the list of unique cuisines from our mock data to build the checkboxes
const Cuisines = ["Chinese", "Cafe", "Noodles", "Peranakan", "Western"];
const Prices = ["$", "$$", "$$$"];

const FilterModal = ({ isOpen, onClose, onApply, currentFilters }) => {
  // Temporary state to hold changes *before* the user clicks "Apply"
  const [tempFilters, setTempFilters] = useState(currentFilters);

  // When the modal opens, sync its temporary state with the app's current filters
  useEffect(() => {
    setTempFilters(currentFilters);
  }, [isOpen, currentFilters]);

  if (!isOpen) {
    return null; // If not open, render nothing
  }

  const handlePriceChange = (price) => {
    setTempFilters(prev => ({ ...prev, price: prev.price === price ? null : price }));
  };

  const handleCuisineChange = (cuisine) => {
    setTempFilters(prev => {
      const newCuisines = prev.cuisines.includes(cuisine)
        ? prev.cuisines.filter(c => c !== cuisine)
        : [...prev.cuisines, cuisine];
      return { ...prev, cuisines: newCuisines };
    });
  };
  
  const handleClear = () => {
    setTempFilters({ price: null, cuisines: [] });
  };

  const handleApplyClick = () => {
    onApply(tempFilters); // Send the selected filters back to the parent
    onClose(); // Close the modal
  };

  return (
    <div className="filter-modal-overlay" onClick={onClose}>
      <div className="filter-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Filters</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
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
          <div className="filter-section">
            <h4>Cuisine</h4>
            <div className="checkbox-group">
              {Cuisines.map(c => (
                <label key={c} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={tempFilters.cuisines.includes(c)}
                    onChange={() => handleCuisineChange(c)}
                  />
                  {c}
                </label>
              ))}
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