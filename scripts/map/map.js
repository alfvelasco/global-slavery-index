
  /**
   *  Map view
   *
   *  Example:
   *
   *  var mapView = new slavery.ui.view.Map({
   *    el: $('.map-wrapper')
   *  });
   */


  slavery.ui.view.Map = cdb.core.View.extend({

    initialize: function() {
      var self = this;

      _.bindAll(this, "_onAreaChanged");

      this.model = new slavery.ui.model.Map();

      this.model.bind("change:area", this._onAreaChanged);

      // this.template = cdb.templates.getTemplate('map/views/map.jst.js');
      this.template = new cdb.core.Template({
        template: $("#cartodb-map-template").html()
      });

      this.render();

      this.chips = {};
      this.hoveringChip = false;

      this._initLoader();
      this._initViews();
      this._initBindings();

      var polygons_url = 'https://globalslavery.cartodb.com/api/v2/sql?q=select iso_a3, name, ST_Simplify(the_geom, 0.1) as the_geom from new_index_numbers&format=geojson';

      create_polygons(polygons_url, function(polygons) {
        self.countries_polygons = polygons;
        self.loadArea && self.loadArea();
      });
    },

    over: function(key, name, pos) {
      var self = this;

      this.out();

      var key_ = key ? key : nameToKey(name);

      if(key && !this.hoveringChip) {
        d3.selectAll('.chip').filter(function() {
          var c = this.getAttribute('class');

          if(c) {
            return c.indexOf('chip_' + key) < 0;
          }

          return true;
        })
        .transition().duration(200).style('opacity', 0).each('end', function() { d3.select(this).style('visibility', 'hidden').style('display', 'none'); });

        d3.selectAll('.chip_' + key).style({
          'opacity': 1,
          'visibility': 'visible',
          'display': 'block'
        });
      }

      var current_polygon = this.current_polygon = this.countries_polygons[key_];
      var current_key = this.current_key;

      if(!current_polygon) return;

      for(var i=0; i < current_polygon.length; ++i) {
        this.map.addLayer(current_polygon[i].geo);

        if(self.model.get("area") === "world") {
          self.tooltip
            .html(name)
            .style("visibility", "visible")
            .style("top", pos.y-40+"px")
            .style("left", pos.x+"px")
            .style("margin-left", function() {
              return -$(this).outerWidth()/2+"px"
            });
        }
      }
    },

    out: function(){
      var self = this;

      if(this.current_polygon) {
        var current_polygon = this.current_polygon;

        for(var i=0; i < current_polygon.length; ++i) {
          this.map.removeLayer(current_polygon[i].geo);
        }

        current_polygon = null;

        if(self.model.get("area") === "world") {
          self.tooltip.style("visibility", "hidden");
        }
      }
    },

    render: function() {
      this.$el.append(this.template.render());
      return this;
    },

    _bindInfowindow: function() {
      var self = this;

      $(document).on("keyup", function(e) {
        if (e.keyCode == 27) self.infowindow.model.set({ hidden: true });
      });

      this.map.on("drag",      function() { this.infowindow._center(); }, this);
      this.map.on("dragend",   function() { this.infowindow._center(); }, this);
      this.map.on("zoomstart", function() { this.infowindow._center(); }, this);
      this.map.on("zoomend",   function() {
        this.infowindow._center();
        this.zoom._checkMaxMin(this.map.getZoom());
      }, this);

      this.bind("missingclick", function() {
        if(this.water) {
          this.infowindow.hide();
          this.closeSelectors();
        }
      });
    },

    _bindOnResize: function() {
      var self = this;

      $(window).resize(function() {
        self._adjustMapHeight();
        self.infowindow._center();
      });
    },

    _adjustMapHeight: function() {
      var mapHeight = $(window).height();

      this.$cartodbMap.height(mapHeight);

      var top = mapHeight/2 - this.$panel.height()/2;

      var top_ = top > 50 ? top : 50;

      this.$panel.css({
        top: top_
      });
    },

    /**
    * this function binds click and dblclick events
    * in order to not raise click when user does a dblclick
    *
    * it raises a missingClick when the user clicks on the map
    * but not over a feature or ui component
    */
    _bindMissingClickEvents: function() {
      var self = this;

      this.map.on('click', function(e) {
        self.water = true;

        if(self.clickTimeout === null) {
          self.clickTimeout = setTimeout(function() {
            self.clickTimeout = null;

            if(!self.featureHovered) {
              self.trigger('missingclick');
            }
          }, 250);
        }
      });

      this.map.on('dblclick', function() {
        if(self.clickTimeout !== null) {
          clearTimeout(self.clickTimeout);
          self.clickTimeout = null;
        }
      });
    },

    _initViews: function() {
      var self = this;

      this.$cartodbMap = this.$('.cartodb-map');
      this.$panel = this.$(".panel");

      this.map = L.map('cartodb-map', {
        center: [0, 0],
        zoomControl: false,
        zoom: 3,
        minZoom: 3,
        maxZoom: 7,
        inertia: false
      });

      this.zoom = new slavery.ui.view.Zoom({
        el: this.$(".zoom"),
        map: this
      });

      this.addView(this.zoom);

      this.share = new slavery.ui.view.Share({
        el: this.$(".share"),
        // bitly: {
        //   key: 'R_de188fd61320cb55d359b2fecd3dad4b',
        //   login: 'vizzuality'
        // }
      });

      this.addView(this.share);

      this.country_selector = new slavery.ui.view.CountrySelector({
        el: this.$(".country_selector"),
        map: this
      });

      this.addView(this.country_selector);

      this.region_selector = new slavery.ui.view.RegionSelector({
        el: this.$(".region_selector"),
        map: this
      });

      this.addView(this.region_selector);

      this.infowindow = new slavery.ui.view.Infowindow({
        className: "collapsed",
        map: this.map,
        el: this.$(".infowindow")
      });

      this.addView(this.infowindow);

      this.panel = new slavery.ui.view.Panel({
        el: this.$panel
      });

      this.addView(this.panel);

      this.help = new slavery.ui.view.Help({
        el: this.$(".map_help"),
        map: this
      });

      this.addView(this.help);

      this.$mamufas = $(".mamufas");

      this.tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip');

      var layerUrl = 'http://globalslavery.cartodb.com/api/v2/viz/01fa0ba2-3262-11e3-83f2-55d1af661060/viz.json';

      this.map.attributionControl.addAttribution('Walk Free Foundation <a href="http://www.globalslaveryindex.org/" target="_blank">Global Slavery Index</a>');

      cartodb.createLayer(this.map, layerUrl, { infowindow: false })
        .addTo(this.map)
        .on('done', function(layer) {
          var sublayer = self.countries_sublayer = layer.getSubLayer(1),
              sublayer2 = self.batimetry_sublayer = layer.getSubLayer(0);

          // remove batimetry
          sublayer2.remove();

          sublayer.setInteractivity('cartodb_id, iso_a3, name, slavery_policy_risk');
          sublayer.setInteraction(true);

          slavery.AppData.CARTOCSS = sublayer.getCartoCSS().split(' ').join(' ');

          sublayer.on('featureClick', function(e, latlng, pos, data, layerNumber) {
            self.water = false;

            self.closeSelectors();

            self.infowindow.model.set({
              coordinates: latlng
            });

            if(!self.infowindow.model.get("hidden") && data.iso_a3 && data.iso_a3 === self.current_iso) return;

            self.current_iso = data.iso_a3;

            self.infowindow.setLoading();

            gsdata.filter({ cartodb_id: data.cartodb_id })
              .done(function(data) {
                var country = data.rows[0],
                    collapsed = country.slavery_policy_risk ? false : true;

                if(collapsed) {
                  // infowindow error
                  self.infowindow.model.set({ content: { country_name: country.name } });
                  self.infowindow.setError();
                } else {
                  // infowindow success
                  self.infowindow.model.set({
                    hidden: false,
                    content: {
                      slavery_policy_risk: country.slavery_policy_risk,
                      country_name: country.name,
                      rank: country.rank,
                      slaves: country.slaves,
                      slaves_lb_rounded: country.slaves_lb_rounded,
                      slaves_ub_rounded: country.slaves_ub_rounded,
                      iso_a3: country.iso_a3
                    },
                    template_name: 'infowindow_success',
                    collapsed: false
                  });

                  self.infowindow._center();
                }
              })
              .error(function(errors) {
                console.log("error:" + errors);
              });
          });

          sublayer.on('featureOver', function(e, latlng, pos, data, layerNumber) {
            var iso = data.iso_a3,
                name = data.name;

            self.over(iso, name, pos);
          });

          sublayer.on('featureOut', function(e, latlng, pos, data, layerNumber) {
            self.out();
          });

          if(!self.loadArea) {
            // world
            layer.on('load', function() {
              self._hideLoader();
            });
          } else {
            self.loadArea();
          }
        }).on('error', function() {
          //log the error
        });
    },

    _initBindings: function() {
      this._adjustMapHeight();
      this._bindOnResize();
      this._bindInfowindow();

      this.clickTimeout = null;
      this._bindMissingClickEvents();

      this.panel.bind("reposition", this._adjustMapHeight, this);

      this.country_selector.bind("closeotherselectors", this.closeSelectors, this);
      this.region_selector.bind("closeotherselectors", this.closeSelectors, this);
    },

    closeSelectors: function(area) {
      if(area) {
        if(area !== 'region') {
          this.region_selector.close();
        } else if(area !== 'country') {
          this.country_selector.close();
        }
      } else {
        this.region_selector.close();
        this.country_selector.close();
        this.tooltip.style("visibility", "hidden");
      }
    },

    _initLoader: function() {
      var opts = {
        lines: 11, // The number of lines to draw
        length: 11, // The length of each line
        width: 4, // The line thickness
        radius: 13, // The radius of the inner circle
        corners: 1, // Corner roundness (0..1)
        rotate: 0, // The rotation offset
        direction: 1, // 1: clockwise, -1: counterclockwise
        color: '#ccc', // #rgb or #rrggbb or array of colors
        speed: 1, // Rounds per second
        trail: 60, // Afterglow percentage
        shadow: false, // Whether to render a shadow
        hwaccel: true, // Whether to use hardware acceleration
        className: 'loader', // The CSS class to assign to the spinner
        zIndex: 2e9, // The z-index (defaults to 2000000000)
        top: 'auto', // Top position relative to parent in px
        left: 'auto' // Left position relative to parent in px
      };

      var target = document.getElementById('wrapper');

      this.loader = new Spinner(opts).spin(target);
      this.$el.append(this.loader.el);
    },

    _hideLoader: function() {
      this.loader.stop();
    },

    _setCountry: function(iso) {
      var self = this;

      this.current_iso = iso;

      gsdata.filter({ iso_a3: iso })
        .done(function(data) {
          var country = data.rows[0];

          self.panel.model.set({
            'country_name': country.name,
            'country_iso': country.iso_a3,
            'rank': country.rank,
            'population': country.population,
            'slaves': country.slaves,
            'slaves_lb_rounded': country.slaves_lb_rounded,
            'slaves_ub_rounded': country.slaves_ub_rounded,
            'gdppp': country.gdppp,
            'us_tip_report_ranking': country.us_tip_report_ranking,
            'remittances_of_gdp': country.remittances_of_gdp,
            'url': country.url
          });

          self._setRegion(country.region);

          self.loadArea && self.loadArea();
        })
        .error(function(errors) {
          console.log("error:" + errors);
        });

      gsdata.filter({ iso_a3: iso }, { bounds: true })
        .done(function(bounds) {
          var center = L.latLngBounds(bounds).getCenter(),
              zoom = self.map.getBoundsZoom(bounds);

          if(self.current_iso === 'USA') {
            zoom = 3;
            center = {
              lat: 0,
              lng: 0
            };
          } else {
            //Moves the center a bit to the right
            center.lng = center.lng - 5;
          }

          self.model.set({
            'center': center,
            'zoom': zoom
          });

          self.loadArea && self.loadArea();
        }).error(function(errors) {
          console.log("error:" + errors);
        });
    },

    _setRegion: function(id) {
      var self = this;

      this.current_region = id;

      gsdata.filter({ region: id })
        .done(function(data) {
          var region = data.rows[0];

          self.panel.model.set({
            'region': id,
            'region_name': slavery.AppData.REGIONS[id]['title'],
            'countries_count': data.rows.length
          });

          self.loadArea && self.loadArea();
        })
        .error(function(errors) {
          console.log("error:" + errors);
        });
    },

    _showRegion: function(id) {
      var self = this;

      gsdata.filter({ region: id }, { 
        extra_columns: 'ST_AsGeoJSON(ST_PointOnSurface(the_geom)) as center'
      })
        .done(function(data) {
          var region = data.rows[0];

          _.each(data.rows, function(country) {
            var coordinates = $.parseJSON(country.center).coordinates;

            var markerIcon = L.divIcon({
              iconSize: [100, 100],
              className: 'chip chip_'+country.iso_a3,
              html: '<div class="mean" style="background:'+rankColor(parseInt(country.rank, 10))+'">'+country.mean.toFixed(2)+'</div>'
            });

            var chip = L.marker([coordinates[1], coordinates[0]], {icon: markerIcon}).addTo(self.map);
            (self.chips[country.iso_a3] || (self.chips[country.iso_a3] = [])).push(chip);

            // dataset
            var dataset = [country.human_rights_risk, country.develop_rights_risk, country.state_stability_risk, country.discrimination_risk, country.slavery_policy_risk];
            var dataset_ord = dataset.slice(0).sort(function(a,b){ return b-a });

            // palette
            var palette = ["#00A99D", "#33BAB1", "#66CBC4", "#99DDD8", "#CCEEEB"],
                palette_ord = [];

            // wedges
            var wedges = [
              {
                "name": "Human rights risk",
                "val": country.human_rights_risk
              },
              {
                "name": "Develop rights risk",
                "val": country.develop_rights_risk
              },
              {
                "name": "State stability risk",
                "val": country.state_stability_risk
              },
              {
                "name": "Discrimination risk",
                "val": country.discrimination_risk
              },
              {
                "name": "Slavery policy risk",
                "val": country.slavery_policy_risk
              },
            ];

            var wedges_ord = [];

            for(var i = 0; i < dataset_ord.length; i++) {
              wedges_ord[i] = {};
              wedges_ord[i]['val'] = dataset_ord[i];
              wedges_ord[i]['color'] = palette[i];
            }

            _.each(wedges, function(wedge, i) {
              _.each(wedges_ord, function(wedge_ord) {
                if(wedge_ord['val'] === wedge['val']) {
                  palette_ord[i] = wedge_ord['color'];

                  return;
                }
              });
            });

            self._drawChips(country, wedges, palette_ord);
          });
        })
        .error(function(errors) {
          console.log("error:" + errors);
        });
    },

    _drawChips: function(country, wedges, palette) {
      var self = this;

      var width = 100,
          height = 100;

      var color = d3.scale.ordinal()
          .range(palette);

      var pie = d3.layout.pie()
          .sort(null)
          .value(function(d) { return 1; } );

      var arc = d3.svg.arc()
          .innerRadius(20)
          .outerRadius(50);

      var chip = d3.select('.chip_'+country.iso_a3)
        .on("mouseover", function() {
          self.hoveringChip = true;
        })
        .on("mousemove", function() {
          self.hoveringChip = true;
        })
        .on("mouseout", function() {
          self.hoveringChip = false;
        });

      var svg = chip.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

      var mean = chip.selectAll(".mean").on("mouseover", function(d) {
        var l = $(this).offset().left,
            m = $(this).width()/2,
            t = "Mean Risk Score";

        self.tooltip
          .html(country.name + "<strong>" + t + "</strong>")
          .style("visibility", "visible")
          .style("top", $(this).offset().top-40+"px")
          .style("left", l+m+"px")
          .style("margin-left", function() {
            return -$(this).outerWidth()/2+"px"
          });
      })
      .on("mousemove", function() {
        self.tooltip.style("visibility", "visible")
      })
      .on("mouseout", function() {
        self.tooltip.style("visibility", "hidden")
      });

      var g = svg.selectAll(".arc")
          .data(pie(wedges))
          .enter().append("g")
          .attr("class", "arc");

      g.append("path")
        .attr("d", arc)
        .style("fill", function(d) { return color(d.data['val']); })

      g.append("text")
        .attr("transform", function(d, i) { return "translate(" + arc.centroid(d) + ")"; })
        .attr("dy", ".35em")
        .style("text-anchor", "middle")
        .text(function(d) { return d.data.val.toFixed(2); });

      g.on("mouseover", function(d) {
        var l = $(this).offset().left,
            m = $(this).find("path")[0].getBoundingClientRect().width/2;

        self.tooltip
          .html(country.name + "<strong>" + d.data['name'] + "</strong>")
          .style("visibility", "visible")
          .style("top", $(this).offset().top-40+"px")
          .style("left", l+m+"px")
          .style("margin-left", function() {
            return -$(this).outerWidth()/2+"px"
          });
      })
      .on("mousemove", function() {
        self.tooltip.style("visibility", "visible")
      })
      .on("mouseout", function() {
        self.tooltip.style("visibility", "hidden")
      });

      chip.style("visibility", "hidden");
    },

    _hideChips: function() {
      var self = this;

      _.each(this.chips, function(chip) {
        _.each(chip, function(c) {
          self.map.removeLayer(c);
          c.off('mouseout');
          c.off('mouseover');
        });
      });

      this.chips = {};
    },

    _changeURL: function(href) {
      this.options.mapTab.attr("data-url", href);

      Backbone.history.navigate(href, true);
    },

    changeArea: function(area, id, callback) {
      var self = this;

      if(area !== this.model.get('area')) {
        var num = 0;

        if(!this.countries_polygons)
          num++;

        if(!this.countries_sublayer)
          num++;

        if(area === 'country') {
          num += 3;

          this._setCountry(id);
        } else if(area === 'region') {
          num++;

          this._setRegion(id);
          this._showRegion(id);
        }

        this.loadArea = _.after(num, function() {
          self._hideLoader();

          self.model.set('area', area);
        });
      } else {
        if(area === 'country' && this.current_iso !== id) {
          this._setCountry(id);

          this.loadArea = _.after(3, function() {
            this._changeCountry();
          });
        } else if(area === 'region' && this.current_region !== id) {
          this._hideChips();

          this._setRegion(id);
          this._showRegion(id);

          this.loadArea = _.after(1, function() {
            this._changeRegion();
          });
        }
      }
    },

    _disableInteraction: function() {
      this.map.dragging.disable();
      this.map.touchZoom.disable();
      this.map.doubleClickZoom.disable();
      this.map.scrollWheelZoom.disable();
      this.map.boxZoom.disable();
      this.map.keyboard.disable();
      this.countries_sublayer.setInteraction(false);
      this.$cartodbMap.addClass("cartodb-map-disabled");

    },

    _enableInteraction: function() {
      this.map.dragging.enable();
      this.map.touchZoom.enable();
      this.map.doubleClickZoom.enable();
      this.map.scrollWheelZoom.enable();
      this.map.boxZoom.enable();
      this.map.keyboard.enable();
      this.countries_sublayer.setInteraction(true);
      this.$cartodbMap.removeClass("cartodb-map-disabled");

    },

    _changeCountry: function() {
      // selectors
      this.closeSelectors();

      // infowindow
      this.infowindow.hide();

      //chips
      this._hideChips();

      // panel
      this.panel.template.set('template', $("#country_panel-template").html());
      this.panel.render();
      this.panel.show();
      this.$mamufas.show();

      // map
      // TODO: active layers
      this.out();
      this.countries_sublayer.setCartoCSS(slavery.AppData.CARTOCSS + "#new_index_numbers [ iso_a3 != '" + this.panel.model.get('country_iso') + "'] { polygon-fill: #666; polygon-opacity: 1; line-width: 1; line-color: #333; line-opacity: 1; } #new_index_numbers [ iso_a3 = '" + this.panel.model.get('country_iso') + "'] { line-width: 3; line-color: #333; }");
      this.map.setView(this.model.get('center'), this.model.get('zoom'));
      this._disableInteraction();
    },

    _changeRegion: function() {
      // selectors
      this.closeSelectors();

      // infowindow
      this.infowindow.hide();

      // panel
      this.panel.template.set('template', $("#region_panel-template").html());
      this.panel.render();
      this.panel.show();
      this.$mamufas.show();

      // map
      // TODO: active layers
      this._enableInteraction();
      this.countries_sublayer.setCartoCSS(slavery.AppData.CARTOCSS + "#new_index_numbers [ region != '" + this.panel.model.get('region') + "'] { polygon-fill: #666; polygon-opacity: 1; line-width: 1; line-color: #333; line-opacity: 1; }");
      this.map.setView(slavery.AppData.REGIONS[this.panel.model.get('region')].center, slavery.AppData.REGIONS[this.panel.model.get('region')].zoom);
      this._enableInteraction();

      // url
      this._changeURL('map/region/'+this.panel.model.get('region'));
    },

    _onAreaChanged: function() {
      if(this.model.get('area') === 'country') {
        this._changeCountry();
      } else if(this.model.get('area') === 'region') {
        this._changeRegion();
      } else if(this.model.get('area') === 'world') {
        // selectors
        this.closeSelectors();

        // infowindow
        this.infowindow.hide();

        //chips
        this._hideChips();

        // panel
        this.panel.hide();
        this.$mamufas.hide();

        // map
        this._enableInteraction();
        // TODO: active layers
        this.countries_sublayer.setCartoCSS(slavery.AppData.CARTOCSS);
        this.map.fitWorld();

        // url
        this._changeURL('map');
      }
    }
  });
