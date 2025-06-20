-- This is a RECONSTRUCTED schema if you can't find your original.
-- Run this in your LOCAL eatery_app database via pgAdmin's Query Tool.

DROP TABLE IF EXISTS eateries; -- Be careful with DROP TABLE if you have any local data you want to keep

CREATE TABLE eateries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    cuisine VARCHAR(100),
    neighbourhood VARCHAR(100),
    rating NUMERIC(3,1) DEFAULT 0, -- e.g., allows 4.5
    review_count INTEGER DEFAULT 0,
    price VARCHAR(10),
    image_url TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    is_halal BOOLEAN NOT NULL DEFAULT FALSE,
    is_vegetarian BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE -- Include this since you added it to Render and seed.js expects it
);