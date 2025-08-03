import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const EateryDetailPage = () => {
  const { id } = useParams();
  const [eatery, setEatery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

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
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEateryDetails();
  }, [id]);

  if (loading) { /* ... same as before ... */ }
  if (error || !eatery) { /* ... same as before ... */ }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eatery.name + ' ' + eatery.neighbourhood)}`;

  // --- THIS LOGIC IS NOW CORRECTED AND SIMPLIFIED ---
  const hasPhotos = eatery.photos && eatery.photos.length > 0;
  
  const mainPhotoUrl = hasPhotos 
    ? `https://places.googleapis.com/v1/${eatery.photos[0].name}/media?maxHeightPx=400&key=${API_KEY}`
    : 'https://via.placeholder.com/400x400.png?text=No+Image';
    
  const galleryPhotos = hasPhotos && eatery.photos.length > 1 
    ? eatery.photos.slice(1).map(photo => `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=400&key=${API_KEY}`)
    : [];
  // --- END OF CORRECTION ---

  return (
    <div className="detail-page-container">
      <Link to="/" className="back-link">← Back to all eateries</Link>
      <div className="detail-header">
        <div 
          className="detail-image" 
          style={{ backgroundImage: `url(${mainPhotoUrl})` }}
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

      {galleryPhotos.length > 0 && (
        <div className="photo-gallery-section">
          <h2>More Photos</h2>
          <div className="photo-gallery-grid">
            {galleryPhotos.map((url, index) => (
              <div key={index} className="gallery-photo-container">
                <img src={url} alt={`${eatery.name} gallery image ${index + 1}`} className="gallery-photo"/>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EateryDetailPage;