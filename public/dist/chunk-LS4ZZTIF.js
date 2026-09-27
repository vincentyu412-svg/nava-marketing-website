var t={scale:.75,still:3.2,intro:2.4,frag:`
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
vec3 bpos(float i, float t){
  return vec3(sin(t * (0.61 + i * 0.13) + i * 1.7) * 0.5, cos(t * (0.53 + i * 0.11) + i * 2.3) * 0.34, sin(t * (0.47 + i * 0.09) + i * 4.1) * 0.3);
}
// blob centres, computed ONCE per pixel (not per march step); plain scalars (arrays are slow on some GPUs)
vec3 gB0, gB1, gB2; float gCore, gT;
void setupBlobs(){
  gT = uTime * 0.5;
  gCore = 0.42 * (0.55 + 0.45 * uIntro);
  float k = uIntro * (VAR(1) ? 1.55 : 1.0);
  gB0 = bpos(0.0, gT) * k; gB1 = bpos(1.0, gT) * k; gB2 = bpos(2.0, gT) * k;
}
float map(vec3 p){
  const float K = VAR(1) ? 0.12 : 0.36, RS = VAR(1) ? 0.8 : 1.0;
  float d = length(p) - gCore;
  d = smin(d, length(p - gB0) - 0.29 * RS, K);
  d = smin(d, length(p - gB1) - 0.25 * RS, K);
  d = smin(d, length(p - gB2) - 0.21 * RS, K);
  d += sin(p.x * 5.0 + gT * 1.3) * sin(p.y * 4.3 - gT) * sin(p.z * 4.7 + gT * 0.7) * (0.03 + 0.03 * uEnergy);
  return d;
}
vec3 env(vec3 r){
  float y = r.y;
  // sky: ink at the zenith -> wine -> coral -> a white-hot line at the horizon
  vec3 sky = mix(HOT * 1.1, CORAL * 0.8, smoothstep(0.02, 0.2, y));
  sky = mix(sky, WINE * 1.8, smoothstep(0.2, 0.5, y));
  sky = mix(sky, INK, smoothstep(0.55, 1.0, y));
  vec3 c = y > 0.0 ? sky : mix(WINE * 1.2, INK, smoothstep(0.0, -0.25, y));
  c += EMBER * exp(-abs(y) * 60.0) * 1.6 + HOT * exp(-abs(y) * 12.0) * 0.5;
  // floor bounce
  c += CORAL * 0.75 * smoothstep(-0.35, -0.95, y) + WINE * 1.5 * smoothstep(0.0, -0.3, y);
  // softboxes: an overhead ember panel and a tall hot strip on the right
  c += EMBER * 2.2 * smoothstep(0.06, 0.0, abs(y - 0.62) - 0.05) * smoothstep(0.6, 0.3, abs(r.x + 0.15));
  c += HOT * 1.6 * smoothstep(0.05, 0.0, abs(r.x - 0.78) - 0.03) * smoothstep(0.7, 0.2, abs(y - 0.15));
  c += EMBER * pow(max(0.0, dot(r, normalize(vec3(-0.55, 0.65, 0.5)))), 60.0) * 3.0;
  return c;
}
vec3 fx(vec2 p){
  float sc = (uPortrait > 0.5 ? 0.62 : 1.2) * uZoom;
  vec2 q = (p - uFocus) * 2.0 / sc;
  float lq = length(q);
  vec3 col = WINE * 1.25 * exp(-lq * 1.2) + CORAL * 0.14 * exp(-lq * 2.4);
  // bounding sphere: the blobs never reach past ~1.12 (molten) / ~1.3 (droplets) from the centre
  const float BR = VAR(1) ? 1.3 : 1.15;
  if (lq > (VAR(1) ? 1.9 : 1.45)) return col;
  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = normalize(vec3(q, -2.6));
  mat2 ry = rot(uPointer.x * 0.6 + sin(uTime * 0.17) * 0.35), rx = rot(-uPointer.y * 0.4 + 0.12);
  ro.xz = ry * ro.xz; rd.xz = ry * rd.xz; ro.yz = rx * ro.yz; rd.yz = rx * rd.yz;
  float b = dot(ro, rd), cc = dot(ro, ro) - BR * BR, h = b * b - cc;
  if (h < 0.0) return col;
  setupBlobs();
  float tt = -b - sqrt(h), tmax = -b + sqrt(h);
  float hit = 0.0;
  for (int i = 0; i < 20; i++) {
    float d = map(ro + rd * tt);
    if (d < 0.003) { hit = 1.0; break; }
    tt += d;
    if (tt > tmax) break;
  }
  if (hit < 0.5) return col;
  vec3 pos = ro + rd * tt;
  vec2 e = vec2(0.003, -0.003);
  vec3 n = normalize(e.xyy * map(pos + e.xyy) + e.yyx * map(pos + e.yyx) + e.yxy * map(pos + e.yxy) + e.xxx * map(pos + e.xxx));
  vec3 r = reflect(rd, n);
  float fres = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);
  vec3 chrome = env(r) * (0.7 + 0.5 * fres) + HOT * fres * 0.35;
  return chrome * (0.25 + 0.75 * uIntro) * (1.0 + uEnergy * 0.25);
}
`};export{t as default};
