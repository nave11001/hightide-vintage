// GLSL for LiquidVeil, kept in its own module so the component stays readable.
//
// The sphere is drawn on a full-screen triangle pair: every pixel works out
// whether it is glass, liquid, the surface between them, or the rim, from its
// own position. There is no geometry.
//
// uFill is the load progress, 0 to 1. uTime only moves the waves and bubbles —
// keeping the two apart is what lets the level report something true.

export const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;
uniform sampler2D uLogo;
uniform float uTime;
uniform float uFill;      // 0 = empty, 1 = full. Driven by real load progress.
uniform vec2 uPointer;
uniform vec2 uTexel;

const float SPHERE = 0.925;
const float PI = 3.14159265;

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

float artworkEdge(vec2 uv) {
  vec3 l = texture2D(uLogo, uv - vec2(uTexel.x * 2.0, 0.0)).rgb;
  vec3 r = texture2D(uLogo, uv + vec2(uTexel.x * 2.0, 0.0)).rgb;
  vec3 d = texture2D(uLogo, uv - vec2(0.0, uTexel.y * 2.0)).rgb;
  vec3 u = texture2D(uLogo, uv + vec2(0.0, uTexel.y * 2.0)).rgb;
  float gx = abs(luminance(r) - luminance(l));
  float gy = abs(luminance(u) - luminance(d));
  return smoothstep(0.035, 0.22, gx + gy);
}

// Three wave trains at different lengths and speeds. One sine reads as a ripple
// pattern; several that never line up read as water.
float waveHeight(float x, float t) {
  return 0.0092 * sin(x * 4.3 + t * 0.90)
       + 0.0046 * sin(x * 9.1 - t * 1.35)
       + 0.0021 * sin(x * 17.4 + t * 2.05);
}

// Slope of that surface, for lighting the top face as a real tilted plane.
float waveSlope(float x, float t) {
  return 0.0092 * 4.30 * cos(x * 4.3 + t * 0.90)
       - 0.0046 * 9.10 * cos(x * 9.1 - t * 1.35)
       + 0.0021 * 17.4 * cos(x * 17.4 + t * 2.05);
}

// A slow tilt of the whole body, as though the sphere were just set down.
float slosh(float x, float t) {
  return x * 0.016 * sin(t * 0.55) * exp(-t * 0.04);
}

