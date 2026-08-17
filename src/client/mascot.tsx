/**
 * 鲸小深 (Jing Xiaoshen) — dsh-replay's mascot, an original whale-catgirl
 * character. When `assets/jingxiaoshen.png` exists at build time it is
 * embedded and used everywhere; otherwise a built-in SVG chibi stands in.
 * Hide globally with:  .dshr-mascot { display: none }
 */
import React from 'react'
import { mascotImage } from './mascot-image.js'

export type MascotMood = 'idle' | 'happy' | 'alert'

const INK = '#233a80'

export function Mascot({
  mood = 'idle',
  size = 88,
}: {
  mood?: MascotMood
  size?: number
}): React.ReactElement {
  if (mascotImage !== undefined) {
    return (
      <img
        className="dshr-mascot"
        src={mascotImage}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover' }}
        alt="鲸小深 Jing Xiaoshen, the dsh-replay mascot"
      />
    )
  }
  const eyes =
    mood === 'happy' ? (
      <g stroke={INK} strokeWidth={3.4} strokeLinecap="round" fill="none">
        <path d="M 53 82 q 8 -9 16 0" />
        <path d="M 91 82 q 8 -9 16 0" />
      </g>
    ) : mood === 'alert' ? (
      <g stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none">
        <path d="M 52 78 l 13 6 l -13 6" />
        <path d="M 108 78 l -13 6 l 13 6" />
      </g>
    ) : (
      <g>
        {/* upper lash lines */}
        <path d="M 50 74 q 11 -7 22 -1" stroke={INK} strokeWidth={3.6} strokeLinecap="round" fill="none" />
        <path d="M 88 73 q 11 -6 22 1" stroke={INK} strokeWidth={3.6} strokeLinecap="round" fill="none" />
        {/* irises */}
        <ellipse cx={61} cy={84} rx={9.5} ry={11.5} fill="url(#dshr-iris)" />
        <ellipse cx={99} cy={84} rx={9.5} ry={11.5} fill="url(#dshr-iris)" />
        {/* pupils + sparkle */}
        <ellipse cx={61} cy={86} rx={4.2} ry={5.4} fill={INK} />
        <ellipse cx={99} cy={86} rx={4.2} ry={5.4} fill={INK} />
        <circle cx={57.5} cy={79.5} r={3.1} fill="#fff" />
        <circle cx={95.5} cy={79.5} r={3.1} fill="#fff" />
        <circle cx={64.5} cy={90} r={1.5} fill="#fff" opacity={0.9} />
        <circle cx={102.5} cy={90} r={1.5} fill="#fff" opacity={0.9} />
      </g>
    )
  return (
    <svg
      className="dshr-mascot"
      width={size}
      height={size}
      viewBox="0 0 160 150"
      role="img"
      aria-label="鲸小深 Jing Xiaoshen, the dsh-replay mascot"
    >
      <defs>
        <linearGradient id="dshr-hair" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#4a6cf0" />
          <stop offset="0.55" stopColor="#2f57c9" />
          <stop offset="1" stopColor="#1e3f9e" />
        </linearGradient>
        <linearGradient id="dshr-hair-lt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f8cf7" />
          <stop offset="1" stopColor="#3a60d4" />
        </linearGradient>
        <radialGradient id="dshr-iris" cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#8fb6ff" />
          <stop offset="0.6" stopColor="#3d6fe0" />
          <stop offset="1" stopColor="#1e3f9e" />
        </radialGradient>
      </defs>

      {/* ==== long back hair (wavy, falls behind shoulders) ==== */}
      <path
        d="M 24 66 Q 20 22 80 20 Q 140 22 136 66
           L 138 96 Q 141 108 134 120 Q 130 110 127 104
           Q 128 122 120 134 Q 116 122 113 114
           Q 111 130 100 140 Q 99 128 97 120
           L 63 120 Q 61 128 60 140 Q 49 130 47 114
           Q 44 122 40 134 Q 32 122 33 104
           Q 30 110 26 120 Q 19 108 22 96 Z"
        fill="url(#dshr-hair)"
      />

      {/* ==== cat ears (on top of hair) ==== */}
      <path d="M 34 44 Q 30 16 44 8 Q 56 18 58 34 Z" fill="url(#dshr-hair-lt)" />
      <path d="M 126 44 Q 130 16 116 8 Q 104 18 102 34 Z" fill="url(#dshr-hair-lt)" />
      <path d="M 40 38 Q 39 22 45 15 Q 52 22 53 32 Z" fill="#ffc9d6" />
      <path d="M 120 38 Q 121 22 115 15 Q 108 22 107 32 Z" fill="#ffc9d6" />

      {/* ==== maid frill headband ==== */}
      <path
        d="M 38 40 Q 42 30 52 28 Q 54 34 60 32 Q 60 26 70 24 Q 73 30 80 29
           Q 87 30 90 24 Q 100 26 100 32 Q 106 34 108 28 Q 118 30 122 40
           Q 112 36 80 35 Q 48 36 38 40 Z"
        fill="#ffffff"
        stroke="#dfe3f2"
        strokeWidth={1}
      />

      {/* ==== face ==== */}
      <path
        d="M 36 76 Q 36 44 80 42 Q 124 44 124 76 Q 124 104 80 108 Q 36 104 36 76 Z"
        fill="#ffeee6"
      />

      {/* ==== bangs — pointed anime locks sweeping over the forehead ==== */}
      <path
        d="M 34 76 Q 33 40 80 38 Q 127 40 126 76
           Q 121 68 117 60 Q 114 72 108 78 Q 104 64 100 58 Q 96 72 88 78 Q 84 62 80 56
           Q 76 62 72 78 Q 64 72 60 58 Q 56 64 52 78 Q 46 72 43 60 Q 39 68 34 76 Z"
        fill="url(#dshr-hair)"
      />
      {/* lock highlights following the strands */}
      <path d="M 66 46 Q 68 56 72 66" stroke="#7f9bf9" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.65} />
      <path d="M 94 46 Q 92 56 88 66" stroke="#7f9bf9" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.65} />

      {/* ==== ahoge ==== */}
      <path d="M 76 22 Q 70 6 88 4 Q 78 10 84 20 Z" fill="url(#dshr-hair-lt)" />

      {/* ==== side locks framing the face ==== */}
      <path d="M 34 66 Q 28 88 34 110 Q 40 104 41 92 Q 44 78 40 64 Z" fill="url(#dshr-hair-lt)" />
      <path d="M 126 66 Q 132 88 126 110 Q 120 104 119 92 Q 116 78 120 64 Z" fill="url(#dshr-hair-lt)" />

      {/* ==== whale-tail hair ornament (clipped onto the side lock) ==== */}
      <g transform="translate(118, 62) rotate(24)">
        <path d="M 0 9 Q 9 -3 16 2 Q 11 5 11 9 Q 18 6 23 11 Q 14 16 5 14 Q 1 12 0 9 Z" fill="#a9c6ff" stroke="#5b7dff" strokeWidth={1.4} />
      </g>

      {eyes}

      {/* blush */}
      <ellipse cx={48} cy={94} rx={6.5} ry={3.2} fill="#ffa8bb" opacity={0.6} />
      <ellipse cx={112} cy={94} rx={6.5} ry={3.2} fill="#ffa8bb" opacity={0.6} />

      {/* cat mouth (w) / open smile per mood */}
      {mood === 'alert' ? (
        <ellipse cx={80} cy={99} rx={4} ry={5} fill="#e26a7d" />
      ) : (
        <path
          d="M 73 97 q 3.5 4 7 0 q 3.5 4 7 0"
          stroke={INK}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* ==== shoulders: navy maid dress + white apron bib ==== */}
      <path d="M 52 116 Q 80 108 108 116 L 116 140 Q 80 148 44 140 Z" fill="#20388f" />
      <path d="M 66 118 Q 80 112 94 118 L 97 140 Q 80 145 63 140 Z" fill="#ffffff" />
      <path d="M 66 118 Q 80 112 94 118" stroke="#dfe3f2" strokeWidth={1.4} fill="none" />
      {/* tiny bow at the collar */}
      <path d="M 80 114 l -7 -4 q -2 4 0 8 Z" fill="#4a6cf0" />
      <path d="M 80 114 l 7 -4 q 2 4 0 8 Z" fill="#4a6cf0" />
      <circle cx={80} cy={114} r={2.2} fill="#2f57c9" />
    </svg>
  )
}

export function MascotState({
  mood,
  text,
  size = 110,
}: {
  mood: MascotMood
  text: string
  size?: number
}): React.ReactElement {
  return (
    <div className="dshr-center dshr-mascot-state">
      <div>
        <Mascot mood={mood} size={size} />
        <div className="dshr-mascot-text">{text}</div>
      </div>
    </div>
  )
}
