#!/usr/bin/env bash
# Firestore doesn't have SQL migrations like Postgres.
# Use this script to create indexes or to verify Firestore connectivity.
# Requires gcloud SDK configured with project or GOOGLE_APPLICATION_CREDENTIALS set.

set -e

echo "Verifying Firestore connectivity..."
node -e "require('./dist/firebaseAdmin.js'); console.log('Firebase admin loaded');"
echo "If you need composite indexes, create firestore.indexes.json and run: gcloud firestore indexes composite create --project=$FIREBASE_PROJECT_ID --file=firestore.indexes.json"
