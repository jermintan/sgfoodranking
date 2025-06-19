import React, { useState, useEffect } from 'react'; // <-- FIX for useState & useEffect
import { useParams, Link } from 'react-router-dom';   // <-- FIX for useParams & Link
import { mockEateries } from '../mockData';           // <-- FIX for mockEateries

const EateryDetailPage = () => {
  // The useParams hook reads the dynamic ':id' from the URL
  const { id } = useParams();

  // This will hold the eatery data once fetched or found
  const [eatery, setEatery] = useState(null);
  
  // NOTE: This logic is temporary. The next step is to replace this
  // with a real API call to fetch a single eatery from our backend.
  useEffect(() => {
    // We are finding from the old mockData for now to make the page work.
    // A real implementation would be: fetch(`/api/eateries/${id}`)
    const foundEatery = mockEateries.find(e => e.id === parseInt(id));
    
    // The server returns snake_case, so we need to use snake_case in our JSX.
    // We don't need to transform the data here because the JSX is already updated.
    // The server will provide the correct property names (`review_count`, `image_url`).
    setEatery(foundEatery);

  }, [id]);

  // Handle the case where the ID is invalid and no eatery is found
  if (!eatery) {
    return (
      <div className="detail-page-container">
        <Link to="/" className="back-link">← Back to all eateries</Link>
        <h1>Loading...</h1>
        {/* Or "Eatery not found!" if the fetch fails */}
      </div>
    );
  }

  // If we found the eatery, render its details
  return (
    <div className="detail-page-container">
      <Link to="/" className="back-link">← Back to all eateries</Link>
      <div className="detail-header">
        {/* Using snake_case to match the database schema */}
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
      </div>
    </div>
  );
};

export default EateryDetailPage;