var o={scale:.6,still:5,intro:2.2,frag:`
float beam(vec2 q, float ang, float w0, float spread){
  vec2 dir = vec2(sin(ang), cos(ang));
  float along = dot(q, dir);
  float across = abs(q.x * dir.y - q.y * dir.x);
  float w = w0 + max(along, 0.0) * spread;
  return exp(-across * across / (w * w)) * smoothstep(-0.02, 0.08, along) * exp(-max(along, 0.0) * 0.9);
}
vec3 fx(vec2 p){
  float t = uTime;
  float base = -0.5 + (uPortrait > 0.5 ? 0.3 : 0.22);          // horizon line
  vec2 o = vec2(uFocus.x + uPointer.x * 0.03, base);
  vec2 q = p - o;
  if (VAR(1)) q = vec2(p.x - uFocus.x - uPointer.x * 0.03, 0.56 - p.y);   // rig above, beams point down
  vec3 col = vec3(0.0), lit = vec3(0.0);           // lit = light that the haze modulates (applied once, below)
  // the pillar: grows from the ground during the intro
  float rise = uIntro * 1.4;
  float up = smoothstep(rise, rise - 0.25, q.y);
  float ax = abs(q.x + sin(q.y * 6.0 - t * 1.5) * 0.002);
  float pw = uPortrait > 0.5 ? 0.5 : 1.0;                      // portrait frames are narrow: keep the light tighter
  float core = exp(-ax * ax / (0.00002 * uZoom * uZoom * pw)) * 1.6;
  float glow = exp(-ax * ax / (0.0012 * uZoom * uZoom * pw * pw)) * 0.9 + exp(-ax * 9.0 / (uZoom * pw)) * 0.25;
  float pillarMask = step(0.0, q.y) * up * exp(-q.y * 0.6) * (VAR(1) ? 0.0 : 1.0);
  col += EMBER * core * pillarMask * (1.0 + uEnergy * 0.6);
  lit += mix(HOT, CORAL, smoothstep(0.0, 0.8, q.y)) * glow * pillarMask * (1.0 + uEnergy * 0.6);
  // sweeping searchlights from just below the horizon
  float sw = uIntro;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float side = mod(fi, 2.0) * 2.0 - 1.0;
    float ang = side * (0.28 + 0.22 * fi / 3.0) + sin(t * (0.23 + fi * 0.07) + fi * 2.1) * 0.22;
    vec2 oo = q + vec2(side * (0.05 + fi * 0.06), 0.05);
    float fan = VAR(1) ? 1.0 : 0.0;
    ang = mix(ang, (fi - 1.5) * 0.16 + sin(t * (0.3 + fi * 0.05) + fi * 1.3) * 0.26, fan);
    oo = mix(oo, q + vec2((fi - 1.5) * 0.42, 0.0), fan);
    float b = beam(oo, ang, 0.004 * uZoom, (0.11 + fi * 0.02) * uZoom * pw);
    lit += mix(CORAL, WINE * 3.0, fi / 4.0 * (1.0 - fan)) * b * ((0.55 - fi * 0.08) * (1.0 - fan) + 0.62 * fan) * sw;
  }
  // haze: two drifting value-noise octaves (rising), gives the beams a volumetric grain \u2014 only where there is light
  float hz = 0.5;
  if (max(max(lit.r, lit.g), lit.b) > 0.003)
    hz = vnoise(vec2(p.x * 3.0, p.y * 2.0 - t * 0.22)) * 0.65 + vnoise(vec2(p.x * 7.0 + 3.1, p.y * 5.0 - t * 0.5)) * 0.35;
  float haze = (0.55 + 0.9 * hz * uDensity) * (uPortrait > 0.5 ? 0.6 : 1.0);
  col += lit * haze;
  // smoke banks along the ground, lit from inside by the pillar
  if (q.y >= 0.0 && q.y < 0.8) {                   // (invisible above ~0.8: exp(-7y) < 0.4%)
    float sm = vnoise(vec2(q.x * 4.0 - t * 0.12, q.y * 9.0 + 1.3)) * 0.6 + vnoise(vec2(q.x * 9.0 + t * 0.2, q.y * 16.0)) * 0.4;
    col += mix(WINE * 2.5, CORAL, exp(-abs(q.x) * 4.0)) * smoothstep(0.35, 0.8, sm) * exp(-q.y * 7.0) * exp(-abs(q.x) * 1.4) * 0.6 * sw;
  }
  // ground: the horizon glow + a hot lens streak where the beam is born
  float gy = VAR(1) ? 1.0 : q.y;
  col += CORAL * exp(-abs(gy) * 26.0) * exp(-abs(q.x) * 1.6) * 0.5 * sw;
  col += EMBER * exp(-gy * gy * 5000.0) * exp(-abs(q.x) * 5.0) * 1.2 * sw;
  col += HOT * exp(-q.x * q.x * 1.2 - gy * gy * 900.0) * 0.35 * sw;
  col += WINE * 1.4 * exp(-length(q * vec2(0.6, 1.4)) * 2.2);
  // floor: dark, with a faint reflection of the pillar
  if (gy < 0.0) {
    float refl = exp(-ax * ax / 0.003) * exp(gy * 7.0) * (0.6 + 0.4 * vnoise(vec2(q.x * 40.0, gy * 90.0 + t * 2.0)));
    col = col * 0.35 + HOT * refl * 0.35 * sw;
  }
  // sparks rising inside the light
  vec2 g = vec2(p.x * 26.0, p.y * 14.0 - t * 1.6);
  vec2 id = floor(g), f = fract(g) - 0.5;
  vec2 jt = hash22(id + uSeed) - 0.5;
  float sp = exp(-dot(f - jt * 0.7, f - jt * 0.7) * 260.0) * step(1.0 - 0.2 * uDensity, hash12(id * 1.7));
  col += EMBER * sp * (glow * 2.5 + 0.12) * step(0.0, gy) * sw;
  return col;
}
`};export{o as default};
