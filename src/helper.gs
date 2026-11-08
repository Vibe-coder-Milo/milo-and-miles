// Milo & Miles short-link reader. Opens a Google Maps short link and finds where the place is.
function doGet(e) {
  var u = String((e && e.parameter && e.parameter.u) || '').trim();
  if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//.test(u)) return out({ error: 'Not a Google Maps short link' });
  var url = u.replace(/^http:/, 'https:');
  for (var i = 0; i < 5 && /^https:\/\/(maps\.app\.goo\.gl|goo\.gl|g\.co)\//.test(url); i++) {
    var r = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true });
    var h = r.getHeaders();
    var next = h['Location'] || h['location'];
    if (!next) break;
    url = next;
  }
  var res = { url: url };
  // !3d…!4d… is the place itself. @lat,lon is only the middle of the map, so the name is looked up as well.
  if (/!3d-?\d/.test(url)) return out(res);
  var m = url.match(/[?&](?:q|query)=([^&#]+)/) || url.match(/\/maps\/place\/([^\/@?]+)/);
  if (m) {
    res.q = decodeURIComponent(m[1].replace(/\+/g, ' '));
    try {
      var g = Maps.newGeocoder().setLanguage('en').geocode(res.q);
      if (g.status === 'OK' && g.results.length) {
        var loc = g.results[0].geometry.location;
        res.lat = loc.lat; res.lon = loc.lng; res.address = g.results[0].formatted_address;
      }
    } catch (err) { res.geocodeError = String(err); }
  }
  return out(res);
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
