import React from 'react';
import { Link } from 'react-router-dom';

const ListingCard = ({ eatery }) => {
  return (
    // We can simplify this back to a regular div, as the Link can wrap it in EateryGrid.js
    // Or keep it as a link, let's keep it for now.
    <Link to={`/eatery/${eatery.id}`} className="listing-card-link">
      <div className="listing-card">
        {/* --- THE MAJOR CHANGE IS HERE --- */}
        {/* Instead of an <img> tag, we use a div with a background image */}
        <div 
          className="card-image-bg" 
          style={{ backgroundImage: `url(${eatery.image_url})` }}
        >
          {/* This div acts as a container for the image */}
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