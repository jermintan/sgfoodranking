// FILE: src/components/EateryDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const EateryDetailPage = () => {
  const { id } = useParams();
  const [eatery, setEatery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use same base as the grid/cards
  const API_BASE_URL =
    process.env.NODE_ENV === 'production'
      ? process.env.REACT_APP_API_URL
      : 'http://localhost:3001';

  useEffect(() => {
    const fetchEateryDetails = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/eateries/${id}`);
        if (!res.ok) throw new Error(`Eatery not found (status: ${res.status})`);
        const data = await res.json();
        setEatery(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEateryDetails();
  }, [id, API_BASE_URL]);

  if (loading) return <div className="detail-page-container"><h2>Loading...</h2></div>;

  if (error || !eatery) {
    return (
      <div className="detail-page-container">
        <Link to="/" className="back-link">← Back to all eateries</Link>
        <h1>Eatery Not Found</h1>
        <p>Sorry, we couldn't find the details for this eatery.</p>
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${eatery.name} ${eatery.neighbourhood}`
  )}`;

  const hasPhotos = eatery.photos && eatery.photos.length > 0;

  // ✅ Use proxy for images
  const mainPhotoUrl = hasPhotos
    ? `${API_BASE_URL}/api/photo?name=${encodeURIComponent(eatery.photos[0].name)}&h=600`
    : 'https://via.placeholder.com/800x500.png?text=No+Image';

  const galleryPhotos = hasPhotos && eatery.photos.length > 1
    ? eatery.photos.slice(1).map(p =>
        `${API_BASE_URL}/api/photo?name=${encodeURIComponent(p.name)}&h=400`
      )
    : [];

  return (
    <div className="detail-page-container">
      <Link to="/" className="back-link">← Back to all eateries</Link>
      <div className="detail-header">
        <div
          className="detail-image"
          style={{ backgroundImage: `url(${mainPhotoUrl})` }}
        />
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
            {galleryPhotos.map((url, i) => (
              <div key={i} className="gallery-photo-container">
                <img src={url} alt={`${eatery.name} gallery image ${i + 1}`} className="gallery-photo" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EateryDetailPage;
