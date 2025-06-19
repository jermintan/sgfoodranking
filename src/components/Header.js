import React from 'react';

const Logo = () => (
  <svg viewBox="0 0 1000 1000" role="presentation" aria-hidden="true" focusable="false" style={{height: '32px', width: '32px', display: 'block', fill: '#111111'}}><path d="m499.3 736.7c-51-64-81-120.1-91-168.1-10-39-6-70 11-93 18-27 45-40 80-40s62 13 80 40c17 23 21 54 11 93-11 49-41 105-91 168.1zm-245.3-18c-27-20-43-46-43-77 0-32 15-58 41-78s58-31 98-31 70 11 93 31c23 20 35 45 35 76 0 31-12 56-35 76s-51 30-84 30-59-11-85-30zm487 0c-27-20-43-46-43-77 0-32 15-58 41-78s58-31 98-31 70 11 93 31c23 20 35 45 35 76 0 31-12 56-35 76s-51 30-84 30-59-11-85-30zm-242-247c-25-31-38-66-38-107 0-41 13-76 38-107s57-46 95-46 70 15 95 46 38 66 38 107-13 76-38 107-57 46-95 46-70-15-95-46zm0 0c-25-31-38-66-38-107 0-41 13-76 38-107s57-46 95-46 70 15 95 46 38 66 38 107-13 76-38 107-57 46-95 46-70-15-95-46z"></path></svg>
);

const Header = () => {
  return (
    <header className="main-header">
      <div className="logo-container">
        <Logo />
        <span className="logo-text">sgfoodranking</span>
      </div>
    </header>
  );
};

export default Header;