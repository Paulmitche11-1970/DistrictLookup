import styles from '@/app/rpdata/page.module.css';
export function DataLandscape() {
  return (
    <div className={styles.landscape} aria-hidden="true">
      <div className={styles.figureHeading}>
        <span>People × Place × Possibility</span>
        <span>RP / DATA</span>
      </div>
      <svg viewBox="0 0 520 450" fill="none">
        <defs>
          <pattern
            id="rp-grid"
            width="26"
            height="26"
            patternUnits="userSpaceOnUse"
          >
            <path d="M26 0H0V26" stroke="#355d61" strokeWidth=".6" />
          </pattern>
          <linearGradient
            id="rp-water"
            x1="0"
            y1="0"
            x2="520"
            y2="450"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#467f80" />
            <stop offset="1" stopColor="#24494e" />
          </linearGradient>
        </defs>
        <rect width="520" height="450" fill="url(#rp-grid)" />
        <path
          d="M302 -20C190 55 390 90 276 172S341 286 210 342S170 399 203 470H285C258 409 301 397 315 366S415 325 393 271S340 215 394 169S334 89 359 34Z"
          fill="url(#rp-water)"
        />
        <g stroke="#bdd5c5" strokeWidth="2" strokeLinejoin="round">
          <path
            d="M55 88L151 51L219 73L248 143L196 186L94 169Z"
            fill="#719e8c"
          />
          <path
            d="M94 169L196 186L231 244L191 293L106 305L56 255Z"
            fill="#d2c99c"
          />
          <path
            d="M151 51L265 45L302 85L275 120L248 143L219 73Z"
            fill="#c4d5c6"
          />
          <path
            d="M106 305L191 293L218 326L202 370L238 410L129 394L69 343Z"
            fill="#527e73"
          />
          <path
            d="M349 161L426 133L471 192L445 253L363 231L326 191Z"
            fill="#91aba0"
          />
          <path d="M363 231L445 253L463 320L399 356L338 311Z" fill="#b6c48e" />
        </g>
        <g stroke="#f3ead1" strokeWidth="1" opacity=".5">
          <path d="M27 128L483 308M36 292L437 75M139 22L391 424M72 352L430 381" />
        </g>
        <g fill="#f3e9cf" stroke="#183e43" strokeWidth="5">
          <circle cx="142" cy="129" r="8" />
          <circle cx="157" cy="242" r="8" />
          <circle cx="224" cy="85" r="6" />
          <circle cx="159" cy="352" r="6" />
          <circle cx="403" cy="201" r="8" />
          <circle cx="410" cy="300" r="6" />
        </g>
        <circle
          cx="157"
          cy="242"
          r="26"
          stroke="#f2dfb1"
          strokeWidth="1"
          opacity=".65"
        />
      </svg>
      <div className={styles.figureFooter}>
        <span>See the connections.</span>
        <span>Make the next move.</span>
      </div>
    </div>
  );
}
