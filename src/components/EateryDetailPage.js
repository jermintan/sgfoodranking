import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

// We NO LONGER need to import mockData here!
// import { mockEateries } from '../mockData'; 

const EateryDetailPage = () => {
  const { id } = useParams();
  const [eatery, setEatery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- REAL DATA FETCHING from our new backend endpoint ---
  useEffect(() => {

    const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? process.env.REACT_APP_API_URL 
    : 'http://localhost:3001';
    
    const fetchEateryDetails = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/eateries/${id}`);
        if (!response.ok) {
          throw new Error(`Eatery not found (status: ${response.status})`);
        }
        const data = await response.json();
        setEatery(data);
      } catch (err) {
        console.error("Failed to fetch eatery details:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEateryDetails();
  }, [id]); // Re-run this effect if the ID in the URL changes

  // --- Dynamic URLs (no change needed here) ---
  const googleMapsUrl = eatery 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eatery.name + ' ' + eatery.neighbourhood)}` 
    : '#';

  // --- RENDER LOGIC with proper loading and error states ---
  if (loading) {
    return <div className="detail-page-container"><h2>Loading...</h2></div>;
  }

  if (error || !eatery) {
    return (
      <div className="detail-page-container">
        <Link to="/" className="back-link">← Back to all eateries</Link>
        <h1>Eatery Not Found</h1>
        <p>Sorry, we couldn't find the details for this eatery.</p>
      </div>
    );
  }

  return (
    <div className="detail-page-container">
      <Link to="/" className="back-link">← Back to all eateries</Link>
      <div className="detail-header">
        <div 
          className="detail-image" 
          // Use the correct snake_case property from our API
          style={{ backgroundImage: `url(${eatery.image_url})` }}
        ></div>
        <div className="detail-title-section">
          <h1>{eatery.name}</h1>
          <p>{eatery.cuisine} • {eatery.neighbourhood}</p>
          <p className="detail-rating">★ {eatery.rating} ({eatery.review_count.toLocaleString()} reviews)</p>
          
          <div className="detail-actions">
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="action-button maps-button">
              Open in Google Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EateryDetailPage;