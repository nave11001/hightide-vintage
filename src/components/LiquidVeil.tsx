import { useEffect, useRef } from 'react';
import logoUrl from '@/assets/logo-loader.webp';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './liquidShader';

// The screen shown while the shop is still coming up: the brand mark as a glass
// sphere filling with liquid, where the level is the real load progress.
//
// It is deliberately hard to make this screen the problem. It never mounts on a
// fast load, it needs no network of its own beyond a 41KB texture, and if WebGL
// is missing or the shader will not compile it draws a plain bar instead. A
// loading screen that can fail is worse than the wait it covers.
//
// The texture is assets/logo-loader.webp, not assets/logo.png: that file stores
// a grey checkerboard in its colour channels under its alpha, and a shader that
// samples .rgb renders it. See scripts/make_loader_texture.py.

interface LiquidVeilProps {
  /** 0 to 1. Drives the liquid level, not a clock. */
  progress: number;
  /** The catalogue could not be loaded and there was nothing cached. */
  failed?: boolean;
  onRetry?: () => void;
}

export default function LiquidVeil({ progress, failed = false, onRetry }: LiquidVeilProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  // Read by the render loop every frame, so a new progress never restarts it.
  const level = useRef(progress);
  level.current = progress;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;

    const gl = el.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false });
    if (!gl) return; // the bar underneath is already showing

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('liquid veil shader', gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('liquid veil link', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'uTime');
    const uFill = gl.getUniformLocation(program, 'uFill');
    const uPointer = gl.getUniformLocation(program, 'uPointer');
    const uTexel = gl.getUniformLocation(program, 'uTexel');
    const uLogo = gl.getUniformLocation(program, 'uLogo');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let frame = 0;
    let shown = 0; // eases toward level.current so a jump to 70% pours rather than snaps

    const image = new Image();
    image.onload = () => {
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.uniform1i(uLogo, 0);
      gl.uniform2f(uTexel, 1 / image.width, 1 / image.height);
      el.style.opacity = '1';

      const draw = (now: number) => {
        const side = Math.max(
          1,
          Math.round(Math.min(el.clientWidth, el.clientHeight) * Math.min(devicePixelRatio, 2)),
        );
        if (el.width !== side || el.height !== side) {
          el.width = side;
          el.height = side;
          gl.viewport(0, 0, side, side);
        }
        shown += (level.current - shown) * 0.055;
        // Frozen waves under reduced-motion; the level still moves, because that
        // is information rather than decoration.
        gl.uniform1f(uTime, reduced ? 2.4 : (now - start) / 1000);
        gl.uniform1f(uFill, shown);
        gl.uniform2f(uPointer, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    };
    image.src = logoUrl;

    return () => cancelAnimationFrame(frame);
  }, []);

  // Nothing behind this is readable, so nothing behind it should scroll.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // The bar is the floor: it is what a browser without WebGL is left with, and
  // it keeps moving even before the texture has arrived.
  useEffect(() => {
    if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0.02, progress)})`;
  }, [progress]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center gap-6 px-6"
      dir="rtl"
      role="status"
      aria-live="polite"
      id="liquid-veil"
    >
      <canvas
        ref={canvas}
        aria-hidden="true"
        className="block w-[min(64vmin,420px)] h-[min(64vmin,420px)] opacity-0 transition-opacity duration-500"
      />

      <div className="w-[min(64vmin,420px)] max-w-full">
        <div className="h-[2px] bg-stone-200 overflow-hidden">
          <div
            ref={bar}
            className="h-full bg-stone-900 origin-right transition-transform duration-500 ease-out"
            style={{ transform: 'scaleX(0.02)' }}
          />
        </div>
      </div>

      {failed ? (
        <div className="text-center max-w-sm">
          <p className="text-base font-medium text-stone-900">לא הצלחנו לטעון את המלאי</p>
          <p className="text-sm text-stone-500 mt-1">
            כנראה תקלה זמנית בחיבור. אפשר לנסות שוב.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 px-6 py-2 bg-stone-900 text-white border border-stone-900 cursor-pointer"
          >
            נסו שוב
          </button>
        </div>
      ) : (
        <p className="text-xs text-stone-400 tracking-widest uppercase font-mono">טוען מלאי…</p>
      )}
    </div>
  );
}
