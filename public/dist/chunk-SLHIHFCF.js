var a={scale:.8,still:9,intro:2.6,frag:`
// particles on concentric rings; ring k turns rigidly at its own (Keplerian-ish) speed
float ringStars(float r, float a, float nr, float sz, float keep, float spin, float seed){
  float rr = r * nr;
  float k = floor(rr);
  float rc = (k + 0.5) / nr;
  float w = spin / (0.12 + rc * 1.4);
  float na = max(6.0, floor(6.2832 * rc * nr * 1.1));
  float aa = (a + w) / 6.2832 * na;
  float j = floor(aa);
  vec2 h = hash22(vec2(k, j) + seed);
  float dr = (fract(rr) - 0.5 - (h.x - 0.5) * 0.7) / nr;
  float da = (fract(aa) - 0.5 - (h.y - 0.5) * 0.7) / na * 6.2832 * rc;
  float d2 = (dr * dr + da * da) * nr * nr;
  float on = step(keep, hash12(vec2(j, k) * 1.7 + seed));
  return exp(-d2 / (sz * sz)) * on * (0.45 + 0.55 * h.x);
}
vec3 fx(vec2 p){
  float t = uTime;
  vec2 q = p - uFocus - uPointer * 0.03;
  q = rot(0.42 + uPointer.x * 0.08) * q;
  float tilt = (VAR(1) ? 0.94 : VAR(2) ? 0.17 : 0.46) + uPointer.y * 0.06;
  float sc = (uPortrait > 0.5 ? 0.55 : 0.7) * uZoom * (VAR(1) ? 0.72 : 1.0);
  vec2 d = vec2(q.x, q.y / tilt) / sc;                    // de-projected disc coordinates
  float r = length(d);
  float a = atan(d.y, d.x);
  vec3 col = vec3(0.0);
  float spin = t * 0.1 + (uIntro - 1.0) * 2.6;
  if (r < 1.6) {
    float pat = a + t * 0.035;                            // density wave: arms turn slowly and rigidly
    float lr = log(r + 0.03) * 2.4;
    float n = vnoise(vec2(a * 2.0 + t * 0.03, r * 9.0));
    float arms = 0.5 + 0.5 * cos(2.0 * (pat - lr) + n * 1.4);
    float armsS = pow(arms, 1.8);
    float lane = smoothstep(0.55, 0.95, 0.5 + 0.5 * cos(2.0 * (pat - lr) - 0.75 + n)) * smoothstep(0.08, 0.3, r);
    float disk = exp(-r * 2.4);
    float dens = (armsS * 0.9 + 0.18) * disk * (1.0 - lane * 0.75);
    col += mix(WINE * 2.6, CORAL * 1.05, clamp(dens * 2.2, 0.0, 1.0)) * dens * 1.6;
    col += HOT * pow(armsS, 3.0) * exp(-r * 3.4) * 0.3 * (1.0 - lane);
    // particles (they brighten inside the arms)
    float s1 = ringStars(r, a, 70.0, 0.22, 1.0 - 0.65 * uDensity, spin, uSeed);
    float s2 = ringStars(r, a, 150.0, 0.26, 1.0 - 0.45 * uDensity, spin * 1.2, uSeed + 9.1);
    float lit = (armsS * 1.5 + 0.12) * exp(-r * 1.5) * (1.0 - lane * 0.6);
    col += mix(HOT, EMBER, armsS) * (s1 * 2.2 + s2 * 1.5) * lit;
  }
  // nucleus + bulge
  float rn = length(q / sc);
  col += EMBER * exp(-rn * rn * 300.0) * 2.2 + HOT * exp(-rn * 10.0) * 0.6 + CORAL * exp(-r * 3.2) * 0.2;
  col *= smoothstep(0.0, 0.5, uIntro) * (1.0 + uEnergy * 0.4);
  // background star field
  vec2 g = p * 55.0 + 3.7; vec2 id = floor(g); vec2 f = fract(g) - 0.5 - (hash22(id) - 0.5) * 0.7;
  col += mix(EMBER, HOT, 0.3) * exp(-dot(f, f) * 140.0) * step(0.9, hash12(id + 2.0)) * (0.35 + 0.25 * sin(t * 2.0 + id.x));
  return col;
}
`};export{a as default};
