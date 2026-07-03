#!/bin/bash
echo "Building backend..."
cd backend && npm run build
echo "Building frontend..."
cd ../frontend && npm run build
echo "Running migrations..."
cd ../backend && npm run migrate:up
echo "Deployment complete!"
