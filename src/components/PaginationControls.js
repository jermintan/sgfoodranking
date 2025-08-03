// FILE: src/components/PaginationControls.js

import React from 'react';

const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null; // Don't render pagination if there's only one page or no pages
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (pageNumber) => {
    onPageChange(pageNumber);
  };

  // Simple page number generation logic (can be made more complex for many pages)
  // For now, let's show a few pages around the current page, plus first and last.
  const pageNumbers = [];
  const maxPagesToShow = 5; // Max page links to show directly (e.g., 1 ... 3 4 5 ... 10)
  const halfPagesToShow = Math.floor(maxPagesToShow / 2);

  if (totalPages <= maxPagesToShow + 2) { // Show all pages if not too many
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    pageNumbers.push(1); // Always show first page

    let startPage = Math.max(2, currentPage - halfPagesToShow);
    let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);

    if (currentPage - halfPagesToShow <= 2) { // Near the beginning
        endPage = Math.min(totalPages -1, maxPagesToShow);
        startPage = 2;
    }
    if (currentPage + halfPagesToShow >= totalPages -1) { // Near the end
        startPage = Math.max(2, totalPages - maxPagesToShow +1);
        endPage = totalPages -1;
    }


    if (startPage > 2) {
      pageNumbers.push('...'); // Ellipsis if gap after first page
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    if (endPage < totalPages - 1) {
      pageNumbers.push('...'); // Ellipsis if gap before last page
    }

    pageNumbers.push(totalPages); // Always show last page
  }


  return (
    <div className="pagination-controls">
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="pagination-button prev-button"
      >
        « Previous
      </button>

      {pageNumbers.map((number, index) =>
        typeof number === 'number' ? (
          <button
            key={index}
            onClick={() => handlePageClick(number)}
            disabled={currentPage === number}
            className={`pagination-button page-number ${currentPage === number ? 'active' : ''}`}
          >
            {number}
          </button>
        ) : (
          <span key={index} className="pagination-ellipsis">
            {number}
          </span>
        )
      )}

      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="pagination-button next-button"
      >
        Next »
      </button>
    </div>
  );
};

export default PaginationControls;