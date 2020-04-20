// Toggle between each type of legal entity (business or individual) in the signup form
document.body.addEventListener('change', function(e) {
  if (e.target.name !== 'pilot-type') {
    return;
  }

  // Show the correct header for the select legal entity
  var headerPrefix = e.target.value === 'individual' ? 'Personal' : 'Company';
  document.querySelector(
    '.pilot-header#account-info'
  ).innerText = `${headerPrefix} information`;

  // Show any fields that apply to the new pilot type
  var pilotInfoRows = document.querySelectorAll('.pilot-info');
  pilotInfoRows.forEach(function(row) {
    row.classList.toggle('hidden', !row.classList.contains(e.target.value));
  });
});

// Enable sequence of annotation cards on the Dashboard
const dashboardAnnotation = document.querySelector('.annotation.dashboard-banner button.next');
if (dashboardAnnotation !== null) {
  dashboardAnnotation.addEventListener('click', function(e) {
    e.preventDefault();
    document
      .querySelector('.annotation.dashboard-banner')
      .classList.toggle('hidden');
    document
      .querySelector('.annotation.dashboard-simulate')
      .classList.toggle('hidden');
  }); 
}

// In mobile / responsive mode, toggle showing details on annotation cards
document.querySelectorAll('.annotation.card').forEach(function(card) {
  card.querySelector('h4').addEventListener('click', function(e) {
    card.querySelector('a.show-more').classList.toggle('expanded');
    card.querySelector('.description').classList.toggle('expanded');
  });
});


// Get the modal
var modal = $("#myModal"),
    span = $(".close:first")
;

// When the user clicks on the button, open the modal
$("#myBtn").click(function () {
  modal.show();
  var paymentIntent = $(this).attr('data-paymentIntent');
  var publishKey = $(this).attr('data-publishKey');
  console.log("paymentIntent: ", paymentIntent);
  console.log("publishKey: ", publishKey);
  payWithCard(paymentIntent);
});

// When the user clicks on <span> (x), close the modal
span.click(function () {
  modal.hide();
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};


var payWithCard = function(paymentIntent){

  var payButton = $('#payWithCard');

  payButton.prop( "disabled", true );

  var stripe = Stripe('pk_test_4ZXpoVP3gkXxSSfnpzL6E9G400arrENpcP');
  var elements = stripe.elements();
  var style = {
    base: {
      color: "#32325d",
    }
  };
  var style2 = {
    iconStyle: 'solid',
    base: {
      iconColor: '#fff',
      color: '#fff',
      fontWeight: 500,
      fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      ':-webkit-autofill': {
        color: '#fce883',
      },
      '::placeholder': {
        color: '#BFAEF6',
      },
    },
    invalid: {
      iconColor: '#FFC7EE',
      color: '#FFC7EE',
    },
  };
  var card = elements.create("card", { style: style2 });

  card.on('change', function(event) {
    $('#card-errors').text('');
    if (event.complete) {
      payButton.prop( "disabled", false);
      console.log("change:: complete event: ", event);
    } else if (event.error) {
      $('#card-errors').text(event.error.message);
      console.log("change:: error event: ", event);
    }
  });

  card.mount("#card-element");
};

function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  var results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

var sendRequest = function (url, data) {
  var jqxhr = $.ajax( "example.php" )
    .done(function(data) {
      console.log('done: ', data);
    })
    .fail(function(error) {
      console.log('error: ', error);
    })
    .always(function(data, error) {
      console.log('always: ', data, error);
    });
};