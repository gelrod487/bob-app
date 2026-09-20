// Bob, rendered from a real illustrated image (public/img/bob-mascot.png) rather than
// hand-coded shapes — flat SVG gradients can't fake real leather texture and lighting.
// The whole image gets the idle sway; the speech bubble is a plain overlay div.
function wireMascot(wrapId, lines) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return () => {};

  wrap.innerHTML = '<img class="mascot-img mascot-sway" src="/img/bob-mascot.png" alt="Bob">'
    + '<div class="mascot-bubble"></div>';
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