// Air rising through the liquid. Nothing says "this is a fluid" like something
// travelling up through it.
float bubbles(vec2 p, float t, float surfaceY, float floorY) {
  float acc = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float seed = fi * 1.7 + 0.3;
    float lane = fract(seed * 0.6180339);
    float speed = 0.11 + 0.09 * fract(seed * 0.3730);
    float cycle = fract(t * speed + fract(seed * 0.2910));
    float by = mix(floorY, surfaceY, cycle);
    float bx = (lane - 0.5) * 1.45 + 0.030 * sin(cycle * 11.0 + seed * 6.0);
    float r = 0.0075 + 0.0115 * fract(seed * 0.5310);
    float d = length(p - vec2(bx, by));
    // Born at the bottom, popped at the surface.
    float life = smoothstep(0.0, 0.10, cycle) * (1.0 - smoothstep(0.86, 1.0, cycle));
    acc += life * smoothstep(r, r * 0.30, d);
  }
  return clamp(acc, 0.0, 1.0);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float radius = length(p);
  float t = uTime;

  // White studio background and a soft cast shadow below the glass object.
  vec2 shadowP = p - vec2(0.025, -0.045);
  float castShadow = (1.0 - smoothstep(0.90, 1.10, length(shadowP))) * smoothstep(0.88, 1.02, radius);
  vec3 color = vec3(1.0) - vec3(0.10, 0.11, 0.19) * castShadow * 0.20;

  if (radius <= SPHERE) {
    float z = sqrt(max(0.0, 1.0 - (radius / SPHERE) * (radius / SPHERE)));
    vec3 normal = normalize(vec3(p.x / SPHERE, p.y / SPHERE, z));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 lightDir = normalize(vec3(-0.38 + uPointer.x * 0.20, 0.48 + uPointer.y * 0.16, 0.82));

    float progress = clamp(uFill, 0.0, 1.0);
    float level = mix(-0.985, 1.015, progress);

    // ---- the liquid volume -------------------------------------------------
    // Its top is an ellipse seen from slightly above: a back edge, a front edge,
    // and real optical thickness between them.
    float safeLevel = clamp(level, -SPHERE, SPHERE);
    float halfChord = sqrt(max(0.0, SPHERE * SPHERE - safeLevel * safeLevel));
    float normalizedX = p.x / max(halfChord, 0.0001);
    float ellipseProfile = sqrt(max(0.0, 1.0 - normalizedX * normalizedX));
    float insideSurface = 1.0 - step(halfChord, abs(p.x));

    float ripple = waveHeight(p.x, t) + slosh(p.x, t);
    // Meniscus: water climbs the glass where it touches it.
    float wall = pow(clamp(abs(normalizedX), 0.0, 1.0), 3.0);
    float meniscus = wall * 0.020 * insideSurface;

    float ellipseHeight = halfChord * 0.135;
    float backSurface  = safeLevel + ellipseHeight * ellipseProfile + ripple + meniscus;
    float frontSurface = safeLevel - ellipseHeight * ellipseProfile + ripple + meniscus;
    float surfaceThickness = max(backSurface - frontSurface, 0.0001);
    float surfacePosition = clamp((p.y - frontSurface) / surfaceThickness, 0.0, 1.0);
    float activeSurface = step(0.001, progress) * step(progress, 0.999);
    float surfaceDisc = insideSurface * step(frontSurface, p.y) * step(p.y, backSurface) * activeSurface;

    float signedFront = p.y - frontSurface;
    float liquidVolume = 1.0 - smoothstep(-0.008, 0.008, signedFront);

    // ---- how much water this pixel looks through ---------------------------
    // Two independent lengths, which is what gives the body its dimension:
    // how far below the surface we are, and how far the ray travels through the
    // sphere at this point. A pixel near the rim is shallow even when submerged.
    float depthBelow = max(0.0, -signedFront);
    float chord = z;
    float optical = clamp(depthBelow * 1.15 + (1.0 - chord) * 0.35, 0.0, 1.0);
    float waterDepth = clamp(depthBelow / 1.7, 0.0, 1.0);

    // ---- refraction --------------------------------------------------------
    // The artwork is sampled exactly once, so the lettering can never split into
    // a second copy. Where it lands is what the water decides.
    float fresnel = pow(1.0 - z, 2.35);
    float surfaceLens = exp(-abs(signedFront) * 25.0);

    // A slow current, strongest deep in the body and absent above the waterline.
    vec2 current = vec2(
      sin(p.y * 8.4 - t * 0.62) + 0.5 * sin(p.x * 5.1 + t * 0.44),
      cos(p.x * 7.2 + t * 0.51) + 0.5 * cos(p.y * 4.3 - t * 0.38)
    );

    vec2 refractedUv = vUv;
    refractedUv = 0.5 + (refractedUv - 0.5) * (1.0 - 0.042 * (1.0 - z));
    refractedUv += normal.xy * (0.004 + fresnel * 0.004);
    refractedUv += current * depthBelow * 0.0115 * liquidVolume;
    // The surface itself acts as a lens right at the waterline.
    refractedUv.y += surfaceLens * 0.013 * sign(-signedFront);
    refractedUv.x += surfaceLens * 0.004 * sin(p.x * 8.0 + t * 0.75);
    refractedUv = clamp(refractedUv, vec2(0.001), vec2(0.999));

    vec3 logo = texture2D(uLogo, refractedUv).rgb;
    float edge = artworkEdge(vUv);

    // ---- above the waterline: glass only -----------------------------------
    vec3 emptyGlass = vec3(0.985, 0.990, 1.0);
    emptyGlass += vec3(0.22, 0.32, 0.70) * edge * 0.28;
    emptyGlass += vec3(0.34, 0.52, 0.98) * fresnel * 0.12;

    // ---- below the waterline: the body -------------------------------------
    float diffuse = 0.74 + 0.26 * max(dot(normal, lightDir), 0.0);
    vec3 reflected = reflect(-lightDir, normal);
    float specular = pow(max(dot(reflected, viewDir), 0.0), 72.0);

    // Currents in depth, on two scales that drift against each other.
    float broadFlow = 0.5 + 0.5 * sin(p.x * 3.4 - p.y * 2.8 + t * 0.16);
    float crossFlow = 0.5 + 0.5 * sin(p.x * 5.6 + p.y * 3.2 - t * 0.12);
    vec3 waterA = vec3(0.035, 0.055, 0.30);
    vec3 waterB = vec3(0.20, 0.035, 0.48);
    vec3 waterC = vec3(0.015, 0.48, 0.66);
    vec3 liquidBody = mix(waterA, waterB, broadFlow * 0.66);
    liquidBody = mix(liquidBody, waterC, crossFlow * 0.18 + fresnel * 0.13);

    // Beer-Lambert: the artwork fades as the water in front of it thickens.
    // This is the cue that reads as volume rather than a tinted pane.
    vec3 absorb = exp(-optical * vec3(1.55, 1.15, 0.72));
    vec3 filled = mix(liquidBody, logo, 0.74 * absorb.b + 0.10);
    filled = mix(filled, logo, edge * 0.30 * absorb.g);
    filled *= diffuse;
    filled *= mix(vec3(1.04, 1.02, 1.05), vec3(0.66, 0.76, 0.94), optical);
    filled += vec3(0.30, 0.58, 1.0) * fresnel * 0.16;
    filled += vec3(1.0, 0.94, 1.0) * specular * 0.72;

    // Caustics travel with the surface above them and dim with depth.
    float caustic = sin((refractedUv.x * 31.0 + refractedUv.y * 23.0) + t * 0.42)
                  * sin((refractedUv.x * 17.0 - refractedUv.y * 29.0) - t * 0.28);
    caustic = caustic * 0.5 + 0.5;
    float causticFade = exp(-depthBelow * 3.4);
    filled += vec3(0.16, 0.30, 0.55) * caustic * causticFade * 0.13 * (1.0 - fresnel);

    // Air on its way up.
    float floorY = -SPHERE * 0.96;
    float air = bubbles(p, t, frontSurface - 0.012, floorY) * liquidVolume * insideSurface;
    filled = mix(filled, filled * 1.5 + vec3(0.30, 0.42, 0.55), air * 0.72);

    color = mix(emptyGlass, filled, liquidVolume);

    // ---- the visible top face ----------------------------------------------
    // Procedural liquid only, so crossing the logo cannot duplicate the letters.
    float slope = waveSlope(p.x, t);
    vec3 surfNormal = normalize(vec3(-slope, 1.0, 0.35));
    float surfDiffuse = max(dot(surfNormal, lightDir), 0.0);
    float surfSpec = pow(max(dot(reflect(-lightDir, surfNormal), viewDir), 0.0), 34.0);

    float surfaceCenter = 1.0 - abs(surfacePosition * 2.0 - 1.0);
    float surfaceCaustic = 0.5 + 0.5 * sin(p.x * 25.0 + t * 0.55)
                                     * sin(surfacePosition * 13.0 - t * 0.32);
    float surfaceGlint = pow(max(0.0, 1.0 - abs(normalizedX + 0.23) * 1.35), 10.0)
                       * pow(surfaceCenter, 1.6);
    vec3 surfaceColor = mix(vec3(0.12, 0.08, 0.46), vec3(0.10, 0.58, 0.78),
                            0.32 + 0.28 * broadFlow + 0.18 * surfacePosition);
    surfaceColor *= 0.86 + surfDiffuse * 0.34 + surfacePosition * 0.18;
    surfaceColor += vec3(0.50, 0.77, 1.0) * surfaceCaustic * 0.10;
    surfaceColor += vec3(1.0, 0.96, 1.0) * surfaceGlint * 0.72;
    surfaceColor += vec3(1.0, 0.98, 0.95) * surfSpec * 0.55;
    color = mix(color, surfaceColor, surfaceDisc * 0.86);

    // Back rim, front lip and the shadow the lip casts into the water below it.
    float backRim = exp(-abs(p.y - backSurface) * 135.0) * insideSurface;
    float frontRim = exp(-abs(p.y - frontSurface) * 105.0) * insideSurface;
    float underFront = exp(-abs(p.y - (frontSurface - 0.025)) * 55.0) * insideSurface;
    color += vec3(0.80, 0.93, 1.0) * backRim * 0.40 * activeSurface;
    color += vec3(1.0, 0.98, 1.0) * frontRim * 0.82 * activeSurface;
    color -= vec3(0.07, 0.045, 0.18) * underFront * 0.46 * activeSurface;

    // Where the meniscus climbs the glass it catches a brighter line.
    float wallLine = exp(-abs(p.y - frontSurface) * 70.0) * wall * insideSurface;
    color += vec3(0.85, 0.95, 1.0) * wallLine * 0.35 * activeSurface;

    // Multi-layer glass rim creates real visual thickness around the sphere.
    float outerRim = smoothstep(0.79, SPHERE, radius);
    float rimHighlight = pow(max(dot(normal, lightDir), 0.0), 10.0) * outerRim;
    float rimShadow = pow(max(dot(normal, -lightDir), 0.0), 5.0) * outerRim;
    color += vec3(0.52, 0.72, 1.0) * fresnel * 0.34;
    color += vec3(1.0, 0.94, 1.0) * rimHighlight * 0.42;
    color -= vec3(0.06, 0.05, 0.16) * rimShadow * 0.25;
  }

  // Crisp outer glass edge and a darker rear edge offset give physical thickness.
  float backEdge = smoothstep(0.928, 0.940, radius) * (1.0 - smoothstep(0.940, 0.955, radius));
  float frontEdge = smoothstep(0.910, 0.925, radius) * (1.0 - smoothstep(0.925, 0.937, radius));
  color -= vec3(0.09, 0.08, 0.24) * backEdge * 0.44;
  color += vec3(0.72, 0.86, 1.0) * frontEdge * 0.62;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
