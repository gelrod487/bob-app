// Wires up click-to-talk on the top-left Bob icon (present on every page). Returns a `say`
// function so page scripts can also have Bob comment on what just happened (e.g. "Case
// added!") instead of only reacting to clicks.
function wireMascot(wrapId, lines) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return () => {};

  let bubble = wrap.querySelector('.mascot-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'mascot-bubble';
    wrap.appendChild(bubble);
  }

  function say(text) {
    bubble.textContent = text;
    wrap.classList.add('talk');
    clearTimeout(wrap._mascotTimer);
    wrap._mascotTimer = setTimeout(() => wrap.classList.remove('talk'), 3200);
  }

  wrap.addEventListener('click', () => say(lines[Math.floor(Math.random() * lines.length)]));
  return say;
}
