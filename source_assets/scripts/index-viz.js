$(document).ready(function() {

  var rank = function (parent) {

    var $parent = $(parent),
      map = L.mapbox.map('index-viz', 'derrr.f5dvlsor')
        .setView([0,0], 2)

      ,point = function(x, y) {
        var pt = map.latLngToLayerPoint([y, x]);
        this.stream.point(pt.x, pt.y);
      }
      ,projection = d3.geo.transform({point: point})
      ,path = d3.geo.path().projection(projection)

      ,clicked = false
      ,tooltip = d3.tip().attr('class', 'rank-tooltip').html(function(d) {
        var d = d.rank,
          rank = d.overall_ranking < 10 ? '0' + d.overall_ranking : d.overall_ranking;
        return [
          '<div class="rank-tooltip-head"><label>Region goes here</label>'
          ,'<h5>' + d.name, '</h5><span class="rank-tooltip-close">&#10005;</span></div>'
          ,'<div class="rank-tooltip-body">'
          ,'<table><tr><td class="first">' + d.overall_ranking, '</td><td>Rank</td></tr>'
          ,'<tr><td class="first">' + d.score, '</td><td>Score</td></tr>'

          // four indicators
          ,'<tr><td class="first">' + d.parameters[0].value
          ,'</td><td class="tooltip-table-indicator indicator-0">Enabling Framework</td></tr>'

          ,'<tr><td class="first">' + d.parameters[1].value
          ,'</td><td class="tooltip-table-indicator indicator-1">Financing & Investment</td></tr>'

          ,'<tr><td class="first">' + d.parameters[2].value
          ,'</td><td class="tooltip-table-indicator indicator-2">Value Chains</td></tr>'

          ,'<tr><td class="first">' + d.parameters[3].value
          ,'</td><td class="tooltip-table-indicator indicator-3">GHG Management</td></tr>'

          ,'</table>'
          ,'<button class="rank-tooltip-link">View Country &rsaquo;</button>'
          ,'</div>'

        ].join(' ');
      })
      // UI element for toggling the map
      ,$countryFilter = $('<ul>', {
        'class': 'leaflet-control bttn-group bttn-group-s bttn-list map-country-toggle'
      })
      ,svg = d3.select(map.getPanes().overlayPane)
        .append('svg:svg')
        .call(tooltip)
      ,g = svg.append('svg:g').attr('class', 'leaflet-zoom-hide')

      // ,radius = d3.scale.sqrt().range([4, 24])

      // placeholder variables to query via http request
      ,land
      ,indicators
      ,markers

      // 1: top ten; -1: bottom ten; 0: all
      ,countryFilter = {
        'bottom-ten': -1
        ,'top-ten': 1
        ,'all': 0
      }
      ,visibleCountries = countryFilter['top-ten']
      ,zoom = map.getZoom()

      ,undef
    ;

    queue()
    .defer(d3.json, CS.domain + '/' + CS.lang + '/api/countries.topojson')
    .defer(d3.json, CS.domain + '/' + CS.lang + '/api/countries.json')

    //.defer(d3.json, 'en/api/countries.topojson')
    //.defer(d3.json, 'en/api/countries.json')
    .await(function(error, geography, countryRank) {

      land = topojson.feature(geography, geography.objects.countries).features;
      indicators = countryRank;

      var lookup = {}
        ,max = []
        ,filtered = []
        ,iso
      ;

      // create a look-up table for each indicator by country code
      // also get a list of each overall ranking to create color scale
      for (var i = 0, ii = indicators.length; i < ii; ++i) {
        lookup[indicators[i].iso] = i;
        max.push(indicators[i].overall_ranking);
      }

      // using lookup, filter out geographies that don't have data;
      // join indicator data to countries with data
      for (i = 0, ii = land.length; i < ii; ++i) {
        iso = land[i].id;
        if (lookup[iso] !== undef) {
          land[i].rank = indicators[lookup[iso]];
          filtered.push(land[i]);
        }
      }

      land = filtered.sort(function(a, b) { return a.rank.overall_ranking - b.rank.overall_ranking });
      reset(), redraw(true, getSlice(land, visibleCountries));

      $countryFilter.on('click', 'button', function(e) {

        var cls = e.currentTarget.className
          ,toShow = countryFilter[cls.slice(cls.indexOf('show') + 5)];

        if (visibleCountries === toShow) return;  // ignore if already showing
        $countryFilter.find('.active').removeClass('active');
        e.currentTarget.className = 'active ' + cls;  // selection class
        toZoom(visibleCountries = toShow);  // zoom to appropriate level
        redraw(true, getSlice(land, visibleCountries));
      })

      // Creating each button, making top-ten the first active button
      $.each(countryFilter, function(key) {
        var cls = 'bttn bttn-default show-' + key;
        if (key === 'top-ten') {
          cls = 'active ' + cls;
        }
        $('<button>', { 'type': 'button', 'class': cls, 'text': key.split('-').join(' ')})
          .appendTo($countryFilter);
      });

      $countryFilter.appendTo($('.leaflet-bottom.leaflet-left'));
    });

    function getSlice(land, visibleCountries) {
      return visibleCountries === 0 ?
        land : visibleCountries === -1 ?
        land.slice(-10) : land.slice(0, 10);
    }

    function reset() {
      var bounds = path.bounds({type: 'FeatureCollection', features: land})
        ,topLeft = bounds[0]
        ,bottomRight = bounds[1]
        ,transform = [-topLeft[0] + 50, -topLeft[1] + 50]
      ;

      svg.attr('width', bottomRight[0] - topLeft[0] + 100)
        .attr('height', bottomRight[1] - topLeft[1] + 100)
        .style('left', topLeft[0]-50 + 'px')
        .style('top', topLeft[1]-50 + 'px');

      g.attr('transform', 'translate(' + transform[0] + ',' + transform[1] + ')');
    }

    function redraw(reset, data) {
      if (reset) {
        // radius.domain([data[data.length-1].rank.score, data[0].rank.score]);

        g.selectAll('.rank-marker').remove();
        markers = g.selectAll('.rank-marker')
          .data(data)
        .enter().append('g')
          .attr('class', 'rank-marker')
          .style('opacity', 0)
          .attr('transform', function(d) { return 'translate(' + path.centroid(d) + ')'; })
        ;

        var circles = markers.append('circle')
          .attr('r', 16)
          .on('mouseover', function(d) {
            if (!clicked) { tooltip.show(d); }
          })
          .on('mouseout', function() {
            if (!clicked) { tooltip.hide(); }
          })
          .on('click', function(d) {
            clicked = true, tooltip.show(d);

            // close tooltip on next click, unless it's on another circle el
            window.setTimeout(function() {
              $(document).one('click', function(e) {
                if (e.target.localName !== 'circle') {
                  clicked = false, tooltip.hide();
                }
              });
            }, 100);
          })
        ;

        markers.append('text')
          .attr('dy', '6px')
          .text(function(d) { return d.rank.overall_ranking < 10 ?
                '0' + d.rank.overall_ranking : d.rank.overall_ranking; })
        ;

        markers.transition()
          .delay(function(d, i) { return 200 + i * 20 })
          .duration(200)
          .style('opacity', 1)
        ;
      }

      else {
        markers
          .attr('transform', function(d) { return 'translate(' + path.centroid(d) + ')'; })
      }
    }

    function toZoom(visibleCountries) {
      if (visibleCountries === 0 && zoom < 4) {
          map.setZoom(4);
      }
      else if (visibleCountries !== 0 && zoom > 2) {
        map.setZoom(2);
      }
    }

    map.on('viewreset', function() {
      reset();
      zoom = map.getZoom();
      if (visibleCountries === 0 && zoom < 4) {
        visibleCountries = 1;
        redraw(true, getSlice(land, visibleCountries));
        $countryFilter.find('.active').removeClass('active');
        var topTen = document.querySelectorAll('.show-top-ten')[0];
        topTen.className = 'active ' + topTen.className;
      }
      else {
        redraw(false);
      }
    });
  };


  // check to see if anything has a class of map
  // if false, probably isn't the index page so do nothing
  var parent = document.querySelectorAll('.map');
  if (!parent.length) return;

  // load the map
  else {
    var ranking = new rank(parent);
  }

});
