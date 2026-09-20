// Bob, built as inline SVG (not an <img src>) so the page's own CSS can animate his eyes
// (blink) in addition to the whole-figure idle bounce, and so he stays crisp at any size
// with no extra network request. Each mounted copy gets its own gradient/filter IDs
// (suffixed with a unique instance number) since SVG ids are unique per-document, not
// scoped to whichever inline <svg> they're declared in — two copies on one page (e.g. the
// homepage's nav icon + hero image) would otherwise fight over the same ids.
let mascotInstanceCount = 0;

function mascotMarkup(uid) {
  return `
<svg class="mascot-svg mascot-sway" viewBox="0 0 160 210" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="coverGrad-${uid}" x1="0.1" y1="0" x2="0.95" y2="1">
      <stop offset="0%" stop-color="#A5303A"/>
      <stop offset="30%" stop-color="#8C1F2A"/>
      <stop offset="75%" stop-color="#711A24"/>
      <stop offset="100%" stop-color="#5C121A"/>
    </linearGradient>
    <linearGradient id="spineGrad-${uid}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4A0F17"/>
      <stop offset="45%" stop-color="#6E1820"/>
      <stop offset="100%" stop-color="#7E1E27"/>
    </linearGradient>
    <linearGradient id="limbGrad-${uid}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#9C2730"/>
      <stop offset="100%" stop-color="#711A24"/>
    </linearGradient>
    <linearGradient id="gold-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FBE6AE"/>
      <stop offset="50%" stop-color="#EAB350"/>
      <stop offset="100%" stop-color="#B57A22"/>
    </linearGradient>
    <linearGradient id="legGrad-${uid}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#D98CA0"/>
      <stop offset="100%" stop-color="#C06B82"/>
    </linearGradient>
    <radialGradient id="pageLight-${uid}" cx="26%" cy="16%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity=".32"/>
      <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ao-${uid}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3A0B10" stop-opacity=".45"/>
      <stop offset="100%" stop-color="#3A0B10" stop-opacity="0"/>
    </radialGradient>
    <filter id="blurSm-${uid}" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.2"/>
    </filter>
    <filter id="blurLg-${uid}" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>

  <ellipse cx="82" cy="201" rx="38" ry="6.5" fill="#3A0B10" opacity=".22" filter="url(#blurLg-${uid})"/>

  <!-- back arm (waving) -->
  <g>
    <path d="M110 98 Q140 85 138 56" stroke="url(#limbGrad-${uid})" stroke-width="13" fill="none" stroke-linecap="round"/>
    <circle cx="138" cy="55" r="9" fill="url(#limbGrad-${uid})"/>
    <ellipse cx="112" cy="98" rx="7" ry="6" fill="url(#ao-${uid})" filter="url(#blurSm-${uid})"/>
    <animateTransform attributeName="transform" type="rotate" additive="sum"
      values="0 110 98; -14 110 98; 10 110 98; -11 110 98; 0 110 98"
      keyTimes="0; 0.25; 0.55; 0.8; 1" dur="1.9s" repeatCount="indefinite"
      calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1; 0.45 0 0.55 1; 0.45 0 0.55 1"/>
  </g>

  <!-- front arm (resting near hip) -->
  <path d="M45 108 Q28 121 34 140" stroke="url(#limbGrad-${uid})" stroke-width="13" fill="none" stroke-linecap="round"/>
  <circle cx="34" cy="141" r="9" fill="url(#limbGrad-${uid})"/>
  <ellipse cx="47" cy="107" rx="7" ry="6" fill="url(#ao-${uid})" filter="url(#blurSm-${uid})"/>

  <!-- short, stubby legs -->
  <ellipse cx="63" cy="177" rx="8.5" ry="5" fill="url(#ao-${uid})" filter="url(#blurSm-${uid})"/>
  <ellipse cx="93" cy="177" rx="8.5" ry="5" fill="url(#ao-${uid})" filter="url(#blurSm-${uid})"/>
  <rect x="55" y="176" width="15" height="20" rx="7" fill="url(#legGrad-${uid})"/>
  <rect x="86" y="176" width="15" height="20" rx="7" fill="url(#legGrad-${uid})"/>
  <ellipse cx="62" cy="197" rx="10" ry="4.5" fill="#4A2126"/>
  <ellipse cx="93" cy="197" rx="10" ry="4.5" fill="#4A2126"/>

  <!-- cream page edges, right side -->
  <rect x="118" y="50" width="9" height="120" rx="2" fill="#F5ECD9"/>
  <rect x="120" y="54" width="1" height="112" fill="#DFCBA6"/>
  <rect x="122.5" y="54" width="1" height="112" fill="#DFCBA6"/>
  <rect x="125" y="54" width="1" height="112" fill="#DFCBA6"/>

  <!-- spine, left side -->
  <path d="M42 46 Q31 50 31 60 L31 158 Q31 168 42 172 Z" fill="url(#spineGrad-${uid})"/>
  <path d="M33 84 H41" stroke="#8C2A34" stroke-width="1.3" opacity=".5"/>
  <path d="M33 120 H41" stroke="#8C2A34" stroke-width="1.3" opacity=".5"/>
  <path d="M33 144 H41" stroke="#8C2A34" stroke-width="1.3" opacity=".5"/>

  <!-- front cover -->
  <rect x="38" y="42" width="82" height="132" rx="12" fill="url(#coverGrad-${uid})"/>
  <rect x="46" y="50" width="66" height="116" rx="6" fill="none" stroke="url(#gold-${uid})" stroke-width="2"/>
  <rect x="38" y="42" width="82" height="132" rx="12" fill="url(#pageLight-${uid})"/>

  <!-- gold seal -->
  <circle cx="95" cy="141" r="11.5" fill="url(#gold-${uid})"/>
  <circle cx="95" cy="141" r="11.5" fill="none" stroke="#8A5A14" stroke-width=".8" opacity=".5"/>
  <circle cx="91.5" cy="137.5" r="2" fill="#FFF6DD" opacity=".6"/>

  <!-- face: large round eyes that blink, rosy cheeks, warm smile -->
  <g class="mascot-eye">
    <ellipse cx="61" cy="90" rx="6.4" ry="7.6" fill="#FBEFE4"/>
    <circle cx="62.2" cy="92" r="3.6" fill="#2B1013"/>
    <circle cx="63.6" cy="90" r="1.1" fill="#FFFFFF"/>
  </g>
  <g class="mascot-eye">
    <ellipse cx="91" cy="90" rx="6.4" ry="7.6" fill="#FBEFE4"/>
    <circle cx="92.2" cy="92" r="3.6" fill="#2B1013"/>
    <circle cx="93.6" cy="90" r="1.1" fill="#FFFFFF"/>
  </g>
  <ellipse cx="55" cy="103" rx="6" ry="3.8" fill="#E8798F" opacity=".55"/>
  <ellipse cx="97" cy="103" rx="6" ry="3.8" fill="#E8798F" opacity=".55"/>
  <path d="M58 108 Q76.5 121 95 108" stroke="#4A0F17" stroke-width="2.8" fill="none" stroke-linecap="round"/>
</svg>`;
}

// Mounts a fresh Bob into `containerId` (sized via that element's own CSS width/height —
// set it inline or in a stylesheet before calling this) and wires click-to-talk. Returns a
// `say` function so page scripts can also have Bob comment on what just happened.
function wireMascot(wrapId, lines) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return () => {};

  mascotInstanceCount += 1;
  wrap.innerHTML = mascotMarkup(mascotInstanceCount) + '<div class="mascot-bubble"></div>';
  wrap.classList.add('mascot-wrap');

  const bubble = wrap.querySelector('.mascot-bubble');
  function say(text) {
    bubble.textContent = text;
    wrap.classList.add('talk');
    clearTimeout(wrap._mascotTimer);
    wrap._mascotTimer = setTimeout(() => wrap.classList.remove('talk'), 3200);
  }

  wrap.addEventListener('click', () => say(lines[Math.floor(Math.random() * lines.length)]));
  return say;
}
