// Milo & Miles short-link reader. Opens a Google Maps or Amap (高德地图) short link and finds where the place is.
var SHORT = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|surl\.amap\.com)\//i;
var FOLLOW = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl|g\.co|([a-z0-9-]+\.)?amap\.com)\//i;
function doGet(e) {
  var u = String((e && e.parameter && e.parameter.u) || '').trim();
  if (!SHORT.test(u)) return out({ error: 'Not a Google Maps or Amap short link' });
  var url = u.replace(/^http:/, 'https:'), r = null;
  for (var i = 0; i < 6 && FOLLOW.test(url); i++) {
    r = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' } });
    var h = r.getHeaders();
    var next = h['Location'] || h['location'];
    if (!next) break;
    url = next.indexOf('http') === 0 ? next : url.replace(/^(https:\/\/[^\/]+).*$/, '$1') + next;
    r = null;
  }
  var res = { url: url };
  // Amap: some short links land on a page that sends you on with a script. Look in it for a full Amap link
  // that has a position in it.
  if (/amap\.com/i.test(url) && r) {
    var body = String(r.getContentText() || '').slice(0, 200000);
    var m0 = body.match(/https?:\\?\/\\?\/[a-z0-9.-]*amap\.com[^"'<>\s]*(?:position|lnglat|location|[?&]p)=[^"'<>\s]*/i);
    if (m0) res.found = m0[0].replace(/\\\//g, '/').replace(/&amp;/g, '&');
    return out(res);
  }
  if (/amap\.com/i.test(url)) return out(res);
  // Google: !3d…!4d… is the place itself. @lat,lon is only the middle of the map, so the name is looked up as well.
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
