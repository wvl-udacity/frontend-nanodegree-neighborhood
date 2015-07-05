// Model section.
// A neighborhood models a certain area with certain places of interest.
// These places have a location, a name, and a description.
// The places can be filtered.

var Place = function(name, location, filter) {
  this.name = name;
  this.location = location;

  this.content = ko.observable('');
  this.contentLoaded = false;

  this.visible = ko.computed(function() {
    return this.name.indexOf(filter()) !== -1;
  }, this);
};

var Neighborhood = function() {
  this.location = {lat: 51.214089, lng: 4.414368};
  this.zoom = 13;

  this.filter = ko.observable('');
  this.places = ko.observableArray();
  this.places.push(new Place(
      'Antwerpen-Centraal railway station',
      {lat: 51.216191, lng: 4.421215},
      this.filter));
  this.places.push(new Place(
      'Cathedral of Our Lady',
      {lat: 51.220291, lng: 4.401515},
      this.filter));
  this.places.push(new Place(
      'Het steen',
      {lat: 51.222724, lng: 4.397364},
      this.filter));
};

// ViewModel section.

var ViewModel = function() {
  this.neighborhood = ko.observable(new Neighborhood());
  this.mapView = new MapView(this);
};

// Populates the description of a place through an asynchronous callback to
// Wikipedia.
ViewModel.prototype.populateContent = function(place) {
  if (place.contentLoaded === true) {
    return;
  }
  $.ajax({
    url: 'https://en.wikipedia.org/w/api.php',
    data: {
      action: 'opensearch',
      search: place.name
    },
    dataType: 'jsonp',
    jsonp: 'callback',
    success: function(result) {
      place.content(result[2][0]);
      place.contentLoaded = true;
    },
    timeout: 5000,
    error: function() {
      place.content('Could not fetch content.');
      place.contentLoaded = false;
    }
  });
};

// View section.
// The view of the map and its markers is described here.

var MapView = function(viewmodel) {
  this.viewmodel = viewmodel;
};

MapView.prototype.init = function(element, neighborhood) {
  var mapOptions = {
    center: neighborhood.location,
    zoom: neighborhood.zoom,
    noClear: true,  // The virtual elements are in the div.
    disableDefaultUI: true,
    styles: [
      {
        featureType: 'poi',
        stylers: [
          {
            visibility: 'off'
          }
        ]
      },
      {
        featureType: 'transit',
        stylers: [
          {
            visibility: 'off'
          }
        ]
      },
    ]
  };
  this.map = new google.maps.Map(element, mapOptions);
  this.markers = [];
  this.infowindows = [];
  this.infoboxTemplate = _.template($('#infobox_template').html());
};

// Creates a marker with an associated info window.
MapView.prototype.addMarker = function(place) {
  var self = this;
  // Create a marker.
  var marker = new google.maps.Marker({
      title: place.name,
      position: place.location,
  });
  this.markers.push(marker);

  // Create an info window, initially displaying a loading gif until
  // new content is loaded.
  var infowindow = new google.maps.InfoWindow({
    content: this.infoboxTemplate({
      name: place.name,
      content: '<img src="img/loading.gif">'
    })
  });
  this.infowindows.push(infowindow);
  // Make a binding between the info window and the description of the place.
  place.content.subscribe(function(newContent) {
    infowindow.setContent(
        self.infoboxTemplate({name: place.name, content: newContent}));
  });
  // On a click, we will asynchronously load the content,
  // and open the info window.
  var index = this.markers.length - 1;
  google.maps.event.addListener(marker, 'click', function() {
    self.openInfoWindow(place, index);
  });
};

// Asynchronously loads the description of the place if needed,
// and opens the info window.
MapView.prototype.openInfoWindow = function(place, index) {
  // Close all other info windows.
  for (var i = 0; i < this.infowindows.length; ++i) {
    this.infowindows[i].close();
  }
  this.viewmodel.populateContent(place);
  this.infowindows[index].open(this.map, this.markers[index]);
};

// Places the relevant marker on the map if the place is not filtered out.
MapView.prototype.renderMarker = function(place, index) {
  if (place.visible()) {
    this.markers[index].setMap(this.map);
  } else {
    this.markers[index].setMap(null);
  }
};

// Bindings between the model and the map view.

// Handles initialization of the map, given a model of the neighborhood.
ko.bindingHandlers.mapInit = {
  init: function(element, valueAccessor, allBindings,
                 viewModel, bindingContext) {
    ko.unwrap(valueAccessor()).init(element, bindingContext.$data);
  }
};

// Handles initialization and updates of the markers,
// given a model of the place.
ko.bindingHandlers.marker = {
  init: function(element, valueAccessor, allBindings,
                 viewModel, bindingContext) {
    ko.unwrap(valueAccessor()).addMarker(bindingContext.$data);
  },
  update: function(element, valueAccessor, allBindings,
                   viewModel, bindingContext) {
    ko.unwrap(valueAccessor()).renderMarker(
        bindingContext.$data, bindingContext.$index());
  }
};
// The markers are virtual elements.
ko.virtualElements.allowedBindings.marker = true;

// Create the M-V-VM objects and connect them.
ko.applyBindings(new ViewModel());
