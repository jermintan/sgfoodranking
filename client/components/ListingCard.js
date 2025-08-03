import React from 'react';
import { Link } from 'react-router-dom';

const ListingCard = ({ eatery }) => {
  // --- THIS IS THE API KEY FROM YOUR FRONTEND ENVIRONMENT ---
  // Ensure this is in a .env file in your project's ROOT directory
  const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  // --- THIS IS THE FIX ---
  // Check if the photos array exists and has photos.
  const hasPhotos = eatery.photos && eatery.photos.length > 0;
  
  // Construct the URL for the FIRST photo to use as the thumbnail.
  const imageUrl = hasPhotos
    ? `https://places.googleapis.com/v1/${eatery.photos[0].name}/media?maxHeightPx=400&key=${API_KEY}`
    : 'https://via.placeholder.com/400x400.png?text=No+Image';
  // --- END OF FIX ---

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