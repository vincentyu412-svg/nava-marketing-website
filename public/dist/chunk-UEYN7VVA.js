var o={scale:.6,still:5,intro:2.2,frag:`
const mat2 R03 = mat2(0.9553365, 0.2955202, -0.2955202, 0.9553365);   // rot(0.3), folded (no per-pixel trig)
vec3 fx(vec2 p){
  float t = uTime;
  float R = (uPortrait > 0.5 ? 0.16 : 0.19) * uZoom;
  vec2 q = (p - uFocus) / R;                               // core-radius units
  float r = length(q);
  vec3 col = WINE * 1.1 * exp(-r * 0.8);
  float ig = ease3(uIntro * 1.3);
  if (r > 2.25) return col + CORAL * exp(-(r - 1.0) * (VAR(1) ? 1.1 : 1.8)) * (VAR(1) ? 0.3 : 0.12) * ig;   // far field: one exp
  float px = 1.0 / (uRes.y * R);
  vec2 L2 = normalize(vec2(-0.62, 0.5) + uPointer * 1.2);
  vec3 L = normalize(vec3(L2, 0.62));
  // ring geometry (tilted ellipse)
  vec2 rq = R03 * q;
  float k = 0.24, RR = 1.72;
  float er = length(vec2(rq.x, rq.y / k));
  float ringD = abs(er - RR) * k * R * uRes.y;             // ~pixels from the ring line
  float sweep = smoothstep(0.0, 1.0, (uIntro - 0.3) * 2.2) * (VAR(1) ? 0.0 : 1.0);
  vec3 ringC = vec3(0.0);
  if (ringD < 36.0) {                                       // ring maths only near the ring
    float ang = atan(rq.y / k, rq.x);
    float along = fract(ang / 6.2832 + t * 0.03);
    float ringA = (exp(-ringD * ringD * 0.35) * 0.9 + exp(-ringD * 0.18) * 0.18) * sweep;
    float dash = 0.75 + 0.25 * smoothstep(0.4, 0.5, abs(fract(along * 48.0) - 0.5));
    ringC = mix(WINE * 3.0, HOT, 0.5 + 0.5 * cos(ang - 2.2)) * ringA * dash;
  }
  float front = step(rq.y, 0.0);
  col += ringC * (1.0 - front) * 0.6;
  if (r < 1.0 + px * 2.0) {
    float rr = min(r, 1.0);
    vec3 nv = vec3(q, sqrt(max(0.0, 1.0 - rr * rr)));
    vec3 no = nv;
    no.xz = rot(t * 0.1) * no.xz;
    no.yz = R03 * no.yz;
    vec2 su = vec2(atan(no.x, no.z) * 1.1, no.y * 3.2);
    float w = vnoise(su * vec2(1.2, 1.0) + vec2(t * 0.04, 0.0));
    float f = vnoise(su * vec2(2.4, 1.6) + vec2(w * 1.8, w * 0.9) + vec2(-t * 0.05, 0.0));
    float bands = 0.5 + 0.5 * sin(no.y * 9.0 + w * 2.4 + t * 0.15);
    float cell = smoothstep(0.3, 0.85, f);
    float ndl = dot(nv, L);
    float wrap = clamp((ndl + 0.5) / 1.5, 0.0, 1.0);
    float lit = pow(max(ndl, 0.0), 1.4);
    vec3 body = (mix(WINE * 1.5, CORAL * 0.6, cell) + HOT * cell * cell * 0.35) * (0.7 + 0.45 * bands) * (0.3 + 0.9 * wrap);
    body += mix(CORAL * 0.7, HOT, cell) * lit * (0.35 + 0.8 * cell);
    float vein = pow(1.0 - abs(f - 0.5) * 2.0, 18.0) * (1.0 - cell) * smoothstep(0.4, 0.7, w);
    body += mix(HOT, EMBER, vein) * vein * 0.45;
    float fres = pow(1.0 - nv.z, 2.8);
    body += mix(CORAL * 0.8, HOT, wrap) * fres * (0.45 + 1.1 * wrap) + EMBER * pow(1.0 - nv.z, 10.0) * wrap * 0.8;
    float disc = 1.0 - smoothstep(1.0 - px * 1.5, 1.0 + px * 1.5, r);
    col = mix(col, body * ig, disc);
  }
  // atmosphere + corona
  float hh = max(r - 1.0, 0.0);
  float side = 0.4 + 0.6 * smoothstep(-0.7, 0.9, dot(q / max(r, 1e-3), L2));
  col += mix(CORAL, HOT, side) * (exp(-hh * 34.0) * 0.8 + exp(-hh * 6.0) * 0.22) * side * ig * smoothstep(0.97, 1.0, r);
  col += CORAL * exp(-hh * (VAR(1) ? 1.1 : 1.8)) * (VAR(1) ? 0.3 : 0.12) * ig;
  col += ringC * front;
  // sparks riding the ring
  for (int i = 0; i < 2; i++) {
    float a = t * (0.45 + float(i) * 0.21) + float(i) * 2.6;
    vec2 cs = vec2(cos(a), sin(a));
    vec2 sp = vec2(cs.x * RR, cs.y * RR * k) * R03;
    float vis = (cs.y < 0.0 || dot(sp, sp) > 1.0) ? sweep : 0.0;
    vec2 dd = (q - sp) * R * uRes.y;
    float d2 = dot(dd, dd);
    col += (EMBER * 1.6 / (1.0 + d2 * 0.25) + HOT * 0.25 / (1.0 + d2 * 0.02)) * vis * (1.0 / (1.0 + d2 * 0.004));
  }
  col += EMBER * exp(-r * r * 5.0) * (1.0 - smoothstep(0.2, 0.7, uIntro)) * 2.0;     // ignition spark
  return col * (1.0 + uEnergy * 0.35);
}
`};export{o as default};
