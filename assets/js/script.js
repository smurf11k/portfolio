function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function flipCard(card) {
  card.classList.toggle("flipped");
}

async function loadSkills() {
  const res = await fetch("assets/json/skills.json");
  if (!res.ok) throw new Error(`Failed to load skills.json: ${res.status}`);
  return await res.json();
}

function createCard(skill, cornerText) {
  const card = document.createElement("div");
  card.className = "card";

  // flip on click (but allow link clicks)
  card.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    flipCard(card);
  });

  const linksHtml = (skill.links || [])
    .map(
      (l) =>
        `<a href="${l.url}" target="_blank" rel="noreferrer">${l.label}</a>`,
    )
    .join("");

  card.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-front" data-corner="${cornerText}">
        <h3>${skill.title}</h3>
      </div>
      <div class="card-face card-back" data-corner="${cornerText}">
        <div class="links">
          ${linksHtml || '<span style="color: rgba(255,255,255,.7)">No links yet</span>'}
        </div>
      </div>
    </div>
  `;

  return card;
}

/**
 * Animates side cards based on intro progress p (0..1)
 * - cards reveal between start..end
 * - left pair slides from left, right pair from right
 */
function animateSideCards(leftCards, rightCards, p) {
  const isMobile = window.matchMedia("(max-width: 600px)").matches;

  const start = 0.25;
  const end = isMobile ? 0.42 : 0.95;

  const t = clamp((p - start) / (end - start), 0, 1);

  const leftWrap = document.getElementById("cardsLeft");
  const rightWrap = document.getElementById("cardsRight");

  const visible = p > start;
  leftWrap.classList.toggle("show", visible);
  rightWrap.classList.toggle("show", visible);

  const finalAnglesLeft = [-45, 75];
  const finalAnglesRight = [-45, 45];

  function animatePair(cards, dir /* -1 left, +1 right */, finalAngles) {
    cards.forEach((card, i) => {
      const stagger = i * 0.1;
      const tt = clamp(t - stagger, 0, 1);

      //card.style.opacity = tt.toFixed(3);

      const dist = (1 - tt) * 100;

      const startExtraTilt = dir * 20;
      const angle = (1 - tt) * startExtraTilt + tt * finalAngles[i];

      card.style.transform = `translate3d(${dir * dist}px, 0, 0) rotate(${angle}deg)`;
    });
  }

  animatePair(leftCards, -1, finalAnglesLeft);
  animatePair(rightCards, 1, finalAnglesRight);
}

async function init() {
  const intro = document.querySelector(".intro-stage");
  const leftWrap = document.getElementById("cardsLeft");
  const rightWrap = document.getElementById("cardsRight");

  if (!intro || !leftWrap || !rightWrap) {
    console.error("Missing intro-stage / cardsLeft / cardsRight in HTML.");
    return;
  }

  const skills = await loadSkills();

  const desiredOrder = [
    "3D design and animation",
    "coding",
    "photography",
    "cinematography",
  ];

  const ordered = skills
    .slice()
    .sort(
      (a, b) => desiredOrder.indexOf(a.title) - desiredOrder.indexOf(b.title),
    );

  const leftCards = [createCard(ordered[0], "♦"), createCard(ordered[1], "♠")];

  const rightCards = [createCard(ordered[2], "♥"), createCard(ordered[3], "♣")];

  leftCards.forEach((c) => leftWrap.appendChild(c));
  rightCards.forEach((c) => rightWrap.appendChild(c));

  const titleRots = ["95deg", "-75deg", "110deg", "-65deg"];
  [...leftCards, ...rightCards].forEach((card, i) => {
    card.style.setProperty("--title-rot", titleRots[i]);
  });

  leftCards[0].style.setProperty("--suit-color", "#b72222"); // card 1
  rightCards[0].style.setProperty("--suit-color", "#b72222"); // card 3

  let targetP = 0;
  let currentP = 0;
  let rafId = null;

  function readScrollP() {
    const rect = intro.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return 0;
    return clamp(-rect.top / scrollable, 0, 1);
  }

  function onScrollOrResize() {
    targetP = readScrollP();
    window.__targetP = targetP; // so animateSideCards can use it immediately
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    const delta = targetP - currentP;
    const abs = Math.abs(delta);

    // Adaptive smoothing:
    let k;
    if (delta < 0) {
      k = 0.45; // fast catch-up when scrolling back up
    } else {
      // down: smoother near target, faster when far away
      k = abs > 0.08 ? 0.22 : 0.12;
    }

    currentP += delta * k;

    // snap very close (kills micro-lag)
    if (abs < 0.001) currentP = targetP;

    document.documentElement.style.setProperty("--p", currentP.toFixed(4));
    animateSideCards(leftCards, rightCards, currentP);

    // keep animating until we catch up
    if (currentP !== targetP) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize);
  onScrollOrResize();
}

init().catch(console.error);

const scrollHint = document.querySelector(".scroll-hint");

window.addEventListener("scroll", () => {
  if (window.scrollY > 1) {
    scrollHint.style.opacity = "0";
  } else {
    scrollHint.style.opacity = "1";
  }
});
