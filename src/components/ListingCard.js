import React from 'react';
import { Link } from 'react-router-dom'; // Import Link

const ListingCard = ({ eatery }) => {
  return (
    // Wrap the entire card in a Link component
    <Link to={`/eatery/${eatery.id}`} className="listing-card-link">
      <div className="listing-card">
        <div className="card-image-container">
          <img src={eatery.imageUrl} alt={eatery.name} className="card-image" />
        </div>
        <div className="card-details">
          <h3 className="card-title">{eatery.name}</h3>
          <p className="card-subtitle">{eatery.cuisine} • {eatery.neighborhood}</p>
          <div className="card-info-line">
            <span className="card-rating">★ {eatery.rating}</span>
            <span className="card-reviews">({eatery.reviewCount.toLocaleString()})</span>
            <span className="card-price">{eatery.price}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;