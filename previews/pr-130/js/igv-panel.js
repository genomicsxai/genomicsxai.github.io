(function(){
  var BASE = {A:"#2ca02c", C:"#1f77b4", G:"#ff7f0e", T:"#d62728", N:"#9aa0a6"};

  function ready(fn){
    if(document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];
    });
  }

  function b64(s){
    return btoa(unescape(encodeURIComponent(s)));
  }

  function dataURL(s){
    return "data:text/plain;base64," + b64(s);
  }

  function fastaURLs(panel){
    var name = panel.contig;
    var seq = panel.seq;
    var fa = ">" + name + "\n";
    for(var i = 0; i < seq.length; i += 60) fa += seq.slice(i, i + 60) + "\n";
    var fai = name + "\t" + seq.length + "\t" + (name.length + 2) + "\t60\t61\n";
    return {fa:dataURL(fa), fai:dataURL(fai)};
  }

  function bedGraphURL(panel, values){
    var s = "track type=bedGraph\n";
    for(var i = 0; i < values.length; i++) {
      s += panel.contig + "\t" + i + "\t" + (i + 1) + "\t" + values[i] + "\n";
    }
    return dataURL(s);
  }

  function tracks(panel){
    return panel.tracks.map(function(track){
      if(track.kind === "hits"){
        return {
          name: track.name,
          type: "annotation",
          displayMode: "EXPANDED",
          height: track.height || 54,
          features: track.features.map(function(feature){
            return {
              chr: panel.contig,
              start: feature.start,
              end: feature.end,
              name: feature.name,
              strand: feature.strand,
              color: feature.color
            };
          })
        };
      }

      if(track.kind === "variant"){
        return {
          name: track.name,
          type: "annotation",
          displayMode: "COLLAPSED",
          height: track.height || 24,
          color: track.color,
          features: [{chr: panel.contig, start: track.pos, end: track.pos + 1, name: track.label, color: track.color}]
        };
      }

      var cfg = {
        name: track.name,
        url: bedGraphURL(panel, track.values),
        format: "bedgraph",
        type: "wig",
        height: track.kind === "contrib" ? 64 : 46,
        color: track.color
      };

      if(track.min != null || track.max != null){
        cfg.autoscale = false;
        cfg.min = track.min != null ? track.min : 0;
        cfg.max = track.max;
      } else {
        cfg.autoscale = true;
      }

      if(track.kind === "contrib") cfg.graphType = "dynseq";
      return cfg;
    });
  }

  function dynseqSVG(seq, scores){
    var height = 64;
    var mid = height / 2;
    var maxabs = 1e-9;
    for(var i = 0; i < scores.length; i++) maxabs = Math.max(maxabs, Math.abs(scores[i]));

    var svg = [
      '<svg class="gxai-igv-fallback-svg" viewBox="0 0 ' + seq.length + " " + height + '" preserveAspectRatio="none" height="' + height + '" width="100%">',
      '<line x1="0" y1="' + mid + '" x2="' + seq.length + '" y2="' + mid + '" stroke="#e6e6e6" stroke-width="0.4"/>'
    ];

    for(i = 0; i < seq.length; i++){
      var score = scores[i] || 0;
      if(!score) continue;
      var normalized = Math.max(-1, Math.min(1, score / maxabs));
      var letterHeight = Math.abs(normalized) * (mid - 1);
      if(letterHeight < 0.25) continue;
      var base = (seq[i] || "N").toUpperCase();
      var color = BASE[base] || BASE.N;
      svg.push('<text x="' + (i + 0.5) + '" y="' + mid + '" font-size="' + letterHeight.toFixed(2) + '" textLength="0.95" lengthAdjust="spacingAndGlyphs" text-anchor="middle" dominant-baseline="' + (normalized >= 0 ? "alphabetic" : "hanging") + '" fill="' + color + '" font-family="monospace" font-weight="700">' + base + "</text>");
    }

    return svg.join("") + "</svg>";
  }

  function signalSVG(values){
    var height = 46;
    var maxv = 1e-9;
    for(var i = 0; i < values.length; i++) maxv = Math.max(maxv, values[i]);
    var scale = (height - 2) / maxv;
    var d = "M0 " + height;
    for(i = 0; i < values.length; i++) d += " L" + i + " " + (height - values[i] * scale).toFixed(2);
    d += " L" + (values.length - 1) + " " + height + " Z";
    return '<svg class="gxai-igv-fallback-svg" viewBox="0 0 ' + values.length + " " + height + '" preserveAspectRatio="none" height="' + height + '" width="100%"><path d="' + d + '" fill="#3c3c3c" stroke="none"/></svg>';
  }

  function renderFallback(host, panel){
    var rows = [
      '<div class="gxai-igv-fallback">',
      '<div class="gxai-igv-fallback-note">Interactive browser unavailable in this viewer; showing the embedded static view of the same data.</div>'
    ];

    panel.tracks.forEach(function(track){
      var svg = track.kind === "contrib" ? dynseqSVG(panel.seq, track.values) : signalSVG(track.values || []);
      rows.push('<div class="gxai-igv-fallback-row"><div class="gxai-igv-fallback-label">' + esc(track.name) + "</div>" + svg + "</div>");
    });

    rows.push("</div>");
    host.innerHTML = rows.join("");
  }

  function chrome(root, panel){
    root.innerHTML =
      '<div class="gxai-igv-card">' +
      '<div class="gxai-igv-head"><b>' + esc(panel.display_name) + '</b> <span class="gxai-igv-locus">' + esc(panel.locus_label) + "</span>" +
      (panel.badge ? '<span class="gxai-igv-badge">' + esc(panel.badge) + "</span>" : "") + "</div>" +
      '<div class="gxai-igv-host"></div>' +
      '<div class="gxai-igv-caption">' + esc(panel.caption || "") + "</div>" +
      (panel.source ? '<div class="gxai-igv-source">' + panel.source + "</div>" : "") +
      "</div>";
    return root.querySelector(".gxai-igv-host");
  }

  function build(root, panel){
    var host = chrome(root, panel);
    if(typeof igv === "undefined"){
      renderFallback(host, panel);
      return;
    }

    var urls = fastaURLs(panel);
    var config = {
      reference: {id: panel.contig, name: panel.display_name, fastaURL: urls.fa, indexURL: urls.fai},
      locus: panel.init_locus || panel.contig,
      tracks: tracks(panel),
      showSVGButton: false
    };
    if(panel.minimum_bases) config.minimumBases = panel.minimum_bases;

    igv.createBrowser(host, config).catch(function(error){
      console.warn("IGV panel failed", error);
      renderFallback(host, panel);
    });
  }

  function init(root){
    if(root.dataset.igvBuilt) return;
    root.dataset.igvBuilt = "1";
    fetch(root.dataset.igvSrc)
      .then(function(response){
        if(!response.ok) throw new Error("Could not load " + root.dataset.igvSrc);
        return response.json();
      })
      .then(function(data){
        var panel = data[root.dataset.igvPanel] || data;
        build(root, panel);
      })
      .catch(function(error){
        console.warn("IGV panel data failed", error);
        root.textContent = "Interactive browser unavailable.";
      });
  }

  ready(function(){
    document.querySelectorAll(".gxai-igv-panel[data-igv-src]").forEach(init);
  });
})();
