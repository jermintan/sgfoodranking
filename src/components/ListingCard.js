import React from 'react';
import { Link } from 'react-router-dom';

const ListingCard = ({ eatery }) => {
  // Use the same API base as EateryGrid
  const API_BASE_URL =
    process.env.NODE_ENV === 'production'
      ? process.env.REACT_APP_API_URL   // e.g. https://your-render-service.onrender.com
      : 'http://localhost:3001';

  // Check if the photos array exists and has photos
  const hasPhotos = eatery.photos && eatery.photos.length > 0;

  // Build URL to your backend proxy
  const imageUrl = hasPhotos
    ? `${API_BASE_URL}/api/photo?name=${encodeURIComponent(eatery.photos[0].name)}&h=400`
    : 'https://via.placeholder.com/400x400.png?text=No+Image';

  return (
    <Link to={`/eatery/${eatery.id}`} className="listing-card-link">
      <div className="listing-card">
        <div
          className="card-image-bg"
          style={{ backgroundImage: `url(${imageUrl})` }}
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
