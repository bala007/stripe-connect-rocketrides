'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const request = require('request-promise-native');
const querystring = require('querystring');
const express = require('express');
const router = express.Router();

// Middleware that requires a logged-in pilot
function pilotRequired(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/pilots/login');
  } 
  next();
}

// Create a new Stripe Connect account for a Custom platform
async function createStripeAccount(pilot, type, ipAddress) {
  let stripeAccountId;
  /* Define the Capabilities we'll request for this account:
   *   - card_payments: sellers with connected accounts accept card payments directly
   *   - transfers: the platform transfers funds to a connected account
   */
  let requested_capabilities = ['card_payments', 'transfers'];
  if (type === 'individual') {
    // Create a connected Stripe Custom account for an individual
    const createdAccount = await stripe.accounts.create({
      type: 'custom',
      business_type: 'individual',
      individual: {
        email: pilot.email,
        first_name: pilot.firstName,
        last_name: pilot.lastName,
        address: {
          line1: pilot.address,
          city: pilot.city,
          country: pilot.country,
          state: pilot.state,
          postal_code: pilot.postalCode
        }
      },
      country: pilot.country,
      default_currency: pilot.currency,
      email: pilot.email,
      // Assign a debit card to the Custom account as a payment method:
      // we use a test token for simplicity in this demo.
      // external_account: 'tok_visa_debit_us_transferFail',
      requested_capabilities,
      /* If you're not using Connect Onboarding, you'll need to include a link to
      *  Stripe's service agreement and record the user's acceptance of our terms.
      *  (If you're using Connect Onboarding, this is included in the flow.)
      */
      // 'tos_acceptance[date]': Date.now(),
      // 'tos[ip]': ipAddress,
    });
    stripeAccountId = createdAccount.id;
  } else if (type === 'company') {
    // Create a connected Stripe Custom account for a business
    const createdAccount = await stripe.accounts.create({
      type: 'custom',
      business_type: 'company',
      company: {
        name: pilot.businessName,
        address: {
          line1: pilot.address,
          city: pilot.city,
          country: pilot.country,
          state: pilot.state,
          postal_code: pilot.postalCode
        }
      },
      country: pilot.country,
      email: pilot.email,
      // Assign a debit card to the Custom account as a payment method:
      // we use a test token for simplicity in this demo.
      // external_account: 'tok_visa_debit',
      requested_capabilities,
      /* If you're not using Con  nect Onboarding, you'll need to include a link to
      *  Stripe's service agreement and record the user's acceptance of our terms.
      *  (If you're using Connect Onboarding, this is included in the flow.)
      */
      // 'tos_acceptance[date]': Date.now(),
      // 'tos[ip]': ipAddress,
    });
    stripeAccountId = createdAccount.id;
    // Because this is a business (and not an individual), we'll need to specify
    // the account opener by email address using the Persons API.
    const accountOpener = await stripe.account.createPerson(stripeAccountId, {
      email: pilot.email,
      'relationship[account_opener]': 'true'
    });
  }

  return stripeAccountId;
}

/**
 * GET /pilots/stripe/authorize
 *
 * Redirect to Stripe to set up payments.
 */
router.get('/authorize', pilotRequired, async (req, res, next) => {
  // Generate a random string as `state` to protect from CSRF and include it in the session
  req.session.state = Math.random()
    .toString(36)
    .slice(2);
  // Define the mandatory Stripe parameters: make sure to include our platform's client ID
  let parameters = {
    client_id: config.stripe.clientId,
    state: req.session.state,
    response_type: 'code',
    scope: 'read_write',
    always_prompt: true
  };

  let authorizeUri;
  if(req.query.connectType === 'express'){
    authorizeUri = config.stripe.authorizeUri;
  } else if (req.query.connectType === 'standard') {
    authorizeUri = config.stripe.authorizeUriStandard;
  }

  console.log("***** req.query => ", req.query);
  console.log("***** authorizeUri => ", authorizeUri);

  if(authorizeUri){
    // Optionally, the Express onboarding flow accepts `first_name`, `last_name`, `email`,
    // and `phone` in the query parameters: those form fields will be prefilled
    parameters = Object.assign(parameters, {
      redirect_uri: config.publicDomain + '/pilots/stripe/token',
      'stripe_user[business_type]': req.user.type || 'individual',
      'stripe_user[business_name]': req.user.businessName || undefined,
      'stripe_user[first_name]': req.user.firstName || undefined,
      'stripe_user[last_name]': req.user.lastName || undefined,
      'stripe_user[email]': req.user.email || undefined,
      'stripe_user[country]': req.user.country || undefined,
      'suggested_capabilities[]': 'card_payments',
      // If we're suggesting this account have the `card_payments` capability,
      // we can pass some additional fields to prefill:
      // 'suggested_capabilities[]': 'card_payments',
      // 'stripe_user[street_address]': req.user.address || undefined,
      // 'stripe_user[city]': req.user.city || undefined,
      // 'stripe_user[zip]': req.user.postalCode || undefined,
      // 'stripe_user[state]': req.user.city || undefined,
    });
    console.log('Starting Express flow:', parameters);
    // Redirect to Stripe to start the Express onboarding flow
    res.redirect(
      authorizeUri + '?' + querystring.stringify(parameters)
    );
  } else {
    // Custom connect
    try {
      let pilot = req.user;
      if(!pilot.stripeAccountId){
        // With the created profile, create a Connect account
        try {
          const stripeAccountId = await createStripeAccount(pilot, pilot.type, req.ip);
          pilot.stripeAccountId = stripeAccountId;
        } catch (err) {
          console.log('Error creating Custom connected account: ', err);
          next(err);
        }
        await pilot.save();
      }
      console.log("pilot => ", JSON.stringify(req.user, null, 2));
      return res.redirect('/pilots/stripe/verify');
    } catch (err) {
      next(err);
    }
  }
});

