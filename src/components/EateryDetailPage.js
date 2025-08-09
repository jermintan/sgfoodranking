import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

const EateryDetailPage = () => {
  const { id } = useParams();
  const [eatery, setEatery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = closed

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

  const openLightboxAt = useCallback((i) => setLightboxIndex(i), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const prev = useCallback((total) => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + total) % total));
  }, []);
  const next = useCallback((total) => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % total));
  }, []);

  // Keyboard support
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prev(photoUrls.length);
      if (e.key === 'ArrowRight') next(photoUrls.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex]); // eslint-disable-line

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

  const mainPhotoUrl = hasPhotos
    ? `${API_BASE_URL}/api/photo?name=${encodeURIComponent(eatery.photos[0].name)}&h=900`
    : 'https://via.placeholder.com/800x500.png?text=No+Image';

  const galleryPhotos = hasPhotos && eatery.photos.length > 1
    ? eatery.photos.slice(1).map((p) =>
        `${API_BASE_URL}/api/photo?name=${encodeURIComponent(p.name)}&h=900`
      )
    : [];

  // Build array of ALL photo URLs (main first, then gallery) for lightbox navigation
  const photoUrls = hasPhotos ? [mainPhotoUrl, ...galleryPhotos] : [];

  // Touch handlers for swipe
  let touchStartX = 0;
  let touchEndX = 0;
  const onTouchStart = (e) => { touchStartX = e.changedTouches[0].clientX; };
  const onTouchEnd = () => {
    const total = photoUrls.length;
    const delta = touchEndX - touchStartX;
    if (Math.abs(delta) > 40) {
      delta < 0 ? next(total) : prev(total);
    }
  };
  const onTouchMove = (e) => { touchEndX = e.changedTouches[0].clientX; };

  return (
    <div className="detail-page-container">
      <Link to="/" className="back-link">← Back to all eateries</Link>
      <div className="detail-header">
        <div
          className="detail-image"
          style={{ backgroundImage: `url(${mainPhotoUrl})` }}
          onClick={() => openLightboxAt(0)}
          role="button"
          aria-label="Open image"
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
              <div
                key={i}
                className="gallery-photo-container"
                onClick={() => openLightboxAt(i + 1)} // +1 because main is index 0
                role="button"
                aria-label={`Open photo ${i + 1}`}
              >
                <img src={url} alt={`${eatery.name} gallery image ${i + 1}`} className="gallery-photo" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxIndex !== null && (
        <div
          className="lightbox-overlay"
          onClick={closeLightbox}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <button
            className="lightbox-nav lightbox-prev"
            onClick={(e) => { e.stopPropagation(); prev(photoUrls.length); }}
            aria-label="Previous image"
          >
            ‹
          </button>

          <img
            src={photoUrls[lightboxIndex]}
            alt="Enlarged view"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            className="lightbox-nav lightbox-next"
            onClick={(e) => { e.stopPropagation(); next(photoUrls.length); }}
            aria-label="Next image"
          >
            ›
          </button>

          <button
            className="lightbox-close"
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            aria-label="Close"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default EateryDetailPage;
