var o={scale:.82,still:4,intro:2.6,frag:`
vec3 fx(vec2 p){
  float t = uTime;
  float px = 1.0 / uRes.y;
  float hy = uPortrait > 0.5 ? -0.08 : -0.12;             // horizon height
  float cx = uFocus.x + uPointer.x * 0.02;
  vec3 col = vec3(0.0);
  float dy = p.y - hy;
  vec2 sc = vec2(cx, hy + mix(-0.2, 0.1, uIntro));
  float R = (uPortrait > 0.5 ? 0.12 : 0.15) * uZoom;
  vec2 sq = p - sc;
  float sr = length(sq);
  float ax = abs(p.x - cx);
  if (dy > 0.0) {
    col += WINE * 1.5 * exp(-dy * 4.0) + CORAL * 0.16 * exp(-dy * 14.0) * exp(-ax * 1.2);
    vec2 g = p * 70.0; vec2 id = floor(g); vec2 f = fract(g) - 0.5 - (hash22(id) - 0.5) * 0.7;
    col += EMBER * exp(-dot(f, f) * 110.0) * step(0.94, hash12(id + 7.0)) * smoothstep(0.08, 0.35, dy) * (0.35 + 0.35 * sin(t * 1.7 + id.x));
    // the core: plasma gradient, slow drifting cut-bands on its lower half, hot limb
    float body = 1.0 - smoothstep(R - px * 1.5, R + px * 1.5, sr);
    float v = clamp(sq.y / R * 0.5 + 0.5, 0.0, 1.0);
    vec3 disc = mix(CORAL * 0.85, HOT * 1.05, smoothstep(0.0, 0.8, v)) + EMBER * pow(v, 4.0) * 0.55;
    float cut = smoothstep(0.1, 0.0, sq.y / R);
    float bands = smoothstep(0.35, 0.5, abs(fract(sq.y / R * 4.0 + t * 0.2) - 0.5) * 2.0);
    disc *= 1.0 - cut * (1.0 - bands) * 0.85;
    disc += HOT * pow(sr / R, 8.0) * 0.4;
    if (VAR(1)) disc = INK * 0.6 + WINE * 0.4 * (1.0 - sr / R) + HOT * pow(sr / R, 14.0) * 0.8;
    col = mix(col, disc, body);
    float hh = max(sr - R, 0.0);
    col += HOT * exp(-hh * 30.0) * 0.45 + CORAL * exp(-hh * 6.0) * 0.32 + WINE * 1.5 * exp(-hh * 2.0) * 0.4;
    if (VAR(1)) {                                        // eclipse corona: a hot ring + slow streamers
      float an = atan(sq.y, sq.x);
      float st = 0.6 + 0.4 * sin(an * 7.0 + t * 0.3) * sin(an * 3.0 - t * 0.2);
      col += EMBER * exp(-hh * 90.0) * 1.2 + HOT * exp(-hh * 14.0 / st) * 0.7;
    }
  } else {
    float d = -dy;
    float z = 0.1 / d;                                   // depth
    float x = (p.x - cx) * z;
    float zz = z + t * 0.55 + uIntro * 1.5;
    float gxs = 7.0 * uDensity, gzs = 3.0 * uDensity;    // lines per world unit
    float dx = z * px * gxs;                              // grid cells per pixel
    float dz = 0.1 / (d * d) * px * gzs;
    float ex = (0.5 - abs(fract(x * gxs) - 0.5)) / max(dx, 1e-4);   // pixels to the nearest line
    float ez = (0.5 - abs(fract(zz * gzs) - 0.5)) / max(dz, 1e-4);
    float lx = (1.0 - smoothstep(0.3, 1.3, ex)) * smoothstep(0.6, 0.15, dx);   // fade lines out before they moire
    float lz = (1.0 - smoothstep(0.3, 1.3, ez)) * smoothstep(0.6, 0.15, dz);
    float fog = exp(-z * 0.22);
    float lines = max(lx, lz) * fog * smoothstep(0.0, 0.7, uIntro);
    col += mix(WINE * 3.2, CORAL * 1.1, fog) * lines * (0.55 + 0.45 * exp(-ax * 1.5));
    // the core's reflection: a shimmering column on the floor
    float sx = p.x - cx;
    float shimmer = 0.55 + 0.45 * vnoise(vec2(sx * 26.0, z * 5.0 - t * 2.5));
    col += mix(HOT, EMBER, exp(-d * 30.0)) * exp(-sx * sx / (0.0012 + d * 0.012)) * exp(-d * 4.5) * shimmer * 0.8 * uIntro;
    col += WINE * 1.3 * exp(-d * 5.0) * exp(-ax * 0.8);
  }
  // horizon line + haze
  col += HOT * exp(-dy * dy * 12000.0) * exp(-ax * 1.6) * 1.1 * uIntro;
  col += CORAL * exp(-abs(dy) * 26.0) * exp(-ax * 1.1) * 0.3;
  return col * (1.0 + uEnergy * 0.3);
}
`};export{o as default};
