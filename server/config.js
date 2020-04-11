'use strict';

module.exports = {
  // App name
  appName: 'Rocket Rides',

  // Public domain of Rocket Rides
  publicDomain: process.env.DS_PUBLIC_DOMAIN,

  // Server port
  port: 3000,

  // Secret for cookie sessions
  secret: 'skfnfksdfbksdfn1312sfn123sdnsdf',

  // Configuration for Stripe
  // API Keys: https://dashboard.stripe.com/account/apikeys
  // Connect Settings: https://dashboard.stripe.com/account/applications/settings
  stripe: {
    secretKey: process.env.DS_STRIPE_SECRET_KEY,
    publishableKey: process.env.DS_STRIPE_PUBLISHABLE_KEY,
    clientId: process.env.DS_STRIPE_CLIENT_ID,
    authorizeUri: 'https://connect.stripe.com/express/oauth/authorize',
    tokenUri: 'https://connect.stripe.com/oauth/token'
  },

  // Configuration for MongoDB
  mongoUri: 'mongodb://localhost/rocketrides',

  // Configuration for Google Cloud (only useful if you want to deploy to GCP)
  gcloud: {
    projectId: 'YOUR_PROJECT_ID'
  }
};
