import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockEateries } from '../mockData';

const EateryDetailPage = () => {
  // The useParams hook reads the dynamic ':id' from the URL
  const { id } = useParams();

  // Find the specific eatery from our mock data array.
  // Note: The 'id' from the URL is a string, so we use parseInt to convert it to a number for matching.
  const eatery = mockEateries.find(e => e.id === parseInt(id));

  // Handle the case where the ID is invalid and no eatery is found
  if (!eatery) {
    return (
      <div className="detail-page-container">
        <Link to="/" className="back-link">← Back to all eateries</Link>
        <h1>Eatery not found!</h1>
      </div>
    );
  }

  // If we found the eatery, render its details
  return (
    <div className="detail-page-container">
      <Link to="/" className="back-link">← Back to all eateries</Link>
      <div className="detail-header">
        <img src={eatery.imageUrl} alt={eatery.name} className="detail-image" />
        <div className="detail-title-section">
          <h1>{eatery.name}</h1>
          <p>{eatery.cuisine} • {eatery.neighborhood} • {eatery.price}</p>
          <p className="detail-rating">★ {eatery.rating} ({eatery.reviewCount.toLocaleString()} reviews)</p>
        </div>
      </div>
      <div className="detail-body">
        <h2>About this place</h2>
        <p>This is where a detailed description of the eatery would go. We could talk about its history, its signature dishes, and what makes it a local favorite. For now, this is just placeholder text, but it shows how the layout would accommodate more information.</p>
        {/* More sections like 'Opening Hours', 'Location on Map', etc. could go here */}
      </div>
    </div>
  );
};

export default EateryDetailPage;