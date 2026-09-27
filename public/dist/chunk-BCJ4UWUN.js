var t={scale:.8,still:6,intro:2.4,frag:`
vec3 fx(vec2 p){
  float t = uTime * 0.55;
  float ang = VAR(1) ? -1.35 : (uPortrait > 0.5 ? -0.9 : -0.28);
  vec2 q = rot(ang) * (p - uFocus * (VAR(1) ? 1.0 : 0.6) - uPointer * 0.03);
  float px = 1.0 / uRes.y;
  vec3 col = WINE * 0.35 * exp(-length(p - uFocus) * 2.2);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    if (fi > uDensity * 4.0 - 0.5 || (VAR(2) && i != 1)) continue;
    float x = q.x * (1.3 + fi * 0.18);
    float ph = fi * 1.9 + uSeed;
    float yc = 0.16 * sin(x * 1.7 + t * 0.9 + ph) + 0.07 * sin(x * 3.3 - t * 1.3 + ph * 2.0) + (fi - 1.5) * 0.085;
    float tw = sin(x * 2.2 - t * 1.1 + ph * 1.3);               // signed width: through zero = the ribbon twists
    float w = ((0.055 + fi * 0.008) * (VAR(2) ? 2.6 : 1.0) * uZoom) * (0.25 + 0.75 * abs(tw)) + 0.004;
    float v = (q.y - yc) / w;                                     // -1..1 across the ribbon
    float edge = 1.0 - smoothstep(1.0 - px * 1.8 / w, 1.0, abs(v));
    // unfurl: each ribbon's front travels in from the left during the intro
    float front = mix(-2.2, 2.4, uIntro) - fi * 0.18;
    edge *= smoothstep(front, front - 0.25, q.x);
    if (edge <= 0.0) continue;
    float face = tw > 0.0 ? 1.0 : 0.45;                           // front face lit, back face darker
    float curve = sqrt(max(0.0, 1.0 - v * v));
    float slope = cos(x * 2.2 - t * 1.1 + ph * 1.3);
    float sheen = pow(clamp(1.0 - abs(v - slope * 0.6), 0.0, 1.0), 14.0);
    vec3 base = mix(WINE * 2.2, mix(CORAL, HOT, 0.3 + 0.3 * slope), curve * face);
    vec3 c = base * (0.35 + 0.75 * curve) + EMBER * sheen * face * 0.9 + HOT * pow(1.0 - abs(tw), 6.0) * 0.4;
    c *= 0.62 + fi * 0.13;
    col = mix(col, c, edge * (0.82 + 0.18 * face));
    col += HOT * exp(-abs(v) * 3.0) * 0.04 * (1.0 - edge);
  }
  return col * (1.0 + uEnergy * 0.3);
}
`};export{t as default};
