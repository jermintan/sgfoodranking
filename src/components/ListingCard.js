import React from 'react';
import { Link } from 'react-router-dom';

const ListingCard = ({ eatery }) => {
  // --- THE FIX IS HERE ---
  // We construct a URL to our OWN backend proxy, passing the real image URL as a query parameter.
  // We must encode the Google URL to ensure it's passed correctly.
  const proxyImageUrl = `http://localhost:3001/api/image?url=${encodeURIComponent(eatery.image_url)}`;

  return (
    <Link to={`/eatery/${eatery.id}`} className="listing-card-link">
      <div className="listing-card">
        <div 
          className="card-image-bg" 
          // We now use our new proxy URL for the background image
          style={{ backgroundImage: `url(${proxyImageUrl})` }}
        >
        </div>
        <div className="card-details">
          <h3 className="card-title">{eatery.name}</h3>
          <p className="card-subtitle">{eatery.cuisine} • {eatery.neighbourhood}</p>
          <div className="card-info-line">
            <span className="card-rating">★ {eatery.rating}</span>
            <span className="card-reviews">({eatery.review_count.toLocaleString()})</span>
            <span className="card-price">{eatery.price}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;