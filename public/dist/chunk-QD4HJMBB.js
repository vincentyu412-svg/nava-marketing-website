var e={scale:.68,still:2.6,intro:2.2,frag:`
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float chev(vec3 p, float s){
  p /= max(s, 0.001);
  vec2 q = vec2(abs(p.x), p.y);
  float d2 = sdSeg(q, vec2(0.0, 0.2), vec2(0.62, -0.28)) - 0.13;
  vec2 w = vec2(d2, abs(p.z) - 0.14);
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.04;
  return d * s;
}
float cyc(float i){ return fract(uTime * 0.11 + i / 3.0 + uIntro * 0.66); }
const int NCH = VAR(1) ? 1 : 3;                     // chevrons in the scene (compile-time)
// per-chevron transforms, computed ONCE per pixel (not per march step); plain scalars (arrays are slow on some GPUs)
mat2 gR0, gR1, gR2, gRx; vec3 gP; vec3 gS; vec3 gC;   // gP/gS/gC = height, scale, age of chevrons 0..2
void setupChevs(){
  gRx = rot(0.25 + uPointer.y * 0.3);
  gC = fract(uTime * 0.11 + vec3(0.0, 1.0, 2.0) / 3.0 + uIntro * 0.66);
  gS = (0.25 + 0.75 * sin(gC * PI)) * 0.95;       // born small, full size mid-way, gone at the top
  gP = mix(vec3(-1.25), vec3(1.25), gC);
  if (VAR(1)) { gC.x = 0.62; gP.x = 0.1; gS.x = 1.55 * 0.95; }
  float sp = uTime * (VAR(1) ? 0.45 : 0.35) + uPointer.x * 0.8;
  gR0 = rot(sp); gR1 = rot(sp + 0.5); gR2 = rot(sp + 1.0);
}
float chevAt(vec3 p, float y, mat2 r, float s){
  vec3 q = p - vec3(0.0, y, 0.0);
  q.xz = r * q.xz;
  q.yz = gRx * q.yz;
  return chev(q, s);
}
float map(vec3 p, out float id, out float k){
  float d = chevAt(p, gP.x, gR0, gS.x); id = gC.x; k = 0.0;
  if (NCH > 1) {
    float d1 = chevAt(p, gP.y, gR1, gS.y); if (d1 < d) { d = d1; id = gC.y; k = 1.0; }
    float d2 = chevAt(p, gP.z, gR2, gS.z); if (d2 < d) { d = d2; id = gC.z; k = 2.0; }
  }
  return d;
}
// the chevron that was hit, alone (the normal needs only that one: 4 taps x 1 chevron instead of x 3). Its
// parameters are selected as values, so each tap is exactly one chevAt() on every GPU (and in SwiftShader)
float mapK(vec3 p, float k){
  if (NCH == 1) return chevAt(p, gP.x, gR0, gS.x);
  float y = k < 0.5 ? gP.x : k < 1.5 ? gP.y : gP.z, s = k < 0.5 ? gS.x : k < 1.5 ? gS.y : gS.z;
  mat2 r = k < 0.5 ? gR0 : k < 1.5 ? gR1 : gR2;
  return chevAt(p, y, r, s);
}
vec3 env(vec3 r){
  vec3 c = INK;
  c += CORAL * 0.9 * smoothstep(-0.1, -0.8, r.y);
  c += EMBER * 2.0 * smoothstep(0.08, 0.0, abs(r.y - 0.5)) * smoothstep(0.8, 0.1, abs(r.x));
  c += HOT * 1.3 * smoothstep(0.1, 0.0, abs(r.x + 0.8)) * smoothstep(0.9, 0.0, abs(r.y));
  return c;
}
vec3 fx(vec2 p){
  float sc = (uPortrait > 0.5 ? 0.44 : 0.7) * uZoom;
  vec2 q = (p - uFocus) / sc;
  vec3 col = WINE * 1.2 * exp(-length(q * vec2(1.4, 0.8)) * 1.6);
  vec3 ro = vec3(0.0, 0.0, 4.2);
  vec3 rd = normalize(vec3(q, -2.3));
  setupChevs();
  // bounding box of the column
  vec3 bmin = vec3(-0.85, -1.5, -0.85), bmax = vec3(0.85, 1.5, 0.85);
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  float tnear = max(max(tn.x, tn.y), tn.z), tfar = min(min(tf.x, tf.y), tf.z);
  // tighter: march only where the ray crosses a chevron's bounding sphere (r = 0.9 x scale); rays that cross none
  // (most of the frame) skip the march entirely
  vec2 span = vec2(1e9, -1e9);
  for (int i = 0; i < NCH; i++) {
    float y = i == 0 ? gP.x : i == 1 ? gP.y : gP.z, r = 0.9 * (i == 0 ? gS.x : i == 1 ? gS.y : gS.z);
    vec3 oc = ro - vec3(0.0, y, 0.0);
    float b = dot(oc, rd), h = b * b - dot(oc, oc) + r * r;
    if (h > 0.0) { h = sqrt(h); span = vec2(min(span.x, -b - h), max(span.y, -b + h)); }
  }
  tnear = max(tnear, span.x); tfar = min(tfar, span.y);
  float glow = 0.0;
  if (tfar > tnear && tfar > 0.0) {
    float tt = max(tnear, 0.0), id = 0.0, kk = 0.0, hit = 0.0, dh = 0.0;
    for (int i = 0; i < 24; i++) {
      float d = map(ro + rd * tt, id, kk);
      if (d < 0.003) { hit = 1.0; dh = d; break; }
      tt += d * 0.95;
      if (tt > tfar) break;
    }
    if (hit > 0.5) {
      vec3 pos = ro + rd * tt;
      vec3 n = normalize(vec3(mapK(pos + vec3(0.003, 0.0, 0.0), kk), mapK(pos + vec3(0.0, 0.003, 0.0), kk), mapK(pos + vec3(0.0, 0.0, 0.003), kk)) - dh);   // 3-tap forward difference
      vec3 base = mix(WINE * 2.4, CORAL, smoothstep(0.1, 0.75, id));
      base = mix(base, HOT, smoothstep(0.7, 0.95, id) * 0.4);
      vec3 L = normalize(vec3(-0.5, 0.8, 0.6));
      float dif = max(dot(n, L), 0.0);
      float fres = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
      vec3 r = reflect(rd, n);
      vec3 c = base * (0.18 + 0.9 * dif) + env(r) * (0.12 + 0.6 * fres) + EMBER * pow(max(dot(r, L), 0.0), 30.0) * 1.2;
      c += HOT * fres * 0.5;
      float fade = smoothstep(0.0, 0.12, id) * (1.0 - smoothstep(0.82, 1.0, id));
      col = mix(col, c, fade);
    }
  }
  // glow: soft screen-space halo around each chevron (continuous everywhere, 3 exps)
  {                                                  // all three at once (vec3 lanes), no loop / indexing
    vec3 c3 = VAR(1) ? vec3(0.5) : gC, s3 = VAR(1) ? vec3(1.6) : gS / 0.95;
    vec3 dx = q.x / (0.36 * s3), dy = (q.y - (c3 * 2.5 - 1.25) * (2.3 / 4.2)) / (0.2 * s3);
    vec3 g = exp(-(dx * dx + dy * dy) * 0.7) * s3 * smoothstep(0.0, 0.15, c3) * (1.0 - smoothstep(0.8, 1.0, c3));
    glow = VAR(1) ? g.x : g.x + g.y + g.z;
  }
  col += CORAL * glow * 0.28;
  // rising exhaust below the column
  col += HOT * exp(-q.x * q.x * 30.0) * smoothstep(-0.4, -1.4, q.y) * exp(-abs(q.y + 1.4) * 3.0) * 0.25;
  return col * (0.4 + 0.6 * uIntro) * (1.0 + uEnergy * 0.3);
}
`};export{e as default};
