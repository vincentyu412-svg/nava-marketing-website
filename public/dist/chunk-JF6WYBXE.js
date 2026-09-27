var e={scale:.53,still:7,intro:2.6,frag:`
vec3 sky(vec2 p, float t){
  vec3 col = mix(INK, WINE * 1.1, smoothstep(0.55, -0.2, p.y));
  vec2 g = p * 80.0; vec2 id = floor(g); vec2 f = fract(g) - 0.5 - (hash22(id) - 0.5) * 0.7;
  col += EMBER * exp(-dot(f, f) * 120.0) * step(0.945, hash12(id + 3.0)) * 0.6;
  vec2 pp = p - vec2(uPointer.x * 0.03, 0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float depth = 1.0 + fi * 0.5;
    float x = pp.x / depth + fi * 3.7 + uSeed;
    float hem = (VAR(1) ? -0.42 : uPortrait > 0.5 ? -0.1 : -0.15) + fi * (VAR(1) ? 0.16 : 0.075) + 0.08 * sin(x * 1.9 + t * 0.45 + fi) + 0.04 * sin(x * 4.3 - t * 0.6 + fi * 2.0)
      + 0.06 * (vnoise(vec2(x * 1.5, t * 0.22 + fi)) - 0.5);
    float y = pp.y - hem;
    float up = mix(0.3, 0.55, fi / 2.0);
    float rev = smoothstep(0.0, 1.0, uIntro * 1.7 - fi * 0.25);
    col += mix(HOT, WINE * 2.0, 0.5) * exp(-abs(y) * 9.0) * 0.07 * rev;          // the sky under the hem glows too
    float curtain = smoothstep(-0.01, 0.02, y) * exp(-max(y, 0.0) / up * 2.4) * rev;
    if (curtain < 0.002) continue;                                                // under the hem / faded out: no rays to draw
    float rays = vnoise(vec2(x * 55.0 * uDensity + t * 0.9, y * 1.2 - t * 0.15));
    rays = 0.25 + 0.75 * rays * rays * (0.6 + 0.4 * sin(x * 17.0 + t * 1.3 + fi));
    vec3 c = mix(EMBER, HOT, smoothstep(0.0, 0.04, y));
    c = mix(c, CORAL, smoothstep(0.03, 0.14, y));
    c = mix(c, WINE * 3.2, smoothstep(0.12, 0.42, y));
    col += c * curtain * rays * (1.05 - fi * 0.25) * 1.3;
  }
  return col;
}
vec3 fx(vec2 p){
  float t = uTime * 0.6;
  float hz = VAR(1) ? -0.9 : (uPortrait > 0.5 ? -0.2 : -0.26);   // lake line
  // ONE sky() evaluation per pixel: above the lake we sample the sky directly, below it the mirrored point
  float d = max(hz - p.y, 0.0);
  float below = step(p.y, hz);
  vec2 m = mix(p, vec2(p.x + sin(d * 90.0 - uTime * 1.2) * 0.0012 * (1.0 + d * 6.0), hz + d), below);
  float mr = hz - 1.0;                                            // ridge line: only evaluated where it can be (<= hz + 0.095)
  if (m.y < hz + 0.1) mr = hz + 0.03 + 0.04 * vnoise(vec2(m.x * 3.0 + uSeed, 1.0)) + 0.025 * vnoise(vec2(m.x * 9.0, 4.0));
  vec3 col = m.y > mr ? sky(m, t) : INK * 0.8 + WINE * 0.25 * smoothstep(hz, mr, m.y);   // sky, or the hills silhouette
  col = mix(col, col * 0.6 * exp(-d * 2.0) + HOT * exp(-d * 90.0) * 0.08, below);
  return col * (1.0 + uEnergy * 0.35);
}
`};export{e as default};
