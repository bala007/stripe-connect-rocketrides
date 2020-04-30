'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Ride schema.
const RideSchema = new Schema({
  pilot: { type : Schema.ObjectId, ref : 'Pilot', required: true },
  passenger: { type : Schema.ObjectId, ref : 'Passenger', required: true },
  origin: { type: [Number], index: '2d', sparse: true, default: [37.7765030, -122.3920385] },
  destination: { type: [Number], index: '2d', sparse: true, default: [37.8199286, -122.4782551] },
  pickupTime: { type: Date, default: Date.now },
  dropoffTime: { type: Date, default: new Date((new Date).getTime() + Math.floor(10 * Math.random()) * 60000) },
  amount: Number,
  currency: { type: String, default: 'usd' },
  chargeType: { type: String },
  created: { type: Date, default: Date.now },

  // Stripe Payment Intent ID corresponding to this ride.
  stripePaymentIntentId: String
});

// Return the ride amount for the pilot after collecting 20% platform fees.
RideSchema.methods.amountForPilot = function(currency) {
  return parseInt(this.amount - this.initialApplicationFee(currency));
};

// Return the ride amount for the pilot after collecting 20% platform fees.
RideSchema.methods.meetlyFee = function() {
  return parseInt(this.amount * 0.08);
};

RideSchema.methods.stripeFee = function(country) {
  let fixedalue = 0.3;
  let perValue = 0.029;
  if(country === 'HK'){
    fixedalue = 2.35;
    perValue = 0.034;
  } else if(country === 'GB'){
    fixedalue = 0.2;
    perValue = 0.029;
  }
  return parseInt(((this.amount*perValue) + fixedalue*100));
};

RideSchema.methods.applicationFee = function(country, currency) {
  let conversion_buffer = 1;
  if(country === 'HK') {
    if (currency !== 'HKD') {
      conversion_buffer = 3
    }
  } else if(country === 'GB'){
    if(currency !== 'GBP'){
      conversion_buffer = 1.5;
    }
  }

  return this.stripeFee(country) + parseInt(this.amount*0.08*conversion_buffer);
};

RideSchema.methods.initialApplicationFee = function(currency) {


  let presentmentCurrency = this.currency.toLowerCase();
  let destinationCurrency;
  if(currency){
    destinationCurrency = currency.toLowerCase();
  }

  // if(presentmentCurrency !== destinationCurrency){
  //   return this.amount*0.5;
  // } else {
    let fixedalue = 0.3;
    let perValue = 0.029;
    if(destinationCurrency === 'eur'){
      fixedalue = 0.25;
      perValue = 0.029;
    } else if (destinationCurrency === 'hkd'){
      fixedalue = 2.35;
      perValue = 0.034;
    }

    return parseInt(this.amount*0.08) + parseInt(((this.amount*perValue) + fixedalue*100));
  // }

};

const Ride = mongoose.model('Ride', RideSchema);

module.exports = Ride;