/**
 * GET /pilots/stripe/verify
 *
 * Redirect to Stripe and use Connect Onboarding to verify the pilot's identity.
 */
router.get('/verify', pilotRequired, async (req, res) => {
  const pilot = req.user;
  try {
    // Create a Stripe Account link for the Connect Onboarding flow
    const accountLink = await stripe.accountLinks.create({
      type: 'custom_account_verification',
      account: pilot.stripeAccountId,
      collect: 'currently_due',
      success_url: config.publicDomain + '/pilots/dashboard?showBanner=true',
      // In the case of a failure, e.g. the link expired or the account was rejected,
      // redirect the user to this URL to refresh the Account Link.
      failure_url: config.publicDomain + '/pilots/dashboard'
    });
    // Redirect to Stripe to start the Connect Onboarding flow.
    res.redirect(accountLink.url);
  } catch (err) {
    console.log('Error generating Connect Onboarding URL: ',err);
    return res.redirect('/pilots/dashboard');
  }
});


/**
 * GET /pilots/stripe/token
 *
 * Connect the new Stripe account to the platform account.
 */
router.get('/token', pilotRequired, async (req, res, next) => {
  // Check the `state` we got back equals the one we generated before proceeding (to protect from CSRF)
  if (req.session.state !== req.query.state) {
    return res.redirect('/pilots/signup');
  }

  if(req.query.error){
    console.log("error => ", req.query.error);
    console.log("error_description => ", req.query.error_description);
    return res.redirect('/pilots/signup');
  }

  try {
    // Post the authorization code to Stripe to complete the Express onboarding flow
    const expressAuthorized = await request.post({
      uri: config.stripe.tokenUri, 
      form: { 
        grant_type: 'authorization_code',
        client_id: config.stripe.clientId,
        client_secret: config.stripe.secretKey,
        code: req.query.code
      },
      json: true
    });

    if (expressAuthorized.error) {
      throw(expressAuthorized.error);
    }

    // Update the model and store the Stripe account ID in the datastore:
    // this Stripe account ID will be used to issue payouts to the pilot
    req.user.stripeAccountId = expressAuthorized.stripe_user_id;
    await req.user.save();

    // Redirect to the Rocket Rides dashboard
    req.flash('showBanner', 'true');
    res.redirect('/pilots/dashboard');
  } catch (err) {
    console.log('The Stripe onboarding process has not succeeded.');
    next(err);
  }
});

/**
 * GET /pilots/stripe/dashboard
 *
 * Redirect to the pilots' Stripe Express dashboard to view payouts and edit account details.
 */
router.get('/dashboard', pilotRequired, async (req, res) => {
  const pilot = req.user;
  // Make sure the logged-in pilot completed the Express onboarding

  console.log("pilot: ", pilot);

  if (!pilot.stripeAccountId) {
    return res.redirect('/pilots/signup');
  }
  try {
    // Generate a unique login link for the associated Stripe account to access their Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(
      pilot.stripeAccountId, {
        redirect_url: config.publicDomain + '/pilots/dashboard'
      }
    );
    // Directly link to the account tab
    if (req.query.account) {
      loginLink.url = loginLink.url + '#/account';
    }
    // Retrieve the URL from the response and redirect the user to Stripe
    return res.redirect(loginLink.url);
  } catch (err) {
    console.log(err);
    console.log('Failed to create a Stripe login link.');
    return res.redirect('/pilots/signup');
  }
});

/**
 * POST /pilots/stripe/payout
 *
 * Generate an instant payout with Stripe for the available balance.
 */
router.post('/payout', pilotRequired, async (req, res) => {
  const pilot = req.user;
  try {
    // Fetch the account balance to determine the available funds
    const balance = await stripe.balance.retrieve({
      stripe_account: pilot.stripeAccountId,
    });
    // This demo app only uses USD so we'll just use the first available balance
    // (Note: there is one balance for each currency used in your application)
    const {amount, currency} = balance.available[0];
    // Create an instant payout
    const payout = await stripe.payouts.create(
      {
        amount: amount,
        currency: currency,
        statement_descriptor: config.appName,
      },
      {
        stripe_account: pilot.stripeAccountId,
      }
    );
  } catch (err) {
    console.log(err);
  }
  res.redirect('/pilots/dashboard');
});

module.exports = router;
