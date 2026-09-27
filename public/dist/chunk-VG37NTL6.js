var t={scale:.85,still:7.5,intro:2.4,frag:`
vec3 fx(vec2 p){
  vec2 c = uFocus + uPointer * 0.05;
  vec2 q = p - c;
  float r = length(q);
  float a = atan(q.y, q.x);
  float px = 1.0 / uRes.y;
  // travelled distance: cruise + a surge while the intro runs (d/dt of the eased intro = the burst of speed)
  float travel = uTime * 0.32 + uIntro * 3.2;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float n = VAR(2) ? 34.0 + fi * 26.0 : 90.0 + fi * 70.0;   // streaks per turn in this layer
    float ab = a / (2.0 * PI) * n + fi * 0.37;
    float id = floor(ab);
    float fa = fract(ab) - 0.5;
    float h = hash11(id * 1.37 + fi * 71.3 + uSeed * 3.1);
    if (h < 1.0 - (0.72 - fi * 0.12) * uDensity) continue;  // gaps between streaks
    float h2 = hash11(id * 3.11 + fi * 19.7);
    float z = 0.09 * uZoom / max(r, 1e-3);                 // depth (centre = far)
    float s = fract(z * (0.55 + 0.3 * h2) - travel * (0.6 + h2 * 0.9) + h * 9.0);
    float len = 0.18 + 0.32 * h2 + 0.25 * uEnergy;
    float body = smoothstep(0.0, 0.02, s) * (1.0 - smoothstep(0.02, len, s));
    float head = exp(-s * 40.0);
    float d = abs(fa) * 6.2832 * r / n;                    // distance to the streak line, in screen units
    float w = (px * (0.8 + fi * 0.2) + r * (0.0022 - fi * 0.0005)) * (VAR(2) ? 2.6 : 1.0);
    float line = exp(-d * d / (w * w));
    float fade = smoothstep(0.02, 0.35, r) * (1.0 - fi * 0.28);
    vec3 tint = mix(CORAL, mix(HOT, EMBER, h2), step(0.72, h2));
    col += (tint * body * 1.5 + EMBER * head * 2.2) * line * fade;
  }
  if (VAR(1)) {                                              // portal rings: circles of constant depth rushing past
    float u = 0.3 * uZoom / max(r, 1e-3) - travel * 1.6;
    float du = 0.3 * uZoom / max(r * r, 1e-4) * px;       // ring units per pixel (analytic AA)
    float e = (0.5 - abs(fract(u) - 0.5)) / max(du, 1e-5);
    col += mix(HOT, EMBER, 0.3) * exp(-e * e * 0.25) * smoothstep(0.03, 0.3, r) * smoothstep(0.5, 0.08, du) * exp(-r * 1.2) * 1.1;
  }
  // tunnel wall haze: soft rings rushing outward
  float ring = 0.5 + 0.5 * sin(0.9 / max(r, 0.02) * 1.0 - travel * 12.0);
  col += WINE * 1.6 * ring * smoothstep(0.05, 0.6, r) * exp(-r * 1.5) * 0.35;
  // vanishing point: white-hot core + coral bloom
  col += EMBER * exp(-r * r * 900.0) * 1.8 + HOT * exp(-r * 16.0) * 0.55 + CORAL * exp(-r * 4.5) * 0.22;
  col *= 0.35 + 0.65 * uIntro;
  col += EMBER * exp(-r * r * 60.0) * (1.0 - uIntro) * 1.6;  // ignition flash
  col *= 1.0 + uEnergy * 0.35;
  return col;
}
`};export{t as default};
